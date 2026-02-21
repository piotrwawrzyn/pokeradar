export interface User {
  id: string;
  clerkId: string;
  telegram: { channelId: string | null; linkToken: string | null };
  discord: { channelId: string | null; linkToken: string | null };
  createdAt: Date;
  updatedAt: Date;
}
