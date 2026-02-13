/**
 * Quick proxy test for both Cheerio (axios) and Playwright engines.
 * Usage: npx tsx scripts/test-proxy.ts
 */
import 'dotenv/config';
import axios from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { chromium } from 'playwright';

const PROXY_URL = process.env.PROXY_URL!;
const TEST_URL = 'https://httpbin.org/ip';
const SHOP_URL = 'https://strefakart.pl/wszystkie-produkty/?s=Prismatic%20Evolutions';

async function testAxios() {
  console.log('--- Testing axios with proxy ---');
  try {
    const agent = new HttpsProxyAgent(PROXY_URL);
    const res = await axios.get(TEST_URL, {
      httpAgent: agent,
      httpsAgent: agent,
      proxy: false,
      timeout: 15000,
    });
    console.log('IP:', res.data);
  } catch (err: any) {
    console.error('FAILED:', err.message);
  }
}

async function testShopPlaywright() {
  console.log('\n--- Testing strefakart.pl via Playwright + proxy ---');
  const parsed = new URL(PROXY_URL);
  const proxyConfig = {
    server: `http://${parsed.hostname}:${parsed.port || '80'}`,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };

  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      proxy: proxyConfig,
    });
    const page = await browser.newPage();
    await page.goto(SHOP_URL, { timeout: 20000, waitUntil: 'networkidle' });

    console.log('Final URL:', page.url());
    console.log('Title:', await page.title());

    // Check if products are found
    const products = await page.locator('li.product').all();
    console.log('Products found:', products.length);

    if (products.length === 0) {
      // Dump page content to see what we're getting
      const html = await page.content();
      console.log('\n--- Page HTML (first 2000 chars) ---');
      console.log(html.substring(0, 2000));
    } else {
      // Show first product title
      const firstTitle = await page.locator('li.product h2').first().textContent();
      console.log('First product:', firstTitle?.trim());
    }
  } catch (err: any) {
    console.error('FAILED:', err.message);
  } finally {
    await browser?.close();
  }
}

async function testShopDirect() {
  console.log('\n--- Testing strefakart.pl via Playwright WITHOUT proxy ---');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(SHOP_URL, { timeout: 20000, waitUntil: 'networkidle' });

    console.log('Final URL:', page.url());
    console.log('Title:', await page.title());

    const products = await page.locator('li.product').all();
    console.log('Products found:', products.length);

    if (products.length > 0) {
      const firstTitle = await page.locator('li.product h2').first().textContent();
      console.log('First product:', firstTitle?.trim());
    }
  } catch (err: any) {
    console.error('FAILED:', err.message);
  } finally {
    await browser?.close();
  }
}

(async () => {
  await testAxios();
  await testShopDirect();
  await testShopPlaywright();
})();
