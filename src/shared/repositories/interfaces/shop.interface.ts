/**
 * Shop repository interface.
 */

import { ShopConfig } from '../../types';
import { ICollectionRepository } from './collection.interface';

/**
 * Repository interface for accessing shop configurations.
 */
export interface IShopRepository extends ICollectionRepository<ShopConfig> {
  getEnabled(): Promise<ShopConfig[]>;
}
