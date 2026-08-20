# Deploying Outverse to Production

This guide covers a typical VPS deployment with Docker Compose, nginx, HTTPS, Stripe, and Web Push.

> Deploying to AWS with RDS Postgres + S3 media instead of a local Postgres
> container? See [DEPLOY_AWS.md](./DEPLOY_AWS.md) — same guide, `docker-compose.aws.yml`
> instead of `docker-compose.prod.yml`, no local `db` container.

## Prerequisites

- Ubuntu 22.04+ VPS (2 GB RAM minimum, 4 GB recommended)
- Domain pointed at the server (`A` record → VPS IP)
- Docker + Docker Compose v2 installed

## 1. Clone and configure secrets

```bash
git clone <your-repo> outverse
cd outverse
cp .env.example .env
```

Edit `.env`:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_PASSWORD` | Strong DB password |
| `DJANGO_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(50))"` |
| `DJANGO_DEBUG=False` | Required in production |
| `DJANGO_ALLOWED_HOSTS` | `yourdomain.com,www.yourdomain.com` |
| `CORS_ALLOWED_ORIGINS` | `https://yourdomain.com` |
| `DJANGO_ENABLE_HTTPS_SECURITY=True` | Secure cookies + HSTS |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Premium checkout |
| `VAPID_*` | Run `python scripts/generate_vapid_env.py` |
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | AI Inspiration Engine (optional) |

## 2. Production compose

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.prod.yml exec backend python manage.py seed_questions
```

## 3. nginx + HTTPS

Copy `deploy/nginx/outverse.conf` to `/etc/nginx/sites-available/outverse`, replace `YOUR_DOMAIN`, then:

```bash
sudo ln -s /etc/nginx/sites-available/outverse /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo nginx -t && sudo systemctl reload nginx
```

## 4. Stripe webhook

Point Stripe webhook to:

```
https://yourdomain.com/api/subscriptions/webhook/
```

Use the signing secret in `STRIPE_WEBHOOK_SECRET`.

## 5. Scheduled jobs (cron sidecar)

`docker-compose.prod.yml` starts a `cron` service that:

- every minute: publishes due scheduled posts + premiere videos
- once daily (08:00 UTC by default): email digests
- once daily (06:00 UTC by default): generates the Lab AI daily challenge

```bash
docker compose -f docker-compose.prod.yml logs -f cron
# Optional: force a digest dry-run
docker compose -f docker-compose.prod.yml exec cron python manage.py send_email_digests --dry-run
docker compose -f docker-compose.prod.yml exec cron python manage.py generate_daily_challenge
```

Tune times in `.env` (UTC): `CRON_DIGEST_HOUR` / `CRON_DIGEST_MINUTE`, and
`CRON_DAILY_CHALLENGE_HOUR` / `CRON_DAILY_CHALLENGE_MINUTE` / `CRON_DAILY_CHALLENGE_LANG`.

On Windows without Docker cron:

```powershell
cd backend
powershell -ExecutionPolicy Bypass -File .\scripts\register-daily-challenge-task.ps1 -Hour 6 -Minute 0
```

See `docs/DEPLOYMENT.md`.

## 6. Verify

- `https://yourdomain.com` — dashboard loads
- `https://yourdomain.com/api/health/` — backend OK
- Settings → Enable browser push
- `/premium` — checkout redirect (test mode keys first)
- `docker compose -f docker-compose.prod.yml ps` — `cron` is `Up`

## 7. Updates

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

## Security checklist

- [ ] `DJANGO_DEBUG=False`
- [ ] Unique `DJANGO_SECRET_KEY`
- [ ] HTTPS only (`DJANGO_ENABLE_HTTPS_SECURITY=True`)
- [ ] Firewall: 80, 443 open; 5432 closed externally
- [ ] Rotate secrets before public launch
- [ ] CSP headers in nginx (see `deploy/nginx/outverse.conf`)

See also: `docs/security-audit.md`, `docs/TESTING.md`.
