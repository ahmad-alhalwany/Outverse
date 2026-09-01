type NavLike = {
  navigate: (name: string, params?: object) => void;
};

export const COSONOVA_SITE = 'https://cosonova.com';

export function openInAppWeb(
  navigation: NavLike,
  title: string,
  url: string,
  opts?: { media?: boolean },
) {
  navigation.navigate('InAppWeb', { title, url, media: !!opts?.media });
}

export function openWebChat(
  navigation: NavLike,
  title: string,
  path = '/chat',
  opts?: { media?: boolean },
) {
  openInAppWeb(navigation, title, `${COSONOVA_SITE}${path}`, opts);
}

export function offerNativeCallFallback(
  navigation: NavLike,
  t: (key: string) => string,
  path = '/chat',
) {
  void (async () => {
    openWebChat(navigation, t('nav.chat'), path, { media: true });
  })();
}

export function goTab(navigation: NavLike, screen: 'Home' | 'Signals' | 'Daily' | 'Profile' | 'More') {
  navigation.navigate('MainTabs', { screen });
}

export function openProfile(navigation: NavLike, username?: string | null, myUsername?: string | null) {
  const handle = (username || '').replace(/^@/, '').trim();
  if (!handle || (myUsername && handle === myUsername)) {
    goTab(navigation, 'Profile');
    return;
  }
  navigation.navigate('UserProfile', { username: handle });
}
