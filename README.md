# SMES AI 智慧排課系統 (v2.12.0)

![Roadmap 2.12](https://img.shields.io/badge/Roadmap-2.12.0-blue?style=for-the-badge&logo=react)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-orange?style=for-the-badge&logo=firebase)
![Tests](https://img.shields.io/badge/Tests-127%20passing-success?style=for-the-badge&logo=vitest)
![CI](https://img.shields.io/badge/CI-lint%20%7C%20test%20%7C%20rules%20%7C%20build-success?style=for-the-badge&logo=github-actions)

本系統是針對「石門國民小學」開發的智慧化自動排課與管理平台，旨在取代傳統的桌機版 STC 系統，提供雲端同步、AI 衝突解決與現代化的使用者體驗。

> 📋 完整進度表與未來優化藍圖請見 [PROGRESS.md](./PROGRESS.md)

## ✨ 最新更新 (v2.12.0) - DX & Testing Foundation
*   **🔔 Toast 通知系統**：取代傳統 `alert()` 為動畫化通知，含 success/error/warning/info/loading 五種類型 + Confirm Dialog。
*   **⌨️ 快捷鍵系統**：`Ctrl+S` 儲存、`Ctrl+Z` 快照管理、`Ctrl+E` 匯出、`Ctrl+Enter` 開始演算、`Esc` 停止。跨 Mac/Windows 自動適配 `Cmd`/`Ctrl`。
*   **⏱️ 排課 ETA 預估**：演算進行中即時顯示「已花費時間 / 代/秒速度 / 預估剩餘 / 停滯警示」四個晶片。
*   **🧪 測試基礎建設**：Vitest + happy-dom + Testing Library，**127 個單元測試 + 23 個 Firestore Rules 測試**，核心模組覆蓋率 88-98%。
*   **🤖 CI Workflow**：GitHub Actions 3 jobs（lint/test + rules + build），PR 階段自動攔截回歸。
*   **🛡️ Firestore Rules 單元測試**：用 `@firebase/rules-unit-testing` + Emulator，驗證 semesters/users/權限提升/default-deny。
*   **🏗️ 狀態管理重構**：引入 Zustand store，抽出 `useSchedulerEngine` / `useExcelImport` / `useSnapshot` 三個自訂 hooks。
*   **🐛 Bug Fix**：修復 `ExcelImporter.js` 欄位偏移 off-by-one bug（測試時意外發現的生產問題）。

## ✨ v2.11.0 - Excel Import / Substitute Rec / Smart Seed
*   **📥 Excel 配課表匯入**：支援全半形正規化、欄位別名與模糊比對（班級/科目/教師），含匯入預覽 Modal 與未匹配原因說明。
*   **🔁 智慧代課推薦引擎**：三級推薦（🥇最佳 / ✅可考慮 / 📌備選），含過勞防護（當日 ≤ 5 節）與科目相符判斷。
*   **🌱 Smart Seed 智慧種子**：GA 初始族群注入上學期最佳染色體，加速收斂；50/50 多樣性策略兼顧速度與基因多樣性。

## ✨ 近期更新 (v2.8.1) - UI/UX 全面升級
*   **🎨 Excel 匯出三欄漸層卡片**、年級 Tab 彈簧動畫、班級 Pill 彩虹漸層、點擊自動平滑滾動至課表預覽。

## ✨ 演算法里程碑 (v2.7) - GA v3.1 混合修復突變
*   🔴 教師衝突修復 30% / 🔵 數學修復 17.5% / 🟢 國語修復 17.5% / 🎯 定向突變 21% / 🎲 隨機交換 14%。
*   硬性限制升級：數學下午禁排、數學每日限一節、國語每日限兩節（−50,000/次）。
*   詳見 [ALGORITHM_SUMMARY.md](./ALGORITHM_SUMMARY.md)。

## ✨ v2.5.0 - User Management & Mobile UX
*   **📱 手機端體驗優化**：新增 LINE/Facebook 內建瀏覽器偵測阻擋 (In-App Browser Guard)，引導使用者開啟預設瀏覽器以解決 Google 登入錯誤。
*   **👥 用戶權限管理強化**：新增「刪除帳號」功能，並內建防止刪除管理員的安全機制 (Admin-safe deletion)。
*   **🖨️ "Editorial Luxury" 列印排版**：全面升級課表匯出樣式，採用 4px/2px 粗黑高對比格線與 16pt 特粗字體，確保清晰的紙本閱讀體驗。
*   **🔧 部署穩定性**：修復 GitHub Pages 路徑 (404) 問題與 CI/CD 環境變數注入邏輯。

## ✨ 核心特色 (Roadmap 2.1)
*   **PWA 全面支援**：支援離線查看課表，並可將系統安裝至手機桌面（Add to Home Screen）。
*   **離線資料同步**：實作 IndexedDB 本地資料庫，在網路不穩時仍能讀取教師與班級設定。

## ✨ 核心特色 (Roadmap 2.0)

### 🧠 AI 智慧建議引擎
*   **鏈式衝突解決**：採用深度 BFS 演算法，自動搜尋多步交換路徑（如 A->B, B->C），一鍵解決複雜排課僵局。
*   **語意化建議**：提供清晰的中文操作指令，讓排課人員能理解 AI 的修正邏輯。

### 🎨 進階排課規則 (Advanced Rules)
*   **學科權重定向**：實作美勞、體育等科目「下午優先」權重。
*   **智能連堂控制**：確保美勞等需要連續操作的學科自動排成 2 節連堂，減少老師與學生的負擔。
*   **課程分配優化**：針對國語、數學等核心學科進行合理的週分配保護。

### 📸 版本快照管理
*   **雲端備份**：隨時記錄當前排課進度至 Firestore。
*   **一鍵還原**：在進行自動演算或大幅度手動調整時，可隨時退回到先前的安全版本。

### 📱 現代化響應式 UI (RWD)
*   **Premium 設計**：採用現代色彩系統、毛玻璃效果與流暢的動態過場。
*   **行動端優化**：針對手機/平版提供優化的橫向捲動課表與操作介面。

---

## 🛠️ 技術棧
*   **前端**：React 19, Vite, Vanilla CSS
*   **後端/資料庫**：Firebase Auth, Firestore
*   **核心演算法**：遺傳演算法 (Genetic Algorithm) + 啟發式搜索

---

## 🚀 快速開始

### 本地開發
1. 克隆專案並進入目錄。
2. 執行 `npm install`。
3. 建立 `.env` 檔案並填入 Firebase 配置（詳見 `.env.example`）。
4. 啟動開發伺服器：
   ```bash
   npm run dev
   ```

### 部署至 GitHub Pages
1. 執行打包指令：
   ```bash
   npm run build
   ```
2. 將 `dist` 資料夾內容部署至您的 GitHub Repository。

---

## 🔐 安全規範
*   所有 API Key 均透過 `.env` 隔離，禁止硬編碼。
*   管理權限採用 Firebase Custom Claims (admin/editor) 嚴格控管。

---

## 📅 未來展望 (Roadmap 3.0+)
完整優化路線圖請見 [PROGRESS.md](./PROGRESS.md)，精選近期項目：

**短期 (1–2 個月)**
*   [ ] 代課歷史紀錄 + 一鍵通知 + PDF 派工單
*   [ ] Excel 匯入乾跑模擬 + Undo
*   [ ] 深色模式 + Toast 通知 + 快捷鍵
*   [ ] 測試覆蓋 > 80% + CI 自動跑測

**中期 (3–6 個月)**
*   [ ] 權限分級管理 (RBAC 四級) + 操作稽核日誌
*   [ ] 視覺化版本差異對比 (Visual Diff)
*   [ ] AutoSchedule.jsx 拆分 + Zustand 狀態管理
*   [ ] 演算法升級：Tabu Search 混合 / NSGA-II / WASM 加速

**長期 (6–12 個月)**
*   [ ] AI 助手整合（自然語言排課、品質報告 AI 總結）
*   [ ] 多語系語系檔 (i18n) 擴充
*   [ ] 跨校多租戶 SaaS 化 + 白標
*   [ ] 行動原生 App (React Native)

---
**Developed with ❤️ for SMES by Antigravity AI.**
