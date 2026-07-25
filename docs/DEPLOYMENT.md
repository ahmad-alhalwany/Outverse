# Outverse production deployment

> **Updated guide:** See [DEPLOY.md](./DEPLOY.md) for the full VPS workflow with `docker-compose.prod.yml`, nginx, Stripe, and VAPID.

## Backend (Django + Daphne)

1. Set environment variables (see `backend/.env.example`):
   - `SECRET_KEY`, `DEBUG=false`, `ALLOWED_HOSTS`
   - `REDIS_URL` for WebSocket channel layer (required with multiple workers)
   - `TURN_URL`, `TURN_USERNAME`, `TURN_PASSWORD` for WebRTC behind NAT
   - `DATABASE_REPLICA_URL` (optional) — Postgres read replica; when set, Django routes read queries to `replica` and writes to `default`. Health check exposes `database_primary` / `database_replica`.
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

4. Media CDN: serve uploads from object storage behind a CDN hostname.
   - Set `AWS_STORAGE_BUCKET_NAME` plus the matching `AWS_*` credentials (see `backend/.env.example`).
   - Point `AWS_S3_CUSTOM_DOMAIN` at your CDN origin (e.g. `media.yourdomain.com`).
   - Set `DJANGO_MEDIA_URL=https://media.yourdomain.com/` so API responses return CDN URLs.
   - Run `python manage.py migrate_media_to_storage` once after switching storage backends.

## Scheduled jobs

Run these Django management commands from the backend environment:

```cron
*/1 * * * * python manage.py publish_scheduled_posts
*/1 * * * * python manage.py publish_premiere_videos
0 * * * * python manage.py send_email_digests
```

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
