# Outverse production deployment

## Backend (Django + Daphne)

1. Set environment variables (see `backend/.env.example`):
   - `SECRET_KEY`, `DEBUG=false`, `ALLOWED_HOSTS`
   - `REDIS_URL` for WebSocket channel layer (required with multiple workers)
   - `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` for WebRTC behind NAT
2. Run migrations and collect static files.
3. Serve ASGI behind HTTPS reverse proxy (nginx/Caddy):

```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

4. Media: serve `/media/` from CDN or object storage; set `MEDIA_URL` accordingly.

## Frontend (Next.js)

1. Build with production API URL:

```bash
cd outverse-dashboard
NEXT_PUBLIC_API_URL=https://api.yourdomain.com npm run build
npm run start
```

2. `NEXT_PUBLIC_API_URL` must use **HTTPS** so WebSockets upgrade to **WSS** automatically.
3. Optional CDN: deploy static export or put Next behind the same domain (`/app` → Next, `/api` → Django).

## Auth

- Clients send `Authorization: Token <key>` on REST.
- WebSockets append `?token=<key>` (no `user_id` in production).
- Set `CHAT_ALLOW_LEGACY_USER_ID=false` (default).

## Checks before go-live

```bash
cd backend && python manage.py test chat
cd outverse-dashboard && npm run build
```

## Admin

- Django: `https://api.yourdomain.com/admin/`
- Dashboard: `https://app.yourdomain.com/admin` (staff user token for API overview)
