# Cosmic Chat — WebSocket & calls

Real-time chat and WebRTC use **Django Channels** over ASGI.

## Install (project venv)

```bash
cd backend
python -m pip install -r requirements.txt
python manage.py migrate
```

## Run API + WebSockets (pick one — same port 8000)

With `daphne` first in `INSTALLED_APPS`, **`runserver` serves HTTP and WebSockets**:

```bash
python manage.py runserver
```

Or explicitly:

```bash
python -m daphne -b 127.0.0.1 -p 8000 outverse.asgi:application
```

Do **not** run both on port 8000 at once.

Frontend: `npm run dev` in `outverse-dashboard` (port 3000).

## Redis (production / multiple workers)

Set `REDIS_URL` (see `.env.example`). Requires `channels-redis` in `requirements.txt`.

```bash
set REDIS_URL=redis://127.0.0.1:6379/0
python manage.py runserver
```

Without `REDIS_URL`, an in-memory channel layer is used (fine for local dev).

## TURN / STUN

Default STUN: Google public servers. For strict NAT, configure coturn (or similar) and set:

- `TURN_URL` — e.g. `turn:your-host:3478`
- `TURN_USERNAME` / `TURN_PASSWORD`

Clients load ICE servers from `GET /api/chat/config/`.

## Endpoints

| URL | Purpose |
|-----|---------|
| `GET /api/chat/config/` | ICE servers, channel layer, WS paths |
| `ws://…/ws/chat/<conversation_id>/?token=` | DM messages, typing |
| `ws://…/ws/room/<room_id>/?token=` | Group room messages |
| `ws://…/ws/signal/?token=` | Presence, 1:1 & room call signaling |

All `/api/chat/` endpoints require `Authorization: Token …` (no `user_id` in query/body).
| `POST …/conversations/<id>/typing/` | Typing when WS is down |
| `POST …/conversations/<id>/upload/` | Image / voice / file (multipart) |
| `GET/POST /api/chat/rooms/` | List / create group rooms |

### WebSocket message types

**Chat:** `chat.send`, `chat.typing` → `chat.message`, `chat.typing`

**Room:** `room.send`, `room.typing` → `room.message`, `room.typing`

**Signal (1:1):** `call.offer`, `call.answer`, `call.ice`, `call.hangup`, `call.reject`, `call.busy`

**Signal (group):** join with `room.join` + `room_id`, then `call.room.offer`, `call.room.answer`, `call.room.ice`, `call.room.hangup`

## Sample data

```bash
python manage.py create_sample_chat
```

## Two-browser test

1. Open `/chat` as user A and user B (different browsers / incognito).
2. Green **Live** dot = WebSocket connected.
3. Messages and attachments appear without refresh.
4. Voice/video: allow mic/camera; callee must **Accept** incoming call.
5. Disable WS (or stop server) and type — **typing** still works via HTTP if the other user has WS.
