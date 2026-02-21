/**
 * Cheerio element wrapper implementing IElement interface.
 */

import type * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { Selector } from '../../../shared/types';
import { IElement } from '../engine.interface';
import { findByTextInsensitive } from '../selector-utils';

/**
 * Element wrapper for Cheerio selections.
 */
export class CheerioElement implements IElement {
  constructor(
    private element: cheerio.Cheerio<AnyNode>,
    private $: cheerio.CheerioAPI,
  ) {}

  async getText(): Promise<string | null> {
    const text = this.element.text().trim();
    return text || null;
  }

  async getOwnText(): Promise<string | null> {
    const text = this.element
      .contents()
      .filter((_, n) => n.type === 'text')
      .text()
      .trim();
    return text || null;
  }

  async getAttribute(name: string): Promise<string | null> {
    const attr = this.element.attr(name);
    return attr || null;
  }

  async find(selector: Selector): Promise<IElement | null> {
    const values = Array.isArray(selector.value) ? selector.value : [selector.value];
    for (const value of values) {
      // Text selectors use case-insensitive matching; CSS/XPath use direct selector
      const found =
        selector.type === 'text'
          ? findByTextInsensitive(this.$, this.element, value)
          : this.element.find(value);

      if (found.length > 0) {
        return new CheerioElement(found.first(), this.$);
      }
    }
    return null;
  }

  async matches(selector: Selector): Promise<boolean> {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;
    return this.element.is(value);
  }

  async findAll(selector: Selector): Promise<IElement[]> {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;
    // Text selectors use case-insensitive matching; CSS/XPath use direct selector
    const found =
      selector.type === 'text'
        ? findByTextInsensitive(this.$, this.element, value)
        : this.element.find(value);

    const elements: IElement[] = [];
    found.each((_, el) => {
      elements.push(new CheerioElement(this.$(el), this.$));
    });

    return elements;
  }
}
