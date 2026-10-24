"""Same-origin API and frontend for anonymous, browser-owned game saves."""
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
from threading import Lock
import time

from flask import Flask, jsonify, request, send_from_directory
from werkzeug.exceptions import HTTPException

LINES = ((0,1,2),(3,4,5),(6,7,8),(0,3,6),(1,4,7),(2,5,8),(0,4,8),(2,4,6))


def validate_state(data):
    if not isinstance(data, dict) or not {"board", "startingPlayer", "round", "scores"} <= set(data) or set(data) - {"board", "startingPlayer", "round", "scores", "mode", "settings"}:
        return False
    if data.get("mode", "local") not in ("single", "local"):
        return False
    if "settings" in data:
        settings = data["settings"]
        if not isinstance(settings, dict) or set(settings) != {"names", "difficulty", "targetWins", "lastMove"}:
            return False
        names = settings["names"]
        if not isinstance(names, dict) or set(names) != {"X", "O"} or any(not isinstance(name, str) or len(name) > 24 for name in names.values()):
            return False
        if settings["difficulty"] not in ("easy", "medium", "hard") or type(settings["targetWins"]) is not int or settings["targetWins"] not in (0, 3):
            return False
        last = settings["lastMove"]
        if last is not None and (type(last) is not int or not 0 <= last < 9):
            return False
    board, starter, round_number, scores = (data[k] for k in ("board", "startingPlayer", "round", "scores"))
    if not isinstance(board, list) or len(board) != 9 or any(c not in (None, "X", "O") for c in board):
        return False
    if type(round_number) is not int or not 1 <= round_number <= 1000000:
        return False
    if starter != ("X" if round_number % 2 else "O"):
        return False
    if not isinstance(scores, dict) or set(scores) != {"X", "O", "draw"}:
        return False
    if any(type(v) is not int or not 0 <= v <= round_number for v in scores.values()):
        return False
    other = "O" if starter == "X" else "X"
    if board.count(starter) - board.count(other) not in (0, 1):
        return False
    winners = {board[a] for a,b,c in LINES if board[a] is not None and board[a] == board[b] == board[c]}
    if len(winners) > 1:
        return False
    if winners:
        winner = next(iter(winners))
        if board.count(starter) - board.count(other) != (1 if winner == starter else 0):
            return False
        # There must be a possible final winning move; play stops at the first win.
        if not any(not any(all((None if j == i else board[j]) == winner for j in line) for line in LINES)
                   for i, cell in enumerate(board) if cell == winner):
            return False
        if scores[winner] < 1:
            return False
    finished = bool(winners) or None not in board
    if not winners and finished and scores["draw"] < 1:
        return False
    return sum(scores.values()) <= round_number - (0 if finished else 1)


def create_app(database=None, frontend=None):
    app = Flask(__name__, static_folder=None)
    app.config.update(MAX_CONTENT_LENGTH=4096, DATABASE=str(database or os.environ.get("GAME_DATABASE", Path(__file__).parent / "instance" / "games.sqlite3")))
    frontend = Path(frontend or os.environ.get("GAME_FRONTEND", Path(__file__).parent.parent / "frontend" / "dist" / "frontend" / "browser"))
    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)
    with closing(sqlite3.connect(app.config["DATABASE"])) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS saves (owner TEXT PRIMARY KEY, state TEXT NOT NULL, revision INTEGER NOT NULL, updated INTEGER NOT NULL)")
    rates, lock = {}, Lock()

    @app.before_request
    def protect_api():
        if not request.path.startswith("/api/"):
            return None
        # No forwarded IP headers are trusted. Configure a reverse proxy explicitly before deployment.
        address = request.remote_addr or "unknown"
        now = time.monotonic()
        with lock:
            bucket = rates.get(address)
            if bucket is None or now - bucket[0] >= 60:
                if len(rates) >= 1024:
                    rates.pop(next(iter(rates)))
                rates[address] = [now, 1]
            elif bucket[1] >= 60:
                return jsonify(error="rate_limit"), 429
            else:
                bucket[1] += 1
        # Browser-generated bearer capability: never sent in URLs or stored in the database.
        if not re.fullmatch(r"Bearer [0-9a-f]{64}", request.headers.get("Authorization", "")):
            return jsonify(error="unauthorized"), 401

    @app.after_request
    def headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        if request.path.startswith("/api/") or request.path == "/config.json":
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        return jsonify(error=error.name.lower().replace(" ", "_")), error.code

    @app.errorhandler(sqlite3.Error)
    def database_error(error):
        app.logger.error("Game storage unavailable (%s)", type(error).__name__)
        return jsonify(error="storage_unavailable"), 503

    @app.get("/config.json")
    def config():
        return jsonify(serverStorage=True)

    @app.route("/api/state", methods=["GET", "PUT"])
    def state():
        owner = hashlib.sha256(request.headers["Authorization"].encode()).hexdigest()
        with closing(sqlite3.connect(app.config["DATABASE"], timeout=5)) as db, db:
            if request.method == "GET":
                row = db.execute("SELECT state, revision FROM saves WHERE owner=?", (owner,)).fetchone()
                return (jsonify(state=json.loads(row[0]), revision=row[1]) if row else (jsonify(error="not_found"), 404))
            if not request.is_json:
                return jsonify(error="json_required"), 415
            body = request.get_json()
            if not isinstance(body, dict) or set(body) != {"state", "revision"} or type(body["revision"]) is not int or body["revision"] < 0 or not validate_state(body["state"]):
                return jsonify(error="invalid_state"), 400
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT revision FROM saves WHERE owner=?", (owner,)).fetchone()
            revision = row[0] if row else 0
            if revision != body["revision"]:
                return jsonify(error="conflict"), 409
            if row is None and db.execute("SELECT COUNT(*) FROM saves").fetchone()[0] >= 10000:
                return jsonify(error="storage_full"), 503
            db.execute("INSERT INTO saves VALUES (?, ?, ?, ?) ON CONFLICT(owner) DO UPDATE SET state=excluded.state, revision=excluded.revision, updated=excluded.updated",
                       (owner, json.dumps(body["state"]), revision + 1, int(time.time())))
            return jsonify(revision=revision + 1)

    @app.get("/")
    def index():
        return send_from_directory(frontend, "index.html")

    @app.get("/<path:filename>")
    def assets(filename):
        return send_from_directory(frontend, filename)

    return app
