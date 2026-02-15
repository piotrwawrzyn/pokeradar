/**
 * Playwright element wrapper implementing IElement interface.
 */

import { Locator } from 'playwright';
import { Selector } from '../../../shared/types';
import { IElement } from '../engine.interface';

/**
 * Logger interface for element operations.
 */
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Element wrapper for Playwright Locators.
 */
export class PlaywrightElement implements IElement {
  constructor(private locator: Locator, private logger?: ILogger) {}

  async getText(): Promise<string | null> {
    try {
      const text = await this.locator.textContent();
      return text?.trim() || null;
    } catch (error) {
      this.logger?.debug('PlaywrightElement.getText failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async getAttribute(name: string): Promise<string | null> {
    try {
      return await this.locator.getAttribute(name);
    } catch (error) {
      this.logger?.debug('PlaywrightElement.getAttribute failed', {
        attribute: name,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async find(selector: Selector): Promise<IElement | null> {
    try {
      const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;
      let locator: Locator;

      // Handle text selector with case-insensitive matching
      if (selector.type === 'text') {
        locator = this.locator.getByText(new RegExp(value, 'i'));
      } else {
        const selectorString = this.getSelectorString(selector);
        locator = this.locator.locator(selectorString);
      }

      // Use all() which returns immediately without waiting
      const elements = await locator.all();

      if (elements.length === 0) {
        return null;
      }

      return new PlaywrightElement(locator.first(), this.logger);
    } catch (error) {
      this.logger?.debug('PlaywrightElement.find failed', {
        selector: selector.value,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async findAll(selector: Selector): Promise<IElement[]> {
    try {
      const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;
      let locator: Locator;

      // Handle text selector with case-insensitive matching
      if (selector.type === 'text') {
        locator = this.locator.getByText(new RegExp(value, 'i'));
      } else {
        locator = this.locator.locator(this.getSelectorString(selector));
      }

      // Use all() which returns immediately
      const rawElements = await locator.all();

      if (rawElements.length === 0) {
        return [];
      }

      // Wrap each raw locator in PlaywrightElement
      return rawElements.map((_, i) => new PlaywrightElement(locator.nth(i), this.logger));
    } catch (error) {
      this.logger?.debug('PlaywrightElement.findAll failed', {
        selector: selector.value,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private getSelectorString(selector: Selector): string {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;

    switch (selector.type) {
      case 'css':
        return value;
      case 'xpath':
        return `xpath=${value}`;
      case 'text':
        return `text=${value}`;
      default:
        throw new Error(`Unknown selector type: ${selector.type}`);
    }
  }
}
