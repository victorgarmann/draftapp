// Web stub — expo-notifications is not supported on web (SSR-safe no-ops)

export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function notifyYourDraftTurn(_groupName?: string): Promise<void> {}

export async function scheduleDeadlineReminders(
  _deadline: string,
  _matchdayLabel: string,
): Promise<void> {}

export async function cancelDeadlineReminders(): Promise<void> {}
