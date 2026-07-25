# Outverse — Testing Guide

## Backend Tests (pytest)

Backend tests use pytest and a dedicated test database.

### Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate              # Windows
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### Run tests

```bash
pytest                             # full test suite (SQLite in-memory by default)
```

By default, pytest uses an **in-memory SQLite** database — no Postgres required.

To run against Postgres (optional, e.g. CI):

```bash
set USE_POSTGRES_FOR_TESTS=1
set POSTGRES_TEST_DB=outverse_test
set POSTGRES_TEST_USER=outverse
set POSTGRES_TEST_PASSWORD=your-password
pytest
```

Credentials are also read from the repo-root `.env` when `USE_POSTGRES_FOR_TESTS=1`.

Backend test files:

- `backend/tests/test_e2e_admin.py`
- `backend/tests/test_e2e_core_flows.py`
- `backend/tests/test_creator_analytics.py`

Manual QA: see [QA_CHECKLIST.md](./QA_CHECKLIST.md).

## Frontend Unit / Type Checks

```bash
cd outverse-dashboard
npm install
npm run typecheck     # TypeScript verification
npm run lint          # ESLint (may prompt first-run setup)
npm run build         # production build
```

## End-to-End Tests (Playwright)

### Setup

```bash
cd outverse-dashboard
npm install
npx playwright install chromium
```

### Run E2E

```bash
# assumes backend on http://127.0.0.1:8000 and Next.js on http://localhost:3000
set E2E_BASE_URL=http://localhost:3000
set E2E_API_URL=http://127.0.0.1:8000

npm run e2e           # headless
npm run e2e:ui        # interactive UI
npm run e2e:report    # show last HTML report
```

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `E2E_BASE_URL` | `http://localhost:3000` | Dashboard URL |
| `E2E_API_URL` | `http://127.0.0.1:8000` | Django API origin |
| `E2E_USERNAME` | `e2e_test_user` | Test account username |
| `E2E_PASSWORD` | `OutverseE2E!2026` | Test account password |
| `E2E_SKIP_SERVER` | — | Set to `1` to skip auto-starting Next.js dev server |

### E2E file locations

- `outverse-dashboard/e2e/auth.spec.ts`
- `outverse-dashboard/e2e/feed.spec.ts`
- `outverse-dashboard/e2e/reels.spec.ts`
- `outverse-dashboard/e2e/global.setup.ts`

## Manual Smoke Tests

1. `/reels` — scroll, double-tap like, comments
2. `/profile/{id}` — view signals/posts/challenges
3. `/lab` — daily challenge + submission
4. `/bazaar` — create idea + vote
5. `/bottles` — throw/catch bottle
6. `/notifications` — mark read
7. `/settings` — toggle theme, update preferences

## CI

GitHub Actions runs:

- Backend: migrations + `pytest tests/` (Postgres service, `USE_POSTGRES_FOR_TESTS=1`)
- Frontend: `npm run typecheck` + `npm run build`
- E2E smoke: Playwright (`--project=smoke`) for core pages, shop, lab, search
- E2E auth: Playwright (`--project=chromium`) with live Django backend in CI

Workflow files: `.github/workflows/ci.yml`
