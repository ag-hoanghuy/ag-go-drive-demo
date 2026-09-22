import { useEffect, useRef, useState } from 'react';
import type { AxiosInstance } from 'axios';
import {
  DrivePicker,
  DrivePickerDocsView,
} from '@googleworkspace/drive-picker-react';
import type { DrivePickerProps } from '@googleworkspace/drive-picker-react';
import { Alert, Button, Card, List, Space, Typography } from 'antd';
import type { GoogleDriveImportResult } from './drive.types';

interface DriveImportCardProps {
  apiClient: AxiosInstance;
  driveConnected: boolean;
  storageConfigured: boolean;
}

interface GooglePickerTokenResponse {
  accessToken: string;
}

interface SelectedDriveItem {
  id: string;
  name: string;
  mimeType: string;
}

interface PickerInstance {
  id: number;
  accessToken: string;
}

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const pickerAppId = import.meta.env.VITE_GOOGLE_DRIVE_APP_ID?.trim();
const pickerDeveloperKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY?.trim();

export function DriveImportCard({
  apiClient,
  driveConnected,
  storageConfigured,
}: DriveImportCardProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedDriveItem[]>([]);
  const [pickerInstance, setPickerInstance] = useState<PickerInstance | null>(
    null,
  );
  const [openingPicker, setOpeningPicker] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<GoogleDriveImportResult | null>(null);
  const [requestError, setRequestError] = useState(false);
  const pickerSequence = useRef(0);

  useEffect(() => {
    if (!driveConnected) {
      setSelectedItems([]);
      setPickerInstance(null);
      setResult(null);
    }
  }, [driveConnected]);

  const openPicker = async (): Promise<void> => {
    if (!pickerAppId || !pickerDeveloperKey) {
      setPickerError('Google Picker chưa được cấu hình đầy đủ.');
      return;
    }

    setOpeningPicker(true);
    setPickerError(null);

    try {
      const response = await apiClient.get<GooglePickerTokenResponse>(
        '/google-drive/picker-token',
      );
      pickerSequence.current += 1;
      setPickerInstance({
        id: pickerSequence.current,
        accessToken: response.data.accessToken,
      });
    } catch {
      setPickerError(
        'Không thể mở Google Picker. Hãy kết nối lại Google Drive.',
      );
    } finally {
      setOpeningPicker(false);
    }
  };

  const handlePicked: NonNullable<DrivePickerProps['onPicked']> = (event) => {
    const pickedItems = (event.detail.docs ?? []).flatMap(
      (document): SelectedDriveItem[] => {
        if (!document.id) {
          return [];
        }

        return [
          {
            id: document.id,
            name: document.name?.trim() || document.id,
            mimeType: document.mimeType || 'application/octet-stream',
          },
        ];
      },
    );

    setSelectedItems((currentItems) => {
      const itemsById = new Map(
        [...currentItems, ...pickedItems].map((item) => [item.id, item]),
      );
      return [...itemsById.values()];
    });
    setResult(null);
    setRequestError(false);
    setPickerError(null);
    setPickerInstance(null);
  };

  const removeItem = (itemId: string): void => {
    setSelectedItems((items) => items.filter((item) => item.id !== itemId));
    setResult(null);
  };

  const importItems = async (): Promise<void> => {
    if (selectedItems.length === 0 || importing) {
      return;
    }

    setImporting(true);
    setResult(null);
    setRequestError(false);

    try {
      const response = await apiClient.post<GoogleDriveImportResult>(
        '/import/google-drive',
        { itemIds: selectedItems.map((item) => item.id) },
      );
      setResult(response.data);
    } catch {
      setRequestError(true);
    } finally {
      setImporting(false);
    }
  };

  const canOpenPicker = driveConnected && !openingPicker && !importing;
  const canImport =
    driveConnected &&
    storageConfigured &&
    selectedItems.length > 0 &&
    !importing;

  return (
    <Card title="Import">
      <Space direction="vertical" size="middle" className="full-width">
        <Button
          disabled={!canOpenPicker}
          loading={openingPicker}
          onClick={() => void openPicker()}
        >
          Chọn từ Google Drive
        </Button>

        {!driveConnected && (
          <Typography.Text type="secondary">
            Hãy kết nối Google Drive trước khi chọn item.
          </Typography.Text>
        )}

        {pickerError && <Alert type="error" showIcon message={pickerError} />}

        {selectedItems.length > 0 && (
          <List
            bordered
            size="small"
            header={
              <Typography.Text strong>
                Đã chọn {selectedItems.length} item
              </Typography.Text>
            }
            dataSource={selectedItems}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="remove"
                    danger
                    size="small"
                    type="text"
                    disabled={importing}
                    onClick={() => removeItem(item.id)}
                  >
                    Bỏ
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={item.name}
                  description={
                    item.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE
                      ? 'Folder'
                      : 'File'
                  }
                />
              </List.Item>
            )}
          />
        )}

        <Button
          type="primary"
          disabled={!canImport}
          loading={importing}
          onClick={() => void importItems()}
        >
          {importing ? 'Đang import...' : 'Import'}
        </Button>

        {!storageConfigured && (
          <Typography.Text type="secondary">
            Cloudflare R2 cần được cấu hình trước khi import.
          </Typography.Text>
        )}

        {requestError && (
          <Alert
            type="error"
            showIcon
            message="Import thất bại"
            description="Không thể hoàn tất yêu cầu import."
          />
        )}

        {result && (
          <Alert
            type={result.failed > 0 ? 'warning' : 'success'}
            showIcon
            message={
              result.totalFiles === 0 ? 'Folder không có file' : 'Import hoàn tất'
            }
            description={
              <Space direction="vertical" size="small">
                <Typography.Text>
                  Đã chọn: {result.selectedItems} item
                </Typography.Text>
                <Typography.Text>Tổng file: {result.totalFiles}</Typography.Text>
                <Typography.Text>Thành công: {result.uploaded}</Typography.Text>
                <Typography.Text>Thất bại: {result.failed}</Typography.Text>
                {result.errors.length > 0 && (
                  <List
                    size="small"
                    dataSource={result.errors}
                    renderItem={(error) => (
                      <List.Item>
                        <Typography.Text>
                          {error.name}: {error.reason}
                        </Typography.Text>
                      </List.Item>
                    )}
                  />
                )}
              </Space>
            }
          />
        )}

        {pickerInstance && pickerAppId && pickerDeveloperKey && (
          <DrivePicker
            key={pickerInstance.id}
            app-id={pickerAppId}
            developer-key={pickerDeveloperKey}
            oauth-token={pickerInstance.accessToken}
            origin={window.location.origin}
            multiselect
            title="Chọn từ Google Drive"
            onPicked={handlePicked}
            onCanceled={() => setPickerInstance(null)}
            onOauthError={() => {
              setPickerError('Google Picker không thể xác thực.');
              setPickerInstance(null);
            }}
          >
            <DrivePickerDocsView
              view-id="DOCS"
              enable-drives="true"
              include-folders="true"
              select-folder-enabled="true"
            />
          </DrivePicker>
        )}
      </Space>
    </Card>
  );
}
