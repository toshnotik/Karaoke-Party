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

The technical `dummy` mode remains available for integration testing. Guess
Song is implemented as a backend/domain mode with deterministic song order,
atomic buzz handling, host judging, scoring, and role-specific gameplay UI.

## Development Songs

Development song metadata lives in `data/songs/songs.json`. Each entry contains
an id, title, artist, optional year, audio filename, preview start, and preview
duration. Put local audio files in `data/songs/media/` using the manifest's
`audio_file` names. Media files in that directory are ignored by Git, and no
copyrighted MP3 files are stored in the repository.

To test audio locally:

1. Put a legally usable audio file in `data/songs/media/`.
2. Add or update its metadata and `audio_file` name in `data/songs/songs.json`.
3. Restart the backend when changing the development container configuration;
   manifest edits are read on demand.

The Screen is the only interface that plays audio and requires an explicit user
gesture to unlock playback. A fragment stops after its preview duration without
ending the round. The Host can continue with another segment of the same length;
the Screen resumes from its local position instead of returning to preview start.
Missing or unplayable media is shown on Screen without exposing its filesystem
location.

For this MVP, playback position is local to Screen. Refreshing Screen loses the
exact position and may restart the active song at preview start after audio is
unlocked again. Audio is not synchronized to Host or Player devices, and Screen
does not report playback or media errors back to Host automatically.

Active rooms are process-local and are cleared when the backend restarts.

## Realtime

Clients connect to `WS /ws/rooms/{roomCode}` and receive versioned
`room.connected` and `room.updated` events. An authenticated Host may also send
the ephemeral `screen.command` event for playback-only actions. It does not
change room state or version. Clients fetch `GET /api/rooms/{roomCode}` whenever
an announced room version is newer than their local snapshot.

Connections and rooms are held in one backend process. Multi-process realtime
coordination is not supported yet.

## Project Structure

```text
frontend/  React application and role-specific routes
backend/   FastAPI application and backend tests
docs/      Architecture documentation
```

See `docs/architecture.md` for system boundaries and the development roadmap.
