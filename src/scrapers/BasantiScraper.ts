import { Page } from 'playwright';
import { BaseScraper } from './BaseScraper';
import { ShopConfig } from '../types';
import { Logger } from '../services/Logger';

/**
 * Custom scraper for Basanti shop.
 * Overrides availability check to handle disabled button logic.
 */
export class BasantiScraper extends BaseScraper {
  constructor(config: ShopConfig, logger?: Logger) {
    super(config, logger);
  }

  /**
   * Custom availability check for Basanti.
   * Product is available if the add-to-cart button is NOT disabled.
   */
  protected async checkAvailability(page: Page): Promise<boolean> {
    try {
      const button = page.locator('button.myButton_en[data-button-action="add-to-cart"]');

      // Check if button exists
      const buttonCount = await button.count();
      if (buttonCount === 0) {
        return false;
      }

      // Check if button is disabled
      const isDisabled = await button.getAttribute('disabled');

      // Available if button exists and is NOT disabled
      const isAvailable = isDisabled === null;

      return isAvailable;
    } catch (error) {
      this.logger.error('Error checking Basanti availability', {
        shop: this.config.id,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}
