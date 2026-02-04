export interface User {
  id: string;
  googleId: string;
  email: string;
  displayName: string;
  telegramChatId: string | null;
  telegramLinkToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}
