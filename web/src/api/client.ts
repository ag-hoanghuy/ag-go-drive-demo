import axios, { type AxiosInstance } from 'axios';

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() || 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 5_000,
});

export function createAuthenticatedApiClient(
  getAccessToken: () => Promise<string | undefined>,
): AxiosInstance {
  const authenticatedClient = axios.create({
    baseURL: apiBaseUrl,
    timeout: 5_000,
  });

  authenticatedClient.interceptors.request.use(async (config) => {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      throw new Error('Không lấy được Auth0 access token');
    }

    config.headers.set('Authorization', `Bearer ${accessToken}`);
    return config;
  });

  return authenticatedClient;
}
