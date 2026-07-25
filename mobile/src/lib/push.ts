import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/api/client';

// Optional native modules: install expo-notifications and expo-device to enable this flow.
type ExpoNotificationsModule = {
  AndroidImportance?: { MAX?: unknown };
  getPermissionsAsync: () => Promise<{ status?: string; granted?: boolean; canAskAgain?: boolean }>;
  requestPermissionsAsync: () => Promise<{ status?: string; granted?: boolean }>;
  getExpoPushTokenAsync: (options?: { projectId?: string }) => Promise<{ data: string }>;
  getDevicePushTokenAsync?: () => Promise<{ data?: string; type?: string }>;
  setNotificationChannelAsync?: (
    channelId: string,
    options: { name: string; importance?: unknown },
  ) => Promise<unknown>;
};

type ExpoDeviceModule = {
  isDevice?: boolean;
};

const optionalImport = (name: string) => {
  const importer = new Function('moduleName', 'return import(moduleName)') as (
    moduleName: string,
  ) => Promise<unknown>;
  return importer(name);
};

async function loadPushModules() {
  try {
    const [notifications, device] = await Promise.all([
      optionalImport('expo-notifications') as Promise<ExpoNotificationsModule>,
      optionalImport('expo-device') as Promise<ExpoDeviceModule>,
    ]);
    return { notifications, device };
  } catch {
    return null;
  }
}

export type PushRegistrationResult = {
  ok: boolean;
  token?: string;
  endpoint?: string;
  reason?: string;
};

function getProjectId() {
  const constants = Constants as typeof Constants & {
    easConfig?: { projectId?: string };
    expoConfig?: typeof Constants.expoConfig & {
      extra?: Record<string, any>;
    };
  };
  return (
    constants.expoConfig?.extra?.eas?.projectId ||
    constants.easConfig?.projectId ||
    constants.expoConfig?.extra?.projectId
  );
}

export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  const modules = await loadPushModules();
  if (!modules) {
    return {
      ok: false,
      reason: 'Install expo-notifications and expo-device, then rebuild the mobile app.',
    };
  }

  const { notifications, device } = modules;
  if (device.isDevice === false) {
    return { ok: false, reason: 'Push notifications require a physical device.' };
  }

  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && permission.status !== 'granted' && permission.canAskAgain !== false) {
    permission = await notifications.requestPermissionsAsync();
  }
  if (!permission.granted && permission.status !== 'granted') {
    return { ok: false, reason: 'Notification permission was not granted.' };
  }

  if (Platform.OS === 'android' && notifications.setNotificationChannelAsync) {
    await notifications
      .setNotificationChannelAsync('default', {
        name: 'Default',
        importance: notifications.AndroidImportance?.MAX,
      })
      .catch(() => {});
  }

  let token = '';
  try {
    token = (await notifications.getExpoPushTokenAsync({ projectId: getProjectId() })).data;
  } catch {
    token = String((await notifications.getDevicePushTokenAsync?.())?.data || '');
  }

  if (!token) {
    return { ok: false, reason: 'Could not create a push token for this device.' };
  }

  const endpoint = token.startsWith('ExponentPushToken[')
    ? `expo://${token}`
    : `${Platform.OS}://${token}`;

  await api.request<{ subscribed: boolean }>('POST', '/notifications/push-subscribe/', {
    endpoint,
    keys: {
      p256dh: 'expo',
      auth: token,
    },
  });

  return { ok: true, token, endpoint };
}
