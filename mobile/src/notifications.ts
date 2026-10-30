import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

// Phase 1: local notifications (new messages / new requests found while the app polls) and the
// permission + channel setup. Phase 2 (server push) needs a Firebase project: add
// google-services.json, then send the token below to the server.
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', { name: 'Uithoorn.online', importance: Notifications.AndroidImportance.HIGH, lightColor: '#2250CE' });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

export async function notificationsGranted(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Push token for phase 2. Returns null until Firebase (FCM) / an EAS project id is configured. */
export async function getPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId;
    if (!projectId) return null;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return null;
  }
}

export async function notifyLocal(title: string, body: string, data: Record<string, unknown> = {}) {
  if (Platform.OS === 'web') return;
  try { await Notifications.scheduleNotificationAsync({ content: { title, body, data }, trigger: null }); } catch { /* ignore */ }
}
