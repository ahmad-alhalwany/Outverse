# Commit preparation (no deploy)

Suggested PR split for the current uncommitted work. **Do not deploy** until VPS credentials and DNS are ready — see [DEPLOY.md](./DEPLOY.md).

## Suggested branches / PRs

| PR | Scope | Key paths |
|----|--------|-----------|
| **ci-qa** | GitHub Actions, Playwright smoke/auth/inspiration | `.github/workflows/ci.yml`, `outverse-dashboard/e2e/`, `playwright.config.ts` |
| **ai-inspiration** | Inspiration Engine v2/v3 | `backend/questions/`, `backend/posts/` (FK + my_stats), `outverse-dashboard/components/posts/InspirationPicker.tsx`, `app/inspiration/` |
| **ux-admin-shop** | Shop downloads, chat mute/archive, onboarding, admin nav | `backend/shop/`, `backend/chat/`, `outverse-dashboard/app/onboarding/`, `app/admin/` |
| **reels-stories-i18n** | Reels sound page, drafts, story poll i18n | `app/reels/`, `components/stories/` |
| **launch-docs** | Security headers, Dependabot, deploy docs only | `docs/DEPLOY.md`, `docker-compose.prod.yml`, `backend/outverse/middleware.py` |

## Pre-commit checklist

```bash
# Backend (from backend/)
python manage.py migrate
python -m pytest tests/

# Frontend (from outverse-dashboard/)
npm run typecheck
npm run lint
```

## Management commands (post-merge)

```bash
python manage.py seed_questions          # if question bank empty
python manage.py pregenerate_inspiration --dry-run
python manage.py pregenerate_inspiration --limit 10
```

## Explicitly out of scope

- VPS / production deploy
- Committing `.env` with secrets
- Pushing without user approval
