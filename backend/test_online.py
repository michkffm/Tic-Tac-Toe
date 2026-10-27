from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import secrets
import tempfile
import unittest
from unittest.mock import patch
from app import create_app


class OnlineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.app = create_app(Path(self.temp.name) / 'db.sqlite', self.temp.name)
        self.app.testing = True
        self.client = self.app.test_client()
        self.x = {'Authorization': 'Bearer ' + secrets.token_hex(32), 'Origin': 'https://michkffm.github.io'}
        self.o = {**self.x, 'Authorization': 'Bearer ' + secrets.token_hex(32)}
        self.other = {**self.x, 'Authorization': 'Bearer ' + secrets.token_hex(32)}
        response = self.client.post('/api/rooms', json={'name': 'Alex', 'targetWins': 0}, headers=self.x)
        self.assertEqual(response.status_code, 201)
        self.room = response.json
        self.url = '/api/rooms/' + self.room['roomId']

    def tearDown(self):
        self.temp.cleanup()

    def join(self):
        response = self.client.post(self.url + '/join', json={'name': 'Sam'}, headers=self.o)
        self.assertEqual(response.status_code, 200)
        self.room = response.json

    def move(self, index, player):
        response = self.client.post(self.url + '/move', json={'revision': self.room['revision'], 'index': index}, headers=player)
        if response.status_code == 200:
            self.room = response.json
        return response

    def test_origin_preflight_and_private_seats(self):
        preflight = self.client.options(self.url, headers={'Origin': 'https://michkffm.github.io', 'Access-Control-Request-Headers': 'authorization,content-type'})
        self.assertEqual(preflight.status_code, 204)
        self.assertEqual(preflight.headers['Access-Control-Allow-Origin'], 'https://michkffm.github.io')
        self.assertEqual(self.client.get(self.url, headers={**self.x, 'Origin': 'https://evil.invalid'}).status_code, 403)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.assertEqual(self.client.get(self.url, headers=self.other).status_code, 403)
        self.assertNotIn('keys', self.room)
        self.assertEqual(self.move(0, self.x).status_code, 409)
        self.join()
        self.assertEqual(self.client.post(self.url + '/join', json={'name': 'Third'}, headers=self.other).status_code, 409)
        self.assertEqual(self.client.post(self.url + '/join', json={'name': 'Sam'}, headers=self.o).status_code, 200)
        self.assertEqual(self.client.get(self.url, headers=self.x).headers['Cache-Control'], 'no-store')

    def test_server_controls_turns_scores_and_rounds(self):
        self.join()
        self.assertEqual(self.move(1, self.o).status_code, 409)
        for index, player in [(0,self.x),(3,self.o),(1,self.x),(4,self.o),(2,self.x)]:
            self.assertEqual(self.move(index, player).status_code, 200)
        self.assertEqual(self.room['result'], 'X')
        self.assertEqual(self.room['scores']['X'], 1)
        self.assertEqual(self.move(8, self.o).status_code, 409)
        response = self.client.post(self.url + '/round', json={'revision': self.room['revision']}, headers=self.o)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json['round'], 2)
        self.assertEqual(response.json['currentPlayer'], 'O')
        self.assertEqual(response.json['board'], [None] * 9)

    def test_conflicts_occupied_cells_and_invalid_inputs(self):
        self.join()
        revision = self.room['revision']
        self.assertEqual(self.move(0, self.x).status_code, 200)
        self.assertEqual(self.client.post(self.url+'/move', json={'revision': revision, 'index': 1}, headers=self.x).status_code, 409)
        self.assertEqual(self.move(0, self.o).status_code, 409)
        for index in [-1, 9, True, '0', None]:
            self.assertEqual(self.move(index, self.o).status_code, 400)
        self.assertEqual(self.client.post(self.url+'/round', json={'revision': self.room['revision']}, headers=self.x).status_code, 409)
        self.assertEqual(self.client.post('/api/rooms', json={'name': 'a'*25, 'targetWins': 0}, headers=self.x).status_code, 400)
        self.assertEqual(self.client.post('/api/rooms', json={'name': 'Alex', 'targetWins': True}, headers=self.x).status_code, 400)

    def test_racing_joins_only_claim_one_seat(self):
        def join(headers):
            with self.app.test_client() as client:
                return client.post(self.url + '/join', json={'name': 'Guest'}, headers=headers).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(join, [self.o, self.other])), [200,409])

    def test_draw_expiration_and_presence(self):
        self.join()
        for number,index in enumerate([0,1,2,4,3,5,7,6,8]):
            self.assertEqual(self.move(index, self.x if number % 2 == 0 else self.o).status_code, 200)
        self.assertEqual(self.room['result'], 'draw')
        self.assertEqual(self.room['scores']['draw'], 1)
        import time
        now = time.monotonic()
        with patch('online.time.monotonic', return_value=now+21):
            self.assertFalse(self.client.get(self.url, headers=self.x).json['opponentOnline'])
        with patch('online.time.monotonic', return_value=now+7201):
            self.assertEqual(self.client.get(self.url, headers=self.x).status_code, 404)

    def test_first_to_three_and_rematch(self):
        created = self.client.post('/api/rooms', json={'name':'Alex', 'targetWins':3}, headers=self.x)
        self.room = created.json
        self.url = '/api/rooms/' + self.room['roomId']
        self.join()
        for round_number in range(1,6):
            starter, other = (self.x,self.o) if round_number % 2 else (self.o,self.x)
            for index, player in [(0,starter),(3,other),(1,starter),(4,other),(2,starter)]:
                self.assertEqual(self.move(index,player).status_code,200)
            if round_number == 5:
                self.assertEqual(self.room['scores']['X'],3)
            response = self.client.post(self.url+'/round', json={'revision':self.room['revision']}, headers=self.x)
            self.room = response.json
        self.assertEqual(self.room['round'],1)
        self.assertEqual(self.room['scores'], {'X':0,'O':0,'draw':0})
