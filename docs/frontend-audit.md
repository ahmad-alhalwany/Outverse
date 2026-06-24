# Frontend Audit Report: `outverse-dashboard/`

Date: 2026-06-24

Scope:
- Reviewed TypeScript/JavaScript under `outverse-dashboard/app/`, `components/`, `hooks/`, `lib/`, `utils/`, and `types/`
- Focused on security, performance, bugs/code quality, and best practices
- Validation run: `npm run typecheck` passed; `npm run lint` could not complete because Next.js requested first-time ESLint setup interactively

Severity scale:
- **Critical**: likely credential compromise, auth bypass, or severe production breakage
- **High**: exploitable weakness, major data leak, or recurring runtime failure
- **Medium**: meaningful reliability/performance/accessibility issue
- **Low**: minor issue, maintainability gap, or polish problem

---

## Executive Summary

The frontend does not appear to contain widespread direct XSS sinks beyond one controlled inline script, but it has several **high-risk auth and transport issues**: auth tokens are stored in `localStorage`, appended to WebSocket query strings, and reused broadly from client-side code. The codebase also has multiple **performance hotspots** from heavy client-only pages, repeated un-memoized rendering, many raw `<img>` tags, and expensive story/reel/chat components. Reliability issues are concentrated around **async race conditions**, **missing request cancellation**, **global DOM querying**, and **weak typing (`any`)** in core views.

The most important fixes should prioritize:
1. moving auth from `localStorage` to secure cookies/session-based auth,
2. removing token-in-query-string WebSocket auth,
3. adding cancellation/cleanup for async fetch-heavy components,
4. replacing raw `<img>` usage with optimized image handling where feasible,
5. tightening types and reducing global DOM/event coupling in story/chat/reel flows.

---

## 1) Security Issues

### Critical

#### 1. Auth token stored in `localStorage`
- **Severity:** Critical
- **File:** `outverse-dashboard/lib/auth.ts:10`
- **Details:** `TOKEN_KEY = 'outverse_token'` is persisted in `localStorage` and read by `getToken()`. Any successful XSS anywhere in the app or a compromised third-party script can exfiltrate the token immediately.
- **Evidence:** `setAuth()` writes token to `localStorage`; `authHeaders()` reuses it for API calls.
- **Impact:** Full account takeover until token expiry/revocation.
- **Recommendation:** Move auth to `HttpOnly`, `Secure`, `SameSite` cookies or a server-managed session. Avoid exposing bearer/session tokens to JavaScript.

#### 2. WebSocket auth token exposed in URL query string
- **Severity:** Critical
- **File:** `outverse-dashboard/lib/ws.ts:4`
- **Details:** `wsUrl()` appends `?token=...` to WebSocket URLs. Query-string tokens can leak through logs, reverse proxies, browser history, monitoring tools, and server access logs.
- **Evidence:** `const auth = token ? \`${joiner}token=${encodeURIComponent(token)}\` : '';`
- **Impact:** Token disclosure outside the browser runtime.
- **Recommendation:** Authenticate WebSockets with secure cookies or a short-lived signed handshake token delivered server-side, not a long-lived auth token in the URL.

### High

#### 3. Inline script via `dangerouslySetInnerHTML`
- **Severity:** High
- **File:** `outverse-dashboard/app/layout.tsx:11`
- **Details:** The theme bootstrap script is injected with `dangerouslySetInnerHTML`.
- **Why this matters:** The current string is static and not directly user-controlled, so this is not an immediate exploitable XSS. However, it creates a CSP exception point and normalizes a dangerous pattern in the root layout.
- **Recommendation:** Replace with Next.js `Script` where possible, or keep it static but pair with a strict CSP and nonce strategy.

#### 4. Client-side auth state is fully trustable/tamperable
- **Severity:** High
- **File:** `outverse-dashboard/lib/auth.ts:16`
- **Details:** `getUser()` reads user identity and staff-related fields from `localStorage`. Although `refreshSession()` later revalidates, many UI decisions can still be influenced by tampered local state before server confirmation.
- **Impact:** UI spoofing, misleading privilege display, inconsistent auth behavior.
- **Recommendation:** Treat client-stored user objects as cache only; derive privileged UI from server-validated state or server components.

#### 5. Missing CSRF protections for cookie-based future migration / mixed auth patterns
- **Severity:** High
- **Files:** `outverse-dashboard/lib/api.ts:44`, `outverse-dashboard/lib/auth.ts:49`
- **Details:** Mutating requests rely on bearer-style headers only and do not include any CSRF token strategy. If the backend ever uses cookies for auth, the frontend is not prepared for CSRF-safe mutation flows.
- **Impact:** Dangerous migration path and inconsistent security model.
- **Recommendation:** Standardize auth transport and add CSRF token handling for state-changing requests if cookies/sessions are used.

#### 6. Third-party link preview fetch exposes user browsing targets to external service
- **Severity:** High
- **File:** `outverse-dashboard/components/LinkPreview.tsx:13`
- **Details:** Every detected URL is sent client-side to `https://api.microlink.io/?url=...`.
- **Impact:** User-generated/private links are disclosed to a third party; can leak internal URLs or sensitive shared links.
- **Recommendation:** Proxy previews through a trusted backend with allowlists, rate limiting, and privacy controls.

### Medium

#### 7. Untrusted remote media rendered directly in many components
- **Severity:** Medium
- **Files:** 
  - `outverse-dashboard/components/PostCard.tsx:389`
  - `outverse-dashboard/components/Comments.tsx:181`
  - `outverse-dashboard/components/StoriesSidebar.tsx:608`
  - `outverse-dashboard/components/reels/ReelSlide.tsx:328`
  - `outverse-dashboard/app/chat/page.tsx:84`
- **Details:** User-controlled or backend-provided URLs are rendered directly into `<img>`, `<video>`, `<audio>`, and `<a>` elements.
- **Impact:** Privacy leakage, mixed-content issues, malicious tracking pixels, and unsafe file linking.
- **Recommendation:** Validate/normalize media origins server-side, restrict allowed domains, and sanitize attachment metadata.

#### 8. Theme preference stored in `localStorage`
- **Severity:** Medium
- **Files:** 
  - `outverse-dashboard/components/ThemeProvider.tsx:7`
  - `outverse-dashboard/app/layout.tsx:11`
  - `outverse-dashboard/lib/vaultMapStyle.ts:7`
- **Details:** Non-sensitive preferences are stored in `localStorage`. This is acceptable for theme/map style, but it reinforces a pattern already used for auth tokens.
- **Recommendation:** Keep only non-sensitive preferences in storage and document that policy explicitly.

#### 9. Admin UI depends on client-side route guard before server response
- **Severity:** Medium
- **File:** `outverse-dashboard/components/admin/AdminGuard.tsx:9`
- **Details:** Admin access is checked client-side after render. This is not a server-side auth bypass by itself, but it exposes admin route shells and creates a flash-of-protected-UI risk if future code adds privileged data before guard completion.
- **Recommendation:** Prefer server-side gating or middleware for admin routes.

### Low

#### 10. No evidence of broad direct DOM XSS sinks beyond root layout
- **Severity:** Low
- **Files checked:** all scoped directories
- **Details:** No additional `dangerouslySetInnerHTML`, `eval`, or `new Function` usage was found in the audited frontend tree.
- **Recommendation:** Keep it that way; add lint rules forbidding these APIs except approved cases.

---

## 2) Performance Issues

### High

#### 11. Extensive use of raw `<img>` instead of `next/image`
- **Severity:** High
- **Files:** many, including:
  - `outverse-dashboard/components/CreatePostCard.tsx:109`
  - `outverse-dashboard/components/Comments.tsx:181`
  - `outverse-dashboard/components/PostCard.tsx:389`
  - `outverse-dashboard/components/StoriesSidebar.tsx:568`
  - `outverse-dashboard/components/reels/ReelSlide.tsx:521`
  - `outverse-dashboard/app/chat/page.tsx:84`
- **Details:** The app disables/works around `@next/next/no-img-element` in many places. This loses automatic sizing, optimization, responsive loading, and caching benefits.
- **Impact:** Larger payloads, layout shift risk, slower LCP on media-heavy screens.
- **Recommendation:** Migrate stable image surfaces to `next/image`; keep raw tags only where dynamic media constraints truly require them.

#### 12. Entire home/feed shell is client-rendered and heavily dynamic
- **Severity:** High
- **File:** `outverse-dashboard/app/page.tsx:1`
- **Details:** The main feed page is a client component with multiple dynamic imports and client-side fetching for core content.
- **Impact:** Slower first render, weaker SEO, larger hydration cost.
- **Recommendation:** Move fetchable feed shell/data to server components where possible and keep only interactive islands client-side.

#### 13. Story viewer uses frequent timers and global DOM queries
- **Severity:** High
- **File:** `outverse-dashboard/components/StoriesSidebar.tsx:200`
- **Details:** `StoryModal` uses `setTimeout(..., 16)` loops, repeated `requestAnimationFrame`, and `document.querySelector('video')` inside effects.
- **Impact:** High CPU usage, unnecessary layout work, brittle synchronization.
- **Recommendation:** Use refs instead of global queries, consolidate timing logic, and avoid dual timer/rAF loops.

#### 14. Link previews fetch on every URL change without caching/debounce
- **Severity:** High
- **File:** `outverse-dashboard/components/LinkPreview.tsx:10`
- **Details:** Each URL change triggers a fresh third-party request with no abort/caching.
- **Impact:** Network churn, duplicate requests, UI flicker.
- **Recommendation:** Add debounce, abort handling, and memoized cache keyed by URL.

### Medium

#### 15. Missing request cancellation in many fetch-heavy components
- **Severity:** Medium
- **Files:** 
  - `outverse-dashboard/app/page.tsx:56`
  - `outverse-dashboard/components/LinkPreview.tsx:10`
  - `outverse-dashboard/components/profile/ProfileView.tsx:119`
  - `outverse-dashboard/app/chat/page.tsx:233`
  - `outverse-dashboard/components/Comments.tsx:84`
- **Details:** Most async effects do not use `AbortController` or equivalent cancellation.
- **Impact:** State updates after stale requests, wasted bandwidth, race conditions.
- **Recommendation:** Add `AbortController` to fetches triggered by changing props/state.

#### 16. Right sidebar recomputes trending topics on every render
- **Severity:** Medium
- **File:** `outverse-dashboard/components/RightSidebar.tsx:89`
- **Details:** `trendingTopics` is recomputed inline from `trendingPosts` each render.
- **Recommendation:** Wrap in `useMemo`.

#### 17. Large monolithic components likely causing unnecessary re-renders
- **Severity:** Medium
- **Files:** 
  - `outverse-dashboard/app/chat/page.tsx:1`
  - `outverse-dashboard/components/StoriesSidebar.tsx:1`
  - `outverse-dashboard/components/PostCard.tsx:1`
  - `outverse-dashboard/components/profile/ProfileView.tsx:1`
- **Details:** These components manage many unrelated state slices and render large subtrees.
- **Impact:** Expensive updates and harder memoization boundaries.
- **Recommendation:** Split into smaller memoized subcomponents.

#### 18. `RelativeTime` likely creates one interval per instance
- **Severity:** Medium
- **File:** `outverse-dashboard/components/RelativeTime.tsx:19`
- **Details:** Feed/comment-heavy pages can mount many timers simultaneously.
- **Impact:** Background CPU churn.
- **Recommendation:** Use a shared timer/store or lower-frequency updates.

#### 19. Story sidebar canvas animation runs continuously
- **Severity:** Medium
- **File:** `outverse-dashboard/components/StoriesSidebar.tsx:17`
- **Details:** `StarfieldBG` animates continuously whenever mounted.
- **Impact:** Constant GPU/CPU usage even when user is not interacting.
- **Recommendation:** Pause when tab is hidden or component is offscreen.

#### 20. Reels slide updates progress on every `timeupdate`
- **Severity:** Medium
- **File:** `outverse-dashboard/components/reels/ReelSlide.tsx:174`
- **Details:** `setProgress` fires frequently during playback.
- **Impact:** Frequent rerenders of active reel slide.
- **Recommendation:** Throttle progress updates or move visual progress to CSS/DOM updates where possible.

#### 21. Search/mention fetch in comments lacks dedupe and abort
- **Severity:** Medium
- **File:** `outverse-dashboard/components/Comments.tsx:84`
- **Details:** Debounced mention lookup still allows stale responses to win.
- **Recommendation:** Abort previous request or track request IDs.

### Low

#### 22. `RightSidebar` mixes `fetch` and `apiFetch`
- **Severity:** Low
- **File:** `outverse-dashboard/components/RightSidebar.tsx:57`
- **Details:** Inconsistent fetch wrappers complicate caching/auth behavior and optimization.

#### 23. Duplicate Next config files may confuse optimization settings
- **Severity:** Low
- **Files:** 
  - `outverse-dashboard/next.config.js:1`
  - `outverse-dashboard/next.config.ts:1`
- **Details:** `next.config.ts` is effectively placeholder config while `next.config.js` contains real settings.
- **Impact:** Maintenance confusion and possible future misconfiguration.

---

## 3) Bugs & Code Quality Issues

### High

#### 24. WebSocket hooks do not guard against stale socket instances during rapid switching
- **Severity:** High
- **Files:** 
  - `outverse-dashboard/hooks/useChatWebSocket.ts:37`
  - `outverse-dashboard/hooks/useRoomWebSocket.ts:35`
  - `outverse-dashboard/hooks/useSignalWebSocket.ts:18`
- **Details:** New sockets are created on dependency changes, but event handlers do not verify they belong to the latest connection instance.
- **Impact:** Racey connected/disconnected state and stale message handling during fast room/conversation changes.
- **Recommendation:** Track socket generation IDs or compare `wsRef.current === ws` before mutating state.

#### 25. Story modal uses `document.querySelector('video')` instead of scoped ref
- **Severity:** High
- **File:** `outverse-dashboard/components/StoriesSidebar.tsx:300`
- **Details:** If multiple videos exist on the page, the wrong element can be controlled.
- **Impact:** Broken playback/progress behavior and hard-to-debug cross-component interference.
- **Recommendation:** Use a dedicated `videoRef`.

#### 26. Async UI state in comments relies on fixed `setTimeout` instead of awaiting completion
- **Severity:** High
- **File:** `outverse-dashboard/components/Comments.tsx:126`
- **Details:** Add/edit/delete comment flows clear loading state after 400ms regardless of network completion.
- **Impact:** False success UI, race conditions, duplicate submissions, stale state.
- **Recommendation:** Make callbacks async and await them before resetting UI state.

#### 27. `ProfileView` mixes authenticated and unauthenticated fetch styles inconsistently
- **Severity:** High
- **File:** `outverse-dashboard/components/profile/ProfileView.tsx:119`
- **Details:** One request uses raw `fetch(apiUrl(...))` while others use `apiFetch`.
- **Impact:** Inconsistent headers, error handling, and auth behavior.
- **Recommendation:** Standardize on one fetch abstraction.

### Medium

#### 28. Widespread `any` usage in core views weakens type safety
- **Severity:** Medium
- **Files:** 
  - `outverse-dashboard/app/tag/[tag]/page.tsx:20`
  - `outverse-dashboard/app/post/[id]/page.tsx:20`
  - `outverse-dashboard/components/profile/ProfileView.tsx:119`
  - `outverse-dashboard/utils/postMapper.ts:5`
  - `outverse-dashboard/components/LinkPreview.tsx:8`
- **Details:** Core data flows use `any[]`, `any | null`, and untyped mapping.
- **Impact:** Hidden runtime bugs and weaker refactoring safety.

#### 29. `PostCard` suppresses hook dependency lint
- **Severity:** Medium
- **File:** `outverse-dashboard/components/PostCard.tsx:174`
- **Details:** `fetchComments()` is used in an effect with `react-hooks/exhaustive-deps` disabled.
- **Impact:** Stale closures and missed updates.
- **Recommendation:** Wrap `fetchComments` in `useCallback` and include dependencies properly.

#### 30. `LinkPreview` can set state after unmount
- **Severity:** Medium
- **File:** `outverse-dashboard/components/LinkPreview.tsx:10`
- **Details:** No cleanup/abort in effect.

#### 31. `StoriesSidebar` creates object URLs without revocation
- **Severity:** Medium
- **File:** `outverse-dashboard/components/StoriesSidebar.tsx:720`
- **Details:** `URL.createObjectURL(file)` is used for preview, but no `URL.revokeObjectURL` cleanup is visible.
- **Impact:** Memory leak during repeated uploads.

#### 32. `showToast` creates overlapping timers without cleanup
- **Severity:** Medium
- **File:** `outverse-dashboard/app/chat/page.tsx:145`
- **Details:** Repeated toasts can race and clear newer messages early.

#### 33. `RightSidebar` has dead constants never used
- **Severity:** Medium
- **File:** `outverse-dashboard/components/RightSidebar.tsx:35`
- **Details:** Top-level `trendingPosts` and `friendSuggestions` constants are unused.
- **Impact:** Dead code and confusion.

#### 34. `remoteMuted` state appears unused in WebRTC hook
- **Severity:** Medium
- **File:** `outverse-dashboard/hooks/useWebRTCCall.ts:31`
- **Details:** State is exposed but not meaningfully driven in the shown logic.

#### 35. Placeholder/deprecated helper returns fake user id
- **Severity:** Medium
- **File:** `outverse-dashboard/lib/auth.ts:27`
- **Details:** `getCurrentUserId()` falls back to `1`.
- **Impact:** Dangerous default if accidentally used in logic.
- **Recommendation:** Return `null`/`undefined` instead of a real-looking ID.

#### 36. Duplicate/garbled encoding artifacts in UI strings
- **Severity:** Medium
- **Files:** multiple, including:
  - `outverse-dashboard/app/page.tsx:126`
  - `outverse-dashboard/components/Comments.tsx:251`
  - `outverse-dashboard/components/StoriesSidebar.tsx:200`
  - `outverse-dashboard/components/RightSidebar.tsx:31`
- **Details:** Several strings render as mojibake (`â€¦`, `âœ•`, etc.).
- **Impact:** Broken UX and localization quality.

### Low

#### 37. `next.config.ts` is placeholder-only and likely unused
- **Severity:** Low
- **File:** `outverse-dashboard/next.config.ts:1`

#### 38. Console logging left in production path
- **Severity:** Low
- **File:** `outverse-dashboard/components/CosmicVideoPlayer.tsx:65`
- **Details:** `console.log('Auto-play prevented by browser');`

#### 39. `AuthBootstrap` ignores promise result and errors silently
- **Severity:** Low
- **File:** `outverse-dashboard/components/AuthBootstrap.tsx:8`
- **Details:** Session refresh is fire-and-forget with no loading/error surface.

#### 40. `RightSidebar` shadows top-level constant names with state variables
- **Severity:** Low
- **File:** `outverse-dashboard/components/RightSidebar.tsx:35`
- **Details:** `const trendingPosts = [...]` and `const [trendingPosts, setTrendingPosts]` coexist.

---

## 4) Best Practices / Accessibility / SEO / UX

### High

#### 41. Many images have empty or non-descriptive `alt` text
- **Severity:** High
- **Files:** many, including:
  - `outverse-dashboard/components/Comments.tsx:181`
  - `outverse-dashboard/components/reels/ReelSlide.tsx:521`
  - `outverse-dashboard/app/chat/page.tsx:84`
  - `outverse-dashboard/components/StoriesSidebar.tsx:608`
- **Impact:** Accessibility failure for screen-reader users.
- **Recommendation:** Provide meaningful alt text or explicit decorative semantics.

#### 42. Core pages are client-only, limiting SEO and metadata richness
- **Severity:** High
- **Files:** 
  - `outverse-dashboard/app/page.tsx:1`
  - `outverse-dashboard/app/reels/page.tsx:1`
  - `outverse-dashboard/app/bottles/page.tsx:1`
  - `outverse-dashboard/app/chat/page.tsx:1`
- **Details:** Important content is fetched/rendered client-side.
- **Impact:** Weak crawlability and slower contentful paint.

### Medium

#### 43. Root metadata is minimal and generic
- **Severity:** Medium
- **File:** `outverse-dashboard/app/layout.tsx:13`
- **Details:** Only basic title/description are defined; no Open Graph, Twitter, canonical, robots, or per-route metadata strategy is visible.

#### 44. Missing explicit loading/error states in many data views
- **Severity:** Medium
- **Files:** 
  - `outverse-dashboard/components/RightSidebar.tsx:46`
  - `outverse-dashboard/components/LinkPreview.tsx:10`
  - `outverse-dashboard/components/profile/ProfileView.tsx:119`
  - admin pages under `outverse-dashboard/app/admin/*`
- **Details:** Several views silently fail or collapse to empty state.

#### 45. No dedicated error boundary coverage for many interactive islands
- **Severity:** Medium
- **Files:** app-level boundaries exist:
  - `outverse-dashboard/app/error.tsx`
  - `outverse-dashboard/app/global-error.tsx`
- **Details:** Global boundaries are present, but large client islands like chat/stories/reels lack local containment.
- **Recommendation:** Add local boundaries around high-risk interactive modules.

#### 46. Inconsistent data-fetching patterns across app
- **Severity:** Medium
- **Files:** widespread
- **Details:** Mix of `fetch`, `apiFetch`, `apiFetchJson`, and direct third-party requests.
- **Impact:** Inconsistent auth, caching, error handling, and testability.

#### 47. Search result and notification popovers rely on blur/timeouts
- **Severity:** Medium
- **Files:** 
  - `outverse-dashboard/components/PostCard.tsx:438`
  - `outverse-dashboard/components/Header.tsx` (search/notification popovers)
- **Details:** Timeout-based close behavior is fragile for keyboard and assistive tech users.

### Low

#### 48. Placeholder favicon redirect to `vercel.svg`
- **Severity:** Low
- **File:** `outverse-dashboard/next.config.js:10`
- **Details:** Branding/SEO polish issue.

#### 49. Mixed language/comment artifacts reduce maintainability
- **Severity:** Low
- **Files:** notably `outverse-dashboard/components/StoriesSidebar.tsx:200`
- **Details:** Garbled comments and mixed-language remnants make maintenance harder.

#### 50. Some interactive controls lack stronger ARIA/state semantics
- **Severity:** Low
- **Files:** various buttons/menus across `PostCard`, `Header`, `StoriesSidebar`
- **Details:** Several toggles/menus do not expose expanded/controls relationships.

---

## Directory Coverage Notes

### `app/`
- Heavy client-side rendering in major routes (`page.tsx`, `chat/page.tsx`, `bottles/page.tsx`, `reels/page.tsx`)
- Root layout contains the only direct `dangerouslySetInnerHTML` usage found
- App-level error boundaries exist, which is positive

### `components/`
- Largest concentration of performance and accessibility issues
- Repeated raw media rendering and timeout-driven async UI
- Several oversized components should be split and memoized

### `hooks/`
- WebSocket/WebRTC hooks are functional but have auth transport and stale-connection risks
- Cleanup is generally present, but connection lifecycle hardening is needed

### `lib/`
- Main security concerns live here: token storage, auth headers, WebSocket URL auth
- API helpers are simple but lack cancellation/CSRF strategy

### `utils/`
- `postMapper.ts` relies on `any`, weakening type guarantees in feed/profile flows

### `types/`
- Minimal issues observed; type coverage is more a problem of underuse than bad declarations

---

## Positive Findings

- `reactStrictMode` is enabled in `outverse-dashboard/next.config.js:3`
- App-level `error.tsx` and `global-error.tsx` exist
- Several components already use `dynamic()` and some `useMemo`/`useCallback`
- WebSocket hooks close sockets on cleanup
- `npm run typecheck` passed, so the current tree is at least TypeScript-parseable

---

## Recommended Remediation Order

1. **Replace `localStorage` token auth** in `lib/auth.ts`
2. **Remove token query-string WebSocket auth** in `lib/ws.ts`
3. **Add abort/cancellation** to fetch-heavy effects (`LinkPreview`, feed/profile/chat/comments)
4. **Refactor `StoriesSidebar` / `StoryModal`** to use refs instead of global DOM queries and to revoke object URLs
5. **Migrate high-traffic images to `next/image`**
6. **Eliminate `any` in core data mappers and route pages**
7. **Add local error boundaries and better loading/error states**
8. **Improve accessibility** for media alt text, menus, and keyboard interactions

---

## Validation Evidence

- `npm run typecheck` → passed
- `npm run lint` → blocked by interactive first-time Next.js ESLint setup prompt
