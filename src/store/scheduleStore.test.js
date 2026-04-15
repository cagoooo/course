import { describe, it, expect, beforeEach } from 'vitest';
import { useScheduleStore } from './scheduleStore';

/**
 * scheduleStore 測試 — 純狀態機行為驗證
 *
 * Zustand store 可直接以 getState/setState/subscribe 在 Node 環境測試,
 * 不需要 React 渲染環境。
 */
describe('scheduleStore', () => {
    beforeEach(() => {
        useScheduleStore.getState().resetAll();
    });

    it('starts with idle status and empty progress', () => {
        const s = useScheduleStore.getState();
        expect(s.status).toBe('idle');
        expect(s.progress).toEqual({
            generation: 0,
            score: 0,
            stagnation: 0,
            mutationRate: 0,
        });
    });

    it('setStatus updates status', () => {
        useScheduleStore.getState().setStatus('running');
        expect(useScheduleStore.getState().status).toBe('running');
    });

    it('setProgress merges into progress object', () => {
        useScheduleStore.getState().setProgress({
            generation: 50,
            score: 800000,
            stagnation: 10,
            mutationRate: 0.03,
        });
        expect(useScheduleStore.getState().progress.generation).toBe(50);
    });

    it('resetProgress clears progress back to 0', () => {
        useScheduleStore.getState().setProgress({ generation: 99, score: 1, stagnation: 0, mutationRate: 0 });
        useScheduleStore.getState().resetProgress();
        expect(useScheduleStore.getState().progress.generation).toBe(0);
    });

    describe('modals', () => {
        it('openModal / closeModal toggles named modal', () => {
            const { openModal, closeModal } = useScheduleStore.getState();
            openModal('snapshot');
            expect(useScheduleStore.getState().modals.snapshot).toBe(true);
            closeModal('snapshot');
            expect(useScheduleStore.getState().modals.snapshot).toBe(false);
        });

        it('openSmartFill stores slotIndex and candidates', () => {
            useScheduleStore.getState().openSmartFill(7, [{ id: 'c1' }]);
            const m = useScheduleStore.getState().modals.smartFill;
            expect(m.show).toBe(true);
            expect(m.slotIndex).toBe(7);
            expect(m.candidates).toHaveLength(1);
        });

        it('closeSmartFill resets slotIndex and candidates', () => {
            useScheduleStore.getState().openSmartFill(7, [{ id: 'c1' }]);
            useScheduleStore.getState().closeSmartFill();
            const m = useScheduleStore.getState().modals.smartFill;
            expect(m.show).toBe(false);
            expect(m.slotIndex).toBeNull();
            expect(m.candidates).toEqual([]);
        });

        it('openImportPreview captures matched/unmatched', () => {
            useScheduleStore.getState().openImportPreview([{ x: 1 }], [{ y: 1 }, { y: 2 }]);
            const m = useScheduleStore.getState().modals.importPreview;
            expect(m.isOpen).toBe(true);
            expect(m.matched).toHaveLength(1);
            expect(m.unmatched).toHaveLength(2);
        });
    });

    describe('diff mode', () => {
        it('clearDiff resets all diff-related state', () => {
            const s = useScheduleStore.getState();
            s.setDiffMode(true);
            s.setDiffMap(new Map([['a', 'added']]));
            s.setComparisonName('v1');
            s.setOriginalBestSolution([{ g: 1 }]);

            s.clearDiff();
            const after = useScheduleStore.getState();
            expect(after.diffMode).toBe(false);
            expect(after.diffMap).toBeNull();
            expect(after.comparisonName).toBe('');
            expect(after.originalBestSolution).toBeNull();
        });
    });

    describe('print settings', () => {
        it('setPrintSettings with function form uses previous', () => {
            useScheduleStore.getState().setPrintSettings((prev) => ({
                ...prev,
                fontSize: 20,
            }));
            expect(useScheduleStore.getState().printSettings.fontSize).toBe(20);
            expect(useScheduleStore.getState().printSettings.paperSize).toBe('A4'); // 其他欄位保留
        });
    });

    describe('smart seed', () => {
        it('setSmartSeedGenes and setSmartSeedInfo update independently', () => {
            const genes = [{ classId: 'A', courseId: 'CHN', periodIndex: 0, teacherId: 'T1' }];
            useScheduleStore.getState().setSmartSeedGenes(genes);
            useScheduleStore.getState().setSmartSeedInfo({ semesterId: '114-1', geneCount: 1 });
            const s = useScheduleStore.getState();
            expect(s.smartSeedGenes).toEqual(genes);
            expect(s.smartSeedInfo.semesterId).toBe('114-1');
        });
    });

    it('resetAll restores pristine state', () => {
        const s = useScheduleStore.getState();
        s.setStatus('running');
        s.setActiveTab('workload');
        s.openModal('snapshot');

        s.resetAll();
        const after = useScheduleStore.getState();
        expect(after.status).toBe('idle');
        expect(after.activeTab).toBe('settings');
        expect(after.modals.snapshot).toBe(false);
    });
});
