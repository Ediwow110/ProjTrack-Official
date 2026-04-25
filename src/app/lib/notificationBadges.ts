export type NotificationBadgeRole = "student" | "teacher" | "admin";

const NOTIFICATION_BADGE_INVALIDATED_EVENT = "projtrack:notification-badge-invalidated";

type NotificationBadgeInvalidationDetail = {
  role: NotificationBadgeRole;
};

export function invalidateNotificationBadge(role: NotificationBadgeRole) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<NotificationBadgeInvalidationDetail>(NOTIFICATION_BADGE_INVALIDATED_EVENT, {
      detail: { role },
    }),
  );
}

export function subscribeNotificationBadgeInvalidation(
  listener: (detail: NotificationBadgeInvalidationDetail) => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<NotificationBadgeInvalidationDetail>;
    if (!customEvent.detail?.role) return;
    listener(customEvent.detail);
  };

  window.addEventListener(NOTIFICATION_BADGE_INVALIDATED_EVENT, handler);
  return () => window.removeEventListener(NOTIFICATION_BADGE_INVALIDATED_EVENT, handler);
}
