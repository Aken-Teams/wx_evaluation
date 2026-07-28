# 1Panel 部署指南（非 Docker 部署方式）

## 📋 專案資訊

| 項目 | 內容 |
|------|------|
| **專案名稱** | 供應商評核系統 (Vendor Assessment System) |
| **專案類型** | Node.js Express + React + TypeScript 全端應用 |
| **後端框架** | Express.js 4.19.2 + Prisma 5.17.0 |
| **前端框架** | React 18.2.0 + TypeScript 5.0.2 + Vite 4.5.14 + Material-UI 5.18.0 |
| **資料庫** | MySQL 8.0 |
| **部署平台** | Ubuntu (1Panel) |
| **Node.js 版本** | 18.x 或更高版本 |

---

## 📦 一、需要上傳的檔案清單

### ✅ 必須上傳的檔案和目錄

```
evaluation/                           # 專案根目錄
├── ✅ dist/                          # 前端建置產物（約 2-5 MB）
│   ├── index.html                    # 前端入口 HTML
│   └── assets/                       # 前端資源檔案（JS、CSS）
│       └── index-*.js                # 建置後的 JavaScript 檔案
│
├── ✅ server/                        # 後端目錄
│   ├── ✅ src/                       # 後端原始碼
│   │   ├── ✅ index.js               # Express 主程序（約 2488 行）
│   │   └── ✅ utils/                 # 工具函數目錄
│   │       └── ✅ numberUtils.js    # 數值處理工具
│   │
│   ├── ✅ prisma/                    # Prisma 資料庫配置
│   │   └── ✅ schema.prisma          # 資料庫 Schema 定義
│   │   └── ⚠️  migrations/          # 資料庫遷移檔案（如果存在）
│   │                                # 注意：如果沒有 migrations/，需執行 prisma migrate deploy
│   │
│   ├── ✅ package.json               # 後端依賴清單（必須）
│   └── ⚠️  .env                      # 後端環境變數（需在伺服器上創建，見步驟 3）
│
├── ✅ start.sh                       # Linux 啟動腳本（必須）
└── ✅ package.json                   # 前端依賴清單（參考用，可選）
```

**重要說明：**
- `server/.env` 檔案**不需要上傳**，應在伺服器上創建（見步驟 3）
- `server/prisma/migrations/` 如果不存在，部署時會使用 `prisma migrate deploy` 自動創建
- 根目錄的 `package.json` 僅供參考，實際上傳可選

### ❌ 不需要上傳的檔案和目錄

```
❌ node_modules/                    # 依賴套件（在伺服器上安裝，約 200-500 MB）
❌ server/node_modules/             # 後端依賴（在伺服器上安裝）
❌ server/package-lock.json          # 鎖定檔案（會在伺服器上重新生成）
❌ .git/                            # Git 版本控制（約 10-50 MB）
❌ src/                             # 前端原始碼（已建置到 dist/）
❌ public/                          # 靜態資源（已包含在 dist/）
❌ .env                             # 本地開發配置
❌ .env.development                 # 開發環境配置
❌ .env.production                  # 生產環境配置（需在伺服器上創建）
❌ .env.example                     # 環境變數範例
❌ *.log                            # 日誌檔案
❌ *.md                             # 文檔檔案（可選，不影響運行）
❌ tsconfig.json                    # TypeScript 配置（已建置）
❌ tsconfig.node.json               # TypeScript Node 配置
❌ vite.config.ts                   # Vite 配置（已建置）
❌ docker-compose.yml               # Docker 配置（非 Docker 部署）
❌ start.bat                        # Windows 腳本（Ubuntu 不需要）
❌ server/clear_*.js                # 清理腳本（開發用）
❌ server/verify_password.js         # 驗證腳本（開發用）
❌ server/fix_atec.sql              # SQL 腳本（開發用）
❌ server/scripts/                  # 開發腳本目錄（開發用）
```

### 📊 檔案大小估算

| 項目 | 大小估算 | 說明 |
|------|---------|------|
| dist/ | 2-5 MB | 前端建置產物（包含所有靜態資源） |
| server/src/ | 50-100 KB | 後端原始碼（index.js + utils） |
| server/prisma/ | 5-10 KB | 僅 schema.prisma 檔案 |
| start.sh | < 1 KB | 啟動腳本 |
| package.json | < 1 KB | 依賴清單（參考用） |
| **總計** | **約 3-6 MB** | 不含 node_modules |

> ⚠️ **注意**：
> - 不含 `node_modules/`，實際上傳檔案非常小！
> - `server/.env` 需在伺服器上創建，不要上傳本地配置
> - 如果使用 `prisma migrate deploy`，不需要上傳 migrations/

---

## 🚀 二、部署步驟

### 步驟 1：準備上傳檔案（本地打包）

#### 1.1 建置前端

```bash
# 在專案根目錄執行
cd c:\AICoding\Test_evaluation

# 安裝前端依賴（如果還沒安裝）
npm install

# 建置生產版本（會生成 dist/ 目錄）
npm run build
```

**驗證建置結果：**
```bash
# 檢查 dist/ 目錄是否存在
dir dist

# 應該看到以下檔案：
# - index.html
# - assets/（包含 JS 和 CSS 檔案）
```

#### 1.2 準備環境配置檔案

**⚠️ 重要：環境配置檔案不需要上傳！**

環境變數檔案應在伺服器上創建，不要上傳本地配置。以下是配置範例：

**前端配置（`.env.production` - 僅供參考，實際上不需要）：**
```env
# 前端 API 路徑（使用相對路徑）
VITE_API_URL=/api
```
> 注意：前端已建置完成，API URL 已編譯到 dist/ 中，無需額外配置

**後端配置（`server/.env` - 需在伺服器上創建）：**
```env
# 伺服器埠口
PORT=12017

# MySQL 資料庫連線（請修改為您的 1Panel MySQL 資訊）
DATABASE_URL=mysql://username:password@localhost:3306/vendor_assessment

# JWT 密鑰（請更換為強密碼）
JWT_SECRET=your-super-secure-random-secret-key-here-change-me

# 維護模式（關閉）
MAINTENANCE_MODE=false

# 維護模式管理員帳號（可選）
MAINTENANCE_USERNAME=admin
MAINTENANCE_PASSWORD=admin123

# 生產環境
NODE_ENV=production
```

#### 1.3 修改啟動腳本權限

**確保 `start.sh` 使用 Unix 換行符（LF）：**
```bash
# 如果您使用 Git Bash 或 WSL
dos2unix start.sh
# 或使用編輯器（如 VS Code）轉換為 LF
```

#### 1.4 打包上傳檔案

**方式 A：使用 7-Zip 或 WinRAR（推薦）**
```bash
# 建立壓縮檔（排除不需要的檔案）
# 手動選擇以下目錄/檔案打包：
# ✅ dist/                    # 前端建置產物
# ✅ server/src/              # 後端原始碼
# ✅ server/prisma/           # Prisma 配置（僅 schema.prisma）
# ✅ server/package.json      # 後端依賴清單
# ✅ start.sh                 # 啟動腳本
# ✅ package.json             # 前端依賴清單（可選）
#
# ❌ 不要包含：
# - server/.env               # 需在伺服器上創建
# - node_modules/            # 會在伺服器上安裝
# - server/node_modules/      # 會在伺服器上安裝

# 壓縮為 vendor-assessment-deploy.zip
```

**方式 B：使用命令行（Git Bash 或 WSL）**
```bash
# 建立臨時目錄
mkdir deploy-package
cd deploy-package

# 複製必要檔案
mkdir -p server/src/utils server/prisma
cp -r ../dist ./
cp -r ../server/src/* ./server/src/
cp -r ../server/prisma/schema.prisma ./server/prisma/
cp ../server/package.json ./server/
cp ../start.sh ./
cp ../package.json ./  # 可選

# ⚠️ 注意：不要複製 .env 檔案！
# server/.env 需在伺服器上創建

# 壓縮
zip -r ../vendor-assessment-deploy.zip .

# 返回上層目錄
cd ..

# 清理臨時目錄
rm -rf deploy-package
```

**檢查壓縮檔內容：**
```
vendor-assessment-deploy.zip
├── dist/
│   ├── index.html
│   └── assets/
│       └── index-*.js
├── server/
│   ├── src/
│   │   ├── index.js
│   │   └── utils/
│   │       └── numberUtils.js
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── start.sh
└── package.json  # 可選
```

**⚠️ 重要：壓縮檔中不應包含：**
- `server/.env` - 需在伺服器上創建
- `node_modules/` - 會在伺服器上安裝
- `server/node_modules/` - 會在伺服器上安裝

---

### 步驟 2：上傳到 1Panel

#### 2.1 登入 1Panel 管理面板

```
訪問：http://your-server-ip:port/1panel
```

#### 2.2 上傳檔案

**使用 1Panel 檔案管理器：**

1. 進入 **檔案** → **檔案管理**
2. 導航到網站根目錄（例如：`/opt/1panel/apps/vendor-assessment/`）
3. 建立專案目錄：
   ```bash
   mkdir -p /opt/1panel/apps/vendor-assessment
   ```
4. 上傳 `vendor-assessment-deploy.zip`
5. 解壓縮檔案：
   ```bash
   unzip vendor-assessment-deploy.zip -d /opt/1panel/apps/vendor-assessment/
   ```

**或使用 SFTP/SCP 上傳（推薦）：**

```bash
# 使用 SCP 從本地上傳
scp vendor-assessment-deploy.zip root@your-server-ip:/opt/1panel/apps/

# SSH 登入伺服器
ssh root@your-server-ip

# 解壓縮
cd /opt/1panel/apps/
unzip vendor-assessment-deploy.zip -d vendor-assessment/
cd vendor-assessment/
```

---

### 步驟 3：設定環境變數

#### 3.1 檢查環境配置檔案

```bash
# SSH 登入伺服器後
cd /opt/1panel/apps/vendor-assessment/server

# 檢查 .env 檔案是否存在
ls -la .env

# 編輯環境變數
nano .env
# 或使用 vim
vim .env
```

#### 3.2 必須配置的環境變數

```env
# 📌 伺服器埠口（確保與反向代理一致）
PORT=12017

# 📌 資料庫連線（重要！）
# 格式：mysql://用戶名:密碼@主機:埠口/資料庫名
DATABASE_URL=mysql://vendor_user:your_password@localhost:3306/vendor_assessment

# 📌 JWT 密鑰（必須更換！）
# 建議使用 openssl rand -base64 32 生成
JWT_SECRET=請更換為強隨機字串例如base64編碼的32字節

# 📌 環境模式
NODE_ENV=production

# 維護模式（可選）
MAINTENANCE_MODE=false
MAINTENANCE_USERNAME=admin
MAINTENANCE_PASSWORD=secure_password_123
```

#### 3.3 生成安全的 JWT_SECRET

```bash
# 在伺服器上執行
openssl rand -base64 32

# 複製輸出結果到 .env 的 JWT_SECRET
```

#### 3.4 配置資料庫

**在 1Panel 中建立 MySQL 資料庫：**

1. 進入 **資料庫** → **MySQL**
2. 建立新資料庫：
   - 資料庫名稱：`vendor_assessment`
   - 字符集：`utf8mb4`
   - 排序規則：`utf8mb4_unicode_ci`
3. 建立資料庫用戶：
   - 用戶名：`vendor_user`
   - 密碼：`your_secure_password`（請設定強密碼）
   - 權限：授予 `vendor_assessment` 資料庫的全部權限

**或使用命令行建立：**

```bash
# 登入 MySQL（1Panel 通常已安裝）
mysql -u root -p

# 執行以下 SQL
CREATE DATABASE vendor_assessment CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'vendor_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON vendor_assessment.* TO 'vendor_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**更新 .env 的 DATABASE_URL：**
```env
DATABASE_URL=mysql://vendor_user:your_secure_password@localhost:3306/vendor_assessment
```

---

### 步驟 4：安裝依賴套件

#### 4.1 檢查 Node.js 版本

```bash
# 檢查 Node.js 是否已安裝
node -v
# 應顯示 v18.x.x 或更高版本

npm -v
# 應顯示 8.x.x 或更高版本
```

**如果未安裝或版本過舊：**

```bash
# 使用 1Panel 的運行時管理安裝 Node.js 18
# 或手動安裝（Ubuntu）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 驗證安裝
node -v
npm -v
```

#### 4.2 安裝後端依賴

```bash
cd /opt/1panel/apps/vendor-assessment/server

# 安裝生產依賴
npm install --production

# 驗證安裝
ls -la node_modules/
```

**預期安裝的主要套件：**
- @prisma/client
- express
- bcryptjs
- jsonwebtoken
- multer
- cors
- dotenv
- xlsx
- zod

#### 4.3 生成 Prisma Client

```bash
# 在 server/ 目錄下
npx prisma generate

# 應該看到：
# ✔ Generated Prisma Client
```

#### 4.4 執行資料庫遷移

```bash
# 應用所有資料庫遷移
npx prisma migrate deploy

# 驗證資料庫結構
npx prisma db pull
```

**預期結果：**
```
✔ Database migrations applied successfully
```

**檢查資料庫表：**
```bash
mysql -u vendor_user -p vendor_assessment -e "SHOW TABLES;"

# 應該看到 9 個主要表：
# - User
# - SQMVQMVendor
# - SQMVQMMonthlyReport
# - SQMVQMAnnualInput
# - OSATVendor
# - OSATMonthlyReport
# - OSATAnnualInput
# - OSATMonthlyPurchase
# - OSATSupplierMapping
```

#### 4.5 建立初始管理員帳號（可選）

```bash
# 使用 MySQL 建立初始用戶
mysql -u vendor_user -p vendor_assessment

# 執行以下 SQL（密碼已加密）
INSERT INTO User (username, password, role, enabled)
VALUES ('admin', '$2a$10$YourBcryptHashedPasswordHere', 'admin', 1);
EXIT;
```

**或使用 Node.js 腳本生成密碼 Hash：**

```bash
# 建立臨時腳本
cat > /tmp/hash-password.js << 'EOF'
const bcrypt = require('bcryptjs');
const password = process.argv[2] || 'admin123';
const hash = bcrypt.hashSync(password, 10);
console.log('Password:', password);
console.log('Hash:', hash);
console.log('\nSQL:');
console.log(`INSERT INTO User (username, password, role, enabled) VALUES ('admin', '${hash}', 'admin', 1);`);
EOF

# 執行腳本
node /tmp/hash-password.js your_admin_password

# 複製輸出的 SQL 到 MySQL 執行
```

---

### 步驟 5：設定啟動命令

#### 5.1 設定啟動腳本權限

```bash
cd /opt/1panel/apps/vendor-assessment

# 賦予執行權限
chmod +x start.sh

# 檢查腳本內容
cat start.sh
```

#### 5.2 手動啟動測試

```bash
# 測試啟動
./start.sh

# 應該看到：
# ✓ 找到前端建置檔案
# ✓ 後端依賴已安裝
# ✓ 環境配置檔案有效
# 🚀 啟動伺服器於 PORT=12017...
```

**檢查日誌：**
```bash
# 如果使用 start.sh 啟動
tail -f logs/*.log
```

#### 5.3 使用 PM2 管理（推薦）

**安裝 PM2：**
```bash
# 全域安裝 PM2
npm install -g pm2

# 驗證安裝
pm2 -v
```

**啟動應用：**
```bash
cd /opt/1panel/apps/vendor-assessment/server

# 啟動應用
pm2 start src/index.js --name vendor-assessment \
  --env production \
  --max-memory-restart 500M \
  --log /opt/1panel/apps/vendor-assessment/logs/pm2.log

# 設定開機自啟動
pm2 startup
# 執行輸出的命令（通常是 sudo 開頭）

# 儲存 PM2 進程列表
pm2 save
```

**PM2 常用命令：**
```bash
# 查看狀態
pm2 status
pm2 list

# 查看日誌
pm2 logs vendor-assessment

# 重啟應用
pm2 restart vendor-assessment

# 停止應用
pm2 stop vendor-assessment

# 刪除應用
pm2 delete vendor-assessment

# 監控資源
pm2 monit
```

#### 5.4 設定反向代理（Nginx）

**在 1Panel 中設定網站：**

1. 進入 **網站** → **建立網站**
2. 選擇 **反向代理**
3. 配置：
   - 域名：`vendor.yourdomain.com`（或使用 IP）
   - 代理地址：`http://127.0.0.1:12017`

**或手動編輯 Nginx 配置：**

```bash
# 建立 Nginx 配置檔案
nano /etc/nginx/sites-available/vendor-assessment

# 貼上以下配置
```

```nginx
server {
    listen 80;
    server_name vendor.yourdomain.com;

    # 日誌
    access_log /var/log/nginx/vendor-assessment-access.log;
    error_log /var/log/nginx/vendor-assessment-error.log;

    # 客戶端上傳大小限制（支持 Excel 上傳）
    client_max_body_size 50M;

    # 代理到 Node.js 應用
    location / {
        proxy_pass http://127.0.0.1:12017;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超時設定
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 靜態資源緩存（可選優化）
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:12017;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

**啟用配置：**
```bash
# 建立符號連結
ln -s /etc/nginx/sites-available/vendor-assessment /etc/nginx/sites-enabled/

# 測試配置
nginx -t

# 重載 Nginx
systemctl reload nginx
```

#### 5.5 設定 HTTPS（可選但推薦）

**使用 Let's Encrypt（免費 SSL 憑證）：**

```bash
# 安裝 Certbot
apt update
apt install certbot python3-certbot-nginx -y

# 自動配置 SSL
certbot --nginx -d vendor.yourdomain.com

# 測試自動續期
certbot renew --dry-run
```

**Nginx 配置會自動更新為：**
```nginx
server {
    listen 443 ssl http2;
    server_name vendor.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vendor.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vendor.yourdomain.com/privkey.pem;

    # ... 其他配置同上
}

server {
    listen 80;
    server_name vendor.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

---

## ✅ 三、啟動與驗證

### 3.1 如何啟動應用

#### 方式 A：使用 PM2（推薦）

```bash
# 啟動
pm2 start vendor-assessment

# 或重新啟動
pm2 restart vendor-assessment

# 查看狀態
pm2 status
```

#### 方式 B：使用啟動腳本

```bash
cd /opt/1panel/apps/vendor-assessment
./start.sh
```

#### 方式 C：直接啟動（測試用）

```bash
cd /opt/1panel/apps/vendor-assessment/server
NODE_ENV=production node src/index.js
```

---

### 3.2 如何驗證運行狀態

#### ✅ 檢查 1：進程運行

```bash
# 檢查 Node.js 進程
ps aux | grep node

# 應該看到類似：
# root  12345  0.5  2.1  /usr/bin/node /opt/1panel/apps/vendor-assessment/server/src/index.js
```

**使用 PM2：**
```bash
pm2 status

# 期望輸出：
# ┌─────┬────────────────────┬─────────┬─────────┬─────────┬──────────┐
# │ id  │ name               │ status  │ cpu     │ memory  │ uptime   │
# ├─────┼────────────────────┼─────────┼─────────┼─────────┼──────────┤
# │ 0   │ vendor-assessment  │ online  │ 0.3%    │ 85.2MB  │ 5m       │
# └─────┴────────────────────┴─────────┴─────────┴─────────┴──────────┘
```

#### ✅ 檢查 2：埠口監聽

```bash
# 檢查埠口 12017 是否被監聽
netstat -tlnp | grep 12017
# 或
ss -tlnp | grep 12017
# 或
lsof -i :12017

# 應該看到：
# tcp  0  0  0.0.0.0:12017  0.0.0.0:*  LISTEN  12345/node
```

#### ✅ 檢查 3：應用日誌

```bash
# PM2 日誌
pm2 logs vendor-assessment --lines 50

# 或直接查看日誌檔案
tail -f /opt/1panel/apps/vendor-assessment/logs/*.log

# 或 Node.js 輸出
journalctl -u vendor-assessment -f
```

**期望看到的日誌：**
```
🚀 Server is running on http://0.0.0.0:12017
✓ Database connected successfully
✓ Prisma Client initialized
✓ Static files served from: /opt/1panel/apps/vendor-assessment/dist
```

#### ✅ 檢查 4：資料庫連線

```bash
# 測試資料庫連線
mysql -u vendor_user -p -e "SELECT COUNT(*) FROM vendor_assessment.User;"

# 應該返回用戶數量（至少 1 個管理員）
```

**使用 Prisma 測試：**
```bash
cd /opt/1panel/apps/vendor-assessment/server
npx prisma db pull
npx prisma studio

# Prisma Studio 會啟動在 http://localhost:5555
# 可以在瀏覽器中查看資料庫
```

#### ✅ 檢查 5：API 健康檢查

```bash
# 測試 API 是否回應（本地）
curl http://localhost:12017/api/health
# 或
wget -qO- http://localhost:12017/api/health

# 期望返回：
# {"status":"ok","timestamp":"2025-11-19T..."}
```

**測試登入 API：**
```bash
curl -X POST http://localhost:12017/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# 期望返回 JWT Token：
# {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","user":{...}}
```

#### ✅ 檢查 6：Nginx 反向代理

```bash
# 測試 Nginx 配置
nginx -t

# 重載 Nginx
systemctl status nginx
systemctl reload nginx

# 測試外部訪問
curl http://vendor.yourdomain.com/api/health
```

---

### 3.3 訪問方式

#### 🌐 前端訪問

**瀏覽器訪問：**
```
HTTP:  http://vendor.yourdomain.com
HTTPS: https://vendor.yourdomain.com

或使用 IP：
http://your-server-ip
```

**預期看到：**
- 登入頁面（如果未登入）
- 供應商評核系統首頁（如果已登入）

#### 📡 API 文檔訪問

**主要 API 端點：**

| 功能 | 方法 | 端點 | 說明 |
|------|------|------|------|
| 健康檢查 | GET | `/api/health` | 檢查服務狀態 |
| 登入 | POST | `/api/auth/login` | 用戶登入 |
| 修改密碼 | POST | `/api/auth/change-password` | 修改密碼 |
| 獲取用戶列表 | GET | `/api/users` | 管理員功能 |
| SQM/VQM 供應商 | GET | `/api/sqmvqm/vendors` | 供應商列表 |
| 上傳月度數據 | POST | `/api/sqmvqm/upload-monthly` | Excel 上傳 |
| OSAT 供應商 | GET | `/api/osat/vendors` | OSAT 供應商 |
| 生成報告 | POST | `/api/reports/generate` | 生成評核報告 |

**測試 API（使用 curl）：**

```bash
# 1. 登入獲取 Token
TOKEN=$(curl -s -X POST http://localhost:12017/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}' \
  | grep -o '"token":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"

# 2. 使用 Token 訪問受保護端點
curl http://localhost:12017/api/users \
  -H "Authorization: Bearer $TOKEN"

# 3. 獲取 SQM/VQM 供應商列表
curl http://localhost:12017/api/sqmvqm/vendors \
  -H "Authorization: Bearer $TOKEN"
```

**Postman 測試集合：**

建議建立 Postman Collection 包含以下測試：
1. 登入 API
2. 用戶管理 API
3. 供應商管理 API
4. 月度數據上傳 API
5. 報告生成 API

---

### 3.4 效能監控

#### 使用 PM2 監控

```bash
# 實時監控
pm2 monit

# 查看詳細資訊
pm2 show vendor-assessment

# 查看日誌
pm2 logs vendor-assessment --lines 100
```

#### 系統資源監控

```bash
# CPU 和記憶體使用
top -p $(pgrep -f "node.*vendor-assessment")

# 或使用 htop
htop -p $(pgrep -f "node.*vendor-assessment")

# 磁碟使用
df -h /opt/1panel/apps/vendor-assessment

# 網路連線
netstat -an | grep 12017
```

---

## 🔧 四、常見問題排除

### ❌ 問題 1：應用無法啟動 - 資料庫連線失敗

**錯誤訊息：**
```
Error: P1001: Can't reach database server at `localhost:3306`
或
Error: ER_ACCESS_DENIED_ERROR: Access denied for user 'vendor_user'@'localhost'
```

**原因分析：**
1. MySQL 服務未啟動
2. 資料庫連線資訊錯誤（用戶名、密碼、資料庫名）
3. 資料庫用戶權限不足
4. MySQL 未監聽 3306 埠口

**解決步驟：**

```bash
# 步驟 1：檢查 MySQL 服務狀態
systemctl status mysql
# 如果未啟動
systemctl start mysql
systemctl enable mysql

# 步驟 2：檢查 MySQL 埠口
netstat -tlnp | grep 3306
# 或
ss -tlnp | grep 3306

# 步驟 3：測試資料庫連線
mysql -u vendor_user -p
# 輸入密碼後應該能夠登入

# 步驟 4：檢查資料庫是否存在
mysql -u vendor_user -p -e "SHOW DATABASES;"
# 應該看到 vendor_assessment

# 步驟 5：檢查用戶權限
mysql -u root -p
SHOW GRANTS FOR 'vendor_user'@'localhost';
# 應該看到 vendor_assessment 的 ALL PRIVILEGES

# 如果沒有，重新授權
GRANT ALL PRIVILEGES ON vendor_assessment.* TO 'vendor_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 步驟 6：驗證 .env 配置
cat /opt/1panel/apps/vendor-assessment/server/.env | grep DATABASE_URL
# 確保格式正確：
# DATABASE_URL=mysql://vendor_user:correct_password@localhost:3306/vendor_assessment

# 步驟 7：測試 Prisma 連線
cd /opt/1panel/apps/vendor-assessment/server
npx prisma db pull
# 如果成功，會拉取資料庫結構

# 步驟 8：重新啟動應用
pm2 restart vendor-assessment
pm2 logs vendor-assessment
```

---

### ❌ 問題 2：前端顯示空白頁或 404

**錯誤訊息：**
- 瀏覽器顯示空白頁
- 控制台顯示 404 Not Found
- 或顯示 "Cannot GET /"

**原因分析：**
1. 前端建置檔案（dist/）未正確上傳
2. 後端未正確配置靜態檔案服務
3. Nginx 反向代理配置錯誤

**解決步驟：**

```bash
# 步驟 1：檢查 dist/ 目錄是否存在
ls -la /opt/1panel/apps/vendor-assessment/dist/
# 應該看到：
# - index.html
# - assets/

# 如果不存在或為空：
# 步驟 2：重新建置並上傳
# （在本地 Windows 機器）
cd c:\AICoding\Test_evaluation
npm run build
# 然後重新上傳 dist/ 目錄到伺服器

# 步驟 3：檢查後端是否配置了靜態檔案服務
cat /opt/1panel/apps/vendor-assessment/server/src/index.js | grep -A 5 "express.static"
# 應該看到類似：
# app.use(express.static(path.join(__dirname, '../../dist')));

# 步驟 4：測試直接訪問 index.html
curl http://localhost:12017/index.html
# 應該返回 HTML 內容

# 步驟 5：檢查 Nginx 日誌
tail -f /var/log/nginx/vendor-assessment-error.log

# 步驟 6：測試 Nginx 代理
curl -I http://vendor.yourdomain.com
# 應該返回 200 OK

# 步驟 7：檢查瀏覽器控制台
# F12 → Console 查看是否有 JavaScript 錯誤
# F12 → Network 查看資源加載狀態

# 步驟 8：清除瀏覽器緩存
# Ctrl + Shift + Delete（Chrome）
# 或強制刷新：Ctrl + F5

# 步驟 9：重啟服務
pm2 restart vendor-assessment
systemctl reload nginx
```

---

### ❌ 問題 3：檔案上傳失敗 - 413 Request Entity Too Large

**錯誤訊息：**
```
413 Request Entity Too Large
或
PayloadTooLargeError: request entity too large
```

**原因分析：**
1. Nginx 的 `client_max_body_size` 限制過小
2. Express 的 body-parser 限制過小

**解決步驟：**

```bash
# 步驟 1：修改 Nginx 配置
nano /etc/nginx/sites-available/vendor-assessment

# 在 server {} 區塊中添加或修改：
client_max_body_size 50M;

# 步驟 2：測試 Nginx 配置
nginx -t

# 步驟 3：重載 Nginx
systemctl reload nginx

# 步驟 4：檢查 Express 配置（如果問題仍存在）
cat /opt/1panel/apps/vendor-assessment/server/src/index.js | grep -A 3 "body-parser\|express.json"

# 應該看到類似：
# app.use(express.json({ limit: '50mb' }));
# app.use(express.urlencoded({ extended: true, limit: '50mb' }));

# 如果沒有，編輯 index.js 添加 limit 參數：
nano /opt/1panel/apps/vendor-assessment/server/src/index.js

# 找到並修改：
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

# 步驟 5：重啟應用
pm2 restart vendor-assessment

# 步驟 6：測試上傳
# 使用 Postman 或 curl 上傳測試檔案
curl -X POST http://localhost:12017/api/sqmvqm/upload-monthly \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@test.xlsx"
```

---

### ❌ 問題 4：JWT Token 驗證失敗 - 401 Unauthorized

**錯誤訊息：**
```
401 Unauthorized
或
JsonWebTokenError: invalid token
或
TokenExpiredError: jwt expired
```

**原因分析：**
1. JWT_SECRET 不一致（伺服器重啟後更換了密鑰）
2. Token 已過期（超過 12 小時）
3. Token 格式錯誤

**解決步驟：**

```bash
# 步驟 1：檢查 JWT_SECRET 是否設定
cat /opt/1panel/apps/vendor-assessment/server/.env | grep JWT_SECRET
# 應該看到一個長隨機字串

# 步驟 2：確保 JWT_SECRET 不為空或預設值
# 如果是 "your-secret-key-here"，請更換為強密鑰
openssl rand -base64 32
# 複製輸出到 .env 的 JWT_SECRET

# 步驟 3：重啟應用使新密鑰生效
pm2 restart vendor-assessment

# 步驟 4：重新登入獲取新 Token
curl -X POST http://localhost:12017/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'

# 步驟 5：檢查 Token 有效期（在後端代碼中）
cat /opt/1panel/apps/vendor-assessment/server/src/index.js | grep -A 5 "jwt.sign"
# 應該看到 expiresIn: '12h'

# 步驟 6：驗證 Token（使用 jwt.io）
# 複製 Token 到 https://jwt.io 解碼查看

# 步驟 7：檢查應用日誌
pm2 logs vendor-assessment --lines 50
# 查看是否有 JWT 相關錯誤
```

**前端處理建議：**
```javascript
// 在前端添加 Token 過期處理
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Token 過期，重新導向登入頁
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

### ❌ 問題 5：Prisma Client 初始化錯誤

**錯誤訊息：**
```
Error: @prisma/client did not initialize yet.
或
PrismaClientInitializationError
```

**原因分析：**
1. Prisma Client 未生成
2. 資料庫遷移未執行
3. schema.prisma 與資料庫不同步

**解決步驟：**

```bash
# 步驟 1：重新生成 Prisma Client
cd /opt/1panel/apps/vendor-assessment/server
npx prisma generate

# 期望輸出：
# ✔ Generated Prisma Client (5.17.0 | library) to ./node_modules/@prisma/client

# 步驟 2：檢查 Prisma Client 是否存在
ls -la node_modules/@prisma/client/
# 應該看到大量檔案

# 步驟 3：執行資料庫遷移
npx prisma migrate deploy

# 步驟 4：驗證資料庫結構
npx prisma db pull

# 步驟 5：檢查 schema.prisma
cat prisma/schema.prisma | grep -A 3 "datasource db"
# 確保 provider = "mysql"
# 確保 url = env("DATABASE_URL")

# 步驟 6：重新安裝 Prisma（如果問題仍存在）
npm uninstall @prisma/client prisma
npm install @prisma/client prisma --save

# 步驟 7：重新生成並遷移
npx prisma generate
npx prisma migrate deploy

# 步驟 8：重啟應用
pm2 restart vendor-assessment
pm2 logs vendor-assessment
```

---

### ❌ 問題 6：CORS 跨域錯誤（開發環境）

**錯誤訊息：**
```
Access to XMLHttpRequest at 'http://...' from origin 'http://...' has been blocked by CORS policy
```

**原因分析：**
前端和後端在不同域名或埠口，CORS 未正確配置

**解決步驟：**

```bash
# 步驟 1：檢查後端 CORS 配置
cat /opt/1panel/apps/vendor-assessment/server/src/index.js | grep -A 5 "cors"

# 應該看到類似：
# const cors = require('cors');
# app.use(cors({
#   origin: process.env.CORS_ORIGIN || '*',
#   credentials: true
# }));

# 步驟 2：在 .env 中配置允許的來源
nano /opt/1panel/apps/vendor-assessment/server/.env

# 添加（生產環境）：
CORS_ORIGIN=https://vendor.yourdomain.com

# 或開發環境允許所有來源（不推薦生產）：
CORS_ORIGIN=*

# 步驟 3：重啟應用
pm2 restart vendor-assessment

# 注意：生產環境使用 Nginx 反向代理時，
# 前端和後端在同一域名下，不會有 CORS 問題
```

---

## 🔒 五、安全性檢查清單

### ✅ 生產環境必須檢查的項目

#### 🔐 1. 環境變數安全

- [ ] **JWT_SECRET 已更換為強隨機密鑰**
  ```bash
  # 生成強密鑰
  openssl rand -base64 32
  # 更新到 .env
  JWT_SECRET=生成的強隨機密鑰
  ```

- [ ] **資料庫密碼設定為強密碼**
  ```bash
  # 資料庫密碼至少 16 字符，包含大小寫字母、數字、特殊符號
  DATABASE_URL=mysql://vendor_user:YourStrong@Password123!@localhost:3306/vendor_assessment
  ```

- [ ] **NODE_ENV 設定為 production**
  ```env
  NODE_ENV=production
  ```

- [ ] **.env 檔案權限正確**
  ```bash
  # 設定為只有 owner 可讀寫
  chmod 600 /opt/1panel/apps/vendor-assessment/server/.env
  chown root:root /opt/1panel/apps/vendor-assessment/server/.env
  ```

---

#### 🔒 2. 資料庫安全

- [ ] **資料庫用戶僅授予必要權限**
  ```sql
  -- 不要使用 root 用戶
  -- vendor_user 僅授予 vendor_assessment 資料庫權限
  SHOW GRANTS FOR 'vendor_user'@'localhost';
  ```

- [ ] **移除預設管理員帳號或更換密碼**
  ```bash
  # 如果使用預設 admin/admin123，務必更換
  # 使用應用的修改密碼功能或直接更新資料庫
  ```

- [ ] **資料庫綁定本地主機（不對外開放）**
  ```bash
  # 檢查 MySQL 配置
  cat /etc/mysql/mysql.conf.d/mysqld.cnf | grep bind-address
  # 應該是：
  bind-address = 127.0.0.1
  ```

- [ ] **定期備份資料庫**
  ```bash
  # 建立備份腳本
  cat > /opt/backup/backup-vendor-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backup/vendor-assessment"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
mysqldump -u vendor_user -p'your_password' vendor_assessment > $BACKUP_DIR/backup_$DATE.sql
# 保留最近 7 天備份
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
EOF

  chmod +x /opt/backup/backup-vendor-db.sh

  # 設定 Cron 每日備份
  crontab -e
  # 添加：
  0 2 * * * /opt/backup/backup-vendor-db.sh
  ```

---

#### 🌐 3. 網路與防火牆

- [ ] **配置防火牆，僅開放必要埠口**
  ```bash
  # 使用 UFW（Ubuntu Firewall）
  ufw allow 22/tcp    # SSH
  ufw allow 80/tcp    # HTTP
  ufw allow 443/tcp   # HTTPS
  ufw deny 3306/tcp   # 拒絕外部訪問 MySQL
  ufw deny 12017/tcp  # 拒絕外部訪問 Node.js（透過 Nginx 代理）
  ufw enable
  ufw status
  ```

- [ ] **禁用不必要的服務**
  ```bash
  # 檢查開放的埠口
  netstat -tuln
  # 停用不需要的服務
  ```

- [ ] **配置 Nginx 速率限制（防止暴力破解）**
  ```nginx
  # 在 nginx.conf 或 site 配置中添加
  limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

  server {
      # ... 其他配置

      location /api/auth/login {
          limit_req zone=login_limit burst=3 nodelay;
          proxy_pass http://127.0.0.1:12017;
          # ... 其他配置
      }
  }
  ```

- [ ] **配置 HTTPS（強烈推薦）**
  ```bash
  # 使用 Let's Encrypt
  certbot --nginx -d vendor.yourdomain.com

  # 強制 HTTPS 重定向
  # Nginx 配置應包含：
  # return 301 https://$server_name$request_uri;
  ```

---

#### 👤 4. 用戶與權限

- [ ] **修改預設管理員密碼**
  ```bash
  # 登入應用後立即修改
  # 或使用 SQL 更新（密碼需 bcrypt 加密）
  ```

- [ ] **實施強密碼策略**
  - 最少 8 字符
  - 包含大小寫字母、數字、特殊符號

- [ ] **定期審查用戶帳號**
  ```sql
  -- 檢查所有用戶
  SELECT id, username, role, enabled, createdAt FROM User;

  -- 停用不活躍用戶
  UPDATE User SET enabled = 0 WHERE id = ?;
  ```

- [ ] **限制管理員帳號數量**
  ```sql
  -- 檢查管理員數量
  SELECT COUNT(*) FROM User WHERE role = 'admin';
  ```

---

#### 📝 5. 日誌與監控

- [ ] **配置應用日誌**
  ```bash
  # PM2 日誌
  pm2 logs vendor-assessment --lines 100

  # 設定日誌輪換
  pm2 install pm2-logrotate
  pm2 set pm2-logrotate:max_size 10M
  pm2 set pm2-logrotate:retain 7
  ```

- [ ] **配置 Nginx 訪問日誌**
  ```bash
  # 定期檢查異常訪問
  tail -f /var/log/nginx/vendor-assessment-access.log

  # 分析常見 IP
  cat /var/log/nginx/vendor-assessment-access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head -20
  ```

- [ ] **設定監控告警**
  ```bash
  # 使用 PM2 Plus（可選）
  pm2 link your-secret-key your-public-key

  # 或配置簡單的監控腳本
  cat > /opt/monitor/check-vendor-app.sh << 'EOF'
#!/bin/bash
if ! curl -f http://localhost:12017/api/health > /dev/null 2>&1; then
    echo "Vendor Assessment App is DOWN!" | mail -s "Alert: App Down" admin@example.com
    pm2 restart vendor-assessment
fi
EOF

  chmod +x /opt/monitor/check-vendor-app.sh
  # 設定 Cron 每 5 分鐘檢查
  */5 * * * * /opt/monitor/check-vendor-app.sh
  ```

---

#### 🛡️ 6. 應用安全

- [ ] **啟用 HTTPS Only Cookies（如果使用 Cookie）**
  ```javascript
  // 在後端代碼中設定
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    sameSite: 'strict'
  });
  ```

- [ ] **設定 HTTP 安全標頭**
  ```javascript
  // 安裝 helmet
  npm install helmet

  // 在 index.js 中使用
  const helmet = require('helmet');
  app.use(helmet());
  ```

  **或在 Nginx 配置：**
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "no-referrer-when-downgrade" always;
  add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
  ```

- [ ] **驗證檔案上傳**
  ```javascript
  // 限制檔案類型
  const allowedMimeTypes = [
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  // 限制檔案大小
  const maxSize = 10 * 1024 * 1024; // 10MB
  ```

- [ ] **SQL 注入防護（Prisma 已內建）**
  ```javascript
  // 確保所有資料庫查詢使用 Prisma ORM
  // 避免使用原始 SQL（除非必要且已參數化）
  ```

---

#### 🔄 7. 更新與維護

- [ ] **定期更新依賴套件**
  ```bash
  # 檢查過時套件
  cd /opt/1panel/apps/vendor-assessment/server
  npm outdated

  # 更新套件（謹慎，先在測試環境驗證）
  npm update
  npm audit fix
  ```

- [ ] **訂閱安全公告**
  - Node.js Security Releases
  - Express.js Security Updates
  - Prisma Security Advisories

- [ ] **定期檢查系統更新**
  ```bash
  # Ubuntu 更新
  apt update
  apt upgrade -y
  apt autoremove -y
  ```

---

#### 📋 8. 部署檢查清單總結

**部署前檢查：**
```bash
# 執行以下命令進行快速檢查
cat > /tmp/security-check.sh << 'EOF'
#!/bin/bash
echo "=== 供應商評核系統安全檢查 ==="
echo ""

echo "1. 檢查 .env 檔案..."
if grep -q "your-secret-key-here" /opt/1panel/apps/vendor-assessment/server/.env; then
    echo "   ❌ JWT_SECRET 仍是預設值！"
else
    echo "   ✅ JWT_SECRET 已更換"
fi

echo ""
echo "2. 檢查 NODE_ENV..."
if grep -q "NODE_ENV=production" /opt/1panel/apps/vendor-assessment/server/.env; then
    echo "   ✅ NODE_ENV=production"
else
    echo "   ❌ NODE_ENV 未設定為 production"
fi

echo ""
echo "3. 檢查 .env 檔案權限..."
PERM=$(stat -c %a /opt/1panel/apps/vendor-assessment/server/.env)
if [ "$PERM" = "600" ]; then
    echo "   ✅ 權限正確 (600)"
else
    echo "   ⚠️  權限為 $PERM，建議設定為 600"
fi

echo ""
echo "4. 檢查防火牆..."
if ufw status | grep -q "Status: active"; then
    echo "   ✅ UFW 已啟用"
else
    echo "   ❌ UFW 未啟用"
fi

echo ""
echo "5. 檢查 HTTPS..."
if nginx -T 2>/dev/null | grep -q "ssl_certificate"; then
    echo "   ✅ HTTPS 已配置"
else
    echo "   ⚠️  HTTPS 未配置（建議配置）"
fi

echo ""
echo "6. 檢查應用狀態..."
if pm2 list | grep -q "online"; then
    echo "   ✅ 應用運行中"
else
    echo "   ❌ 應用未運行"
fi

echo ""
echo "7. 檢查資料庫連線..."
if mysql -u vendor_user -p"$(grep DATABASE_URL /opt/1panel/apps/vendor-assessment/server/.env | cut -d':' -f3 | cut -d'@' -f1)" -e "USE vendor_assessment;" 2>/dev/null; then
    echo "   ✅ 資料庫連線成功"
else
    echo "   ❌ 資料庫連線失敗"
fi

echo ""
echo "=== 檢查完成 ==="
EOF

chmod +x /tmp/security-check.sh
/tmp/security-check.sh
```

---

## 📚 附錄

### A. 快速命令參考

```bash
# 啟動應用
pm2 start vendor-assessment

# 重啟應用
pm2 restart vendor-assessment

# 停止應用
pm2 stop vendor-assessment

# 查看日誌
pm2 logs vendor-assessment

# 查看狀態
pm2 status

# 資料庫備份
mysqldump -u vendor_user -p vendor_assessment > backup.sql

# 資料庫還原
mysql -u vendor_user -p vendor_assessment < backup.sql

# 檢查應用健康
curl http://localhost:12017/api/health

# 重載 Nginx
systemctl reload nginx

# 查看 Nginx 日誌
tail -f /var/log/nginx/vendor-assessment-access.log
```

---

### B. 聯絡資訊

**技術支援：**
- 專案文檔：[README.md](README.md)
- 部署指南：[DEPLOY.md](DEPLOY.md)

**相關資源：**
- Node.js 官方文檔：https://nodejs.org/docs/
- Express.js 文檔：https://expressjs.com/
- Prisma 文檔：https://www.prisma.io/docs/
- React 文檔：https://react.dev/
- 1Panel 文檔：https://1panel.cn/docs/

---

## ✅ 部署完成確認

完成以上所有步驟後，請確認：

- [x] 應用可以正常訪問（HTTP/HTTPS）
- [x] 登入功能正常
- [x] 資料庫連線正常
- [x] 檔案上傳功能正常
- [x] 所有 API 端點回應正常
- [x] PM2 監控顯示應用 online
- [x] 日誌無錯誤訊息
- [x] 安全性檢查清單全部通過

**恭喜！您的供應商評核系統已成功部署到 1Panel！** 🎉

---

**文檔版本：** 1.0.0
**最後更新：** 2025-11-19
**適用平台：** Ubuntu 20.04/22.04 + 1Panel
