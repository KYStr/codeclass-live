# CodeClass Live

即時程式教學輔助平台，讓老師在課堂中監看學生練習、發布作業、給予回饋，並讓學生保存自己的練習專案與取得 AI 提示。

## 主要功能

### 老師端

- 教室管理：先選擇要進入的教室，老師端左上也可隨時切換。
- 即時監看：查看同一教室內學生目前的程式碼、語言、在線狀態與提交狀況。
- 舉手提醒：學生按下舉手後，老師端對應學生卡片會亮起，老師處理後可清除狀態。
- 教室倒數：老師可替目前教室設定倒數計時，學生端會即時同步顯示。
- 作業管理：發布、開關、刪除作業，查看學生提交狀況。
- 重複提交：截止時間內學生可更新提交，老師預設看到最新版本。
- 師生對話：老師可以針對單一學生傳訊息，也可清除對話。
- 程式執行與 AI 分析：老師可執行學生程式碼，或對學生程式碼做輔助分析。

### 學生端

- 程式編輯器：支援 Python、JavaScript、Java、C++，含語法高亮與基本補全。
- 練習專案：學生可建立自己的練習專案與資料夾，支援收合、拖曳移動與儲存。
- 作業工作流：作業可收合整理，可將課堂作業一鍵存成練習專案。
- 程式輸入與執行：可提供 stdin 測試 `input()` 類程式。
- 舉手發問：一鍵通知老師目前需要協助。
- AI 提示：每個練習專案保留獨立 AI 對話，只提供提示與類似範例，不直接給完整答案。
- Markdown 顯示：AI 回覆支援 Markdown 與表格。
- 介面主題：可選 VS Code Dark、VS Code Light、Monokai、Solarized Light、Dracula。
- 響應式介面：支援全螢幕、分割螢幕與窄寬比例。

## 技術架構

- 前端：React 19、Vite、TypeScript、Tailwind CSS、Monaco Editor
- 後端：Node.js、Express、Socket.IO
- 資料庫：SQLite / better-sqlite3
- AI：Kimi Coding Plan API，使用 OpenAI-compatible 端點
- 即時同步：Socket.IO

## 快速開始

### 系統需求

- Node.js 20 以上
- npm
- Python 3，用於後端程式執行器

### 安裝

```bash
git clone https://github.com/KYStr/codeclass-live.git
cd codeclass-live

npm install
cd server
npm install
cd ..
```

### 設定環境變數

前端可建立 `.env.local`：

```env
VITE_API_URL=http://localhost:3001/api
VITE_SOCKET_URL=http://localhost:3001
```

後端請複製範例檔：

```bash
cp server/.env.example server/.env
```

`server/.env` 主要設定：

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
KIMI_API_KEY=your_kimi_code_api_key_here
KIMI_MODEL=kimi-for-coding
KIMI_API_STYLE=openai
KIMI_OPENAI_BASE_URL=https://api.kimi.com/coding/v1
```

注意：`.env`、`.env.local`、`server/.env`、SQLite 資料庫檔都已加入 `.gitignore`，不要把真實 API key 放進 Git。

### 啟動開發環境

終端 1：

```bash
cd server
npm run dev
```

終端 2：

```bash
npm run dev -- --host localhost
```

預設網址：

- 前端：http://localhost:3000
- 後端健康檢查：http://localhost:3001/api/health

預設老師帳號：

- 密碼：`admin`

部署後請立即到老師端修改密碼。

## 常用指令

```bash
# 前端建置
npm run build

# 啟動前端開發伺服器
npm run dev

# 啟動後端
cd server
npm run dev
```

## 專案結構

```text
codeclass-live/
├── App.tsx
├── components/
│   ├── ClassroomManager.tsx
│   ├── CodeEditor.tsx
│   ├── LoginPage.tsx
│   ├── StudentDashboard.tsx
│   └── TeacherDashboard.tsx
├── docs/
│   └── future-development-plan.md
├── services/
│   ├── api.ts
│   ├── geminiService.ts
│   └── socket.ts
├── server/
│   ├── database.js
│   ├── index.js
│   ├── routes/
│   ├── services/
│   │   └── kimiTutor.js
│   └── socket/
└── vite.config.ts
```

## API 摘要

### 教室

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/classrooms` | 取得教室列表 |
| POST | `/api/classrooms` | 建立教室 |
| PUT | `/api/classrooms/:id` | 更新教室 |
| DELETE | `/api/classrooms/:id` | 刪除教室 |
| POST | `/api/classrooms/:id/timer` | 設定教室倒數 |
| POST | `/api/classrooms/:id/timer/clear` | 清除教室倒數 |

### 學生

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/students` | 取得學生列表 |
| POST | `/api/students` | 建立學生 |
| PUT | `/api/students/:id/classroom` | 移動學生到教室 |
| POST | `/api/students/:id/help-request` | 學生舉手 |
| POST | `/api/students/:id/help-request/clear` | 清除舉手狀態 |
| POST | `/api/students/:id/submit` | 提交或更新作業 |

### 練習專案與 AI

| 方法 | 路徑 | 說明 |
| --- | --- | --- |
| GET | `/api/students/:id/projects` | 取得學生練習專案 |
| POST | `/api/students/:id/projects` | 建立練習專案 |
| PUT | `/api/students/:id/projects/:projectId` | 更新練習專案 |
| DELETE | `/api/students/:id/projects/:projectId` | 刪除練習專案 |
| GET | `/api/students/:id/project-folders` | 取得專案資料夾 |
| POST | `/api/students/:id/project-folders` | 建立專案資料夾 |
| GET | `/api/students/:id/projects/:projectId/ai/messages` | 取得專案 AI 對話 |
| POST | `/api/students/:id/projects/:projectId/ai/messages` | 發送 AI 提示問題 |

## AI 提示規則

AI 會收到：

- 學生目前使用的程式語言
- 學生目前畫面的程式碼
- 題目內容、題目網址或截圖
- 同一練習專案的近期對話

回覆原則：

- 使用學生提問的語言回答
- 給提示、方向、類似範例，不直接給完整答案
- 範例程式需保留學生必須修改的部分
- 新專案會建立新的 AI 對話脈絡

## 維運提醒

- `server/codeclass.db` 是本機 SQLite 資料庫，請定期備份。
- `server/.env` 包含 API key，不要 commit。
- 目前程式執行器適合教學內網或受控環境；正式公開部署前建議改成 Docker 沙箱。
- 未來功能規劃在 [docs/future-development-plan.md](./docs/future-development-plan.md)。

## 部署

詳細部署說明請參考：

- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [QUICK_DEPLOY.md](./QUICK_DEPLOY.md)

## 授權

MIT License
