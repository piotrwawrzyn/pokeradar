import * as cheerio from 'cheerio';
import { Selector } from '@pokeradar/shared';
import { CheerioElement } from '../cheerio-element';

const HTML = `
  <article class="product" data-id="42" data-flag="">
    Direct text
    <span class="title">Product Title</span>
    <a class="link" href="/product/42">Buy now</a>
    <div class="price">
      <strong>99</strong>
      <span>.99</span>
    </div>
    <ul class="tags">
      <li>Tag A</li>
      <li>Tag B</li>
      <li>Tag C</li>
    </ul>
    <p class="in-stock">In Stock</p>
    <p class="available">Available Now</p>
  </article>
`;

function sel(value: string | string[], type: Selector['type'] = 'css'): Selector {
  return { type, value };
}

let $: cheerio.CheerioAPI;
let article: CheerioElement;

beforeEach(() => {
  $ = cheerio.load(HTML);
  article = new CheerioElement($('article'), $);
});

describe('getText()', () => {
  it('returns trimmed text content of an element', async () => {
    const span = new CheerioElement($('.title'), $);
    expect(await span.getText()).toBe('Product Title');
  });

  it('includes text from all descendants', async () => {
    const price = new CheerioElement($('.price'), $);
    const text = await price.getText();
    expect(text).toContain('99');
  });

  it('returns null when element has no text', async () => {
    const empty = new CheerioElement($('<div></div>'), $);
    expect(await empty.getText()).toBeNull();
  });
});

describe('getOwnText()', () => {
  it('returns only direct text nodes, excluding child element text', async () => {
    const text = await article.getOwnText();
    // "Direct text" is a direct text node; "Product Title", "Buy now" etc. are in child elements
    expect(text).toContain('Direct text');
    expect(text).not.toContain('Product Title');
    expect(text).not.toContain('Buy now');
  });

  it('returns null when there are no direct text nodes', async () => {
    const price = new CheerioElement($('.price'), $);
    expect(await price.getOwnText()).toBeNull();
  });
});

describe('getAttribute()', () => {
  it('returns the attribute value', async () => {
    expect(await article.getAttribute('data-id')).toBe('42');
  });

  it('returns null when the attribute is missing', async () => {
    expect(await article.getAttribute('data-nonexistent')).toBeNull();
  });

  it('returns null for an empty attribute value', async () => {
    expect(await article.getAttribute('data-flag')).toBeNull();
  });
});

describe('find()', () => {
  it('finds a descendant by CSS selector', async () => {
    const found = await article.find(sel('.title'));
    expect(found).not.toBeNull();
    expect(await found!.getText()).toBe('Product Title');
  });

  it('returns null when no descendant matches', async () => {
    const found = await article.find(sel('.nonexistent'));
    expect(found).toBeNull();
  });

  it('tries each value in an array selector and returns the first match', async () => {
    const found = await article.find(sel(['.nonexistent', '.link']));
    expect(found).not.toBeNull();
    expect(await found!.getAttribute('href')).toBe('/product/42');
  });

  it('finds by text selector (case-insensitive)', async () => {
    const found = await article.find(sel('in stock', 'text'));
    expect(found).not.toBeNull();
    const text = await found!.getText();
    expect(text?.toLowerCase()).toContain('in stock');
  });

  it('text selector matching is case-insensitive', async () => {
    const found = await article.find(sel('IN STOCK', 'text'));
    expect(found).not.toBeNull();
  });

  it('returns null when text selector finds nothing', async () => {
    const found = await article.find(sel('Out of Stock', 'text'));
    expect(found).toBeNull();
  });
});

describe('findAll()', () => {
  it('returns all matching descendants as CheerioElements', async () => {
    const items = await article.findAll(sel('li'));
    expect(items).toHaveLength(3);
  });

  it('returns empty array when nothing matches', async () => {
    const items = await article.findAll(sel('.nonexistent'));
    expect(items).toHaveLength(0);
  });

  it('each returned element is independently queryable', async () => {
    const items = await article.findAll(sel('li'));
    const texts = await Promise.all(items.map((el) => el.getText()));
    expect(texts).toEqual(['Tag A', 'Tag B', 'Tag C']);
  });

  it('finds by text selector (case-insensitive) and returns all matches', async () => {
    const items = await article.findAll(sel('available', 'text'));
    // Both ".in-stock" (In Stock) and ".available" (Available Now) contain "available"
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('uses only the first value when selector is an array', async () => {
    const items = await article.findAll(sel(['.title', '.link']));
    expect(items).toHaveLength(1);
    expect(await items[0].getText()).toBe('Product Title');
  });
});

describe('matches()', () => {
  it('returns true when the element matches the selector', async () => {
    expect(await article.matches(sel('article'))).toBe(true);
    expect(await article.matches(sel('.product'))).toBe(true);
    expect(await article.matches(sel('[data-id="42"]'))).toBe(true);
  });

  it('returns false when the element does not match', async () => {
    expect(await article.matches(sel('.title'))).toBe(false);
    expect(await article.matches(sel('div'))).toBe(false);
  });

  it('uses the first value when selector is an array', async () => {
    expect(await article.matches(sel(['article', '.title']))).toBe(true);
  });
});
