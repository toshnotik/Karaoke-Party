# Karaoke Party

Karaoke Party is a family browser party game with separate Screen, Host, Player, and Admin interfaces.

## Stack

- Frontend: React, TypeScript, Vite, React Router, Zustand, Ant Design, SCSS Modules
- Backend: Python, FastAPI, pytest
- Development: Docker Compose

## Requirements

For local development without Docker:

- Node.js 22 or newer
- npm 10 or newer
- Python 3.12 or newer

Alternatively, use Docker Desktop with Docker Compose.

## Run Without Docker

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

On macOS or Linux, activate the environment with `source .venv/bin/activate`.

## Run With Docker Compose

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000
- Health endpoint: http://localhost:8000/api/health

Stop the development services with `docker compose down`.

### Open From Another Device

Start the development services, find the computer's local network address, and
open `http://<local-ip>:5173` on a phone connected to the same Wi-Fi network.
Vite listens on the LAN interface, and the frontend uses the page hostname to
reach the backend on port `8000`. Development CORS accepts localhost and private
LAN addresses only; deployed environments should configure their explicit
public origins.

## Room API

- `POST /api/rooms` creates an in-memory room and returns its host token.
- `GET /api/rooms/{roomCode}` returns the public room snapshot.
- `POST /api/rooms/{roomCode}/join` joins a remote player or reconnects one with a player token.

## Game Command API

Host game commands use `Authorization: Bearer <hostToken>` and expose explicit
configure, start, activate, reveal, scoreboard, and finish endpoints under
`/api/rooms/{roomCode}/game`. Player actions use the same Bearer scheme with
the player's token at `POST /api/rooms/{roomCode}/game/actions`; the backend
derives player identity from that token.

Only the technical `dummy` mode is available for development and integration
testing. It is not a user-facing game mode.

Active rooms are process-local and are cleared when the backend restarts.

## Realtime

Clients connect to `WS /ws/rooms/{roomCode}` and receive `room.connected` and
`room.updated` events containing only the room code and version. Commands remain
REST requests; clients fetch `GET /api/rooms/{roomCode}` whenever the announced
version is newer than their local snapshot.

Connections and rooms are held in one backend process. Multi-process realtime
coordination is not supported yet.

## Project Structure

```text
frontend/  React application and role-specific routes
backend/   FastAPI application and backend tests
docs/      Architecture documentation
```

See `docs/architecture.md` for system boundaries and the development roadmap.
