# Contributing to Outverse

## Git commits

Use small, focused commits with clear messages:

```
feat(shop): add /shop/[id] product detail page
fix(bazaar): redirect legacy ?idea= query to /bazaar/[id]
feat(i18n): language toggle in settings (en/ar)
```

Prefixes: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

## Pull requests

1. Branch from `main`: `git checkout -b feat/shop-detail-pages`
2. Run checks:
   ```bash
   cd backend && python manage.py test chat
   cd outverse-dashboard && npm run build
   ```
3. Open a PR with:
   - **Summary** — what and why
   - **Test plan** — steps you ran locally

## Scope per PR

Prefer one concern per PR (e.g. i18n separate from shop routes) so reviews stay small.
