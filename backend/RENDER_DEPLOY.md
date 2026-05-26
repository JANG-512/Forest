# Render Multiplayer Backend Deploy Guide

Forest Island uses GitHub Pages for the static game client and Render for the WebSocket relay server.

## What Render Runs

The backend service is a FastAPI app in this folder:

- HTTP health check: `/api/health`
- Room list: `/api/multiplayer/rooms`
- Multiplayer WebSocket: `/ws/multiplayer/{room_id}`

The repository root now includes `render.yaml`, which Render can import as a Blueprint.

## Option A: Blueprint Deploy

1. Push this repository to GitHub.
2. Open [Render Dashboard](https://dashboard.render.com/).
3. Click **New +**.
4. Choose **Blueprint**.
5. Connect the GitHub repo.
6. Select the root `render.yaml`.
7. Confirm the service:
   - Name: `poko-multiplayer-backend`
   - Runtime: Python
   - Root Directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Health Check Path: `/api/health`
8. Deploy.

Expected public URL:

```text
https://poko-multiplayer-backend.onrender.com
```

The WebSocket base URL used by the game should be:

```text
wss://poko-multiplayer-backend.onrender.com
```

If Render gives the service a different URL, update `DEFAULT_MULTIPLAYER_SERVER` in `js/config.js`.

## Option B: Manual Web Service

Create a new **Web Service** on Render and use these settings:

```text
Language: Python 3
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: uvicorn main:app --host 0.0.0.0 --port $PORT
Health Check Path: /api/health
```

Environment variables:

```text
PYTHON_VERSION=3.11.9
ALLOWED_ORIGINS=https://jang-512.github.io,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000
```

## Verify The Deploy

Open the health endpoint:

```text
https://poko-multiplayer-backend.onrender.com/api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "poko-multiplayer-backend",
  "multiplayer_rooms": 0
}
```

Check active rooms:

```text
https://poko-multiplayer-backend.onrender.com/api/multiplayer/rooms
```

## Connect From GitHub Pages

The frontend default is already set here:

```js
export const DEFAULT_MULTIPLAYER_SERVER = 'wss://poko-multiplayer-backend.onrender.com';
```

After Render is live:

1. Open the GitHub Pages game.
2. Click the multiplayer button.
3. Host clicks **server room open**.
4. Friend enters only the island code.
5. Both clients connect through Render.

## Important Notes

- Use `wss://` from GitHub Pages. Public Render WebSocket connections should use TLS.
- Free Render instances can sleep after inactivity. The first connection after sleep may take a little while.
- Current room state is in memory. If Render restarts or redeploys, active rooms disappear and players need to reconnect.
- If you scale the service to multiple instances later, this in-memory relay needs Redis/Key Value storage or sticky room routing.
