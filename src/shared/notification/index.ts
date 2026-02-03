/**
 * Notification module exports.
 */

export { NotificationStateService } from './notification-state.service';
export { MultiUserNotificationDispatcher } from './multi-user-dispatcher';
// Re-export type separately to avoid conflicts with repository interfaces
export type { INotificationStateRepository } from './notification-state.service';
