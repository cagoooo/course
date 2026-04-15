import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider } from '../contexts/ToastContext';
import { useScheduleStore } from '../store/scheduleStore';

vi.mock('../services/firestoreService', () => ({
    firestoreService: {
        saveBestChromosome: vi.fn(() => Promise.resolve()),
        loadBestChromosome: vi.fn(),
    },
}));

import { useSnapshot } from './useSnapshot';
import { firestoreService } from '../services/firestoreService';

const wrapper = ({ children }) => React.createElement(ToastProvider, null, children);

describe('useSnapshot', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useScheduleStore.getState().resetAll();
    });

    describe('saveSmartSeed', () => {
        it('returns false and warns when bestSolution is empty', async () => {
            const { result } = renderHook(() => useSnapshot(), { wrapper });
            let ok;
            await act(async () => {
                ok = await result.current.saveSmartSeed([], '114-1');
            });
            expect(ok).toBe(false);
            expect(firestoreService.saveBestChromosome).not.toHaveBeenCalled();
        });

        it('calls firestore and returns true on success', async () => {
            const { result } = renderHook(() => useSnapshot(), { wrapper });
            const solution = [{ classId: 'c1', courseId: 'CHN', periodIndex: 0, teacherId: 'T1' }];

            let ok;
            await act(async () => {
                ok = await result.current.saveSmartSeed(solution, '114-1');
            });
            expect(ok).toBe(true);
            expect(firestoreService.saveBestChromosome).toHaveBeenCalledWith(solution, '114-1');
        });

        it('returns false on firestore error', async () => {
            firestoreService.saveBestChromosome.mockRejectedValueOnce(new Error('quota exceeded'));
            const { result } = renderHook(() => useSnapshot(), { wrapper });

            let ok;
            await act(async () => {
                ok = await result.current.saveSmartSeed([{ x: 1 }], '114-1');
            });
            expect(ok).toBe(false);
        });
    });

    describe('loadSmartSeed', () => {
        it('returns null when targetSemesterId is falsy', async () => {
            const { result } = renderHook(() => useSnapshot(), { wrapper });
            let genes;
            await act(async () => {
                genes = await result.current.loadSmartSeed('');
            });
            expect(genes).toBeNull();
        });

        it('sets store state when genes exist', async () => {
            const mockGenes = [{ classId: 'c1', courseId: 'CHN', periodIndex: 0, teacherId: 'T1' }];
            firestoreService.loadBestChromosome.mockResolvedValue(mockGenes);

            const { result } = renderHook(() => useSnapshot(), { wrapper });
            await act(async () => {
                await result.current.loadSmartSeed('113-2');
            });

            const state = useScheduleStore.getState();
            expect(state.smartSeedGenes).toEqual(mockGenes);
            expect(state.smartSeedInfo).toEqual({ semesterId: '113-2', geneCount: 1 });
        });

        it('returns null when semester has no saved genes', async () => {
            firestoreService.loadBestChromosome.mockResolvedValue(null);

            const { result } = renderHook(() => useSnapshot(), { wrapper });
            let genes;
            await act(async () => {
                genes = await result.current.loadSmartSeed('113-2');
            });

            expect(genes).toBeNull();
            expect(useScheduleStore.getState().smartSeedGenes).toBeNull();
        });

        it('returns null on firestore error', async () => {
            firestoreService.loadBestChromosome.mockRejectedValueOnce(new Error('net fail'));

            const { result } = renderHook(() => useSnapshot(), { wrapper });
            let genes;
            await act(async () => {
                genes = await result.current.loadSmartSeed('113-2');
            });

            expect(genes).toBeNull();
        });
    });
});
