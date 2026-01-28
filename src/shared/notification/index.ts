/**
 * Notification module exports.
 */

export { NotificationService } from './notification.service';
export { NotificationStateService } from './notification-state.service';
// Re-export type separately to avoid conflicts with repository interfaces
export type { INotificationStateRepository } from './notification-state.service';
