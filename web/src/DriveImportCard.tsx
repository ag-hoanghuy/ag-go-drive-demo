import { useEffect, useRef, useState } from 'react';
import type { AxiosInstance } from 'axios';
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

interface GoogleApiLoader {
  load(
    api: string,
    config: {
      callback: () => void;
      onerror: () => void;
      timeout: number;
      ontimeout: () => void;
    },
  ): void;
}

const GOOGLE_DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const GOOGLE_API_SCRIPT_URL = 'https://apis.google.com/js/api.js';
const GOOGLE_PICKER_MAX_ITEMS = 100;
const pickerAppId = import.meta.env.VITE_GOOGLE_DRIVE_APP_ID?.trim();
const pickerDeveloperKey = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY?.trim();
let googlePickerApiPromise: Promise<void> | null = null;

function getGoogleApiLoader(): GoogleApiLoader | undefined {
  return (window as Window & { gapi?: GoogleApiLoader }).gapi;
}

function loadGooglePickerApi(): Promise<void> {
  if (
    typeof google !== 'undefined' &&
    typeof google.picker?.PickerBuilder === 'function'
  ) {
    return Promise.resolve();
  }

  if (!googlePickerApiPromise) {
    googlePickerApiPromise = new Promise<void>((resolve, reject) => {
      const loadPickerModule = (): void => {
        const gapi = getGoogleApiLoader();
        if (!gapi) {
          reject(new Error('Google API loader không khả dụng.'));
          return;
        }

        gapi.load('picker', {
          callback: resolve,
          onerror: () => reject(new Error('Không thể tải Google Picker API.')),
          timeout: 10_000,
          ontimeout: () =>
            reject(new Error('Quá thời gian tải Google Picker API.')),
        });
      };

      if (getGoogleApiLoader()) {
        loadPickerModule();
        return;
      }

      const script = document.createElement('script');
      script.src = GOOGLE_API_SCRIPT_URL;
      script.async = true;
      script.onload = loadPickerModule;
      script.onerror = () =>
        reject(new Error('Không thể tải Google API script.'));
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      googlePickerApiPromise = null;
      throw error;
    });
  }

  return googlePickerApiPromise;
}

function createGooglePickerViews(): google.picker.DocsView[] {
  const createView = (): google.picker.DocsView =>
    new google.picker.DocsView(google.picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

  return [
    createView().setOwnedByMe(true),
    createView().setOwnedByMe(false),
    createView().setStarred(true),
    createView().setEnableDrives(true),
  ];
}

export function DriveImportCard({
  apiClient,
  driveConnected,
  storageConfigured,
}: DriveImportCardProps) {
  const [selectedItems, setSelectedItems] = useState<SelectedDriveItem[]>([]);
  const [openingPicker, setOpeningPicker] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<GoogleDriveImportResult | null>(null);
  const [requestError, setRequestError] = useState(false);
  const pickerRef = useRef<google.picker.Picker | null>(null);

  useEffect(() => {
    if (!driveConnected) {
      setSelectedItems([]);
      pickerRef.current?.dispose();
      pickerRef.current = null;
      setResult(null);
    }
  }, [driveConnected]);

  const closePicker = (): void => {
    pickerRef.current?.dispose();
    pickerRef.current = null;
  };

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
      await loadGooglePickerApi();

      let pickerBuilder = new google.picker.PickerBuilder()
        .setAppId(pickerAppId)
        .setDeveloperKey(pickerDeveloperKey)
        .setOAuthToken(response.data.accessToken)
        .setOrigin(window.location.origin)
        .setTitle('Chọn từ Google Drive')
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setMaxItems(GOOGLE_PICKER_MAX_ITEMS)
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED) {
            handlePicked(
              new CustomEvent('picker-picked', {
                detail: data,
              }),
            );
            return;
          }

          if (data.action === google.picker.Action.CANCEL) {
            closePicker();
            return;
          }

          if (data.action === google.picker.Action.ERROR) {
            setPickerError('Google Picker gặp lỗi khi chọn dữ liệu.');
            closePicker();
          }
        });

      for (const view of createGooglePickerViews()) {
        pickerBuilder = pickerBuilder.addView(view);
      }

      closePicker();
      pickerRef.current = pickerBuilder.build();
      pickerRef.current.setVisible(true);
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
    closePicker();
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
      setSelectedItems([]);
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

        <Typography.Text type="secondary">
          Có thể chọn nhiều file bằng Ctrl + Click (Windows) hoặc Cmd + Click
          (macOS).
        </Typography.Text>

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
            renderItem={(item, index) => (
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
                  title={`${index + 1}. ${item.name}`}
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

      </Space>
    </Card>
  );
}
