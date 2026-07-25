import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

function appleClientId(): string {
  return (
    process.env.EXPO_PUBLIC_APPLE_CLIENT_ID ||
    (Constants.expoConfig?.extra as { appleClientId?: string } | undefined)?.appleClientId ||
    ''
  );
}

/**
 * Obtain an Apple identity token.
 * Prefer native Sign in with Apple when available; fall back to web OAuth.
 */
export async function obtainAppleIdentityToken(): Promise<string> {
  try {
    // Optional native module — may be absent on Expo Go / Android.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AppleAuthentication = require('expo-apple-authentication');
    const available = await AppleAuthentication.isAvailableAsync();
    if (available) {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (cred?.identityToken) return cred.identityToken as string;
    }
  } catch {
    /* fall through to browser flow */
  }

  const clientId = appleClientId();
  if (!clientId) {
    throw new Error('EXPO_PUBLIC_APPLE_CLIENT_ID is not configured.');
  }
  const redirectUri = Linking.createURL('auth/apple');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    response_mode: 'fragment',
    scope: 'name email',
  });
  const authUrl = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Apple sign-in was cancelled.');
  }
  const hash = result.url.includes('#') ? result.url.split('#')[1] : '';
  const query = result.url.includes('?') ? result.url.split('?')[1]?.split('#')[0] : '';
  const fromHash = new URLSearchParams(hash);
  const fromQuery = new URLSearchParams(query || '');
  const idToken = fromHash.get('id_token') || fromQuery.get('id_token');
  if (!idToken) {
    throw new Error('Apple did not return an identity token.');
  }
  return idToken;
}
