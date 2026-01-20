import { Page, Locator } from 'playwright';
import { Selector, ExtractType } from '../types';

export class SelectorEngine {
  /**
   * Extracts content from a page or locator using the provided selector.
   * Supports fallback selectors - tries each selector in order until one succeeds.
   */
  async extract(
    pageOrLocator: Page | Locator,
    selector: Selector
  ): Promise<string | null> {
    const selectors = Array.isArray(selector.value)
      ? selector.value
      : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const element = await this.findElement(
          pageOrLocator,
          selector.type,
          selectorValue
        );

        if (element) {
          const value = await this.extractValue(
            element,
            selector.extract || 'text'
          );

          if (value) {
            return value;
          }
        }
      } catch (error) {
        // Try next selector in fallback chain
        continue;
      }
    }

    return null;  // All selectors failed
  }

  /**
   * Extracts content from all matching elements.
   */
  async extractAll(
    pageOrLocator: Page | Locator,
    selector: Selector
  ): Promise<Locator[]> {
    const selectors = Array.isArray(selector.value)
      ? selector.value
      : [selector.value];

    for (const selectorValue of selectors) {
      try {
        const locator = this.createLocator(
          pageOrLocator,
          selector.type,
          selectorValue
        );

        const count = await locator.count();
        if (count > 0) {
          return await locator.all();
        }
      } catch (error) {
        // Try next selector in fallback chain
        continue;
      }
    }

    return [];  // All selectors failed
  }

  /**
   * Finds a single element using the specified selector type.
   */
  private async findElement(
    pageOrLocator: Page | Locator,
    type: string,
    value: string
  ): Promise<Locator | null> {
    const locator = this.createLocator(pageOrLocator, type, value);
    const count = await locator.count();

    if (count === 0) {
      return null;
    }

    return locator.first();
  }

  /**
   * Creates a Playwright locator based on selector type.
   */
  private createLocator(
    pageOrLocator: Page | Locator,
    type: string,
    value: string
  ): Locator {
    switch (type) {
      case 'css':
        return pageOrLocator.locator(value);
      case 'xpath':
        return pageOrLocator.locator(`xpath=${value}`);
      case 'text':
        return pageOrLocator.locator(`text=${value}`);
      default:
        throw new Error(`Unknown selector type: ${type}`);
    }
  }

  /**
   * Extracts the desired value from an element.
   */
  private async extractValue(
    element: Locator,
    extractType: ExtractType
  ): Promise<string | null> {
    try {
      switch (extractType) {
        case 'href':
          return await element.getAttribute('href');
        case 'text':
          return await element.textContent();
        case 'innerHTML':
          return await element.innerHTML();
        default:
          return await element.textContent();
      }
    } catch (error) {
      return null;
    }
  }
}
