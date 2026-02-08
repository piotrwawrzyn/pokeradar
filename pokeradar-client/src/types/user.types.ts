export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  telegramLinked: boolean;
  telegramLinkToken: string | null;
}

export interface TelegramLinkToken {
  telegramLinkToken: string;
}
