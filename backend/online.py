import hashlib
import re
import secrets
from threading import Lock
import time

from flask import jsonify, request

LINES = ((0,1,2),(3,4,5),(6,7,8),(0,3,6),(1,4,7),(2,5,8),(0,4,8),(2,4,6))
ROOM_TTL = 7200


def register_online(app):
    rooms = {}
    lock = Lock()

    def owner():
        return hashlib.sha256(request.headers['Authorization'].encode()).hexdigest()

    def name(value):
        if not isinstance(value, str) or len(value) > 24 or any(ord(c) < 32 for c in value):
            return None
        return value.strip()

    def snapshot(room, player):
        now = time.monotonic()
        room['seen'][player] = now
        return jsonify(roomId=room['id'], player=player, board=room['board'], names=room['names'],
                       scores=room['scores'], round=room['round'], currentPlayer=room['turn'],
                       result=room['result'], lastMove=room['last'], revision=room['revision'],
                       targetWins=room['target'], joined=room['keys']['O'] is not None,
                       opponentOnline=now - room['seen']['O' if player == 'X' else 'X'] < 20)

    @app.get('/health')
    def health():
        return jsonify(status='ok')

    @app.route('/api/rooms', methods=['POST'])
    @app.route('/api/rooms/<room_id>', methods=['GET'])
    @app.route('/api/rooms/<room_id>/<action>', methods=['POST'])
    def online(room_id=None, action=None):
        body = request.get_json() if request.method == 'POST' and request.is_json else None
        if request.method == 'POST' and not isinstance(body, dict):
            return jsonify(error='invalid_request'), 400
        now = time.monotonic()
        with lock:
            for expired in [key for key, room in rooms.items() if now - room['created'] >= ROOM_TTL]:
                del rooms[expired]
            if room_id is None:
                player_name = name(body.get('name'))
                if set(body) != {'name', 'targetWins'} or player_name is None or type(body.get('targetWins')) is not int or body['targetWins'] not in (0, 3):
                    return jsonify(error='invalid_request'), 400
                if len(rooms) >= 100:
                    return jsonify(error='rooms_full'), 503
                room_id = secrets.token_hex(16)
                room = {'id': room_id, 'created': now, 'keys': {'X': owner(), 'O': None},
                        'seen': {'X': now, 'O': -float('inf')}, 'names': {'X': player_name, 'O': ''},
                        'board': [None] * 9, 'turn': 'X', 'round': 1, 'scores': {'X': 0, 'O': 0, 'draw': 0},
                        'result': None, 'last': None, 'revision': 0, 'target': body['targetWins']}
                rooms[room_id] = room
                return snapshot(room, 'X'), 201
            if not re.fullmatch('[0-9a-f]{32}', room_id) or room_id not in rooms:
                return jsonify(error='room_missing'), 404
            room = rooms[room_id]
            key = owner()
            player = next((p for p in ('X', 'O') if room['keys'][p] == key), None)
            if action == 'join':
                player_name = name(body.get('name'))
                if set(body) != {'name'} or player_name is None:
                    return jsonify(error='invalid_request'), 400
                if player is not None:
                    return snapshot(room, player)
                if room['keys']['O'] is not None:
                    return jsonify(error='room_full'), 409
                room['keys']['O'] = key
                room['names']['O'] = player_name
                room['revision'] += 1
                return snapshot(room, 'O')
            if player is None:
                return jsonify(error='unauthorized'), 403
            if request.method == 'GET':
                return snapshot(room, player)
            if action not in ('move', 'round') or set(body) != ({'revision', 'index'} if action == 'move' else {'revision'}):
                return jsonify(error='invalid_request'), 400
            if type(body['revision']) is not int or body['revision'] != room['revision']:
                return jsonify(error='conflict'), 409
            if room['keys']['O'] is None:
                return jsonify(error='waiting'), 409
            if action == 'move':
                index = body['index']
                if type(index) is not int or not 0 <= index < 9:
                    return jsonify(error='invalid_request'), 400
                if room['turn'] != player or room['result'] is not None or room['board'][index] is not None:
                    return jsonify(error='invalid_move'), 409
                room['board'][index] = player
                room['last'] = index
                if any(all(room['board'][i] == player for i in line) for line in LINES):
                    room['result'] = player
                elif None not in room['board']:
                    room['result'] = 'draw'
                if room['result']:
                    room['scores'][room['result']] += 1
                else:
                    room['turn'] = 'O' if player == 'X' else 'X'
            else:
                if room['result'] is None:
                    return jsonify(error='round_active'), 409
                if room['target'] and max(room['scores']['X'], room['scores']['O']) >= room['target']:
                    room['scores'] = {'X': 0, 'O': 0, 'draw': 0}
                    room['round'] = 1
                else:
                    room['round'] += 1
                room['turn'] = 'X' if room['round'] % 2 else 'O'
                room['board'] = [None] * 9
                room['result'] = room['last'] = None
            room['revision'] += 1
            return snapshot(room, player)
