// Shared models (from @pokeradar/shared)
export { UserModel, type IUserDoc } from '@pokeradar/shared';
export { UserWatchEntryModel, type IUserWatchEntryDoc } from '@pokeradar/shared';
export { ProductResultModel, type IProductResultDoc } from '@pokeradar/shared';
export { AppSettingsModel, getAppSettings, type IAppSettingsDoc } from '@pokeradar/shared';

// Local models (api-only)
export { WatchlistProductModel } from './product.model';
export type { IWatchlistProductDoc } from './product.model';

export { ProductSetModel } from './product-set.model';
export type { IProductSetDoc } from './product-set.model';
