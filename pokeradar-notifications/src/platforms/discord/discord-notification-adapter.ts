import { Client } from 'discord.js';
import { INotificationChannel } from '../../notifications/channels/channel.interface';
import { INotificationPayload } from '@pokeradar/shared';
import { formatDiscordNotification } from '../../messages/notification.messages';

export class DiscordNotificationAdapter implements INotificationChannel {
  readonly name = 'discord';

  constructor(private client: Client) {}

  async send(target: string, payload: INotificationPayload): Promise<void> {
    const user = await this.client.users.fetch(target);
    await user.send(formatDiscordNotification(payload));
  }
}
