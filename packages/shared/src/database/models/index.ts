export { NotificationModel } from './notification.model';
export type {
  INotificationDoc,
  INotificationPayload,
  IDelivery,
  NotificationChannel,
} from './notification.model';

export { NotificationStateModel } from './notification-state.model';
export type { INotificationStateDoc } from './notification-state.model';

export { UserModel } from './user.model';
export type { IUserDoc, IChannelData } from './user.model';

export { UserWatchEntryModel } from './user-watch-entry.model';
export type { IUserWatchEntryDoc } from './user-watch-entry.model';

export { ProductResultModel } from './product-result.model';
export type { IProductResultDoc } from './product-result.model';

export { ProductSetModel } from './product-set.model';
export type { IProductSetDoc } from './product-set.model';

export { ProductTypeModel } from './product-type.model';
export type { IProductTypeDoc, IMatchingProfile } from './product-type.model';

export { WatchlistProductModel } from './watchlist-product.model';
export type { IWatchlistProductDoc, ISearchOverride } from './watchlist-product.model';

export { MatchRejectionEventModel } from './match-rejection-event.model';
export type { IMatchRejectionEventDoc, RejectionReason } from './match-rejection-event.model';

export { MatchConfirmationEventModel } from './match-confirmation-event.model';
export type {
  IMatchConfirmationEventDoc,
  MatchBandValue,
  ConfirmationSource,
} from './match-confirmation-event.model';

export { PendingMatchModel } from './pending-match.model';
export type {
  IPendingMatchDoc,
  PendingMatchStatus,
  PendingMatchSource,
} from './pending-match.model';

export { SuppressedTitleModel } from './suppressed-title.model';
export type { ISuppressedTitleDoc, SuppressedReason } from './suppressed-title.model';

export { ClassificationCorrectionModel } from './classification-correction.model';
export type {
  IClassificationCorrectionDoc,
  CorrectionReason,
} from './classification-correction.model';
