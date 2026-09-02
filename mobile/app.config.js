module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios.infoPlist,
      NSLocationWhenInUseUsageDescription:
        config.ios?.infoPlist?.NSLocationWhenInUseUsageDescription ||
        'Cosonova uses your location to center the Story Map and show nearby pins.',
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: true,
        NSExceptionDomains: {
          localhost: {
            NSExceptionAllowsInsecureHTTPLoads: true,
          },
        },
      },
    },
  },
  android: {
    ...config.android,
    permissions: Array.from(
      new Set([
        ...(config.android?.permissions || []),
        'ACCESS_COARSE_LOCATION',
        'ACCESS_FINE_LOCATION',
      ]),
    ),
  },
  plugins: [
    ...(config.plugins || []),
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Cosonova uses your location to center the Story Map and show nearby pins.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    // Local .env overrides; otherwise fall back to the production defaults
    // committed in app.json (EAS builds never see the gitignored .env).
    apiUrl: process.env.EXPO_PUBLIC_API_URL || config.extra?.apiUrl,
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || config.extra?.googleClientId || '',
    appleClientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || config.extra?.appleClientId || '',
  },
});
