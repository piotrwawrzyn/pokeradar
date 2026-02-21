/**
 * Proxy configuration utility for rotating proxy support (e.g. Webshare).
 *
 * Two conditions must be met for a shop to use proxy:
 *   1. Global toggle: PROXY_ENABLED=true in .env
 *   2. Per-shop opt-in: antiBot.useProxy=true in shop JSON config
 *
 * This design lets you disable proxy globally (e.g. for local development)
 * while keeping per-shop configs intact.
 */

import { ShopConfig } from '../types';

/** Parsed proxy connection details, derived from PROXY_URL env var. */
export interface ProxyConfig {
  url: string; // Full proxy URL (e.g. http://user:pass@host:port)
  host: string; // Proxy hostname (e.g. p.webshare.io)
  port: number; // Proxy port (e.g. 80)
  username: string; // Proxy auth username
  password: string; // Proxy auth password
}

/**
 * Returns parsed proxy config if proxy is enabled globally and for the given shop.
 * Returns null if proxy should not be used (either disabled globally or not configured for shop).
 */
export function getProxyConfig(shop: ShopConfig): ProxyConfig | null {
  if (process.env.PROXY_ENABLED !== 'true' || !shop.antiBot?.useProxy) {
    return null;
  }

  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) {
    return null;
  }

  const parsed = new URL(proxyUrl);

  return {
    url: proxyUrl,
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : parsed.protocol === 'https:' ? 443 : 80,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}
