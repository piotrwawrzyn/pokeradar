/**
 * File-based implementation of shop repository.
 * Reads shop configurations from JSON files in a directory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ShopConfig } from '../../types';
import { IShopRepository } from '../interfaces';

export class FileShopRepository implements IShopRepository {
  constructor(private shopsDir: string) {}

  async getEnabled(): Promise<ShopConfig[]> {
    const all = await this.getAll();
    return all.filter((shop) => !shop.disabled);
  }

  async getAll(): Promise<ShopConfig[]> {
    const files = fs.readdirSync(this.shopsDir).filter((f) => f.endsWith('.json'));
    const shops: ShopConfig[] = [];

    for (const file of files) {
      const filePath = path.join(this.shopsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      shops.push(JSON.parse(content));
    }

    return shops;
  }

  async getById(id: string): Promise<ShopConfig | null> {
    const all = await this.getAll();
    return all.find((shop) => shop.id === id) || null;
  }
}
