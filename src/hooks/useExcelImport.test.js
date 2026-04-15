import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { ToastProvider } from '../contexts/ToastContext';

// Mock firestoreService
vi.mock('../services/firestoreService', () => ({
    firestoreService: {
        saveRequirements: vi.fn(() => Promise.resolve()),
    },
}));

// Mock ExcelImporter(避免真的生成 xlsx,聚焦 hook 行為)
vi.mock('../utils/excel/ExcelImporter', () => ({
    parseRequirementsExcel: vi.fn(),
    toRequirements: vi.fn((matched) => matched.map(m => ({
        classId: m.classId, courseId: m.courseId, teacherId: m.teacherId || null, periodsNeeded: m.periodsNeeded || 1,
    }))),
}));

import { useExcelImport } from './useExcelImport';
import { firestoreService } from '../services/firestoreService';
import { parseRequirementsExcel } from '../utils/excel/ExcelImporter';

const wrapper = ({ children }) => React.createElement(ToastProvider, null, children);

describe('useExcelImport', () => {
    const baseProps = () => ({
        classes: [{ id: 'cls1', name: '3年1班', grade: 3, classNum: 1 }],
        courses: [{ id: 'CHN', name: '國語' }],
        teachers: [{ id: 'T1', name: '王老師' }],
        requirements: [],
        setRequirements: vi.fn(),
        semesterId: '114-1',
        onParsed: vi.fn(),
        onImported: vi.fn(),
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('handleImportFile', () => {
        it('calls onParsed with matched and unmatched results', async () => {
            parseRequirementsExcel.mockResolvedValue({
                matched: [{ classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 5 }],
                unmatched: [],
                total: 1,
            });

            const props = baseProps();
            const { result } = renderHook(() => useExcelImport(props), { wrapper });

            await act(async () => {
                await result.current.handleImportFile(new Blob(['dummy']));
            });

            expect(parseRequirementsExcel).toHaveBeenCalled();
            expect(props.onParsed).toHaveBeenCalledWith(
                [{ classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 5 }],
                []
            );
        });

        it('surfaces error via toast on parse failure', async () => {
            parseRequirementsExcel.mockRejectedValue(new Error('格式錯誤'));

            const props = baseProps();
            const { result } = renderHook(() => useExcelImport(props), { wrapper });

            await act(async () => {
                await result.current.handleImportFile(new Blob(['bad']));
            });

            // onParsed 不應被呼叫
            expect(props.onParsed).not.toHaveBeenCalled();
        });
    });

    describe('handleConfirmImport', () => {
        it('merges new requirements into existing and saves to firestore', async () => {
            const existing = [
                { classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 5 }, // 舊
                { classId: 'cls2', courseId: 'MATH', teacherId: 'T2', periodsNeeded: 4 },
            ];
            const props = { ...baseProps(), requirements: existing };
            const { result } = renderHook(() => useExcelImport(props), { wrapper });

            const newMatched = [
                { classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 6 }, // 覆蓋舊
                { classId: 'cls3', courseId: 'ART', teacherId: null, periodsNeeded: 2 }, // 新增
            ];

            await act(async () => {
                await result.current.handleConfirmImport(newMatched);
            });

            expect(firestoreService.saveRequirements).toHaveBeenCalled();
            const savedArg = firestoreService.saveRequirements.mock.calls[0][0];
            // cls1 應被更新為 6 節(不是 5)
            const cls1 = savedArg.find(r => r.classId === 'cls1');
            expect(cls1.periodsNeeded).toBe(6);
            // cls2 保留
            expect(savedArg.some(r => r.classId === 'cls2')).toBe(true);
            // cls3 新增
            expect(savedArg.some(r => r.classId === 'cls3')).toBe(true);
        });

        it('calls onImported on success', async () => {
            const props = baseProps();
            const { result } = renderHook(() => useExcelImport(props), { wrapper });

            await act(async () => {
                await result.current.handleConfirmImport([
                    { classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 3 },
                ]);
            });

            expect(props.onImported).toHaveBeenCalled();
            expect(props.setRequirements).toHaveBeenCalled();
        });

        it('does NOT call onImported on firestore failure', async () => {
            firestoreService.saveRequirements.mockRejectedValueOnce(new Error('Network down'));

            const props = baseProps();
            const { result } = renderHook(() => useExcelImport(props), { wrapper });

            await act(async () => {
                await result.current.handleConfirmImport([
                    { classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 3 },
                ]);
            });

            expect(props.onImported).not.toHaveBeenCalled();
        });
    });
});
