/**
 * Generic bot interface.
 * Implement this for each bot platform (Telegram, Discord, etc.).
 */

export interface IBot {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
