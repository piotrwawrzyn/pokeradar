// Shared models (from @pokebot/shared)
export { UserModel, type IUserDoc } from '@pokebot/shared';
export { UserWatchEntryModel, type IUserWatchEntryDoc } from '@pokebot/shared';
export { ProductResultModel, type IProductResultDoc } from '@pokebot/shared';

// Local models (api-only)
export { WatchlistProductModel } from './product.model';
export type { IWatchlistProductDoc } from './product.model';

export { ProductSetModel } from './product-set.model';
export type { IProductSetDoc } from './product-set.model';
