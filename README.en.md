# Spielzeit · Tic-Tac-Toe

A project by Michael Koch

[Deutsch](README.md) | **English**

A full-stack browser game built with Angular, TypeScript and Flask. Play against the computer, share a device with another player, or invite a friend to play online from a different device.

**[Open the live demo](https://michkffm.github.io/Tic-Tac-Toe/)**

![Spielzeit: an online game with two players](docs/online-multiplayer.jpg)

## Features

- **Single player:** Three difficulty levels, with a Minimax opponent on the highest setting.
- **Local multiplayer:** Two players on one device with custom names.
- **Online multiplayer:** Private rooms with an invitation link for two devices.
- **Match system:** Scores, multiple rounds and an optional first-to-three-wins match.
- **Appearance:** Light and dark themes, German and English, and highlighted winning lines.
- **Saved games:** Optional manual saving of local games through the SQLite backend.

## Technologies

| Area | Technologies |
| --- | --- |
| Frontend | Angular 20, TypeScript, CSS |
| Backend | Python 3.13, Flask, Gunicorn |
| Storage | SQLite for local saved games; in-memory storage for online rooms |
| Tests | Jasmine, Karma, ChromeHeadless, Python unittest |
| Deployment | GitHub Actions, GitHub Pages, Render |

## Implementation

Local game modes run in the browser. On the highest difficulty level, the computer uses the **Minimax algorithm** to evaluate possible game outcomes and select the best move.

For online games, the Angular frontend communicates with the Flask backend through a custom **HTTP API using JSON**. The server manages rooms and player permissions, validates moves and calculates results. The frontend polls the shared game state every four seconds. Revision numbers prevent outdated requests from overwriting newer state.

The main API endpoints:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms` | Create a room |
| `POST` | `/api/rooms/{roomId}/join` | Join a room |
| `GET` | `/api/rooms/{roomId}` | Retrieve the game state |
| `POST` | `/api/rooms/{roomId}/move` | Make a move |
| `POST` | `/api/rooms/{roomId}/round` | Start the next round |

Player credentials are stored in the individual browser tab, separately from the invitation link, and sent through Authorization headers. Inputs and permissions are checked on the server.

## Playing online

1. Open the [live demo](https://michkffm.github.io/Tic-Tac-Toe/) and select **Online with friends**.
2. Create a private room and send the invitation link to the other player.
3. The other player opens the link on their device and selects **Join room**.

Keep the invitation link private: the first person to join receives the second player slot.

**Demo limitation:** The free Render backend may take a little time to start on the first request. Online rooms are temporary, expire after at most two hours and are lost when the server restarts. Online games are not stored permanently.

## Installation and local development

Requirements: Node.js 24, npm and Python 3.13 or later.

```sh
git clone https://github.com/michkffm/Tic-Tac-Toe.git
cd Tic-Tac-Toe

python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm --prefix frontend ci --ignore-scripts
npm --prefix frontend run build

.venv/bin/python -m flask --app backend.app:create_app run --host 127.0.0.1 --port 8772
```

Open **http://127.0.0.1:8772/**. This local setup also provides controls for saving and loading local games. The online API endpoints are available at the same address; using them through the interface requires an `onlineApi` entry in the frontend configuration.

For frontend development, you can also start the Angular development server:

```sh
npm --prefix frontend start
```

The frontend preview uses `frontend/public/config.json`. The Flask development server is intended for local development only. On Windows, run the Python commands using `.venv\Scripts\python.exe`.

To create a production build with the GitHub Pages path:

```sh
npm --prefix frontend run build -- --base-href /Tic-Tac-Toe/
```

## Tests

```sh
# Backend
.venv/bin/python -m unittest discover -s backend -v

# Frontend (Chrome or Chromium required)
npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless
```

Tests cover winning conditions, computer moves, room joins, turn permissions, round transitions and error cases. GitHub Actions runs the tests and build before publishing the frontend.

## Project structure

```text
frontend/src/app/        Interface, game logic and frontend tests
frontend/public/         Static files and API configuration
backend/app.py          Flask application and SQLite storage
backend/online.py       Online rooms and server-side game rules
backend/test_*.py       Backend tests
docs/                   Screenshots
.github/workflows/      Automated tests and Pages deployment
render.yaml             Render configuration
```

## Author

[Michael Koch](https://github.com/michkffm)
