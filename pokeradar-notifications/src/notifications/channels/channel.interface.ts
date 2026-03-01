/**
 * Notification channel interface.
 * Implement this for each delivery channel (Telegram, email, Discord, etc.).
 */

import { INotificationPayload } from '@pokeradar/shared';

export interface INotificationChannel {
  readonly name: string;
  send(target: string, payload: INotificationPayload): Promise<void>;
}
