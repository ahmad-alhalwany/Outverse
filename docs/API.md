# Outverse — API Reference

Base URL: `http://127.0.0.1:8000/api/`

Authentication: `Authorization: Token <your-token>`

## Authentication

### Register
```http
POST /api/users/register/
Content-Type: application/json

{
  "username": "ahmad",
  "email": "ahmad@example.com",
  "password": "SecurePass123!",
  "first_name": "Ahmad",
  "last_name": "User"
}
```

### Login
```http
POST /api/users/login/
Content-Type: application/json

{
  "username": "ahmad",
  "password": "SecurePass123!"
}
```

Response:
```json
{
  "token": "abc123...",
  "user": {
    "id": 1,
    "username": "ahmad",
    "email": "ahmad@example.com"
  }
}
```

### Logout
```http
POST /api/users/logout/
Authorization: Token <token>
```

## Users

```http
GET    /api/users/me/              # current user
GET    /api/users/{id}/            # user profile
PATCH  /api/users/{id}/update/     # update profile
POST   /api/users/{id}/follow/     # follow user
POST   /api/users/{id}/unfollow/   # unfollow user
GET    /api/users/suggestions/     # suggested creators
```

## Posts

```http
GET    /api/posts/                 # feed
GET    /api/posts/trending/        # trending posts
POST   /api/posts/                 # create post
GET    /api/posts/{id}/            # post detail
DELETE /api/posts/{id}/            # delete own post
POST   /api/posts/{id}/react/      # like/unlike
POST   /api/posts/{id}/add_media/  # add image/video/file
```

Create post example:
```json
{
  "content": "Hello Outverse!",
  "mood": "creative",
  "tags": ["art", "morning"]
}
```

## Search

```http
GET /api/search/?q=keyword
```

## Notifications

```http
GET    /api/notifications/                # list notifications
POST   /api/notifications/mark_read/    # mark all as read
PATCH  /api/notifications/{id}/read/     # mark single as read
```

## Weirdness Lab (Challenges)

```http
GET    /api/challenges/              # challenges list
GET    /api/challenges/daily/        # today's challenge
POST   /api/challenges/{id}/submit/  # submit response
GET    /api/challenges/history/      # user history
```

## Ideas Bazaar

```http
GET    /api/ideas/                              # list (filters: category, status, tag, owner, owner_id, ordering)
POST   /api/ideas/                              # create idea (auth)
GET    /api/ideas/featured/                     # top featured ideas
GET    /api/ideas/{id}/                         # idea detail
PATCH  /api/ideas/{id}/                         # update (owner only)
DELETE /api/ideas/{id}/                         # delete (owner only)
POST   /api/ideas/{id}/vote/                    # toggle vote
POST   /api/ideas/{id}/toggle-save/             # toggle bookmark
POST   /api/ideas/{id}/pledge/                  # pledge coins { amount }
POST   /api/ideas/{id}/apply/                   # apply to collaborate { role, message }
GET    /api/ideas/{id}/applicants/              # list applicants (owner)
POST   /api/ideas/{id}/applicants/{req_id}/respond/  # accept|reject → may return collab_project_id
POST   /api/ideas/{id}/launch-collab/           # create/open collab hub (owner)
GET    /api/ideas/{id}/comments/                # list comments
POST   /api/ideas/{id}/comments/                # add comment
PATCH  /api/ideas/{id}/comments/{cid}/          # edit own comment
DELETE /api/ideas/{id}/comments/{cid}/          # delete own comment
```

**List filters:** `?category=`, `?status=`, `?tag=`, `?owner=me|collaborating|supporting`, `?owner_id=`, `?ordering=trending|new`

**Idea fields:** `tags[]`, `target_date` (YYYY-MM-DD), `milestones[]` (`{ id, title, done, due_date? }`), `collab_project_id` (read-only when linked)

## Emotion Vault (Bottles)

```http
GET    /api/bottles/                  # recent bottles
POST   /api/bottles/throw/           # throw a bottle
POST   /api/bottles/{id}/catch/      # catch bottle
GET    /api/bottles/dashboard/       # user stats
```

## Story Forge

```http
GET    /api/forge/stories/             # stories list
POST   /api/forge/stories/             # create story
GET    /api/forge/stories/{id}/        # story detail
POST   /api/forge/stories/{id}/contrib/ # contribute segment
GET    /api/forge/stories/featured/    # editor's picks
```

## Reels

```http
GET    /api/reels/                  # feed
GET    /api/reels/discover/        # discover page
POST   /api/reels/                # upload reel
GET    /api/reels/{id}/           # single reel
POST   /api/reels/{id}/react/     # like
POST   /api/reels/{id}/view/      # record view
```

## Shop

```http
GET    /api/shop/items/           # list items
GET    /api/shop/items/{id}/       # item detail
POST   /api/shop/orders/           # place order
GET    /api/shop/orders/           # order history
```

## Chat

WebSocket: `ws://127.0.0.1:8000/ws/chat/?token=<token>`

REST endpoints:
```http
GET /api/chat/rooms/          # my chat rooms
GET /api/chat/rooms/{id}/     # messages in room
```

## Admin

```http
GET /api/admin/stats/          # admin overview (staff only)
GET /api/admin/reports/        # moderation queue (staff only)
GET /api/analytics/dashboard/  # analytics (staff only)
```

## WebSocket Events (Chat)

| Event | Description |
|-------|-------------|
| `chat_message` | New message in room |
| `typing` | User is typing |
| `presence` | User online/offline |
| `call_signal` | WebRTC signaling |

## Notes

- All list endpoints return paginated results (`count`, `next`, `previous`, `results`).
- Use `?page=` for pagination.
- POST/PATCH requests need `Content-Type: application/json` unless uploading files.
