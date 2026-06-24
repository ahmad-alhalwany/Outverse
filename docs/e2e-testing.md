# Outverse — End-to-End Testing

This covers the E2E test setup for the Outverse platform.

## What's covered

### Frontend (Playwright)

- Auth: login redirect, successful login.
- Core user flows: home feed, reels, notifications, settings.
- Discovery: reels discover page and individual reel page.

### Backend (pytest)

- User registration, login, follow.
- Post reaction and comments.
- Reel listing, discover, music tracks.
- Notification generation on reel like.
- Moderation reporting.
- Feed, trending, search.
- Shop and bottles list endpoints.
- Admin authorization gates.

## Run the backend tests

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Configure test DB via env, e.g.:
set POSTGRES_TEST_DB=outverse_test
set POSTGRES_TEST_USER=postgres
set POSTGRES_TEST_PASSWORD=postgres

pytest
```

## Run the frontend tests

```bash
cd outverse-dashboard
npm install
npx playwright install chromium

# Tests assume a backend is running on http://127.0.0.1:8000
set E2E_API_URL=http://127.0.0.1:8000
set E2E_BASE_URL=http://localhost:3000
npm run e2e
```

Variables:

- `E2E_BASE_URL` — dashboard URL.
- `E2E_API_URL` — Django API origin.
- `E2E_USERNAME` / `E2E_PASSWORD` — test account (default `e2e_test_user` / `OutverseE2E!2026`).
- `E2E_SKIP_SERVER=1` — don't auto-start Next.js dev server.

## CI notes

- Backend tests use a dedicated test database; ensure migrations are run first.
- Frontend tests use Chromium headless by default; `-ui` opens interactive mode.
- HTML reports are written to `outverse-dashboard/e2e-report/`.
