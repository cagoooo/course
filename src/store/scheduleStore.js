/**
 * scheduleStore — 排課頁面的共用 UI / transient 狀態
 *
 * 原則:
 *   - 跟 Firestore 同步的主要資料(classes/teachers/courses/requirements/bestSolution)
 *     仍留在 AutoSchedule.jsx 組件內,由 useSchedulerData 管理(下一階段);
 *     此 store 只放「橫跨多個 hook / 元件」的 UI 狀態。
 *
 *   - 所有 setter 都以「語意化 action」命名,避免直接 setState 的濫用。
 *
 *   - 不使用 middleware(如 persist),保持零依賴、最小 API 表面積,
 *     若未來需要跨分頁同步再補 persist。
 */
import { create } from 'zustand';

const initialState = {
    // Tab 狀態
    activeTab: 'settings', // 'settings' | 'workload' | 'scheduler'

    // 排課引擎狀態
    status: 'idle',        // idle | loading | running | stopped | saving
    progress: {
        generation: 0,
        score: 0,
        stagnation: 0,
        mutationRate: 0,
    },

    // Modal 開關
    modals: {
        snapshot: false,
        substitute: false,
        printSettings: false,
        diagnostics: false,
        smartFill: { show: false, slotIndex: null, candidates: [] },
        importPreview: { isOpen: false, matched: [], unmatched: [] },
    },

    // Diff 模式
    diffMode: false,
    diffMap: null,
    comparisonName: '',
    originalBestSolution: null,

    // 列印
    printType: 'class',
    printFilter: null,
    isBatchPrinting: false,
    printSettings: {
        fontSize: 14,
        paperSize: 'A4',
        layout: 'portrait',
        showTeacherName: true,
        showCourseName: true,
        showClassName: true,
        titleTemplate: '',
    },

    // 檢視
    viewClassId: '',
    selectedTeacherId: null,
    showQRCode: false,
    diagnosticResults: [],

    // Smart Seed
    smartSeedGenes: null,
    smartSeedInfo: null,
};

export const useScheduleStore = create((set, get) => ({
    ...initialState,

    // ---------- Tab ----------
    setActiveTab: (tab) => set({ activeTab: tab }),

    // ---------- Status / Progress ----------
    setStatus: (status) => set({ status }),
    setProgress: (progress) => set({ progress }),
    resetProgress: () => set({ progress: initialState.progress }),

    // ---------- Modals ----------
    openModal: (name) => set((s) => ({ modals: { ...s.modals, [name]: true } })),
    closeModal: (name) => set((s) => ({ modals: { ...s.modals, [name]: false } })),
    openSmartFill: (slotIndex, candidates) =>
        set((s) => ({ modals: { ...s.modals, smartFill: { show: true, slotIndex, candidates } } })),
    closeSmartFill: () =>
        set((s) => ({ modals: { ...s.modals, smartFill: { show: false, slotIndex: null, candidates: [] } } })),
    openImportPreview: (matched, unmatched) =>
        set((s) => ({ modals: { ...s.modals, importPreview: { isOpen: true, matched, unmatched } } })),
    closeImportPreview: () =>
        set((s) => ({ modals: { ...s.modals, importPreview: { isOpen: false, matched: [], unmatched: [] } } })),

    // ---------- Diff ----------
    setDiffMode: (on) => set({ diffMode: on }),
    setDiffMap: (map) => set({ diffMap: map }),
    setComparisonName: (name) => set({ comparisonName: name }),
    setOriginalBestSolution: (v) => set({ originalBestSolution: v }),
    clearDiff: () => set({ diffMode: false, diffMap: null, comparisonName: '', originalBestSolution: null }),

    // ---------- Print ----------
    setPrintSettings: (settings) =>
        set((s) => ({ printSettings: typeof settings === 'function' ? settings(s.printSettings) : settings })),
    setPrintType: (type) => set({ printType: type }),
    setPrintFilter: (filter) => set({ printFilter: filter }),
    setIsBatchPrinting: (on) => set({ isBatchPrinting: on }),

    // ---------- 檢視 ----------
    setViewClassId: (id) => set({ viewClassId: id }),
    setSelectedTeacherId: (id) => set({ selectedTeacherId: id }),
    setShowQRCode: (on) => set({ showQRCode: on }),
    setDiagnosticResults: (results) => set({ diagnosticResults: results }),

    // ---------- Smart Seed ----------
    setSmartSeedGenes: (genes) => set({ smartSeedGenes: genes }),
    setSmartSeedInfo: (info) => set({ smartSeedInfo: info }),

    // 完整重置(切換學期時使用)
    resetAll: () => set(initialState),
}));

// 選擇器(供需要細粒度訂閱的元件使用,避免不必要的重渲染)
export const selectStatus = (s) => s.status;
export const selectProgress = (s) => s.progress;
export const selectModal = (name) => (s) => s.modals[name];
export const selectActiveTab = (s) => s.activeTab;
