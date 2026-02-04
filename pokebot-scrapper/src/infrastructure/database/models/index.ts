// Shared models (from @pokebot/shared)
export { ProductResultModel, type IProductResultDoc } from '@pokebot/shared';
export { UserModel, type IUserDoc } from '@pokebot/shared';
export { UserWatchEntryModel, type IUserWatchEntryDoc } from '@pokebot/shared';
export { NotificationModel, type INotificationDoc, type INotificationPayload } from '@pokebot/shared';

// Local models (scrapper-only)
export { WatchlistProductModel, type IWatchlistProductDoc } from './watchlist-product.model';
export { NotificationStateModel, type INotificationStateDoc } from './notification-state.model';
