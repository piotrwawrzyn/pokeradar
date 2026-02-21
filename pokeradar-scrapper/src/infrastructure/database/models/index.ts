// Shared models (from @pokeradar/shared)
export { ProductResultModel, type IProductResultDoc } from '@pokeradar/shared';
export { UserModel, type IUserDoc } from '@pokeradar/shared';
export { UserWatchEntryModel, type IUserWatchEntryDoc } from '@pokeradar/shared';
export {
  NotificationModel,
  type INotificationDoc,
  type INotificationPayload,
} from '@pokeradar/shared';
export { ProductSetModel, type IProductSetDoc } from '@pokeradar/shared';
export { ProductTypeModel, type IProductTypeDoc } from '@pokeradar/shared';
export { WatchlistProductModel, type IWatchlistProductDoc } from '@pokeradar/shared';

// Local models (scrapper-only)
export { NotificationStateModel, type INotificationStateDoc } from './notification-state.model';
