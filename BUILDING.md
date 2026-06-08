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
| Reels (Signals) | `/api/reels/` — feed, react, upload, views, filters, music |
| Reel comments | `/api/reel-comments/?reel={id}` |
| Reel music | `/api/reel-music/` |
| Reel discover | `/api/reels/discover/` |
| Reels by user | `/api/reels/?user={id}` |
| Reel page (share) | `/reels/{id}` — OG meta + direct open |
| Reel notifications | likes/comments → `/reels/{id}` |
| Report reel | `POST /api/moderation/flagged/` type `reel` |
| Delete reel | `DELETE /api/reels/{id}/` (owner only) |
| Report reel comment | `POST /api/moderation/flagged/` type `reel_comment` |
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

Optional — full GIF/sticker search in comments (server-side, not exposed to browser):

```env
GIPHY_API_KEY=your_key
# or
TENOR_API_KEY=your_key
```

Get keys: [Giphy Developers](https://developers.giphy.com/) or [Tenor Google](https://developers.google.com/tenor). Without keys, a built-in trending set is used with local tag filtering.

All dashboard fetch calls use `lib/api.ts` (`apiUrl`, `mediaUrl`, `apiFetch`).

## Quick verify

```bash
# backend — migrations + reel API flow (comment, reply, like, notify, report)
cd backend
python manage.py migrate
python manage.py check
python scripts/verify_reel_e2e.py

# frontend — production build must exit 0
cd outverse-dashboard
npm run build
```

### Manual UI checklist (~10 min)

1. `/reels` — scroll reels, hear music overlay, double-tap like
2. Comments — post, reply, edit/delete own, report others (🚩)
3. Share — opens cosmic panel, copy link `/reels?focus={id}`
4. Bell — notification opens focused reel
5. `/profile/{id}` → Signals tab
