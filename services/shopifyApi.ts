export interface ShopifyApiItem {
  timestamp: string;
  itemName: string;
  usdValue?: number;
  inrValue?: number;
  country?: string;
  orderNo?: string;
  [key: string]: any;
}

export interface ShopifyApiResponse {
  success: boolean;
  data?: Record<string, ShopifyApiItem>;
  message?: string;
}

const DEFAULT_TIMEOUT_MS = 30000;

export class ShopifyApiService {
  private getApiUrl(): string {
    const url = process.env.SHOPIFY_SALES_API_URL;
    if (!url || !url.trim()) {
      throw new Error('Configuration error: SHOPIFY_SALES_API_URL environment variable is missing.');
    }
    return url.trim();
  }

  /**
   * Fetch all sales records from the external Shopify / Other-Store Sales API endpoint.
   */
  async fetchSales(): Promise<ShopifyApiResponse> {
    let url: string;
    try {
      url = this.getApiUrl();
    } catch (err: any) {
      return {
        success: false,
        message: err.message || 'SHOPIFY_SALES_API_URL is not configured.'
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const startTime = Date.now();

    try {
      console.log(`[Shopify API] Fetching sales data from configured endpoint...`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;
      console.log(`[Shopify API] Response status: ${response.status} (${duration} ms)`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        return {
          success: false,
          message: `Shopify Sales API responded with status ${response.status}: ${errorText || response.statusText}`
        };
      }

      const json = await response.json();
      if (!json || typeof json !== 'object') {
        return {
          success: false,
          message: 'Invalid JSON payload received from Shopify Sales API.'
        };
      }

      // Handle standard response format { success: true, data: { ... } } or direct dictionary
      const salesData = json.data !== undefined ? json.data : json;

      if (!salesData || typeof salesData !== 'object') {
        return {
          success: true,
          data: {},
          message: 'Empty or missing sales data in API response.'
        };
      }

      return {
        success: true,
        data: salesData
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        console.error(`[Shopify API] Request timed out after ${DEFAULT_TIMEOUT_MS}ms`);
        return {
          success: false,
          message: `Shopify Sales API request timed out after ${DEFAULT_TIMEOUT_MS}ms`
        };
      }
      console.error('[Shopify API] Fetch error:', error?.message || error);
      return {
        success: false,
        message: error?.message || 'Failed to connect to Shopify Sales API.'
      };
    }
  }
}

export const shopifyApi = new ShopifyApiService();
