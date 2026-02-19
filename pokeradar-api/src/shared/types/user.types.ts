export interface User {
  id: string;
  clerkId: string;
  telegramChatId: string | null;
  telegramLinkToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}
