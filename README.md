# 供應商評核系統 (Vendor Assessment System)

用於管理供應商評核數據的全端系統，支援 SQM/VQM 與 OSAT 月／年度評核。

## 快速開始

```bash
# 安裝依賴
npm install
cd server && npm install

# 後端（終端 1）
cd server && npm run dev

# 前端（終端 2）
npm run dev
```

訪問：http://localhost:5176（或依 VITE_PORT 設定）

## 文檔

完整說明與部署指南請見 **`docs/`** 目錄：

| 文件 | 說明 |
|------|------|
| [docs/README.md](docs/README.md) | 專案說明、技術棧、API、故障排除 |
| [docs/DEPLOY.md](docs/DEPLOY.md) | 部署步驟與環境變數 |
| [docs/1PanelCheck.md](docs/1PanelCheck.md) | 1Panel 部署完整指南 |
| [docs/系統操作說明.md](docs/系統操作說明.md) | 啟動／關閉／常見問題 |
| [docs/計算規則與判定邏輯說明.md](docs/計算規則與判定邏輯說明.md) | SQM/OSAT 計算與判定邏輯 |
| [docs/GIT_READY_CHECKLIST.md](docs/GIT_READY_CHECKLIST.md) | 上傳 Gitea 前檢查清單 |
| [docs/VA_PREFIX_README.md](docs/VA_PREFIX_README.md) | 資料庫表名 va_ 前綴說明 |

---

**最後更新**: 2025-10-31
