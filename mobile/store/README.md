# Cosonova store listing

Copy in `en-US/` and `ar-SA/` is ready to paste into Google Play Console and App Store Connect.

## First-time EAS

From `mobile/`:

```bash
npx eas login
npx eas init
npm run build:android
```

- `npm run build:android` — internal preview APK (native WebRTC)
- `npm run build:store:android` — Play Store AAB
- `npm run build:store:ios` — App Store IPA

Expo Go never runs native WebRTC. Voice/video in Expo Go opens Cosonova Chat in-app.

## Screenshots to capture (phone, light + dark if you can)

1. Home feed
2. Signals
3. Chat
4. Worlds hub
5. Profile

Play feature graphic: `play-feature-graphic.png` (1024×500).

Privacy: https://cosonova.com/privacy
Support: privacy@cosonova.com
Website: https://cosonova.com
