# Outverse Feature Gap Analysis

## Scope and method

This audit compares the implemented backend/frontend against `H:/project/Outverse - Copy/BUILDING.md`, the docs under `H:/project/Outverse - Copy/docs/`, and the current code in `H:/project/Outverse - Copy/backend` plus `H:/project/Outverse - Copy/outverse-dashboard`.

For each feature area, this report checks:
- backend API existence and completeness (`views.py`, `models.py`, `serializers.py`, `urls.py`)
- frontend route/page existence and completeness (`page.tsx` and related components)
- missing or broken sub-features
- backend endpoints with no frontend consumer
- frontend UI calling missing or mismatched backend behavior

## Executive summary

Outverse has broad coverage across all major worlds and core social surfaces, but many areas are only partially complete. The strongest implemented areas are the home feed/posts flow, Signals/Reels, the five world landing pages, and the staff admin shell. The biggest gaps are around incomplete onboarding, shallow settings/preferences, partial notifications/search, missing frontend consumers for several backend capabilities, and multiple places where UI exists but key actions are local-only, placeholder, or not fully wired to backend state.

---

## 1. Weirdness Lab (`/lab` ↔ `backend/challenges`)

### What exists
- Backend app exists with models/serializers/routes in:
  - `H:/project/Outverse - Copy/backend/challenges/models.py`
  - `H:/project/Outverse - Copy/backend/challenges/serializers.py`
  - `H:/project/Outverse - Copy/backend/challenges/views.py`
  - `H:/project/Outverse - Copy/backend/challenges/urls.py`
- Implemented backend endpoints include:
  - list/detail CRUD on `/api/challenges/`
  - `/api/challenges/daily/`
  - `/api/challenges/archive/`
  - `/api/challenges/stats/`
  - `/api/challenges/user_entries/`
  - `/api/challenges/{id}/submissions/`
- Frontend page exists in `H:/project/Outverse - Copy/outverse-dashboard/app/lab/page.tsx` with:
  - daily challenge hero
  - archive grid
  - category filter
  - challenge modal
  - submission composer

### Missing / incomplete
- No frontend for admin CRUD of challenge submissions or moderation/approval state, even though submissions expose `is_approved` and admin challenge CRUD exists in backend/admin pages. Users can submit, but there is no user-facing review status workflow beyond a badge in profile challenge entries.
- No frontend consumer for challenge `user_entries` outside profile tab; there is no dedicated “my lab history” page.
- No frontend display of submission lists on the challenge detail modal; backend supports `GET /submissions/`, but the modal only submits and does not show community entries.
- No visible pagination or infinite loading for archive/history; archive is hard-capped to 12 in backend.
- No challenge search.

### Backend endpoints with no frontend consumer
- `GET /api/challenges/{id}/submissions/` appears unused by the frontend.
- Admin challenge CRUD is only partially surfaced through admin pages, not through the main Lab experience.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/challenges/views.py`, `H:/project/Outverse - Copy/backend/challenges/serializers.py`, `H:/project/Outverse - Copy/backend/challenges/urls.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/lab/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/profile/ProfileView.tsx`

---

## 2. Ideas Bazaar (`/bazaar` ↔ `backend/ideas`)

### What exists
- Backend app exists with CRUD, vote toggle, featured list:
  - `H:/project/Outverse - Copy/backend/ideas/models.py`
  - `H:/project/Outverse - Copy/backend/ideas/serializers.py`
  - `H:/project/Outverse - Copy/backend/ideas/views.py`
  - `H:/project/Outverse - Copy/backend/ideas/urls.py`
- Frontend exists in:
  - `H:/project/Outverse - Copy/outverse-dashboard/app/bazaar/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/app/bazaar/[id]/page.tsx`
- Implemented UI includes:
  - trending/new/needs-help tabs
  - category filters
  - featured sidebar
  - create idea modal
  - vote/support action
  - detail page routing

### Missing / incomplete
- No dedicated collaboration workflow beyond listing `roles_needed`; there is no apply/join/contact action for collaborators.
- Funding fields are displayed, but there is no backend transaction/pledge flow to actually raise funding. The UI presents progress bars as if crowdfunding exists, but no pledge endpoint exists in `backend/ideas/views.py`.
- No comments/discussion thread for ideas.
- No reporting/moderation action from Bazaar UI.
- No owner edit/delete controls in the main Bazaar UI despite backend allowing owner/staff update/delete.
- No admin-specific idea moderation state beyond generic CRUD.

### Backend endpoints with no frontend consumer
- Idea update/delete capabilities in backend are not clearly exposed in the main Bazaar pages.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/ideas/views.py`, `H:/project/Outverse - Copy/backend/ideas/models.py`, `H:/project/Outverse - Copy/backend/ideas/serializers.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/bazaar/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/bazaar/[id]/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/lib/bazaarTypes.ts`

---

## 3. Emotion Vault (`/bottles` ↔ `backend/bottles`)

### What exists
- Backend app exists with throw/catch/map/recent/dashboard/my_bottles:
  - `H:/project/Outverse - Copy/backend/bottles/models.py`
  - `H:/project/Outverse - Copy/backend/bottles/serializers.py`
  - `H:/project/Outverse - Copy/backend/bottles/views.py`
  - `H:/project/Outverse - Copy/backend/bottles/urls.py`
- Frontend page exists in `H:/project/Outverse - Copy/outverse-dashboard/app/bottles/page.tsx`
- Implemented UI includes:
  - map view
  - throw bottle modal
  - catch bottle modal
  - recent bottles
  - dashboard/timeline summary
  - bottle deep-link preview
  - local privacy toggles reflected from settings prefs

### Missing / incomplete
- The page falls back to demo data when API data is empty or unavailable (`shouldUseVaultDemo`), which means the experience can appear complete while not actually reflecting backend state. This is useful for demos but incomplete for production truthfulness.
- Privacy settings are local-only frontend preferences; there is no backend persistence for bottle privacy preferences.
- Non-owner bottle preview intentionally hides message text, but there is no richer “caught bottles history” page for previously caught bottles. Backend only exposes catch action and sender-owned bottles.
- No frontend for deleting your own bottles even though backend `destroy` supports owner/staff deletion.
- No frontend for browsing expired/caught bottle history.
- No search/filter by emotion or date on the vault page.

### Backend endpoints with no frontend consumer
- `DELETE /api/bottles/{id}/` has no visible main-app consumer.
- `GET /api/bottles/{id}/` is only used for deep-link preview fallback, not as a first-class detail page.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/bottles/views.py`, `H:/project/Outverse - Copy/backend/bottles/serializers.py`, `H:/project/Outverse - Copy/backend/bottles/models.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/bottles/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/vault/EmotionVaultMap.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/lib/vaultDemoData.ts`, `H:/project/Outverse - Copy/outverse-dashboard/lib/settingsPrefs.ts`

---

## 4. Story Forge (`/forge` ↔ `backend/narratives`)

### What exists
- Backend app exists with story CRUD, featured, and segment contribution:
  - `H:/project/Outverse - Copy/backend/narratives/models.py`
  - `H:/project/Outverse - Copy/backend/narratives/serializers.py`
  - `H:/project/Outverse - Copy/backend/narratives/views.py`
  - `H:/project/Outverse - Copy/backend/narratives/urls.py`
- Frontend page exists in `H:/project/Outverse - Copy/outverse-dashboard/app/forge/page.tsx`
- Implemented UI includes:
  - story list with genre/status filters
  - featured stories
  - create story modal
  - read/contribute modal

### Missing / incomplete
- “Trending” tab is not truly backed by a distinct backend ordering; frontend maps trending to default ordering, while backend only supports `ordering=new` or default `-updated_at`. So the UI promises a trending mode that does not really exist.
- No owner edit/delete controls in the Forge UI despite backend CRUD existing.
- No bookmarking/following of stories.
- No comments/discussion around stories.
- No dedicated story detail route (`/forge/[id]`); only modal/query-param navigation.
- No frontend consumer for story completion state beyond a simple badge and contribution lock.

### Backend endpoints with no frontend consumer
- Full update/delete capabilities on `/api/forge/stories/{id}/` are not surfaced in the main Forge UI.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/narratives/views.py`, `H:/project/Outverse - Copy/backend/narratives/models.py`, `H:/project/Outverse - Copy/backend/narratives/serializers.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/forge/page.tsx`

---

## 5. Madness Shop (`/shop` ↔ `backend/shop`)

### What exists
- Backend app exists with item CRUD, featured, wallet, purchase:
  - `H:/project/Outverse - Copy/backend/shop/models.py`
  - `H:/project/Outverse - Copy/backend/shop/serializers.py`
  - `H:/project/Outverse - Copy/backend/shop/views.py`
  - `H:/project/Outverse - Copy/backend/shop/urls.py`
- Frontend exists in:
  - `H:/project/Outverse - Copy/outverse-dashboard/app/shop/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/app/shop/[id]/page.tsx`
- Implemented UI includes:
  - featured banner
  - category/type/sort filters
  - wallet balance
  - owned collection
  - purchase flow

### Missing / incomplete
- No checkout/shipping flow for physical items; backend treats digital and physical items the same and only deducts points.
- No order history page despite transactions existing in backend.
- No ratings/reviews submission flow even though rating is displayed.
- No inventory/stock handling for physical goods.
- No download/access flow for purchased digital items beyond “owned” state.
- No refund/cancel/order status UX.

### Backend endpoints with no frontend consumer
- Transaction records are only indirectly consumed through wallet; there is no dedicated frontend for transaction history.
- Admin CRUD exists, but no user-facing order history or receipt page consumes transaction serializer output.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/shop/views.py`, `H:/project/Outverse - Copy/backend/shop/models.py`, `H:/project/Outverse - Copy/backend/shop/serializers.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/shop/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/shop/[id]/page.tsx`

---

## 6. Home / Social Feed (`/home` via `/` ↔ `backend/posts`, `backend/comments`, `backend/stories`)

### What exists
- Backend posts/comments/search APIs exist in:
  - `H:/project/Outverse - Copy/backend/posts/models.py`
  - `H:/project/Outverse - Copy/backend/posts/serializers.py`
  - `H:/project/Outverse - Copy/backend/posts/views.py`
  - `H:/project/Outverse - Copy/backend/posts/urls.py`
- Frontend home/feed exists in:
  - `H:/project/Outverse - Copy/outverse-dashboard/app/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/components/home/HomePageClient.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/components/PostCard.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/components/Comments.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/components/CreatePostCard.tsx`
- Implemented features include:
  - all/following feed
  - create post
  - reactions
  - comments/replies/reactions
  - save post
  - share count
  - post detail page
  - tag page
  - saved posts page
  - stories rail/sidebar

### Missing / incomplete
- Search only covers users and posts; no search across reels, ideas, bottles, stories, or shop items despite the platform scope.
- No backend pagination on feed is surfaced in UI; feed loads full arrays and refreshes wholesale.
- No post reporting resolution feedback; report action fires moderation endpoint but gives no success/error UX.
- No post edit media management after creation.
- No dedicated trending feed page even though backend exposes `/posts/trending/` and `/posts/trending_tags/`.
- Comments UI supports GIF/sticker attachments, but there is no persistent upload flow for arbitrary comment media beyond URLs.
- Stories feature on the home surface is only partially represented; there is no dedicated story composer UI on home despite backend stories app existing.

### Backend endpoints with no frontend consumer
- `GET /api/posts/trending/` and `GET /api/posts/trending_tags/` are not clearly surfaced as dedicated pages/features.
- `POST /api/posts/{id}/add_media/` appears to have no obvious frontend consumer after initial post creation.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/posts/views.py`, `H:/project/Outverse - Copy/backend/posts/serializers.py`, `H:/project/Outverse - Copy/backend/comments/views.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/PostCard.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/Comments.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/Header.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/post/[id]/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/tag/[tag]/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/saved/page.tsx`

---

## 7. Signals / Reels (`/reels` ↔ `backend/reels`)

### What exists
- Backend reels app exists with:
  - reel CRUD
  - discover
  - record_view
  - react
  - reel comments CRUD/react
  - reel music list
- Files:
  - `H:/project/Outverse - Copy/backend/reels/models.py`
  - `H:/project/Outverse - Copy/backend/reels/serializers.py`
  - `H:/project/Outverse - Copy/backend/reels/views.py`
  - `H:/project/Outverse - Copy/backend/reels/urls.py`
- Frontend exists in:
  - `H:/project/Outverse - Copy/outverse-dashboard/app/reels/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/app/reels/[id]/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/app/reels/create/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/app/reels/discover/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/components/reels/*`
- Implemented features include:
  - feed and following feed
  - discover page
  - create/upload reel
  - likes, comments, replies, comment reactions
  - report/delete reel
  - music overlay and trim
  - share panel
  - profile signals tab

### Missing / incomplete
- No reel edit UI for caption/tags/filter after creation, although backend `partial_update` exists for owner/staff.
- No saved/bookmarked reels feature.
- No explicit success/error feedback for report actions.
- No moderation state surfaced to users if a reel is hidden/flagged.
- No frontend consumer for admin reel patching beyond admin pages.
- Discover is rich, but global search does not include reels.

### Backend endpoints with no frontend consumer
- Owner/staff `PATCH /api/reels/{id}/` is not exposed in the main reels UX.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/reels/views.py`, `H:/project/Outverse - Copy/backend/reels/serializers.py`, `H:/project/Outverse - Copy/backend/reels/models.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/reels/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/reels/create/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/reels/discover/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/reels/ReelSlide.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/reels/ReelCommentsSheet.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/profile/ProfileReelsGrid.tsx`

---

## 8. Chat (`/chat` ↔ `backend/chat`)

### What exists
- Backend chat app is extensive:
  - friends list
  - presence ping
  - conversations list/start/messages/typing/upload
  - rooms list/create/messages/typing/upload
  - shared_space
  - config
  - admin overview
  - websocket support
- Files:
  - `H:/project/Outverse - Copy/backend/chat/models.py`
  - `H:/project/Outverse - Copy/backend/chat/serializers.py`
  - `H:/project/Outverse - Copy/backend/chat/views.py`
  - `H:/project/Outverse - Copy/backend/chat/urls.py`
- Frontend page exists in `H:/project/Outverse - Copy/outverse-dashboard/app/chat/page.tsx` with websocket hooks and WebRTC hooks.

### Missing / incomplete
- No frontend consumer for `chat/config/`; the backend exposes runtime websocket/ICE config, but the frontend hardcodes behavior through hooks.
- No frontend consumer for `chat/presence/`; presence appears websocket-driven only, so the REST fallback is unused.
- No frontend consumer for `chat/conversations/` list; the UI builds conversations by starting/opening chats from friends rather than showing historical conversation list.
- No room membership management UI after room creation (invite/remove members, rename room, leave room).
- No message read receipts UI despite backend marking reads.
- No archive/mute/block/report chat controls. Several header/menu buttons are present but not wired to real actions.
- Group call signaling is acknowledged with a toast only; no actual room call UX.
- Attachment support exists, but there is no upload progress or file management UX.
- No onboarding for “how to get friends” beyond a passive message.

### Backend endpoints with no frontend consumer
- `GET /api/chat/config/`
- `POST /api/chat/presence/`
- `GET /api/chat/conversations/`
- `POST /api/chat/send/`
- `GET /api/chat/admin/overview/` is only used in admin, not main chat

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/chat/views.py`, `H:/project/Outverse - Copy/backend/chat/models.py`, `H:/project/Outverse - Copy/backend/chat/serializers.py`, `H:/project/Outverse - Copy/backend/chat/ws_auth.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/chat/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/hooks/useChatWebSocket.ts`, `H:/project/Outverse - Copy/outverse-dashboard/hooks/useRoomWebSocket.ts`, `H:/project/Outverse - Copy/outverse-dashboard/hooks/useSignalWebSocket.ts`, `H:/project/Outverse - Copy/outverse-dashboard/hooks/useWebRTCCall.ts`

---

## 9. User profiles (`/profile/[id]` ↔ `backend/users`)

### What exists
- Backend users app exists with:
  - register/login/logout/me
  - suggestions
  - mentions
  - follow toggle
  - followers/following lists
  - profile update
  - public profile
  - admin profile viewset
- Files:
  - `H:/project/Outverse - Copy/backend/users/models.py`
  - `H:/project/Outverse - Copy/backend/users/serializers.py`
  - `H:/project/Outverse - Copy/backend/users/views.py`
  - `H:/project/Outverse - Copy/backend/users/urls.py`
- Frontend profile exists in:
  - `H:/project/Outverse - Copy/outverse-dashboard/app/profile/[id]/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/components/profile/ProfileView.tsx`
  - related modals/components
- Implemented UI includes:
  - profile header
  - follow/unfollow
  - edit own profile
  - followers/following modal
  - tabs for posts, signals, challenges, stories, bottles

### Missing / incomplete
- Bottles tab only shows active own bottles for the owner; there is no public bottle history or caught bottle history.
- No dedicated achievements/points UI even though backend `Profile` model contains points and achievements and admin can edit them.
- No creator suggestions surfaced directly on profile pages.
- No profile search page; only header search popover.
- No profile privacy controls persisted to backend.
- No cover photo editing despite a cover-like header UI.

### Backend endpoints with no frontend consumer
- `GET /api/users/suggestions/` is not clearly surfaced in a dedicated UI flow.
- Admin profile CRUD fields (`status`, `points`, `achievements`) are only used in admin.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/users/views.py`, `H:/project/Outverse - Copy/backend/users/models.py`, `H:/project/Outverse - Copy/backend/users/serializers.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/components/profile/ProfileView.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/profile/ProfileReelsGrid.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/profile/EditProfileModal.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/profile/FollowListModal.tsx`

---

## 10. Settings (`/settings`)

### What exists
- Frontend settings page exists in `H:/project/Outverse - Copy/outverse-dashboard/app/settings/page.tsx`
- Implemented settings include:
  - language toggle (English/Arabic)
  - theme toggle (light/dark)
  - vault map style
  - local bottle privacy preferences
  - account/profile link
  - logout

### Missing / incomplete
- No backend settings/preferences API at all; all preferences are local-only in browser storage.
- No password change, email change, account deletion, notification preferences, privacy controls, blocked users, or security sessions management.
- No chat preferences, autoplay preferences, accessibility preferences, or content moderation preferences.
- No sync of locale/theme/preferences across devices.

### Files involved
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/settings/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/lib/settingsPrefs.ts`, `H:/project/Outverse - Copy/outverse-dashboard/lib/vaultMapStyle.ts`
- Backend gap: no dedicated settings app/endpoints in `H:/project/Outverse - Copy/backend`

---

## 11. Notifications (`/notifications` ↔ `backend/notifications`)

### What exists
- Backend notifications app exists with list, mark read, mark all read:
  - `H:/project/Outverse - Copy/backend/notifications/models.py`
  - `H:/project/Outverse - Copy/backend/notifications/serializers.py`
  - `H:/project/Outverse - Copy/backend/notifications/views.py`
  - `H:/project/Outverse - Copy/backend/notifications/urls.py`
- Frontend page exists in `H:/project/Outverse - Copy/outverse-dashboard/app/notifications/page.tsx`
- Header also consumes notifications in `H:/project/Outverse - Copy/outverse-dashboard/components/Header.tsx`

### Missing / incomplete
- Notification verbs are limited in UI typing to `reaction | comment | follow`; there is no richer handling for shop, challenge, moderation, or chat notifications if added later.
- No notification preferences or filtering.
- No pagination/infinite scroll UI even though backend paginates. The frontend only reads `data.results` from the paginated response and does not load more pages.
- No real-time notification channel; polling is used in header every 30 seconds.
- No grouping by date/type.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/notifications/views.py`, `H:/project/Outverse - Copy/backend/notifications/models.py`, `H:/project/Outverse - Copy/backend/notifications/serializers.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/notifications/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/Header.tsx`

---

## 12. Admin (`/admin`)

### What exists
- Frontend admin shell and pages exist for:
  - dashboard
  - analytics
  - users
  - bazaar
  - vault
  - shop
  - reels
  - challenges
  - moderation
  - chat
  - health
  - audit
- Files under `H:/project/Outverse - Copy/outverse-dashboard/app/admin/*` and `H:/project/Outverse - Copy/outverse-dashboard/components/admin/*`
- Backend staff APIs exist for analytics, moderation, profile admin, challenge/shop CRUD, reel admin listing, chat overview, health, audit.

### Missing / incomplete
- Admin navigation includes `/admin/achievements`, but there is no corresponding backend achievements app or dedicated achievements API; this area appears UI-only/derived from profile achievements JSON.
- Audit page consumes `audit/logs/`, but backend audit endpoint is not scoped to admin-only in code; functionally it works, but access control is incomplete.
- No admin UI for stories/forge moderation or management.
- No admin UI for posts/comments management despite feed being core.
- No admin UI for notifications management or broadcast.
- No admin UI for user role promotion; staff creation remains CLI-only (`promote_staff`, `ensure_staff`).

### Backend endpoints with no frontend consumer
- Some admin-capable backend surfaces are not represented in admin UI, especially around stories, posts, and notifications.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/analytics/views.py`, `H:/project/Outverse - Copy/backend/moderation/views.py`, `H:/project/Outverse - Copy/backend/health/views.py`, `H:/project/Outverse - Copy/backend/audit/views.py`, `H:/project/Outverse - Copy/backend/users/views.py`, `H:/project/Outverse - Copy/backend/chat/views.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/admin/*`, `H:/project/Outverse - Copy/outverse-dashboard/lib/adminApi.ts`, `H:/project/Outverse - Copy/outverse-dashboard/components/admin/AdminShell.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/admin/AdminGuard.tsx`

---

## 13. Onboarding / registration / auth completeness

### What exists
- Backend register/login/logout/me endpoints exist in `backend/users/views.py`.
- Frontend login/register pages exist in:
  - `H:/project/Outverse - Copy/outverse-dashboard/app/login/page.tsx`
  - `H:/project/Outverse - Copy/outverse-dashboard/app/register/page.tsx`
- Session refresh/bootstrap exists in:
  - `H:/project/Outverse - Copy/outverse-dashboard/lib/auth.ts`
  - `H:/project/Outverse - Copy/outverse-dashboard/components/AuthBootstrap.tsx`

### Missing / incomplete
- No email verification flow.
- No password reset / forgot password flow.
- No username availability check during registration.
- No onboarding wizard after signup (choose interests, follow creators, set avatar, pick worlds, etc.).
- No social auth providers.
- No explicit post-registration redirect to profile completion.
- No backend/session UX for account deletion or password change.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/users/views.py`, `H:/project/Outverse - Copy/backend/users/serializers.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/login/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/register/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/lib/auth.ts`

---

## 14. Search functionality

### What exists
- Backend search endpoint exists at `/api/search/?q=` in `H:/project/Outverse - Copy/backend/posts/views.py`.
- Header search UI exists in `H:/project/Outverse - Copy/outverse-dashboard/components/Header.tsx`.

### Missing / incomplete
- Search only returns users and posts. It does not search reels, ideas, bottles, stories, shop items, or chat rooms.
- No dedicated search results page.
- No advanced filters, recent searches, or keyboard navigation.
- No backend mention of fuzzy search, hashtags, or world-specific search.

### Files involved
- Backend: `H:/project/Outverse - Copy/backend/posts/views.py`
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/components/Header.tsx`

---

## 15. Mobile responsiveness indicators

### What exists
- Many pages include mobile-specific layouts/components, e.g.:
  - `H:/project/Outverse - Copy/outverse-dashboard/components/home/HomeMobileNav.tsx`
  - responsive grids in world pages
  - mobile-specific feed/profile layouts
  - bottom nav in chat

### Gaps / risks
- Desktop header navigation is dense and likely overfull on smaller widths; there is no unified mobile header/menu for all worlds.
- Several pages rely on large modal experiences (`/forge`, `/lab`, `/bottles`) that may be usable but are not clearly optimized for small-screen keyboard/input edge cases.
- Admin pages are table-heavy and only partially responsive.
- Chat has a mobile bottom nav, but the three-column desktop layout compresses heavily and may not fully adapt for all device widths.

### Files involved
- Frontend: widespread, especially `H:/project/Outverse - Copy/outverse-dashboard/components/Header.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/chat/page.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/app/admin/*`, `H:/project/Outverse - Copy/outverse-dashboard/components/home/HomeMobileNav.tsx`

---

## 16. Dark/light theme coverage

### What exists
- Theme provider exists and many major pages define light/dark palettes.
- Settings page can toggle theme.

### Missing / incomplete
- Theme coverage is inconsistent: many components use hardcoded colors or mixed inline palettes rather than shared tokens, so dark mode is not uniformly guaranteed.
- Admin area appears to use its own styling system rather than the main theme provider.
- Some pages/components still contain hardcoded light-oriented gradients/backgrounds.

### Files involved
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/layout.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/components/ThemeProvider.tsx`, plus most page components with inline `PALETTES` objects

---

## 17. i18n / localization state

### What exists
- Locale provider exists in `H:/project/Outverse - Copy/outverse-dashboard/components/LocaleProvider.tsx`.
- English and Arabic dictionaries exist in:
  - `H:/project/Outverse - Copy/outverse-dashboard/lib/i18n/en.ts`
  - `H:/project/Outverse - Copy/outverse-dashboard/lib/i18n/ar.ts`
- Settings page can switch locale and document direction.

### Missing / incomplete
- Localization coverage is partial. Many major pages still hardcode English strings directly, including large parts of:
  - `/lab`
  - `/forge`
  - `/bottles`
  - `/login`
  - `/register`
  - parts of `/profile`
  - admin pages
- No backend localization strategy.
- No route-level locale prefixes or server-rendered locale handling.
- No pluralization/formatting framework beyond simple key lookup.

### Files involved
- Frontend: `H:/project/Outverse - Copy/outverse-dashboard/components/LocaleProvider.tsx`, `H:/project/Outverse - Copy/outverse-dashboard/lib/i18n/en.ts`, `H:/project/Outverse - Copy/outverse-dashboard/lib/i18n/ar.ts`, plus many page files with hardcoded strings

---

## 18. Frontend UI calling non-existent backend endpoints

After comparing the current frontend code to backend routes, there are **few outright non-existent endpoint calls**. Most major calls map to real endpoints. The bigger issue is **UI promises exceeding backend behavior**, not missing routes. Specific mismatches:

1. **Forge “Trending” tab is not backed by a real trending API**
   - Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/forge/page.tsx`
   - Backend: `H:/project/Outverse - Copy/backend/narratives/views.py`
   - The UI exposes a trending tab, but backend only supports `ordering=new` or default updated ordering.

2. **Bazaar funding/progress presentation implies crowdfunding actions that do not exist**
   - Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/bazaar/page.tsx`, `.../app/bazaar/[id]/page.tsx`
   - Backend: `H:/project/Outverse - Copy/backend/ideas/views.py`
   - No pledge/fund endpoint exists.

3. **Shop physical items imply commerce depth that backend does not implement**
   - Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/shop/page.tsx`, `.../app/shop/[id]/page.tsx`
   - Backend: `H:/project/Outverse - Copy/backend/shop/views.py`
   - No shipping/address/order lifecycle endpoints exist.

4. **Vault demo mode can mask missing backend data**
   - Frontend: `H:/project/Outverse - Copy/outverse-dashboard/app/bottles/page.tsx`
   - Backend exists, but the UI may show demo content instead of real API state.

---

## 19. Backend endpoints with no clear frontend consumer (cross-feature summary)

The following implemented backend capabilities appear unused or only weakly used by the current frontend:

- `GET /api/challenges/{id}/submissions/`
- `POST/PUT/PATCH/DELETE /api/forge/stories/{id}/` owner/staff management in main UX
- `DELETE /api/bottles/{id}/`
- `GET /api/posts/trending/`
- `GET /api/posts/trending_tags/`
- `POST /api/posts/{id}/add_media/`
- `PATCH /api/reels/{id}/` in main reels UX
- `GET /api/chat/config/`
- `POST /api/chat/presence/`
- `GET /api/chat/conversations/`
- `POST /api/chat/send/`
- `GET /api/users/suggestions/` as a dedicated surfaced feature
- transaction history detail beyond `shop/items/wallet/`

---

## 20. Highest-priority missing features to complete the product

### Tier 1: core product completeness
1. Full onboarding flow after registration
2. Backend-persisted user settings/preferences
3. Expanded global search across all worlds and content types
4. Notification preferences + pagination + real-time delivery
5. Chat conversation history / room management / presence fallback UX
6. Forge/Bazaar owner management actions (edit/delete)
7. Shop order history + digital delivery / physical checkout distinction

### Tier 2: world depth
8. Lab submission browsing and approval visibility
9. Bazaar collaboration/contact workflow
10. Vault history/delete management and real backend-only mode
11. Reels edit/save/bookmark features
12. Profile achievements/points surface

### Tier 3: platform polish
13. Full i18n coverage
14. Consistent dark mode coverage
15. Better mobile admin responsiveness
16. Dedicated search results page and discovery surfaces

---

## Conclusion

Outverse is not missing any of its headline worlds or core route shells; all five worlds plus feed, reels, chat, profiles, settings, admin, and notifications exist in some form. The main gaps are in **depth, persistence, and completeness**: onboarding is shallow, settings are local-only, search is narrow, notifications are basic, several backend capabilities have no frontend consumer, and multiple UIs imply richer workflows than the backend actually supports.