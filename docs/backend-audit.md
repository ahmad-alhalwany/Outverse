# Django Backend Audit

Audit scope: all Python files under `H:\project\Outverse - Copy\backend` with focus on the Django apps requested by the user (`users`, `posts`, `reels`, `comments`, `chat`, `challenges`, `ideas`, `bottles`, `shop`, `stories`, `notifications`, `moderation`, `analytics`, `moods`, `narratives`, `health`, `outverse` settings). Findings below are based on direct source inspection and are categorized by severity.

## Executive Summary

- The backend has multiple **Critical** security issues in configuration and API authorization defaults.
- The most serious risks are: hard-coded secrets and database credentials, `DEBUG` defaulting to enabled, wildcard hosts/CORS in debug mode, globally permissive DRF permissions, and an unauthenticated audit log endpoint exposing sensitive activity data.
- There are also several **High/Medium** authorization, file-upload, race-condition, and N+1 query issues that will affect production safety and scalability.

---

## 1) Critical Security Issues

### Critical

1. **Hard-coded fallback `SECRET_KEY` in source control**
   - **Severity:** Critical
   - **Location:** `backend/outverse/settings.py:24`
   - **Evidence:** `SECRET_KEY` falls back to a literal secret string if `DJANGO_SECRET_KEY` is unset.
   - **Risk:** Anyone with source access can forge sessions/tokens tied to Django cryptographic signing features.
   - **Recommendation:** Remove the fallback entirely and fail fast when the environment variable is missing.

2. **`DEBUG` defaults to enabled**
   - **Severity:** Critical
   - **Location:** `backend/outverse/settings.py:30`
   - **Evidence:** `DJANGO_DEBUG` defaults to `'True'`.
   - **Risk:** Production misconfiguration will expose debug behavior, verbose errors, and weaken multiple security controls.
   - **Recommendation:** Default `DEBUG` to `False` and enable only explicitly in local development.

3. **Wildcard hosts automatically enabled when `DEBUG=True`**
   - **Severity:** Critical
   - **Location:** `backend/outverse/settings.py:32-35`
   - **Evidence:** `ALLOWED_HOSTS.append('*')` is executed whenever debug is enabled.
   - **Risk:** Host header validation is effectively disabled in the most likely misconfigured deployment path.
   - **Recommendation:** Never append `*`; require explicit host configuration per environment.

4. **CORS opens all origins whenever debug is enabled**
   - **Severity:** Critical
   - **Location:** `backend/outverse/settings.py:181`
   - **Evidence:** `CORS_ALLOW_ALL_ORIGINS = DEBUG`
   - **Risk:** If debug leaks into any shared/staging/prod environment, any origin can call the API and combine with token/session auth.
   - **Recommendation:** Use explicit allowlists only; do not tie CORS openness to debug mode.

5. **Global DRF permission default is `AllowAny`**
   - **Severity:** Critical
   - **Location:** `backend/outverse/settings.py:200-201`
   - **Evidence:** `DEFAULT_PERMISSION_CLASSES = ['rest_framework.permissions.AllowAny']`
   - **Risk:** Any new endpoint without explicit permissions becomes public by default, creating a high likelihood of future auth regressions.
   - **Recommendation:** Change the global default to `IsAuthenticated` or a stricter project-specific baseline.

6. **Hard-coded database credentials in settings**
   - **Severity:** Critical
   - **Location:** `backend/outverse/settings.py:127-134`
   - **Evidence:** Database name/user/password/host/port are embedded directly in source, including `postgres_password`.
   - **Risk:** Credential leakage and accidental reuse across environments.
   - **Recommendation:** Move all database settings to environment variables or a secrets manager.

7. **Audit log endpoint is fully public**
   - **Severity:** Critical
   - **Location:** `backend/audit/views.py:9`
   - **Evidence:** `permission_classes = []`
   - **Risk:** Unauthenticated users can enumerate audit records, including user-linked activity and searchable fields such as `ip_address` and `user__email`.
   - **Recommendation:** Restrict to admins immediately and review whether the endpoint should exist externally at all.

### High

8. **WebSocket auth can fall back to insecure `?user_id=` impersonation**
   - **Severity:** High
   - **Location:** `backend/outverse/settings.py:72-74`, `backend/chat/ws_auth.py:23-38`
   - **Evidence:** `CHAT_ALLOW_LEGACY_USER_ID` can enable `parse_user_id_legacy`, which trusts a raw query-string `user_id`.
   - **Risk:** If enabled in any non-local environment, attackers can impersonate arbitrary users over WebSockets.
   - **Recommendation:** Remove the legacy path entirely or hard-disable it outside isolated local development.

9. **Unrestricted file uploads across multiple apps**
   - **Severity:** High
   - **Locations:**  
     - `backend/posts/views.py:144-159`  
     - `backend/stories/views.py:17,29-30`  
     - `backend/reels/views.py:230`  
     - `backend/chat/views.py:248-271, 364-385`  
     - `backend/users/models.py:9`  
     - `backend/posts/models.py:28`  
     - `backend/stories/models.py:7-8`  
     - `backend/reels/models.py:8,50,65`  
     - `backend/chat/models.py:80,129`  
     - `backend/shop/models.py:26`
   - **Evidence:** File/Image fields and multipart endpoints accept uploads without visible content-type allowlists, extension validation, size limits, malware scanning, or storage hardening.
   - **Risk:** Malicious file upload, storage abuse, XSS via served files, and denial-of-service through oversized uploads.
   - **Recommendation:** Add validators for MIME/extension/size, store outside executable/static roots, and scan uploads where applicable.

10. **Story creation does not bind created objects to the authenticated user**
    - **Severity:** High
    - **Location:** `backend/stories/views.py:29-30`
    - **Evidence:** `perform_create` calls `serializer.save()` without forcing `user=request.user`.
    - **Risk:** If serializer accepts `user`, clients may create stories on behalf of other users; if it does not, creation may fail unpredictably.
    - **Recommendation:** Explicitly save with `serializer.save(user=request.user)`.

11. **Public mutation endpoint for story view counts**
    - **Severity:** High
    - **Location:** `backend/stories/views.py:38-44`
    - **Evidence:** `increment_views` is `AllowAny`.
    - **Risk:** Anyone can script inflated metrics; if business logic depends on views, this becomes abuse-prone.
    - **Recommendation:** Add throttling, deduplication, or server-side analytics rather than blind increments.

12. **Public mutation endpoints for post/reel view counters**
    - **Severity:** High
    - **Locations:** `backend/posts/views.py:187-193`, `backend/reels/views.py:312-318`
    - **Evidence:** Both endpoints are `AllowAny` and increment counters directly.
    - **Risk:** Metric poisoning and easy automated abuse.
    - **Recommendation:** Add throttling, idempotency, and bot-resistant tracking.

13. **Moderation reports trust arbitrary user-supplied content without stronger validation**
    - **Severity:** High
    - **Location:** `backend/moderation/views.py:19-26`
    - **Evidence:** `perform_create` stores free-form `content` and a user-controlled fallback `reporter`.
    - **Risk:** Abuse, spam, and potentially unsafe downstream rendering if admin UIs do not escape content consistently.
    - **Recommendation:** Validate report targets structurally and derive reporter identity only from authenticated users.

### Medium

14. **Session authentication is enabled while CORS/permission defaults are permissive**
    - **Severity:** Medium
    - **Location:** `backend/outverse/settings.py:196-198`
    - **Evidence:** `SessionAuthentication` is globally enabled alongside permissive defaults.
    - **Risk:** Increases CSRF exposure surface if browser-based clients use session auth on endpoints not carefully permissioned.
    - **Recommendation:** Use token/JWT-only for API surfaces unless session auth is explicitly needed and CSRF posture is reviewed.

15. **No visible secure cookie / HTTPS hardening settings**
    - **Severity:** Medium
    - **Location:** `backend/outverse/settings.py`
    - **Evidence:** No `SECURE_SSL_REDIRECT`, `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, `SECURE_HSTS_SECONDS`, `SECURE_PROXY_SSL_HEADER`, or related settings were found.
    - **Risk:** Weaker transport/session protection in production.
    - **Recommendation:** Add standard Django production security settings behind environment flags.

16. **No visible upload sanitization for avatar/media URLs returned to clients**
    - **Severity:** Medium
    - **Locations:** multiple serializers returning `request.build_absolute_uri(field.url)`
   - **Risk:** If unsafe files are uploaded, the API helps distribute them directly.
   - **Recommendation:** Combine file validation with safe media serving strategy.

17. **Potential sensitive data exposure in user serializer**
   - **Severity:** Medium
   - **Location:** `backend/users/serializers.py:11-17`
   - **Evidence:** `UserSerializer` includes `email` and `is_staff`.
   - **Risk:** If reused in broader contexts, it can leak internal role and email data unnecessarily.
   - **Recommendation:** Split public/private serializers and expose only minimum fields per endpoint.

18. **Audit search fields include email and IP address**
   - **Severity:** Medium
   - **Location:** `backend/audit/views.py:11-12`
   - **Evidence:** `search_fields = ['description', 'ip_address', 'user__email']`
   - **Risk:** Combined with public access, this becomes a direct privacy leak.
   - **Recommendation:** Restrict access and minimize searchable sensitive fields.

### Low

19. **No evidence of SQL injection**
   - **Severity:** Low
   - **Location:** repository-wide search
   - **Evidence:** No `raw()`, `cursor.execute()`, `RawSQL`, or `.extra()` usage found in the Django backend.
   - **Risk:** Low for SQL injection specifically in current code.
   - **Recommendation:** Keep using ORM parameterization and review future raw SQL carefully.

20. **No evidence of insecure deserialization primitives**
   - **Severity:** Low
   - **Location:** repository-wide search
   - **Evidence:** No `pickle`, unsafe `yaml.load`, or similar deserialization primitives found.
   - **Risk:** Low in current codebase.
   - **Recommendation:** Preserve this posture.

---

## 2) Performance Issues

### High

1. **Severe N+1 queries in public user profile payload construction**
   - **Severity:** High
   - **Location:** `backend/users/views.py:31-46`
   - **Evidence:** `_public_user_dict` calls `user.posts.count()`, `Reel.objects.filter(...).count()`, and two `Follow.objects.filter(...).count()` queries per user.
   - **Impact:** Followers/following/profile endpoints will issue multiple extra queries per row.
   - **Recommendation:** Annotate counts in the queryset and reuse them.

2. **Comment serializer performs recursive N+1 queries**
   - **Severity:** High
   - **Location:** `backend/comments/serializers.py:33-54`
   - **Evidence:** For each comment it separately queries replies, reactions, reaction counts, and current-user reaction.
   - **Impact:** Comment-heavy threads will degrade rapidly.
   - **Recommendation:** Prefetch replies/reactions and compute aggregates in bulk.

3. **Chat serializers trigger repeated per-object queries**
   - **Severity:** High
   - **Locations:**  
     - `backend/chat/serializers.py:93-97`  
     - `backend/chat/serializers.py:122-139`  
     - `backend/chat/serializers.py:143-147`
   - **Evidence:** Each conversation/room fetches last message with `order_by(...).first()`, peer user with `User.objects.filter(...).first()`, and presence with `UserPresence.objects.get_or_create(...)`.
   - **Impact:** Conversation lists and room lists scale poorly.
   - **Recommendation:** Annotate last-message metadata, prefetch peer/presence, and avoid `get_or_create` during serialization.

4. **Random bottle selection uses `order_by('?')`**
   - **Severity:** High
   - **Location:** `backend/bottles/views.py:94`
   - **Evidence:** `qs.order_by('?').first()`
   - **Impact:** Full-table random ordering is expensive and degrades badly with growth.
   - **Recommendation:** Use indexed sampling strategies or random ID windows.

5. **Trending tags scans 400 posts in Python**
   - **Severity:** High
   - **Location:** `backend/posts/views.py:178-184`
   - **Evidence:** Iterates over `Post.objects.order_by('-created_at')[:400]` and counts tags in Python.
   - **Impact:** Repeated CPU work and unnecessary row materialization.
   - **Recommendation:** Cache results and/or normalize tags for DB-side aggregation.

6. **Analytics dashboard performs many full-table counts per request**
   - **Severity:** High
   - **Location:** `backend/analytics/views.py:20-214`
   - **Evidence:** Numerous `.count()`, `.values_list()`, and aggregation queries are executed on every admin dashboard request.
   - **Impact:** Expensive admin endpoint under load.
   - **Recommendation:** Cache dashboard metrics and precompute heavy aggregates.

### Medium

7. **No pagination on major list endpoints**
   - **Severity:** Medium
   - **Locations:** multiple viewsets including `backend/posts/views.py`, `backend/reels/views.py`, `backend/users/views.py`, `backend/chat/views.py`, `backend/ideas/views.py`, `backend/shop/views.py`
   - **Evidence:** No DRF pagination configuration in settings and list endpoints return raw querysets/slices.
   - **Impact:** Unbounded responses and poor client/server scalability.
   - **Recommendation:** Add global pagination and endpoint-specific limits.

8. **Saved posts endpoint loses ordering in DB and rebuilds in Python**
   - **Severity:** Medium
   - **Location:** `backend/posts/views.py:195-210`
   - **Evidence:** Fetches IDs first, then loads posts with `id__in`, then reorders in Python.
   - **Impact:** Extra memory and query complexity.
   - **Recommendation:** Use a join/subquery or explicit ordering expression.

9. **Narratives shared-space endpoint has N+1 segment counts**
   - **Severity:** Medium
   - **Location:** `backend/chat/views.py:432-437`
   - **Evidence:** For each story, `Segment.objects.filter(story=st).count()` is executed.
   - **Impact:** Extra queries per story.
   - **Recommendation:** Annotate segment counts on the story queryset.

10. **Friends list creates presence rows during reads**
    - **Severity:** Medium
    - **Locations:** `backend/chat/views.py:52`, `backend/chat/views.py:71`, `backend/chat/serializers.py:122`
    - **Evidence:** `UserPresence.objects.get_or_create(...)` is called in read paths.
    - **Impact:** Read requests cause writes and lock contention.
    - **Recommendation:** Create presence records at user creation/login or handle missing presence without writes.

11. **Notification list lacks explicit ordering**
    - **Severity:** Medium
    - **Location:** `backend/notifications/views.py:31-45`
    - **Evidence:** Uses model default ordering implicitly and slices `qs[:30]`.
    - **Impact:** Acceptable now, but brittle if model ordering changes; no pagination for older notifications.
    - **Recommendation:** Add explicit ordering and pagination.

12. **Repeated `.count()` and `.exists()` patterns in hot paths**
    - **Severity:** Medium
    - **Locations:** `backend/users/views.py`, `backend/challenges/views.py`, `backend/shop/views.py`, `backend/reels/views.py`
    - **Evidence:** Multiple endpoints compute counts one-by-one instead of annotating or batching.
    - **Impact:** Extra DB round-trips.
    - **Recommendation:** Consolidate with annotations and cached counters where appropriate.

13. **Potential missing indexes on frequently filtered fields**
    - **Severity:** Medium
    - **Locations:** models across `posts`, `reels`, `stories`, `notifications`, `moderation`, `shop`, `challenges`
    - **Evidence:** Frequent filters/orderings on `created_at`, `is_active`, `status`, `recipient`, `user`, `type`, `category`, `mood`, and JSON tag containment; few explicit indexes are declared.
    - **Impact:** Query plans may degrade as tables grow.
    - **Recommendation:** Add indexes for common filter/order combinations and review PostgreSQL GIN indexes for JSON tag fields.

### Low

14. **Platform analytics endpoint is public**
    - **Severity:** Low (security concern already noted separately)
    - **Location:** `backend/analytics/views.py:19-30`
    - **Evidence:** `PlatformAnalyticsView` has no `permission_classes`.
    - **Impact:** Also wastes resources by exposing aggregate counts to anyone.
    - **Recommendation:** Restrict access and cache if kept.

---

## 3) Bugs & Code Quality Issues

### High

1. **Race condition in shop purchase flow can overspend points / double-purchase**
   - **Severity:** High
   - **Location:** `backend/shop/views.py:92-123`
   - **Evidence:** Ownership check, balance check, points decrement, transaction creation, and sales increment are done without `transaction.atomic()` or row locking.
   - **Impact:** Concurrent requests can both pass checks and create inconsistent balances/purchases.
   - **Recommendation:** Wrap in `transaction.atomic()`, lock profile/item rows, and enforce DB constraints.

2. **Potential duplicate follow creation race**
   - **Severity:** High
   - **Location:** `backend/users/views.py:211-236`
   - **Evidence:** Toggle logic uses `.first()` then create/delete without atomic handling.
   - **Impact:** Concurrent follow requests can raise integrity errors or produce inconsistent notifications.
   - **Recommendation:** Use `get_or_create`/delete inside an atomic block and handle uniqueness exceptions.

3. **Potential duplicate reel-like race / counter drift**
   - **Severity:** High
   - **Location:** `backend/reels/views.py:320-343`
   - **Evidence:** `get_or_create` plus manual `likes_count` increment/decrement can drift under concurrency.
   - **Impact:** Counter mismatch versus actual likes table.
   - **Recommendation:** Use atomic transactions and derive counters safely.

4. **Potential duplicate saved-post race**
   - **Severity:** High
   - **Location:** `backend/posts/views.py:212-223`
   - **Evidence:** Toggle save uses `.first()` then create/delete without atomic handling.
   - **Impact:** Integrity errors or inconsistent UX under concurrent requests.
   - **Recommendation:** Use atomic `get_or_create`/delete patterns.

5. **Narrative segment creation has race on `max_segments`**
   - **Severity:** High
   - **Location:** `backend/narratives/views.py:61-83`
   - **Evidence:** Reads `story.segments.count()`, creates a segment, then checks count again without locking.
   - **Impact:** Concurrent submissions can exceed `max_segments` or assign duplicate `order`.
   - **Recommendation:** Use `transaction.atomic()` and lock the story row.

### Medium

6. **Duplicate import / inconsistent imports in users views**
   - **Severity:** Medium
   - **Location:** `backend/users/views.py:7-10`
   - **Evidence:** `AllowAny` is imported twice from `rest_framework.permissions`.
   - **Impact:** Minor maintainability issue.
   - **Recommendation:** Clean imports.

7. **Story create path likely broken or ambiguous**
   - **Severity:** Medium
   - **Location:** `backend/stories/views.py:29-30`
   - **Evidence:** `perform_create` does not pass `user`; correctness depends on serializer internals not shown here.
   - **Impact:** Can fail at runtime or allow incorrect ownership.
   - **Recommendation:** Bind user explicitly.

8. **Public analytics endpoint lacks explicit admin restriction**
   - **Severity:** Medium
   - **Location:** `backend/analytics/views.py:19-30`
   - **Evidence:** `PlatformAnalyticsView` has no permission class while `AdminDashboardView` does.
   - **Impact:** Likely unintended exposure of internal metrics.
   - **Recommendation:** Restrict or remove.

9. **Comment serializer in `comments` app appears inconsistent with `posts` app models**
   - **Severity:** Medium
   - **Location:** `backend/comments/serializers.py:13-29, 42-54`
   - **Evidence:** Uses `reaction` field names and fields like `updated_at`, `likes_count`, `is_pinned`, `custom_style` that do not match `backend/posts/models.py` comment model shape.
   - **Impact:** Suggests dead/legacy code or broken endpoints if wired.
   - **Recommendation:** Verify whether `comments` app is active; remove or fix stale code.

10. **Read paths mutate database state**
    - **Severity:** Medium
    - **Locations:** `backend/chat/views.py:52`, `backend/chat/serializers.py:122`
    - **Evidence:** `get_or_create` in serializers/helpers writes presence rows during GET requests.
    - **Impact:** Surprising side effects and harder debugging.
    - **Recommendation:** Avoid writes in serialization/read helpers.

11. **Counter fields can drift from source-of-truth tables**
    - **Severity:** Medium
    - **Locations:** `backend/posts/views.py:224-257`, `backend/reels/views.py:320-343`, `backend/stories/views.py:40-43`
    - **Evidence:** Manual increments/decrements are used instead of authoritative aggregation.
    - **Impact:** Data inconsistency after failed requests or concurrent updates.
    - **Recommendation:** Use atomic updates plus periodic reconciliation or derive counts dynamically where feasible.

12. **No explicit exception handling around integrity-sensitive writes**
    - **Severity:** Medium
    - **Locations:** `backend/users/views.py`, `backend/shop/views.py`, `backend/reels/views.py`, `backend/narratives/views.py`
    - **Evidence:** Write-heavy endpoints do not catch `IntegrityError` or wrap transactions.
    - **Impact:** 500s under concurrency or malformed input.
    - **Recommendation:** Add atomic blocks and targeted exception handling.

13. **Health app is effectively empty**
    - **Severity:** Medium
    - **Location:** `backend/health/views.py:1-3`
    - **Evidence:** Only scaffolded `render` import and placeholder comment.
    - **Impact:** If health endpoints are expected, they are missing.
    - **Recommendation:** Implement a real health check or remove the app.

### Low

14. **Dead/legacy audit/comments code likely present**
   - **Severity:** Low
   - **Locations:** `backend/comments/*`, `backend/audit/*`
   - **Evidence:** Separate comments app overlaps with `posts` comments; audit endpoint marked temporary in comment.
   - **Impact:** Maintenance burden and confusion.
   - **Recommendation:** Consolidate or clearly deprecate unused apps.

15. **Encoding/mojibake in comments and ideas source comments/labels**
   - **Severity:** Low
   - **Locations:** `backend/outverse/settings.py`, `backend/comments/serializers.py`, `backend/ideas/models.py`
   - **Evidence:** Non-ASCII text appears garbled in source output.
   - **Impact:** Readability/documentation issue.
   - **Recommendation:** Normalize file encoding to UTF-8.

---

## 4) Best Practices / Django-Specific Gaps

### High

1. **Production security middleware/settings are incomplete**
   - **Severity:** High
   - **Location:** `backend/outverse/settings.py`
   - **Evidence:** Security middleware exists, but no visible SSL/HSTS/secure-cookie hardening settings.
   - **Recommendation:** Add standard production security settings and environment gating.

2. **Permission model relies on per-view overrides instead of secure defaults**
   - **Severity:** High
   - **Location:** `backend/outverse/settings.py:200-201`
   - **Evidence:** Global `AllowAny` means future endpoints are insecure unless developers remember to override.
   - **Recommendation:** Invert the default to secure-by-default.

### Medium

3. **No global pagination configured**
   - **Severity:** Medium
   - **Location:** `backend/outverse/settings.py`
   - **Evidence:** `REST_FRAMEWORK` lacks `DEFAULT_PAGINATION_CLASS` and `PAGE_SIZE`.
   - **Recommendation:** Add DRF pagination defaults.

4. **No caching strategy visible for expensive aggregate endpoints**
   - **Severity:** Medium
   - **Locations:** `backend/analytics/views.py`, `backend/posts/views.py:169-184`, `backend/reels/views.py:173-225`
   - **Evidence:** Expensive discovery/trending/dashboard endpoints compute everything on demand.
   - **Recommendation:** Add per-endpoint caching and invalidation strategy.

5. **Missing explicit DB indexes for common access patterns**
   - **Severity:** Medium
   - **Locations:** model files across apps
   - **Evidence:** Frequent filters/orderings are visible, but explicit `indexes = [...]` are mostly absent.
   - **Recommendation:** Add indexes after checking query plans.

6. **Potential migration hygiene concern**
   - **Severity:** Medium
   - **Location:** `backend/posts/migrations`
   - **Evidence:** There are two `0005_*` migrations and a merge migration (`0011_merge_...`), which is valid but indicates prior branch divergence.
   - **Recommendation:** Verify migration graph consistency in CI with `manage.py makemigrations --check` and `showmigrations`.

### Low

7. **Use of `permission_classes = []` as a temporary development shortcut**
   - **Severity:** Low
   - **Location:** `backend/audit/views.py:9`
   - **Evidence:** Inline comment indicates temporary development bypass.
   - **Recommendation:** Avoid temporary auth bypasses in committed code.

8. **Read serializers performing business logic**
   - **Severity:** Low
   - **Locations:** `backend/chat/serializers.py`, `backend/comments/serializers.py`, `backend/posts/serializers.py`, `backend/reels/serializers.py`
   - **Evidence:** Serializers compute counts and query related objects extensively.
   - **Recommendation:** Move heavy aggregation to queryset/service layer.

---

## App-by-App Notes

- **users:** Main auth flows are straightforward, but profile/follow endpoints have N+1 count issues and follow toggling is race-prone.
- **posts:** Good use of ORM; biggest issues are open metric mutation endpoints, upload validation gaps, and Python-side trending aggregation.
- **reels:** Similar to posts; discover endpoint is expensive, likes/comments counters can drift, and uploads need validation.
- **comments:** Appears partially legacy and inconsistent with `posts` comment implementation; verify whether this app is still active.
- **chat:** Highest performance debt due to serializer N+1s and read-path writes; legacy WebSocket auth fallback is dangerous if enabled.
- **challenges:** Mostly simple, but lacks pagination and has public read surfaces that may need product review.
- **ideas:** Reasonable auth checks, but list endpoints are unpaginated and vote counts are recomputed frequently.
- **bottles:** `order_by('?')` is the main scalability issue; auth on write paths is present.
- **shop:** Purchase flow needs transactional integrity urgently.
- **stories:** Ownership binding and upload validation need attention.
- **notifications:** Auth is present; pagination/order hardening would help.
- **moderation:** Admin-only reads are good, but report payload validation is weak.
- **analytics:** Admin dashboard is expensive; one analytics endpoint is public.
- **moods:** Minimal implementation; no major direct issue found beyond analytics usage.
- **narratives:** Segment creation has concurrency issues.
- **health:** Placeholder only; likely incomplete.
- **outverse/settings:** Contains the most severe configuration risks.

---

## Recommended Remediation Order

1. Fix `backend/outverse/settings.py` security defaults (`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, CORS, DB credentials, DRF default permissions).
2. Lock down `backend/audit/views.py` and `backend/analytics/views.py`.
3. Add upload validation and storage hardening for posts/reels/stories/chat/users/shop.
4. Make `backend/shop/views.py` and `backend/narratives/views.py` transactional.
5. Remove or hard-disable legacy WebSocket `user_id` auth fallback.
6. Add pagination and optimize N+1 hotspots in users/comments/chat/posts/reels.
7. Review stale/duplicate code in `comments` and `audit` apps.

---

## Validation Notes

- This report is based on static source inspection only.
- I did not modify application code; only this report file was added.
- Recommended next step: run Django checks and targeted tests after fixes, especially around auth, uploads, and transactional flows.