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
      const locator = this.createLocator(selector);
      const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

      if (count === 0) {
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
      const locator = this.createLocator(selector);
      const count = await locator.evaluateAll((els) => els.length).catch(() => 0);

      if (count === 0) {
        return [];
      }

      const elements: IElement[] = [];
      for (let i = 0; i < count; i++) {
        elements.push(new PlaywrightElement(locator.nth(i), this.logger));
      }
      return elements;
    } catch (error) {
      this.logger?.debug('PlaywrightElement.findAll failed', {
        selector: selector.value,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  private createLocator(selector: Selector): Locator {
    const value = Array.isArray(selector.value) ? selector.value[0] : selector.value;

    switch (selector.type) {
      case 'css':
        return this.locator.locator(value);
      case 'xpath':
        return this.locator.locator(`xpath=${value}`);
      case 'text':
        return this.locator.locator(`text=${value}`);
      default:
        throw new Error(`Unknown selector type: ${selector.type}`);
    }
  }
}
