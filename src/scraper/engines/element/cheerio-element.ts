/**
 * Cheerio element wrapper implementing IElement interface.
 */

import type * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { Selector } from '../../../shared/types';
import { IElement } from '../engine.interface';

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
    const selectorValue = this.getSelectorValue(selector);
    const found = this.element.find(selectorValue);

    if (found.length === 0) {
      return null;
    }

    return new CheerioElement(found.first(), this.$);
  }

  async findAll(selector: Selector): Promise<IElement[]> {
    const selectorValue = this.getSelectorValue(selector);
    const found = this.element.find(selectorValue);

    const elements: IElement[] = [];
    found.each((_, el) => {
      elements.push(new CheerioElement(this.$(el), this.$));
    });

    return elements;
  }

  private getSelectorValue(selector: Selector): string {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;

    if (selector.type === 'text') {
      return `:contains("${value}")`;
    }

    if (selector.type === 'xpath') {
      console.warn(`XPath selector not supported in Cheerio engine: ${value}`);
      return value;
    }

    return value;
  }
}
