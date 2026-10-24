from contextlib import closing
from pathlib import Path
import secrets
import sqlite3
import tempfile
import unittest

from app import LINES, create_app, validate_state


def empty_state():
    return {"board": [None] * 9, "startingPlayer": "X", "round": 1, "scores": {"X": 0, "O": 0, "draw": 0}}


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "games.sqlite3"
        self.app = create_app(self.database, self.temp.name)
        self.app.testing = True
        self.client = self.app.test_client()
        self.token = secrets.token_hex(32)
        self.headers = {"Authorization": "Bearer " + self.token}

    def tearDown(self):
        self.temp.cleanup()

    def save(self, state=None, revision=0):
        return self.client.put('/api/state', json={"state": state or empty_state(), "revision": revision}, headers=self.headers)

    def test_save_survives_application_restart_and_token_is_hashed(self):
        state = empty_state()
        state['board'][4] = 'X'
        self.assertEqual(self.save(state).status_code, 200)
        restarted = create_app(self.database, self.temp.name).test_client()
        response = restarted.get('/api/state', headers=self.headers)
        self.assertEqual(response.json, {"state": state, "revision": 1})
        with closing(sqlite3.connect(self.database)) as db:
            owner = db.execute('SELECT owner FROM saves').fetchone()[0]
        self.assertNotEqual(owner, self.token)

    def test_game_mode_roundtrip_and_validation(self):
        state = {**empty_state(), 'mode': 'single'}
        self.assertEqual(self.save(state).status_code, 200)
        self.assertEqual(self.client.get('/api/state', headers=self.headers).json['state'], state)
        for mode in ('invalid', None, {}, []):
            self.assertEqual(self.save({**state, 'mode': mode}, 1).status_code, 400)

    def test_settings_roundtrip_and_invalid_values(self):
        settings = {"names": {"X": "Alex", "O": "Sam"}, "difficulty": "medium", "targetWins": 3, "lastMove": None}
        state = {**empty_state(), "settings": settings}
        self.assertEqual(self.save(state).status_code, 200)
        self.assertEqual(self.client.get('/api/state', headers=self.headers).json['state'], state)
        for key, value in (("names", {"X": "a" * 25, "O": ""}), ("difficulty", "wrong"), ("targetWins", True), ("lastMove", 9)):
            self.assertEqual(self.save({**state, "settings": {**settings, key: value}}, 1).status_code, 400)

    def test_authentication_and_isolation(self):
        self.assertEqual(self.client.get('/api/state').status_code, 401)
        self.save()
        other = {"Authorization": "Bearer " + secrets.token_hex(32)}
        self.assertEqual(self.client.get('/api/state', headers=other).status_code, 404)
        self.assertEqual(self.client.put('/api/state', headers={'Authorization': "Bearer ' OR 1=1"}).status_code, 401)

    def test_revision_prevents_overwrites(self):
        self.assertEqual(self.save().json['revision'], 1)
        self.assertEqual(self.save().status_code, 409)
        self.assertEqual(self.save(revision=1).json['revision'], 2)

    def test_invalid_input_leaves_previous_save_intact(self):
        self.save()
        invalid = []
        for field, value in [('board', ['X'] * 9), ('board', [True] * 9), ('round', True), ('round', 0), ('startingPlayer', 'O'), ('scores', {'X': -1, 'O': 0, 'draw': 0})]:
            state = empty_state()
            state[field] = value
            invalid.append(state)
        state = empty_state()
        state['board'] = ['X','X','X','O','O','O',None,None,None]
        invalid.append(state)
        for state in invalid:
            with self.subTest(state=state):
                self.assertEqual(self.save(state, 1).status_code, 400)
        self.assertEqual(self.client.get('/api/state', headers=self.headers).json['revision'], 1)

    def test_payload_limits_and_json_errors(self):
        self.assertEqual(self.client.put('/api/state', data='x' * 5000, content_type='application/json', headers=self.headers).status_code, 413)
        self.assertEqual(self.client.put('/api/state', data='{', content_type='application/json', headers=self.headers).status_code, 400)
        self.assertEqual(self.client.put('/api/state', data='text', headers=self.headers).status_code, 415)

    def test_security_headers_and_no_cross_origin_access(self):
        response = self.client.get('/api/state', headers={**self.headers, 'Origin': 'https://attacker.invalid'})
        self.assertEqual(response.headers['Cache-Control'], 'no-store')
        self.assertNotIn('Access-Control-Allow-Origin', response.headers)
        self.assertIn("frame-ancestors 'none'", response.headers['Content-Security-Policy'])
        self.assertEqual(self.client.get('/config.json').json, {'serverStorage': True})
        self.assertEqual(self.client.get('/../app.py').status_code, 404)

    def test_rate_limit(self):
        for _ in range(60):
            self.client.get('/api/state', headers=self.headers)
        self.assertEqual(self.client.get('/api/state', headers=self.headers).status_code, 429)

    def test_every_reachable_board_for_both_starting_players(self):
        for starter, round_number in [('X', 1), ('O', 2)]:
            seen = set()
            def visit(board, player):
                key = tuple(board)
                if key in seen:
                    return
                seen.add(key)
                winner = next((board[a] for a,b,c in LINES if board[a] is not None and board[a] == board[b] == board[c]), None)
                scores = {'X': 0, 'O': 0, 'draw': 0}
                if winner:
                    scores[winner] = 1
                elif None not in board:
                    scores['draw'] = 1
                state = {'board': board, 'startingPlayer': starter, 'round': round_number, 'scores': scores}
                self.assertTrue(validate_state(state), state)
                if winner or None not in board:
                    return
                for index, cell in enumerate(board):
                    if cell is None:
                        next_board = list(board)
                        next_board[index] = player
                        visit(next_board, 'O' if player == 'X' else 'X')
            visit([None] * 9, starter)
            self.assertEqual(len(seen), 5478)


if __name__ == '__main__':
    unittest.main()
