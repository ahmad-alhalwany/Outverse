# Cosmory Mobile App

React Native / Expo client for the Cosmory Django API.

## API contract (aligned with web)

- Auth: **DRF Token** — `Authorization: Token <key>` (not JWT Bearer)
- Login accepts **username or email**
- 2FA: `POST /users/login/2fa/` when `requires_2fa` is returned
- Feed pagination: `limit` / `offset` / `has_more` (same as dashboard)
- Media: resolve with `mediaUrl()` from `src/api/config.ts`
- Create post: `POST /posts/` with `{ text }`, then `POST /posts/:id/add_media/`

## Configure

```bash
# mobile/.env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000/api   # Android emulator
# EXPO_PUBLIC_API_URL=http://127.0.0.1:8000/api # iOS simulator
# EXPO_PUBLIC_API_URL=http://192.168.x.x:8000/api # physical device
```

## Run

```bash
cd mobile
npm install
npx expo start
```

## Core screens wired to real API

| Screen | Endpoints |
|--------|-----------|
| Login / Register / Forgot | `/users/login/`, `/login/2fa/`, `/register/`, `/forgot-password/` |
| Home feed | `GET /posts/?limit&offset`, react |
| Create | `POST /posts/` + `add_media/` |
| Profile | `by-username`, `users/:id/`, `posts/?author=`, follow toggle |
| Explore | `/search/`, `/users/mentions/`, `/users/suggestions/`, trending tags |
| Notifications | list + `read` + `read_all/` |
| Chat / Conversation | conversations, messages (`text`), start (`peer_id`) |
| Reels | list + react + `record_view/` |

## Not yet (backend optional / later)

- Ads delivery (ads app not mounted in `urls.py`)
- WebSocket realtime chat
- Full feature parity with web (bazaar, bottles, communities, live, …)
