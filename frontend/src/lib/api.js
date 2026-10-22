import axios from 'axios';

/**
 * Single axios instance for the whole app.
 *
 * The base URL defaults to the relative `/api` path so the Vite dev server (and
 * nginx in production) proxy requests to the Express API. That keeps cookies
 * same-origin, avoids hard-coded localhost URLs in the browser and works behind
 * preview proxies. Set VITE_API_URL only when the API lives on another origin.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let refreshSubscribers = [];

const subscribeTokenRefresh = (cb) => refreshSubscribers.push(cb);
const onRefreshed = (token) => {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
};

const clearSession = () => {
  localStorage.removeItem('accessToken');
  if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
    window.location.assign('/login');
  }
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const code = error.response?.data?.code;
    const isAuthCall = original?.url?.includes('/auth/refresh') || original?.url?.includes('/auth/login');

    // Access token expired → refresh once, queue concurrent requests.
    if (error.response?.status === 401 && code === 'TOKEN_EXPIRED' && !original?._retry && !isAuthCall) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token) => {
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
          setTimeout(() => reject(error), 15000);
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        const newToken = data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        onRefreshed(newToken);
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        clearSession();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    // Session invalid (logged out elsewhere / revoked) → back to login.
    if (error.response?.status === 401 && !isAuthCall && !original?._retry) {
      clearSession();
    }

    return Promise.reject(error);
  },
);

export default api;
