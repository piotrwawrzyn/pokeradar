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
    private $: cheerio.CheerioAPI
  ) {}

  async getText(): Promise<string | null> {
    const text = this.element.text().trim();
    return text || null;
  }

  async getAttribute(name: string): Promise<string | null> {
    const attr = this.element.attr(name);
    return attr || null;
  }

  async find(selector: Selector): Promise<IElement | null> {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;
    // Text selectors use case-insensitive matching; CSS/XPath use direct selector
    const found = selector.type === 'text'
      ? findByTextInsensitive(this.$, this.element, value)
      : this.element.find(value);

    if (found.length === 0) {
      return null;
    }

    return new CheerioElement(found.first(), this.$);
  }

  async findAll(selector: Selector): Promise<IElement[]> {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;
    // Text selectors use case-insensitive matching; CSS/XPath use direct selector
    const found = selector.type === 'text'
      ? findByTextInsensitive(this.$, this.element, value)
      : this.element.find(value);

    const elements: IElement[] = [];
    found.each((_, el) => {
      elements.push(new CheerioElement(this.$(el), this.$));
    });

    return elements;
  }
}
