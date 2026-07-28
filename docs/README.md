# 供應商評核系統 (Vendor Assessment System)

一個用於管理供應商評核數據的全端系統，支持 SQM/VQM 月度評核和 OSAT 年度評核。

## 技術棧

### 前端
- **React 18.2.0** + **TypeScript 5.0.2**
- **Vite 4.5.14** - 建置工具
- **Material-UI 5.x** - UI 組件庫
- **Axios** - HTTP 客戶端
- **React Router 6.x** - 路由管理

### 後端
- **Node.js** + **Express 4.19.2**
- **Prisma 5.17.0** - ORM
- **MySQL 8.0** - 資料庫
- **JWT** - 身份驗證
- **bcryptjs** - 密碼加密

## 項目結構

```
├── src/                    # 前端源碼
│   ├── components/         # React 組件
│   ├── hooks/              # 自定義 Hooks
│   ├── services/           # API 服務
│   ├── utils/              # 工具函數
│   └── main.tsx            # 入口文件
├── server/                 # 後端源碼
│   ├── src/
│   │   └── index.js        # Express 服務器
│   ├── prisma/             # 資料庫 Schema
│   ├── .env.example        # 後端環境變數範例
│   └── package.json
├── dist/                   # 前端建置產物 (git ignored)
├── package.json            # 前端依賴
└── vite.config.ts          # Vite 配置

```

## 快速開始

### 1. 環境需求

- Node.js 18.x 或更高
- MySQL 8.0
- npm 或 yarn

### 2. 安裝依賴

```bash
# 安裝前端依賴
npm install

# 安裝後端依賴
cd server
npm install
```

### 3. 配置環境變數

#### 前端配置

在專案根目錄建立 `.env.development` 檔案，內容例如：

```env
VITE_API_URL=http://localhost:3001/api
VITE_PROXY_TARGET=http://localhost:3001
```

#### 後端配置

複製 `server/.env.example` 到 `server/.env`：

```env
PORT=3001
DATABASE_URL=mysql://username:password@localhost:3306/database_name
JWT_SECRET=your-secret-key-here
MAINTENANCE_MODE=false
MAINTENANCE_USERNAME=admin
MAINTENANCE_PASSWORD=admin123
NODE_ENV=development
```

**重要**:
- 請修改 `DATABASE_URL` 為您的資料庫連接字符串
- 使用以下命令生成強密鑰：
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```

### 4. 初始化資料庫

```bash
cd server
npx prisma migrate dev
npx prisma db seed  # 如果有種子數據
```

### 5. 開發模式運行

#### 方式 A：分別啟動（推薦開發時使用）

```bash
# 終端 1: 啟動後端 (端口 3001)
cd server
npm run dev

# 終端 2: 啟動前端 (端口 5176)
npm run dev
```

訪問: http://localhost:5176

#### 方式 B：統一端口運行（生產環境方式）

```bash
# 1. 建置前端
npm run build

# 2. 啟動後端（自動提供前端靜態文件）
cd server
npm start
```

訪問: http://localhost:3001

## 生產環境部署

### 1. 建置前端

```bash
# 確保使用生產環境配置
npm run build
```

這會生成 `dist/` 目錄，包含優化後的靜態文件。

### 2. 配置生產環境變數

創建 `.env.production`：

```env
VITE_API_URL=/api
```

創建 `server/.env`（生產環境）：

```env
PORT=12017
DATABASE_URL=mysql://user:pass@host:port/dbname
JWT_SECRET=<strong-random-key>
NODE_ENV=production
MAINTENANCE_MODE=false
```

### 3. 部署方式

#### 使用啟動腳本（推薦，Linux/Mac）

**Linux/Mac**:
```bash
chmod +x start.sh
./start.sh
```

> 💡 **Windows 提示**：目前專案未提供對應的 `start.bat`，請改用下方「手動啟動」方式（或使用 PM2 於伺服器上啟動 `server/src/index.js`）。

#### 手動啟動

```bash
# 1. 確認 dist/ 存在
ls -la dist/

# 2. 安裝生產依賴
cd server
npm install --production

# 3. 啟動服務
node src/index.js
```

### 4. 使用 PM2 管理（推薦）

```bash
# 安裝 PM2
npm install -g pm2

# 啟動應用
cd server
pm2 start src/index.js --name vendor-assessment

# 設置開機自啟
pm2 startup
pm2 save

# 管理命令
pm2 status
pm2 logs vendor-assessment
pm2 restart vendor-assessment
pm2 stop vendor-assessment
```

## 反向代理配置（Nginx）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:12017;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://127.0.0.1:12017/api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 主要功能

### 用戶管理
- 用戶登入/登出
- 角色權限管理
- 密碼修改和重置

### SQM/VQM 月度評核
- 供應商月度數據上傳
- 年度採購數據管理
- 自動計算評核分數
- Excel 導入/導出

### OSAT 評核管理
- OSAT 供應商評鑑
- 到貨明細數據處理
- 蘇州/外購供應商評核
- 多維度評分系統

### 數據管理
- 供應商基本資料維護
- 評核歷史記錄查詢
- 數據批量處理
- Excel 報表生成

## 安全性

- ✅ JWT Token 身份驗證
- ✅ bcryptjs 密碼加密（Salt rounds: 10）
- ✅ Prisma ORM 防止 SQL 注入
- ✅ React 默認 XSS 防護
- ✅ 環境變數隔離敏感配置
- ✅ HTTPS 支持（生產環境）

## API 文檔

### 認證
- `POST /api/auth/login` - 用戶登入
- `POST /api/auth/change-password` - 修改密碼

### SQM/VQM
- `GET /api/sqm-vqm/monthly/:year/:month` - 獲取月度數據
- `POST /api/sqm-vqm/monthly` - 上傳月度數據

### OSAT
- `GET /api/osat/:year/:month` - 獲取 OSAT 數據
- `POST /api/osat/upload` - 上傳評核數據

### 管理
- `GET /api/admin/users` - 獲取用戶列表
- `POST /api/admin/users` - 創建用戶
- `PUT /api/admin/users/:id` - 更新用戶
- `DELETE /api/admin/users/:id` - 刪除用戶

## 故障排除

### 問題 1: 無法連接資料庫

**症狀**: `Error: P1001: Can't reach database server`

**解決**:
```bash
# 檢查 MySQL 服務是否運行
sudo systemctl status mysql  # Linux
brew services list           # Mac

# 檢查 DATABASE_URL 配置
cat server/.env | grep DATABASE_URL
```

### 問題 2: 前端顯示空白

**原因**: 未建置或 dist/ 不存在

**解決**:
```bash
# 重新建置
npm run build

# 確認 dist/ 存在
ls -la dist/
```

### 問題 3: API 500 錯誤

**檢查後端日誌**:
```bash
pm2 logs vendor-assessment
# 或
cd server && npm run dev  # 查看詳細錯誤
```

## 開發指南

### 代碼風格

```bash
# 運行 ESLint
npm run lint

# TypeScript 類型檢查
npm run build:check
```

### 添加新功能

1. 前端: 在 `src/components/` 創建組件
2. 後端: 在 `server/src/` 添加路由和邏輯
3. 數據庫: 使用 Prisma 修改 schema

```bash
# 修改 schema 後
cd server
npx prisma migrate dev --name feature_name
npx prisma generate
```

## 貢獻

請在提交前確保：
- [ ] 代碼通過 ESLint 檢查
- [ ] TypeScript 無類型錯誤
- [ ] 測試通過（如果有）
- [ ] 更新相關文檔

## 授權

本項目為內部使用，未經授權不得外傳。

## 聯繫方式

如有問題，請聯繫開發團隊。

---

**最後更新**: 2025-10-31
