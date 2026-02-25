/**
 * HTTP client for the pokeradar-ml sidecar service.
 * Implements a per-cycle circuit breaker: on first timeout/error, all subsequent
 * calls in that scrape cycle return null immediately to avoid blocking.
 */

import axios from 'axios';

export interface MLClassifyResult {
  productId: string | null;
  confidence: number;
}

export class MLClassifierClient {
  private available = true;

  constructor(
    private readonly baseUrl: string,
    private readonly threshold: number,
    private readonly timeoutMs: number = 3000,
  ) {}

  /**
   * Classifies a title against product centroids.
   * Returns null if the ML service is unavailable, timed out, or returns low confidence.
   */
  async classify(title: string): Promise<MLClassifyResult | null> {
    if (!this.available) return null;

    try {
      const response = await axios.post<MLClassifyResult>(
        `${this.baseUrl}/classify`,
        { title },
        { timeout: this.timeoutMs },
      );
      return response.data;
    } catch {
      this.available = false;
      return null;
    }
  }

  /**
   * Triggers centroid recalculation for a product (fire-and-forget).
   * Called after admin confirms/corrects a match.
   */
  async updateCentroid(productId: string): Promise<void> {
    if (!this.available) return;

    axios.post(`${this.baseUrl}/centroid/update`, { productId }, { timeout: 5000 }).catch(() => {
      /* fire-and-forget */
    });
  }

  /**
   * Resets the circuit breaker. Called at the start of each scrape cycle.
   */
  reset(): void {
    this.available = true;
  }

  isAvailable(): boolean {
    return this.available;
  }
}
