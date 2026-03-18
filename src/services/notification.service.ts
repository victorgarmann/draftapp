// Push / local notification helpers
// expo-notifications handles both immediate local alerts and scheduled reminders.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// ── Android channels ──────────────────────────────────────────────────────────

async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('draft-turn', {
    name: 'Draft Turn Alerts',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
  });
  await Notifications.setNotificationChannelAsync('lineup-deadline', {
    name: 'Lineup Deadline Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
}

// ── Permission ────────────────────────────────────────────────────────────────

/** Request notification permissions. Returns true if granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false; // simulators can't receive notifications

  // Configure foreground notification behaviour (must run on device, not during SSR)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await ensureAndroidChannels();
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Draft turn ────────────────────────────────────────────────────────────────

/** Fire an immediate local notification telling the user it's their pick. */
export async function notifyYourDraftTurn(groupName?: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "It's your pick!",
        body: groupName
          ? `Your turn to draft in ${groupName}.`
          : 'Time to make your draft pick.',
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId: 'draft-turn' } : {}),
      },
      trigger: null, // fire immediately
    });
  } catch {
    // Silently ignore — notifications are non-critical
  }
}

// ── Lineup deadline reminders ─────────────────────────────────────────────────

const DEADLINE_PREFIX = 'lineup-deadline-';

/**
 * Schedule local notifications for an upcoming lineup deadline:
 * - 24 hours before
 * - 1 hour before
 *
 * Cancels any previously scheduled deadline reminders first.
 */
export async function scheduleDeadlineReminders(
  deadline: string,
  matchdayLabel: string,
): Promise<void> {
  await cancelDeadlineReminders();

  const deadlineMs = new Date(deadline).getTime();
  const now = Date.now();

  const reminders = [
    { id: '24h', offsetMs: 24 * 60 * 60 * 1000, text: '24 hours' },
    { id: '1h',  offsetMs: 60 * 60 * 1000,       text: '1 hour'  },
  ];

  for (const { id, offsetMs, text } of reminders) {
    const fireAt = deadlineMs - offsetMs;
    if (fireAt <= now) continue; // already in the past

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `${DEADLINE_PREFIX}${id}`,
        content: {
          title: 'Lineup Deadline Approaching',
          body: `${matchdayLabel} locks in ${text}. Set your starting XI now!`,
          sound: 'default',
          ...(Platform.OS === 'android' ? { channelId: 'lineup-deadline' } : {}),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(fireAt),
        },
      });
    } catch {
      // Silently ignore
    }
  }
}

/** Cancel all previously scheduled deadline reminder notifications. */
export async function cancelDeadlineReminders(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      if (n.identifier.startsWith(DEADLINE_PREFIX)) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // Silently ignore
  }
}
