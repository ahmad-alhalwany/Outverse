# Outverse — Build & API wiring

## Backend (Django)

```bash
cd backend
python -m venv venv          # once
venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

API root: `http://127.0.0.1:8000/api/`

| Area | Endpoints |
|------|-----------|
| Users | `/api/users/` — login, register, follow, profile, suggestions |
| Posts | `/api/posts/` — feed, trending, react, comments via `/api/comments/` |
| Search | `/api/search/?q=` |
| Notifications | `/api/notifications/` |
| Stories | `/api/stories/` |
| Challenges (Lab) | `/api/challenges/` |
| Ideas (Bazaar) | `/api/ideas/` |
| Bottles (Vault) | `/api/bottles/` |
| Shop | `/api/shop/items/` |
| Forge | `/api/forge/stories/` |

## Frontend (Next.js)

```bash
cd outverse-dashboard
cp .env.example .env.local   # optional
npm install
npm run build
npm run dev                  # http://localhost:3000
```

Set `NEXT_PUBLIC_API_URL` in `.env.local` if the API is not on `127.0.0.1:8000`.

All dashboard fetch calls use `lib/api.ts` (`apiUrl`, `mediaUrl`, `apiFetch`).

## Quick verify (no UI testing)

```bash
# backend
python manage.py check

# frontend
npm run build
```
