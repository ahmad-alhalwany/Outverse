# Deploying Outverse to AWS (EC2 + RDS + S3)

Adapts `docs/DEPLOY.md` (generic VPS guide) to AWS-managed Postgres (RDS) and
S3 media storage, using `docker-compose.aws.yml` instead of
`docker-compose.prod.yml`. Everything else (nginx config, Stripe, VAPID, cron)
is identical to the VPS guide — only the database and media storage move to
managed AWS services.

Recommended shape for a first launch: **one EC2 instance + Elastic IP +
host nginx/certbot + your existing RDS instance + an S3 bucket for media.**
No load balancer, no ECS/Fargate — the simplest thing that works. Scale up
later if the trial takes off.

## 0. RDS — confirm reachability first

Before anything else, confirm the EC2 instance you're about to launch can
actually reach RDS:

- RDS instance is in the same VPC (or peered/reachable) as the EC2 instance.
- RDS security group's inbound rule allows port `5432` from the EC2
  instance's security group (not `0.0.0.0/0` — scope it to the EC2 SG).
- RDS **Publicly Accessible** can stay `No` if EC2 is in the same VPC.

This is the IP/connectivity fix you already know you need to make — do it
before step 2, or `docker compose ... exec backend python manage.py migrate`
in step 4 will hang/timeout exactly like local testing has this whole audit.

## 1. Launch the EC2 instance

- Ubuntu 22.04 LTS, `t3.small` minimum (`t3.medium` if running the AI
  features locally instead of via API).
- Security group: allow `22` (SSH, your IP only), `80`/`443` (public).
- Allocate an **Elastic IP** and associate it, so the IP survives a reboot —
  point your domain's `A` record at it.
- Install Docker + Compose v2:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER   # log out/in after this
sudo apt-get install -y docker-compose-plugin nginx certbot python3-certbot-nginx
```

## 2. S3 bucket for media

1. Create a bucket (Block Public Access **on** — the backend uses signed
   URLs, not public-read, see `backend/outverse/settings.py`).
2. Create an IAM user (or role, if you'd rather attach it to the EC2
   instance profile) with a policy scoped to that bucket:
   `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:ListBucket`.
3. Note the bucket name, region, and access key pair (skip the key pair
   entirely and use an instance profile instead if you'd rather not manage
   long-lived credentials).

## 3. Clone and configure secrets

```bash
git clone <your-repo> outverse
cd outverse
cp .env.example .env
```

Edit `.env` — same variables as `docs/DEPLOY.md`, plus:

| Variable | Purpose |
|----------|---------|
| `POSTGRES_HOST` | RDS endpoint, e.g. `outverse-db.xxxxxxxx.us-east-1.rds.amazonaws.com` |
| `POSTGRES_PORT` | usually `5432` |
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | match the RDS instance's actual database/role, not fresh values — RDS already exists |
| `AWS_STORAGE_BUCKET_NAME` | the S3 bucket from step 2 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | leave blank if using an instance profile instead |
| `AWS_S3_REGION_NAME` | bucket's region |

`POSTGRES_HOST` not being `localhost`/`127.0.0.1` automatically turns on
`sslmode=require` for the RDS connection (`backend/outverse/settings.py`) —
nothing else to configure for TLS-to-RDS.

## 4. Bring up the stack (no local `db` container)

```bash
docker compose -f docker-compose.aws.yml up -d --build
docker compose -f docker-compose.aws.yml exec backend python manage.py migrate
docker compose -f docker-compose.aws.yml exec backend python manage.py createsuperuser
docker compose -f docker-compose.aws.yml exec backend python manage.py seed_questions
```

`backend` and `frontend` publish to `127.0.0.1:8000` / `127.0.0.1:3000` only
— not reachable from outside the instance until nginx is in front of them.

## 5. Host nginx + HTTPS

Same as `docs/DEPLOY.md` step 3 — `deploy/nginx/outverse.conf` already
expects exactly this shape (host nginx → `127.0.0.1:8000`/`127.0.0.1:3000`):

```bash
sudo cp deploy/nginx/outverse.conf /etc/nginx/sites-available/outverse
sudo sed -i 's/YOUR_DOMAIN/yourdomain.com/g' /etc/nginx/sites-available/outverse
sudo ln -s /etc/nginx/sites-available/outverse /etc/nginx/sites-enabled/
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
sudo nginx -t && sudo systemctl reload nginx
```

## 6. Stripe webhook, cron sidecar, verification, updates

Identical to `docs/DEPLOY.md` steps 4, 5, 6, 7 — just swap
`docker-compose.prod.yml` for `docker-compose.aws.yml` in every command.

## Why no ECS/Fargate/ALB here

Channels/Daphne need long-lived WebSocket connections and the app is a
single-service Django monolith — a load balancer + container orchestrator
buys nothing at trial-launch scale and adds a recurring ALB cost plus more
moving parts to operate solo. Move to ECS Fargate behind an ALB (ACM cert
instead of certbot, `nginx/default.conf` already listens on plain `:80` for
exactly that fronting shape) once/if real scaling needs show up.
