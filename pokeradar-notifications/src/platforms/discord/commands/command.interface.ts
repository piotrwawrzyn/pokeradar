import { ChatInputCommandInteraction } from 'discord.js';

export interface IDiscordCommand {
  readonly command: string;
  readonly description: string;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
