# Cursor handoff — Cosmory: finish the mobile app

Paste this whole file into Cursor as your instruction. It has full context —
you do not need to re-explore the repo from scratch to understand *why*
things are the way they are, though you should still read the specific
files named below before editing them.

## Project

**Cosmory** (renamed from "Outverse" this session — the old name collided
with an unrelated funded startup). Three parts in this monorepo:

- `backend/` — Django + DRF, 31 apps, ASGI via Daphne, `python manage.py runserver`
- `outverse-dashboard/` — Next.js 14 web app (folder name is stale, contents are Cosmory-branded)
- `mobile/` — Expo / React Native app (managed workflow)

Repo: `github.com/ahmad-alhalwany/Outverse.git`, branch `main`. Work in the
existing local working directory — do not re-clone. Some of the fixes below
(backend/shop/views.py+urls.py, backend/outverse/settings.py,
backend/users/views.py+urls.py, backend/notifications/views.py+urls.py+
serializers.py, mobile/src/api/client.ts) are **not pushed to GitHub yet**
— they exist only in the local working tree. Don't
let `git status` noise alarm you; just keep working in place. Push when the
user asks.

## What already happened this session (don't redo, don't revert)

**Mobile app** went from *literally cannot boot* to functional:
- Fixed `package.json` main entry (was pointed at nonexistent expo-router setup)
- Deleted a duplicate/dead root `App.tsx`, fixed `app.config.js` merge bug, added Metro path aliases
- Deleted a dead duplicate `useTheme.tsx` (Context-based, no provider ever rendered — would've crashed every screen)
- Rewired comments/likes from an invented API shape (`/posts/{id}/like/`, `content` field, etc. — none of which exist on the backend) to the real contract: `POST /posts/{id}/react/` and `POST /comments/{id}/react/` with `{reaction: <type>}`, flat `/comments/?post={id}` CRUD, real field names (`user`/`text`/`reaction_counts`/`my_reaction`, not `author`/`content`/`is_liked`)
- Built `ReactionPicker.tsx` + `ReactionBurst.tsx` (cosmic 5-reaction picker + double-tap burst) matching the web dashboard's `PostReactions.tsx`/`ReactionBurst.tsx` exactly — same 5 types/colors in `mobile/src/lib/reactions.ts`
- Full Cosmory rebrand: `app.json`/`package.json` naming, bundle IDs `com.cosmory.mobile`, generated real icon/splash/adaptive-icon/favicon PNGs (not placeholder stubs) matching a cosmic orbit-mark logo
- Accessibility/touch polish on `PostCard.tsx` and `ReactionPicker.tsx`: `accessibilityRole`/`accessibilityLabel` (were completely absent), `hitSlop`, press-state opacity feedback
- Fixed a real `toFeedPage()` generic-inference bug in `api/client.ts` that was silently typing ~15 list-returning methods as `unknown[]` (added explicit `Promise<FeedPage<T>>` return annotations — the actual root cause, not per-callsite casts)
- Fixed WebRTC type mismatches, duplicate-object-key TS2783 patterns, a missing `Alert` import in `LiveViewerScreen.tsx` that would've crashed on first use
- `mobile/` had **never been committed to git before this session** — it's now committed and (mostly) pushed

**Web dashboard**: full Outverse→Cosmory rename across ~47 files (i18n
strings, storage keys, SEO/OG tags, share-card canvas text, e2e test
assertions, `next.config.js` CSP, service worker cache name), new
`cosmory-icon.svg`/PNG favicon set replacing leftover Next.js placeholder
icons, post card/media gallery redesign (adaptive aspect ratio,
double-tap-to-react, removed a fragile `@tanstack/react-virtual` list in
favor of a plain `.map()` — virtualization was overengineering at this
app's real feed sizes and was producing overlapping rows), wired the
previously-unbuilt marketing-campaign and shadow-ban admin API clients.

**Backend** — two of these were **boot-blocking for the entire API**, found
via automated verification, not casual testing:
1. `users/oauth_apple.py` imports `jwt` (PyJWT) — it's in `requirements.txt`
   but was never actually `pip install`-ed in the venv. Fixed by installing.
   **If you're on a fresh venv, run `pip install -r requirements.txt` first
   or you'll hit the same crash.**
2. `outverse/throttles.py` defines ~20 well-designed DRF throttle classes
   (`BurstThrottle`, `AuthLoginThrottle`, `UserLikeThrottle`, etc.) but
   `settings.py`'s `REST_FRAMEWORK` dict had **zero** `DEFAULT_THROTTLE_RATES`
   entries. Any view using any of these classes crashed every request with
   a 500 `ImproperlyConfigured`, including the health-check endpoint. Fixed
   by adding all 21 scope→rate entries to `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`
   in `backend/outverse/settings.py`, using the rates already documented in
   each throttle class's own docstring.

Also built from scratch (model+serializer existed, view+URL didn't — the
dashboard/mobile UI was built ahead of the backend both times):
- `notifications`: full marketing-campaign CRUD (`MarketingCampaignListCreateView`,
  `MarketingCampaignDetailView`, `MarketingCampaignPreviewView`,
  `MarketingCampaignSendView`) at `/api/notifications/marketing-campaigns/...`
- `users`: `ToggleShadowBanView` at `/api/users/{id}/shadow-ban/`
- `shop`: `MyTransactionsView`/`MySalesView` at `/api/shop/transactions/` and
  `/api/shop/my-sales/` — these literally had a comment in the mobile screen
  saying "when those APIs are mounted"; they're mounted now
- Fixed mobile's `startCreatorCheckout()` calling the wrong URL
  (`/subscriptions/creator-checkout/` → real path is
  `/subscriptions/creator-subscriptions/checkout/`)

### Verification method used — reuse this, it's much stronger than clicking through screens

1. Extract every method name from `mobile/src/api/client.ts`:
   `grep -oP '(?<=async )\w+(?=\()' src/api/client.ts`
2. Extract every `api.<method>(` call site across `src/screens src/hooks src/components`
   and confirm every call resolves to a real method (`comm -23` the two sorted lists).
3. Extract every URL template from `client.ts`'s `this.client.get/post/patch/delete(...)`
   calls, substitute `${var}` → `1`, and `curl` each one against the live
   `python manage.py runserver` (or `daphne`) instance.
4. **Read the response body**, not just the status code — a DRF 404
   (`{"detail":"Not found."}` or `{"detail":"No X matches the given query."}`)
   means the route is real and the object with id=1 just doesn't exist
   (fine, expected). A raw Django HTML "Page not found at ..." 404 means the
   URL pattern genuinely isn't mounted (real bug — this caught the 3 shop/
   subscriptions issues above).
5. For POST/PATCH bodies, cross-check field names against the actual
   `Serializer.Meta.fields` in the corresponding `backend/<app>/serializers.py`
   — this is the class of bug the *original* comments/likes issue was
   (invented field names like `content` instead of `text`).

## What's left — build these three mobile screens

The web dashboard has these; mobile doesn't. Confirmed via directory
comparison — everything else in `app/` on web has a mobile equivalent
(often consolidated under `mobile/src/screens/Worlds/` instead of separate
top-level folders — check there before assuming something's missing).

### 1. Saved posts screen

Backend contract (already verified working, read
`backend/saved/views.py` — it has a docstring with the exact contract):
- `GET /api/saved/?collection=posts|reels|ideas|stories|all` → plain JSON
  array (not paginated), each item is the full serialized object
  (`PostSerializer`/`ReelSerializer`/etc. shape) plus two extra fields:
  `saved_id` (string, e.g. `"post_12"`) and `saved_type`
  (`"post"|"reel"|"idea"|"story"`).
- `DELETE /api/saved/{saved_id}/` — pass the composite id back, e.g.
  `DELETE /api/saved/post_12/`.

Mobile's `api/client.ts` has **no method for this endpoint yet** — add one
(e.g. `getSavedItems(collection?: string)` / `unsaveItem(savedId: string)`),
following the existing method style in that file. Reference the working web
implementation at `outverse-dashboard/app/saved/page.tsx` for UX (folder
filter tabs, per-type rendering) — don't copy its collection_id query param
for posts specifically (`posts/saved/?collection_id=`), that's the
*post-bookmark-folder* feature (`toggleSavePost`/`getCollections`, already
wired on mobile) which is separate from this unified saved-items list;
mirror the plain `saved/?collection=` calls instead.

Register the screen in `mobile/src/App.tsx`'s stack navigator (see how
`PostDetail` is registered there) and add a nav entry — check
`SettingsScreen.tsx` or `ProfileScreen.tsx` for where "Saved" should link
from, matching whatever the web's nav does.

### 2. Search screen

Backend: `GET /api/search/?q=<query>` (`posts/views.py` `SearchView`,
`AllowAny`). Returns `{users, posts, reels, ideas, stories, bottles, shop,
challenges}` — each an array, capped/sliced server-side. Add `&category=<name>`
for a single-category paginated view (check `SearchView._paginated_category`
for the exact param name of the category values — read the view, don't guess).

Mobile already has `api.searchPosts(query)` and `api.searchUsers(query)` in
`client.ts` — `searchPosts` already unwraps `data.posts` correctly. You'll
likely want a new `api.search(query)` that hits `/search/` directly and
returns the full multi-category object, since the existing two methods only
give you one category each. Build the screen with a search input + tabbed
or sectioned results (mirror `outverse-dashboard/app/search/page.tsx` for
which categories to show and in what order).

### 3. Tag-filtered feed screen

No new backend work needed — `api.getPosts()` already accepts a `tag?: string`
param (`client.ts`, confirmed it's threaded through to the real
`GET /api/posts/?tag=<tag>` query param). Build a screen that takes a `tag`
route param (register it in the navigator with a param, like
`PostDetail`'s `{postId}` pattern) and renders a `usePosts({tag})`-style
feed reusing `PostCard`. Reference `outverse-dashboard/app/tag/[tag]/page.tsx`
for what a tag page shows (probably just a filtered feed + the tag name as
a header — check the file, it's short).

## After building these three

1. Run the verification method above again for anything new you added to
   `client.ts` — don't assume a URL you wrote by hand is correct; curl it
   against the live backend the same way.
2. `cd mobile && npx tsc --noEmit` — must be clean (it is right now; keep it that way).
3. `cd outverse-dashboard && npx tsc --noEmit` — also currently clean, don't regress it.
4. `cd backend && python manage.py check` and
   `python manage.py makemigrations --check --dry-run` — both currently clean.
5. Match the existing design system: dark cosmic theme (`#0A0A0F` background,
   indigo `#6366F1`/`#818CF8` primary, the 5 reaction colors in
   `mobile/src/lib/reactions.ts`), reuse `PostCard`/`ReactionPicker`/`Avatar`
   rather than building new card UI, and add `accessibilityRole`/
   `accessibilityLabel`/`hitSlop` on every new pressable (the pattern is in
   `PostCard.tsx` and `ReactionPicker.tsx` — every icon-only button needs a
   label since this was a critical-severity gap found and fixed this session).
6. Don't touch `outverse-dashboard`'s folder name or the git remote's repo
   name — only the in-app branding was renamed to Cosmory, not the
   directory/repo names, and that was a deliberate scope decision.
7. When you're done, tell the user explicitly what you built, what you
   verified (and how), and what — if anything — you couldn't verify (e.g. if
   you can't run a live backend in your environment, say so plainly rather
   than claiming it works).
