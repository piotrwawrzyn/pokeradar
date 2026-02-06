/**
 * Bot platform interface.
 * A platform (Telegram, Discord, etc.) provides both interactive command handling
 * and notification delivery through a single connection.
 */

import { INotificationChannel } from '../notifications/channels/channel.interface';

export interface IBotPlatform {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  asNotificationChannel(): INotificationChannel;
}
