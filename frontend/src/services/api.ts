import { env, apiEndpoints } from '@/config/env';

// Base API configuration using centralized environment management
export const API_BASE_URL = `${env.API_BASE_URL}/api/v1`;
export const API_TIMEOUT = env.API_TIMEOUT;

// API Error types
export interface ApiError {
  message: string;
  status: number;
  detail?: string;
}

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// Create custom error class for API errors
export class ApiException extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.detail = detail;
  }
}

// Generic fetch wrapper with error handling and timeout support
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Get auth token from localStorage if available
  const token = localStorage.getItem('auth_token');
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }

  // Create AbortController for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  const config: RequestInit = {
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
    signal: controller.signal,
    ...options,
  };

  try {
    const response = await fetch(url, config);
    
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
      
      throw new ApiException(errorMessage, response.status, errorDetail);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    // For non-JSON responses
    return await response.text() as unknown as T;
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    
    // Network or other errors
    throw new ApiException(
      error instanceof Error ? error.message : 'Network error',
      0
    );
  }
}

// Convenience methods for common HTTP verbs
export const api = {
  get: <T>(endpoint: string, params?: Record<string, string>) => {
    const url = params 
      ? `${endpoint}?${new URLSearchParams(params).toString()}`
      : endpoint;
    return apiRequest<T>(url);
  },
  
  post: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  put: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  patch: <T>(endpoint: string, data?: unknown) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    }),
    
  delete: <T>(endpoint: string) =>
    apiRequest<T>(endpoint, {
      method: 'DELETE',
    }),
};