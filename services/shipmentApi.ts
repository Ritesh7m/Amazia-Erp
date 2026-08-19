export interface ShipmentDetail {
  processCode?: string;
  shippingStatus?: string;
  customerName?: string;
  shippedAt?: string;
  orders?: string[];
  awbNumber?: string;
  [key: string]: any;
}

export interface OrderAwbsResponseData {
  orderNo: string;
  awbNumbers: string[];
  shipments: ShipmentDetail[];
}

export interface AwbOrdersResponseData {
  awbNumber: string;
  orders: string[];
  shipments: ShipmentDetail[];
}

const DEFAULT_TIMEOUT_MS = 30000;

class ShipmentApiService {
  private cachedToken: string | null = null;

  private getBaseUrl(): string {
    const url = process.env.SHIPMENT_API_BASE_URL || 'http://100.125.123.94:4000';
    return url.replace(/\/+$/, '');
  }

  private getUsername(): string {
    return process.env.SHIPMENT_API_USERNAME || 'ops';
  }

  private getPassword(): string {
    return process.env.SHIPMENT_API_PASSWORD || '123';
  }

  /**
   * Helper function to execute a fetch call with an isolated, per-request AbortController.
   */
  private async executeFetch(
    url: string,
    options: RequestInit,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    identifier: string = 'request'
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const startTime = Date.now();

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      const path = url.replace(this.getBaseUrl(), '');
      console.log(`[Shipment API] Response:\n${response.status}\n[Shipment API] Duration:\n${duration} ms`);

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error?.name === 'AbortError' || controller.signal.aborted) {
        console.log(`[Shipment API] Timeout:\n${identifier} after ${timeoutMs}ms`);
        throw new Error(`Order ${identifier}: The operation was aborted due to timeout`);
      }

      throw error;
    }
  }

  /**
   * Authenticate with the external shipment API and cache the JWT token.
   */
  async login(forceRefresh = false): Promise<string> {
    if (this.cachedToken && !forceRefresh) {
      return this.cachedToken;
    }

    const baseUrl = this.getBaseUrl();
    const loginUrl = `${baseUrl}/api/auth/login`;

    console.log(`[Shipment API] Request:\nPOST /api/auth/login`);

    try {
      const response = await this.executeFetch(
        loginUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username: this.getUsername(),
            password: this.getPassword(),
          }),
        },
        DEFAULT_TIMEOUT_MS,
        'login'
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Login failed with status ${response.status}: ${errorText}`);
      }

      const json = await response.json();
      const token = json?.data?.token;

      if (!token) {
        throw new Error('Login response did not contain a valid JWT token');
      }

      this.cachedToken = token;
      return token;
    } catch (error: any) {
      this.cachedToken = null;
      console.error('Shipment API authentication error:', error?.message || error);
      throw error;
    }
  }

  /**
   * Execute fetch against external API with JWT authorization, handles retry on 401.
   * Every request (and retry attempt) gets its own fresh AbortController.
   */
  private async fetchWithAuth(endpointPath: string, identifier: string): Promise<Response> {
    const baseUrl = this.getBaseUrl();
    const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
    const targetUrl = `${baseUrl}${cleanPath}`;

    let token = await this.login();

    console.log(`[Shipment API] Request:\nGET ${cleanPath}`);

    let response = await this.executeFetch(
      targetUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      },
      DEFAULT_TIMEOUT_MS,
      identifier
    );

    // Handle 401 Unauthorized: Invalidate cached token, login again, and retry once with fresh signal
    if (response.status === 401) {
      console.warn('Shipment API returned 401 Unauthorized. Retrying with fresh login...');
      this.cachedToken = null;
      token = await this.login(true);

      console.log(`[Shipment API] Request:\nGET ${cleanPath} (retry)`);
      response = await this.executeFetch(
        targetUrl,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
        },
        DEFAULT_TIMEOUT_MS,
        identifier
      );
    }

    return response;
  }

  /**
   * Fetch AWBs for a given order number.
   * Endpoint: GET /api/shipments/orders/{orderNo}/awbs
   */
  async getAwbsByOrder(orderNo: string): Promise<{ success: boolean; data?: OrderAwbsResponseData; message?: string }> {
    try {
      const response = await this.fetchWithAuth(`/api/shipments/orders/${encodeURIComponent(orderNo)}/awbs`, orderNo);

      if (response.status === 404) {
        return {
          success: true,
          data: {
            orderNo,
            awbNumbers: [],
            shipments: [],
          },
        };
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          message: `External Shipment API error (${response.status}): ${errText || response.statusText}`,
        };
      }

      const json = await response.json();

      if (!json || !json.data) {
        return {
          success: true,
          data: {
            orderNo,
            awbNumbers: [],
            shipments: [],
          },
        };
      }

      return {
        success: true,
        data: {
          orderNo: json.data.orderNo || orderNo,
          awbNumbers: json.data.awbNumbers || [],
          shipments: json.data.shipments || [],
        },
      };
    } catch (error: any) {
      console.error(`Error fetching AWBs for order ${orderNo}:`, error?.message || error);
      return {
        success: false,
        message: error?.message || `Order ${orderNo}: Shipment service unavailable`,
      };
    }
  }

  /**
   * Fetch orders for a given AWB number.
   * Endpoint: GET /api/shipments/awb/{awbNumber}
   */
  async getOrdersByAwb(awbNumber: string): Promise<{ success: boolean; data?: AwbOrdersResponseData; message?: string }> {
    try {
      const response = await this.fetchWithAuth(`/api/shipments/awb/${encodeURIComponent(awbNumber)}`, awbNumber);

      if (response.status === 404) {
        return {
          success: true,
          data: {
            awbNumber,
            orders: [],
            shipments: [],
          },
        };
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        return {
          success: false,
          message: `External Shipment API error (${response.status}): ${errText || response.statusText}`,
        };
      }

      const json = await response.json();

      if (!json || !json.data) {
        return {
          success: true,
          data: {
            awbNumber,
            orders: [],
            shipments: [],
          },
        };
      }

      return {
        success: true,
        data: {
          awbNumber: json.data.awbNumber || awbNumber,
          orders: json.data.orders || [],
          shipments: json.data.shipments || [],
        },
      };
    } catch (error: any) {
      console.error(`Error fetching orders for AWB ${awbNumber}:`, error?.message || error);
      return {
        success: false,
        message: error?.message || `AWB ${awbNumber}: Shipment service unavailable`,
      };
    }
  }
}

export const shipmentApi = new ShipmentApiService();
