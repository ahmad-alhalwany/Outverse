# Outverse

Outverse is a full-stack creative social platform where users explore five interconnected worlds:

- **Weirdness Lab** — daily creative challenges
- **Ideas Bazaar** — collaborative idea marketplace
- **Emotion Vault** — anonymous mood bottles on a map
- **Story Forge** — collaborative story writing
- **Madness Shop** — creative marketplace

Plus social feed, reels, chat, notifications, profile, and admin tools.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Django 5.x, Django REST Framework, Django Channels, Daphne |
| Frontend | Next.js 14, React 18, TypeScript, TailwindCSS |
| Database | PostgreSQL |
| Cache / Channels | Redis |
| Tests | pytest (backend), Playwright (frontend) |
| Deployment | Docker Compose, GitHub Actions, nginx |

## Quick Start

### 1. Clone & setup

```bash
cd "H:\project\Outverse - Copy"  # or your path
```

### 2. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate                 # Windows
# source venv/bin/activate             # macOS/Linux
pip install -r requirements.txt
cp .env.example .env                   # edit with your local settings
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

API will be at `http://127.0.0.1:8000/api/`.

### 3. Frontend

```bash
cd outverse-dashboard
npm install
cp .env.example .env.local             # optional; defaults to http://127.0.0.1:8000
npm run dev
```

Dashboard will be at `http://localhost:3000`.

### 4. Verify

```bash
cd backend
python manage.py check

cd outverse-dashboard
npm run typecheck
npm run build
```

## Docker (Production-like)

```bash
cd "H:\project\Outverse - Copy"
docker compose up --build
```

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for full details.

## Documentation Index

| Document | Purpose |
|----------|---------|
| [BUILDING.md](./BUILDING.md) | Backend/frontend setup, API map, env reference |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Docker, CI/CD, production config |
| [docs/DEVELOPER.md](./docs/DEVELOPER.md) | Architecture, conventions, how to add features |
| [docs/API.md](./docs/API.md) | Key endpoints and examples |
| [docs/TESTING.md](./docs/TESTING.md) | Running backend & frontend tests |
| [docs/e2e-testing.md](./docs/e2e-testing.md) | Playwright setup details |
| [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) | Commit & PR conventions |
| [docs/feature-gaps.md](./docs/feature-gaps.md) | Feature completion report |
| [docs/design-comparison.md](./docs/design-comparison.md) | Mockup vs implementation analysis |

## Project Status

- ✅ Phase 1 — Security, performance, bug fixes (~100 issues)
- ✅ Phase 2 — 16+ features across 3 tiers
- ✅ Phase 3 — Design comparison and alignment (~90%+ match)
- ✅ Phase 4 — Deployment, E2E tests, performance optimization
- ✅ Phase 5 — Cleanup and final polish

## License

Internal project — all rights reserved.
