import { useCallback, useEffect, useState } from 'react';
import type { AxiosInstance } from 'axios';
import { Alert, Button, Card, Space, Spin, Typography } from 'antd';

type ConnectionState =
  | 'idle'
  | 'checking'
  | 'connected'
  | 'disconnected'
  | 'error';

interface GoogleDriveCardProps {
  apiClient: AxiosInstance;
  isAuthenticated: boolean;
  onConnectionChange: (connected: boolean) => void;
}

interface GoogleDriveStatusResponse {
  connected: boolean;
}

interface GoogleAuthorizationResponse {
  authorizationUrl: string;
}

function getCallbackResult(): 'connected' | 'error' | null {
  const result = new URLSearchParams(window.location.search).get('googleDrive');
  return result === 'connected' || result === 'error' ? result : null;
}

export function GoogleDriveCard({
  apiClient,
  isAuthenticated,
  onConnectionChange,
}: GoogleDriveCardProps) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('idle');
  const [actionLoading, setActionLoading] = useState(false);
  const [callbackResult] = useState(getCallbackResult);

  const loadStatus = useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      if (!isAuthenticated) {
        setConnectionState('idle');
        onConnectionChange(false);
        return;
      }

      setConnectionState('checking');

      try {
        const response = await apiClient.get<GoogleDriveStatusResponse>(
          '/google-drive/status',
          { signal },
        );
        setConnectionState(
          response.data.connected ? 'connected' : 'disconnected',
        );
        onConnectionChange(response.data.connected);
      } catch {
        if (!signal?.aborted) {
          setConnectionState('error');
          onConnectionChange(false);
        }
      }
    },
    [apiClient, isAuthenticated, onConnectionChange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadStatus(controller.signal);
    return () => controller.abort();
  }, [loadStatus]);

  useEffect(() => {
    if (!callbackResult) {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('googleDrive');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [callbackResult]);

  const connect = async (): Promise<void> => {
    setActionLoading(true);

    try {
      const response = await apiClient.get<GoogleAuthorizationResponse>(
        '/google-drive/connect',
      );
      window.location.assign(response.data.authorizationUrl);
    } catch {
      setConnectionState('error');
      setActionLoading(false);
    }
  };

  const disconnect = async (): Promise<void> => {
    setActionLoading(true);

    try {
      await apiClient.delete('/google-drive/disconnect');
      await loadStatus();
    } catch {
      setConnectionState('error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Card title="Google Drive">
      <Space direction="vertical" size="middle" className="full-width">
        {callbackResult === 'connected' && (
          <Alert type="success" showIcon message="Đã kết nối Google Drive" />
        )}
        {callbackResult === 'error' && (
          <Alert
            type="error"
            showIcon
            message="Không thể kết nối Google Drive"
            description="Yêu cầu đã bị từ chối, hết hạn hoặc không hợp lệ."
          />
        )}

        {!isAuthenticated && (
          <Typography.Text type="secondary">
            Đăng nhập để kết nối Google Drive.
          </Typography.Text>
        )}

        {isAuthenticated && connectionState === 'checking' && (
          <Space>
            <Spin size="small" />
            <Typography.Text>Đang kiểm tra kết nối...</Typography.Text>
          </Space>
        )}

        {isAuthenticated && connectionState === 'connected' && (
          <>
            <Typography.Text>Google Drive đã kết nối</Typography.Text>
            <Button danger loading={actionLoading} onClick={() => void disconnect()}>
              Ngắt kết nối
            </Button>
          </>
        )}

        {isAuthenticated && connectionState === 'disconnected' && (
          <>
            <Typography.Text>Google Drive chưa kết nối</Typography.Text>
            <Button
              type="primary"
              loading={actionLoading}
              onClick={() => void connect()}
            >
              Kết nối Google Drive
            </Button>
          </>
        )}

        {isAuthenticated && connectionState === 'error' && (
          <>
            <Alert
              type="error"
              showIcon
              message="Không thể kiểm tra kết nối Google Drive"
            />
            <Button loading={actionLoading} onClick={() => void loadStatus()}>
              Thử lại
            </Button>
          </>
        )}
      </Space>
    </Card>
  );
}
