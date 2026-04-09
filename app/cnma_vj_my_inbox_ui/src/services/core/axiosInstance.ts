import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { triggerSessionExpiredGlobal } from '@/components/providers/SessionTimeoutProvider';

const isLocal = false;

const axiosInstance: AxiosInstance = axios.create({
  baseURL: isLocal ? 'http://localhost:5000' : '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// CSRF Token cache
let csrfToken: string | null = null;
let tokenFetchPromise: Promise<string | null> | null = null;

/**
 * Fetch CSRF token from the server
 */
const fetchCsrfToken = async (): Promise<string | null> => {
  if (tokenFetchPromise) {
    return tokenFetchPromise;
  }

  tokenFetchPromise = (async () => {
    try {
      const response = await axios.get('odata/v4/inbox/$metadata', {
        headers: {
          'X-CSRF-Token': 'Fetch',
        },
      });
      csrfToken = response.headers['x-csrf-token'];
      return csrfToken;
    } catch (error) {
      console.warn('CSRF token fetch failed:', (error as any)?.response?.status);
      csrfToken = null;
      return null;
    } finally {
      tokenFetchPromise = null;
    }
  })();

  return tokenFetchPromise;
};

/**
 * Request interceptor - adds CSRF token to non-GET requests
 */
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = config.method?.toLowerCase();

    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      if (!csrfToken) {
        await fetchCsrfToken();
      }

      if (csrfToken && config.headers) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Response interceptor - handles CSRF token expiration (403) and session expiration (401)
 */
let isHandlingSessionExpiry = false;

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const responseCode = error.response?.data?.code;
    const responseError = error.response?.data?.error;

    // 401 Unauthorized -> session expired
    // Never hard-reload here to avoid reload loops when backend keeps returning 401.
    if (shouldHandleUnauthorized(error) && !isHandlingSessionExpiry) {
      isHandlingSessionExpiry = true;
      console.warn('[Session] Token expired -> showing session expired dialog.');
      triggerSessionExpiredGlobal();
      error.isUnauthorized = true;
      return Promise.reject(error);
    }

    // 403 on write operation -> likely CSRF token issue, retry once
    if (error.response?.status === 403 && !originalRequest._retry) {
      const method = originalRequest.method?.toLowerCase();
      const isWriteOp = method && ['post', 'put', 'patch', 'delete'].includes(method);

      if (isWriteOp) {
        originalRequest._retry = true;
        csrfToken = null;
        await fetchCsrfToken();

        if (csrfToken) {
          originalRequest.headers['X-CSRF-Token'] = csrfToken;
          return axiosInstance(originalRequest);
        }
      }
    }

    // Tag 403 for UI components to detect authorization denial
    if (error.response?.status === 403) {
      error.isForbidden = true;
    }
    if (responseCode === 'SAP_USER_MAPPING_MISSING') {
      error.isSapUserMappingMissing = true;
    }
    if (responseCode === 'SAP_CONNECTIVITY_ERROR') {
      error.isSapConnectivityError = true;
    }
    if (responseError === 'Unauthorized') {
      error.isUnauthorized = true;
    }

    return Promise.reject(error);
  }
);

function shouldHandleUnauthorized(error: any): boolean {
  if (error.response?.status !== 401) return false;

  const code = error.response?.data?.code;
  if (code === 'SAP_USER_MAPPING_MISSING' || code === 'SAP_CONNECTIVITY_ERROR') {
    return false;
  }

  const errorText = error.response?.data?.error;
  if (typeof errorText === 'string' && errorText === 'Unauthorized') {
    return true;
  }

  // If backend did not send a structured code, treat as real session expiration.
  return !code;
}

export default axiosInstance;
