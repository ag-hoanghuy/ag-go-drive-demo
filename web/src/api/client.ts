import axios from 'axios';
import { getDemoSessionId } from '../demo-session';

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 5_000,
});

apiClient.interceptors.request.use((config) => {
  config.headers.set('X-Demo-Session-Id', getDemoSessionId());
  return config;
});
