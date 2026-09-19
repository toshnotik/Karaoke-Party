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

## Room API

- `POST /api/rooms` creates an in-memory room and returns its host token.
- `GET /api/rooms/{roomCode}` returns the public room snapshot.
- `POST /api/rooms/{roomCode}/join` joins a remote player or reconnects one with a player token.

Active rooms are process-local and are cleared when the backend restarts.

## Project Structure

```text
frontend/  React application and role-specific routes
backend/   FastAPI application and backend tests
docs/      Architecture documentation
```

See `docs/architecture.md` for system boundaries and the development roadmap.
