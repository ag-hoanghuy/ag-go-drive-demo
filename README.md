# Google Drive Import Demo

Repo gồm hai ứng dụng:

- `api`: NestJS API
- `web`: React + Vite frontend

Yêu cầu: Node.js 22 và Yarn.

Sao chép `.env.example` thành `.env` trong từng ứng dụng, sau đó điền cấu hình Google OAuth và Cloudflare R2 cho backend.

Mỗi browser tự tạo một demo session ID. Google token được lưu tạm trong memory theo session này và sẽ mất khi backend khởi động lại.

Google Drive OAuth cần một Google OAuth Web Client, bật Google Drive API và dùng scope `drive.readonly`. Redirect URI:

```text
http://localhost:4000/api/google-drive/callback
```

## Chạy backend

```bash
cd api
yarn
yarn start:dev
```

## Chạy frontend

```bash
cd web
yarn
yarn dev
```
