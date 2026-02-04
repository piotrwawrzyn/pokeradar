// Shared models (from @pokeradar/shared)
export { ProductResultModel, type IProductResultDoc } from '@pokeradar/shared';
export { UserModel, type IUserDoc } from '@pokeradar/shared';
export { UserWatchEntryModel, type IUserWatchEntryDoc } from '@pokeradar/shared';
export { NotificationModel, type INotificationDoc, type INotificationPayload } from '@pokeradar/shared';

// Local models (scrapper-only)
export { WatchlistProductModel, type IWatchlistProductDoc } from './watchlist-product.model';
export { NotificationStateModel, type INotificationStateDoc } from './notification-state.model';
