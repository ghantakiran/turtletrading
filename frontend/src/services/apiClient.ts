import { env } from '@/config/env';

export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  defaultHeaders: Record<string, string>;
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private defaultHeaders: Record<string, string>;
  private authToken: string | null = null;

  constructor(config?: Partial<ApiClientConfig>) {
    this.baseURL = config?.baseURL || `${env.API_BASE_URL}/api/v1`;
    this.timeout = config?.timeout || env.API_TIMEOUT;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config?.defaultHeaders,
    };
  }

  /**
   * Set authentication token for all requests
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Get request headers with authentication
   */
  private getHeaders(customHeaders?: Record<string, string>): Record<string, string> {
    const headers = {
      ...this.defaultHeaders,
      ...customHeaders,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Make HTTP request with error handling and timeout
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const config: RequestInit = {
      ...options,
      headers: this.getHeaders(options.headers as Record<string, string>),
      signal: controller.signal,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorDetail: string | undefined;

        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.detail || errorMessage;
          errorDetail = errorData.detail;
        } catch {
          // If JSON parsing fails, use the default error message
        }

        const error = new Error(errorMessage) as any;
        error.status = response.status;
        error.detail = errorDetail;
        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      // For non-JSON responses
      return (await response.text()) as unknown as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      throw error;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
    const url = params
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;

    return this.request<T>(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T>(endpoint: string, data?: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  /**
   * Upload file with form data
   */
  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    // Don't set Content-Type for FormData, let the browser set it
    const headers = this.authToken
      ? { 'Authorization': `Bearer ${this.authToken}` }
      : {};

    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers,
    });
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    try {
      return await this.get('/health');
    } catch (error) {
      throw new Error(`API health check failed: ${error}`);
    }
  }

  /**
   * Get API base URL
   */
  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ApiClientConfig>): void {
    if (config.baseURL) this.baseURL = config.baseURL;
    if (config.timeout) this.timeout = config.timeout;
    if (config.defaultHeaders) {
      this.defaultHeaders = { ...this.defaultHeaders, ...config.defaultHeaders };
    }
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

export default apiClient;