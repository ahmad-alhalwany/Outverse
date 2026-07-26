# Cosmory launch test checklist

Use this before the first public / closed beta. Mark each item after a manual pass on **web** and **mobile** where relevant.

## Ops / cron

- [ ] `docker compose -f docker-compose.prod.yml ps` shows `cron` Up
- [ ] `docker compose -f docker-compose.prod.yml logs cron` shows `publish_scheduled_posts` / `publish_premiere_videos` each minute
- [ ] Create a post scheduled ~2 minutes ahead → appears in feed after cron tick
- [ ] Schedule a premiere video → status flips to published after due time
- [ ] `send_email_digests --dry-run` returns counts without SMTP errors (or with expected missing SMTP in staging)

## Auth & onboarding

- [ ] Register / login / logout
- [ ] Onboarding completes and `onboarding_completed` flips
- [ ] Password reset email path (staging)

## Feed & social

- [ ] Create post with media, poll, location
- [ ] React (5 types), comment, quote/echo, save, unsave
- [ ] Saved screen filters (All / Posts / Reels / Ideas / Stories)
- [ ] Search multi-category + tag feed (`#tag`)
- [ ] Story Map shows markers; tap opens viewer
- [ ] Push notification received on like/comment (device build)

## Reels / Live

- [ ] Create reel with music trim + green-screen chroma preview
- [ ] Playback shows cosmic backdrop when `effect_meta.chroma_key`
- [ ] Live start / join / chat (WebRTC)

## Payments / subscriptions

- [ ] Stripe test mode: Premium plan checkout → success redirect
- [ ] Creator tier checkout from Creator Studio
- [ ] Shop item purchase / wallet coin pack (test keys)
- [ ] Webhook endpoint receives `checkout.session.completed` (Stripe CLI or dashboard)

## Moderation / safety

- [ ] Report post / user
- [ ] Shadow-ban from admin → content hidden for others
- [ ] Marketing campaign preview (admin) does not send until Send
- [ ] Quiet hours / read receipts preference saves

## Worlds (mobile depth)

- [ ] Forge: filters, create with premise, add segment (`content`), save/share
- [ ] Museum: exhibition chips + lesson on create
- [ ] Garden: growth-stage labels; opens Bazaar detail
- [ ] Simulator: sliders change alternate scores; re-roll

## Accessibility smoke

- [ ] VoiceOver/TalkBack: reaction buttons, map refresh, chroma toggle announce labels
- [ ] Icon-only controls have `accessibilityLabel`
- [ ] Hit targets feel ≥ 44pt on primary actions

## Go / no-go

- [ ] `cd backend && python manage.py check`
- [ ] `cd mobile && npx tsc --noEmit`
- [ ] `cd outverse-dashboard && npx tsc --noEmit`
- [ ] No secrets in git (`git status` clean of `.env`)
- [ ] `DJANGO_DEBUG=False` on prod
