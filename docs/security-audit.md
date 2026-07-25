# Outverse Security Audit Report

Date: 2026-06-28

## Backend Findings

| Area | Status | Notes |
|------|--------|-------|
| SECRET_KEY from env | ✅ Safe | `os.environ['DJANGO_SECRET_KEY']` with no fallback |
| DEBUG env controlled | ✅ Safe | Defaults to False |
| ALLOWED_HOSTS env | ✅ Safe | Configurable via `DJANGO_ALLOWED_HOSTS` |
| CORS | ✅ Safe | Uses specific origins in production |
| REST default permission | ✅ Safe | `IsAuthenticated` default class |
| CSRF middleware | ✅ Present | Default Django CSRF +
| File upload validators | ✅ Present | Validators in `outverse/upload_validators.py` |
| Admin path | ⚠️ Default | `/admin/` is default; protected by Django auth |
| Rate limiting | ✅ Implemented | Login, register, forgot-password via `outverse/rate_limit.py` |

## Frontend Findings

| Area | Status | Notes |
|------|--------|-------|
| Hardcoded secrets | ✅ None found | |
| console.log in production | ✅ None except documented E2E setup warning |
| HTTPS API | ✅ Uses configurable `NEXT_PUBLIC_API_URL` |
| dangerouslySetInnerHTML | ⚠️ Used once | In `app/layout.tsx` for theme init script (safe, self-generated, no user input) |
| target='_blank' links | ✅ Fixed | All now use `rel="noopener noreferrer"` |

## Changes Made

- Added `noopener` to `rel` attributes on external links in:
  - `outverse-dashboard/components/shop/ProductDetailView.tsx`
  - `outverse-dashboard/app/shop/page.tsx`
  - `outverse-dashboard/app/shop/orders/page.tsx`
  - `outverse-dashboard/app/admin/chat/page.tsx`
  - `outverse-dashboard/app/chat/page.tsx`

## Recommendations

1. ~~Add rate limiting on `/api/users/login/` and `/api/users/register/`.~~ ✅ Done.
2. Add Content Security Policy headers in production nginx (baseline API headers added via `SecurityHeadersMiddleware`).
3. ~~Implement automated dependency scanning (Dependabot).~~ ✅ `.github/dependabot.yml` added.
4. Rotate Django SECRET_KEY before production launch.
5. Review admin staff assignment process carefully.

## Verification

- `npm run typecheck` — passed
- `npm run build` — passed
- `python manage.py check` — passed
