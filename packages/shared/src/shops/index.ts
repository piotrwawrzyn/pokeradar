import * as fs from 'fs';
import * as path from 'path';

export interface ShopInfo {
  id: string;
  name: string;
  baseUrl: string;
  disabled?: boolean;
}

export function getShopConfigDir(): string {
  return path.join(__dirname, '../config/shops');
}

export function loadShopInfos(): ShopInfo[] {
  const dir = getShopConfigDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  return files.map((f) => {
    const content = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8'));
    return {
      id: content.id,
      name: content.name,
      baseUrl: content.baseUrl,
      disabled: content.disabled,
    };
  });
}
