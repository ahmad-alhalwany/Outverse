module.exports = ({ config }) => ({
  ...config,
  ios: {
    ...config.ios,
    infoPlist: {
      ...config.ios.infoPlist,
      NSLocationWhenInUseUsageDescription:
        config.ios?.infoPlist?.NSLocationWhenInUseUsageDescription ||
        'Cosmory uses your location to center the Story Map and show nearby pins.',
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
          'Cosmory uses your location to center the Story Map and show nearby pins.',
      },
    ],
  ],
  extra: {
    ...config.extra,
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8000/api',
    googleClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
    appleClientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || '',
  },
});
