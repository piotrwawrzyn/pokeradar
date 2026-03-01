export interface ChannelStatus {
  linked: boolean;
  linkToken: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  telegram: ChannelStatus;
  discord: ChannelStatus;
}

export interface LinkToken {
  linkToken: string;
}

export interface UnlinkResult {
  watchlistCleared: boolean;
}
