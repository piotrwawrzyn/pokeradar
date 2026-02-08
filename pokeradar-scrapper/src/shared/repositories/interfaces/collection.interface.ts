/**
 * Base repository interface for collection access.
 */

/**
 * Generic collection repository interface.
 */
export interface ICollectionRepository<T> {
  getAll(): Promise<T[]>;
  getById?(id: string): Promise<T | null>;
}
