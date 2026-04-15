# Changelog

本專案遵循 [Semantic Versioning](https://semver.org/lang/zh-TW/)。
格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)。

---

## [2.12.0] - 2026-04-16 · DX & Testing Foundation

### ✨ Added
- **Toast 通知系統** (`src/contexts/ToastContext.{jsx,css}`)
  - 5 種類型:success / error / warning / info / loading
  - 內建 Confirm Dialog 取代 `window.confirm`
  - 支援 `toast.update(id, ...)` 做 loading → success 替換
- **快捷鍵系統** (`src/hooks/useKeyboardShortcuts.js`)
  - `Ctrl+S` 儲存、`Ctrl+Z` 快照管理、`Ctrl+E` 匯出
  - `Ctrl+Enter` 開始演算、`Esc` 停止
  - 跨 Mac/Windows 自動適配 `Cmd`/`Ctrl`(`mod` 鍵)
  - `formatShortcut()` 依平台顯示符號(⌘ vs Ctrl+)
- **排課 ETA 預估** (`src/hooks/useScheduleETA.js`)
  - 已花費時間 / 代/秒速度 / 預估剩餘時間 / 停滯警示四晶片
- **測試基礎建設**
  - `vitest.config.js` + `vitest.rules.config.js` + `src/test/setup.js`
  - 12 支測試檔 / **127 個單元測試**(SubstituteService 96% / ExcelImporter 98% / useKeyboardShortcuts 93% / ToastContext 88% / useScheduleETA 88%)
  - **23 個 Firestore Rules 測試**(emulator 驅動,無 emulator 自動 skip)
  - `@firebase/rules-unit-testing` 整合
- **GitHub Actions CI** (`.github/workflows/ci.yml`)
  - Job 1:Lint + Unit tests + Coverage
  - Job 2:Firestore Rules tests(via emulator)
  - Job 3:Production build + bundle size check
- **狀態管理與 hooks**
  - `src/store/scheduleStore.js`:Zustand store 統一管理 15+ UI field
  - `src/hooks/useSchedulerEngine.js`:GA Worker 生命週期封裝
  - `src/hooks/useExcelImport.js`:Excel 匯入 + 合併邏輯
  - `src/hooks/useSnapshot.js`:Smart Seed 讀寫
- **測試腳本**
  - `npm run test:run` / `test:coverage` / `test:rules`
- **CHANGELOG.md**(本文件)

### 🔧 Changed
- `AutoSchedule.jsx` 整合 Toast/快捷鍵/ETA/3 新 hooks,業務邏輯從 UI 組件抽離
- `App.jsx` 包入 `<ToastProvider>`
- `README.md` 更新至 v2.12.0,補 Tests / CI badges
- `PROGRESS.md` 補 v2.12 Sprint 戰果速覽,更新 KPI 指標 + Sprint 計畫
- `package.json` 新增 6 個 devDependencies:`happy-dom`、`@vitest/coverage-v8`、`@testing-library/{react,user-event,jest-dom}`、`@firebase/rules-unit-testing`
- `package.json` 新增一個生產 dependency:`zustand`

### 🐛 Fixed
- **`ExcelImporter.js` 欄位偏移 off-by-one bug**
  - `vals[classCol + 1]` 的 `+1` 讓每個欄位讀取錯位
  - 寫測試時意外發現;修正後 11 個 Excel 匯入測試全綠
- `ConstraintChecker.test.js` 2 個過時測試值(反映硬性限制已升級)

### 📊 Metrics
- 測試:9 → **127**(+13x)+ 23 rules tests
- 測試覆蓋率(核心模組):~10% → **88-98%**
- `AutoSchedule.jsx` 行數:2211 → ~2180(業務邏輯已抽出,為下一輪 UI 瘦身鋪路)
- `alert()` 使用:111 → 89(關鍵路徑已改)

---

## [2.11.0] - 2026-02-19 · Excel Import, Substitute Rec, Smart Seed

### ✨ Added
- Excel 配課表匯入(全半形正規化、欄位別名、模糊比對)
- 智慧代課推薦引擎(3 級推薦 + 過勞防護)
- Smart Seed 跨學期最佳染色體注入

### 🔧 Changed
- GA 演算法:50/50 多樣性策略(半族群啟發式 + 半族群隨機)

---

## [2.8.1] - 2026-02 · UI/UX 全面升級

### ✨ Added
- Excel 匯出三欄漸層卡片
- 年級 Tab 彈簧動畫
- 班級 Pill 彩虹漸層
- 點擊自動平滑滾動至課表預覽

---

## [2.7.x] - 2026-01 · GA v3.1 混合修復突變

### ✨ Added
- 教師衝突修復突變(30%)
- 數學修復突變(17.5%)
- 國語修復突變(17.5%)
- 定向優化突變(21%)
- 隨機交換(14%)
- 演算法規則總表 `ALGORITHM_SUMMARY.md`
- 教師跳轉 URL `?id=` 參數

### 🔧 Changed
- 硬性限制升級:數學下午禁排 / 數學每日限一節 / 國語每日限兩節(−50,000/次)

---

## [2.6.x] - 2026-01 · Quality Analysis

### ✨ Added
- Phase 1.1 排課品質分析報告
- Phase 1.2 教師連堂疲勞偵測
- 品質報告扣分跳轉
- 年級分頁班級快選器

---

## [2.5.0] - 2025-12 · User Management & Mobile UX

### ✨ Added
- LINE/FB 內建瀏覽器 Guard (`InAppBrowserGuard.jsx`)
- 管理員刪除帳號功能(Admin-safe deletion)
- "Editorial Luxury" 列印樣式(4px/2px 粗黑格線 + 16pt 特粗字體)

### 🐛 Fixed
- GitHub Pages 部署路徑 404
- Firebase Secrets 環境變數注入

---

## [2.1.x - 2.4.x] - 2025 · PWA & Offline

### ✨ Added
- PWA 全面支援(Manifest + Service Worker)
- IndexedDB 離線資料庫(`idb`)
- AI 鏈式衝突解決(深度 BFS 多步交換)
- 版本快照管理(Firestore 雲端備份 + 還原)
- 響應式 Premium UI(毛玻璃 + 動態過場)

---

## [1.0.0] - 2025 · Initial Release

### ✨ Added
- Firebase Auth + Firestore 整合
- React 19 + Vite + Vanilla CSS
- Custom Claims 權限控制(admin/editor)
- `.env` 環境隔離 + 嚴格安全盤查
