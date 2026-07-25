import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

WebBrowser.maybeCompleteAuthSession();

function googleClientId(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    (Constants.expoConfig?.extra as { googleClientId?: string } | undefined)?.googleClientId ||
    ''
  );
}

/** Open Google OAuth and return an ID token for POST /users/auth/google/. */
export async function obtainGoogleIdToken(): Promise<string> {
  const clientId = googleClientId();
  if (!clientId) {
    throw new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID is not configured.');
  }
  const redirectUri = Linking.createURL('auth/google');
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce,
    prompt: 'select_account',
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }
  const hash = result.url.includes('#') ? result.url.split('#')[1] : '';
  const query = result.url.includes('?') ? result.url.split('?')[1]?.split('#')[0] : '';
  const fromHash = new URLSearchParams(hash);
  const fromQuery = new URLSearchParams(query || '');
  const idToken = fromHash.get('id_token') || fromQuery.get('id_token');
  if (!idToken) {
    throw new Error('Google did not return an id_token. Check redirect URI allowlist.');
  }
  return idToken;
}
