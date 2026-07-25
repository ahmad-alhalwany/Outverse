# Outverse — Developer Guide

This document explains the architecture and conventions used across the Outverse platform.

## Architecture Overview

Outverse consists of two main layers:

1. **Backend (`backend/`)** — Django monolith with REST APIs and WebSockets
2. **Frontend (`outverse-dashboard/`)** — Next.js 14 app with server and client components

They communicate via REST (`/api/*`) and WebSocket (`/ws/*`) connections.

## Backend Structure

```
backend/
├── outverse/          # settings, urls, asgi, wsgi
├── users/             # auth, profiles, follows, suggestions
├── posts/             # feed posts, reactions, comments
├── comments/          # comment system
├── challenges/        # Weirdness Lab daily challenges
├── ideas/             # Ideas Bazaar
├── bottles/           # Emotion Vault map + bottles
├── stories/           # Story Forge collaborative stories
├── shop/              # Madness Shop items/orders
├── reels/             # Reels / signals feed
├── notifications/     # notification system
├── chat/              # WebSocket real-time chat
├── preferences/       # user settings/preferences API
├── moderation/        # reports and admin moderation
├── analytics/         # dashboard analytics
└── tests/             # backend E2E tests
```

### Key Conventions

- Use Django REST Framework viewsets for CRUD APIs.
- All list endpoints should support pagination (`?page=`).
- Use `IsAuthenticated` as the default permission class.
- File uploads are validated via `outverse/upload_validators.py`.
- WebSocket consumers live in `chat/consumers.py` and use channel layer groups.

### Adding a New Feature

1. Create a new Django app: `python manage.py startapp myapp`
2. Register it in `INSTALLED_APPS` in `outverse/settings.py`
3. Define models → create migrations → run `python manage.py migrate`
4. Add serializers, viewsets, and URL registration
5. Add tests in `tests/`
6. Expose frontend API helpers in `outverse-dashboard/lib/api.ts`

## Frontend Structure

```
outverse-dashboard/
├── app/               # Next.js app router pages
├── components/        # shared React components
├── lib/
│   ├── api.ts         # central API helper + mediaUrl
│   ├── auth.ts        # authentication helpers
│   ├── i18n/          # en.ts / ar.ts dictionaries
│   └── settingsPrefs.ts
├── hooks/             # custom React hooks
└── e2e/               # Playwright tests
```

### Key Conventions

- **Server Components by default** — only add `'use client'` when interactivity is needed.
- **API calls** go through `lib/api.ts` using `apiFetch()` and `apiUrl()`.
- **Images** use `next/image` with the configured hostname in `next.config.js`.
- **i18n** is handled via `lib/i18n/useTranslation.ts`. Always add both `en.ts` and `ar.ts` keys.
- **Styling** uses TailwindCSS with a cosmic theme palette in `app/globals.css`.
- **State** uses React hooks; prefer local state before context, context before global stores.

### Adding a New Page

1. Add a new folder under `app/`, e.g. `app/my-feature/page.tsx`
2. Create server component; fetch data via `apiFetch()` if needed
3. Extract interactive parts to client components in `app/my-feature/MyFeatureClient.tsx`
4. Add i18n keys in `lib/i18n/en.ts` and `lib/i18n/ar.ts`
5. Add route to navigation if public
6. Run `npm run typecheck` and `npm run build`

## Authentication Flow

1. User submits username/email + password to `/api/users/login/`
2. Backend returns `token` and `user` object
3. Frontend stores token in cookies and user in state/context
4. Subsequent requests send `Authorization: Token <token>`
5. WebSocket connections append `?token=<token>`
6. Token cleared on logout

## WebSocket / Chat

- Daphne ASGI server handles WebSocket upgrade
- Channel layer uses Redis
- Consumers: `chat/consumers.py`
- Chat messages, presence (typing/online), and WebRTC signaling happen over `/ws/chat/`

## Performance Notes

- Admin routes lazy-load `recharts` to reduce bundle size.
- Reels feed uses viewport culling (only active ±1 slide renders video).
- Images generally use `next/image` for optimization.
- API list endpoints use pagination and `select_related`/`prefetch_related` to avoid N+1.

## Browser Push (PWA)

Push notifications use the Web Push API with VAPID keys on the backend.

1. Generate keys into the repo-root `.env` (gitignored):

   ```bash
   python scripts/generate_vapid_env.py
   ```

2. Ensure these variables reach the backend (Docker Compose reads them automatically):

   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY` (PEM; stored with `\n` escapes in `.env`)
   - `VAPID_ADMIN_EMAIL` (e.g. `mailto:admin@outverse.local`)

3. Restart the backend, then in the app open **Settings → Enable browser push notifications**.

The frontend fetches the public key from `GET /api/notifications/push-vapid-key/` and stores subscriptions via `POST /api/notifications/push-subscribe/`. New in-app notifications trigger a browser push when keys are configured.

## Useful Commands

```bash
# Backend
cd backend
python manage.py migrate
python manage.py check
python manage.py test chat
python manage.py seed_demo_data --username YOUR_USERNAME --clear

# Frontend
cd outverse-dashboard
npm run dev
npm run typecheck
npm run build
npm run e2e
```
