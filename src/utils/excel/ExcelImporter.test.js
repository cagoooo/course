import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseRequirementsExcel, toRequirements } from './ExcelImporter';

/**
 * ExcelImporter 測試
 *
 * 策略:用 ExcelJS 在記憶體產生 workbook → buffer → File-like(arrayBuffer)
 * 驗證:
 *   - 正常匹配
 *   - 模糊比對(全形轉半形、空白容錯)
 *   - 表頭別名(班別/任課教師/週節數)
 *   - 缺欄位錯誤
 *   - 找不到班級/科目 → unmatched
 *   - 教師可選(未指定仍匹配)
 */

/** 在記憶體產生 xlsx,回傳一個具備 arrayBuffer() 的物件(像 File) */
async function makeXlsx(rows) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('配課');
    rows.forEach(r => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    return {
        arrayBuffer: async () => buf,
    };
}

const baseClasses = [
    { id: 'cls1', grade: 3, classNum: 1, name: '3年1班' },
    { id: 'cls2', grade: 3, classNum: 2, name: '3年2班' },
];
const baseCourses = [
    { id: 'CHN', name: '國語' },
    { id: 'MATH', name: '數學' },
    { id: 'ART', name: '美勞' },
];
const baseTeachers = [
    { id: 'T1', name: '王小明' },
    { id: 'T2', name: '李美麗' },
];

describe('ExcelImporter', () => {
    it('parses a straightforward sheet with all columns', async () => {
        const file = await makeXlsx([
            ['班級', '科目', '教師', '節數/週'],
            ['3年1班', '國語', '王小明', 5],
            ['3年2班', '數學', '李美麗', 4],
        ]);

        const { matched, unmatched, total } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(total).toBe(2);
        expect(unmatched).toHaveLength(0);
        expect(matched).toHaveLength(2);
        expect(matched[0].classId).toBe('cls1');
        expect(matched[0].courseId).toBe('CHN');
        expect(matched[0].teacherId).toBe('T1');
        expect(matched[0].periodsNeeded).toBe(5);
    });

    it('handles fullwidth digits and spaces in class name', async () => {
        const file = await makeXlsx([
            ['班級', '科目', '節數'],
            ['３年１班 ', '國 語', '５'],
        ]);
        const { matched } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(matched).toHaveLength(1);
        expect(matched[0].classId).toBe('cls1');
        expect(matched[0].courseId).toBe('CHN');
        expect(matched[0].periodsNeeded).toBe(5);
    });

    it('accepts column aliases (班別 / 任課教師 / 週節數)', async () => {
        const file = await makeXlsx([
            ['班別', '課程', '任課教師', '週節數'],
            ['3年1班', '美勞', '王小明', 2],
        ]);
        const { matched } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(matched).toHaveLength(1);
        expect(matched[0].courseId).toBe('ART');
    });

    it('returns unmatched with reason when class not found', async () => {
        const file = await makeXlsx([
            ['班級', '科目'],
            ['6年9班', '國語'], // 不存在
        ]);
        const { unmatched } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(unmatched).toHaveLength(1);
        expect(unmatched[0].reason).toMatch(/找不到班級/);
    });

    it('returns unmatched with reason when course not found', async () => {
        const file = await makeXlsx([
            ['班級', '科目'],
            ['3年1班', '量子力學'],
        ]);
        const { unmatched } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(unmatched).toHaveLength(1);
        expect(unmatched[0].reason).toMatch(/找不到科目/);
    });

    it('marks teacherNotFound when teacher missing from roster', async () => {
        const file = await makeXlsx([
            ['班級', '科目', '教師'],
            ['3年1班', '國語', '不存在老師'],
        ]);
        const { matched } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(matched).toHaveLength(1);
        expect(matched[0].teacherNotFound).toBe(true);
        expect(matched[0].teacherId).toBeNull();
    });

    it('matches even when teacher column is omitted', async () => {
        const file = await makeXlsx([
            ['班級', '科目'],
            ['3年1班', '數學'],
        ]);
        const { matched } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(matched).toHaveLength(1);
        expect(matched[0].teacherId).toBeNull();
        expect(matched[0].periodsNeeded).toBe(1); // 預設 1
    });

    it('skips fully empty rows', async () => {
        const file = await makeXlsx([
            ['班級', '科目'],
            ['', ''],
            ['3年1班', '國語'],
        ]);
        const { total } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(total).toBe(1);
    });

    it('throws helpful error when required column missing', async () => {
        const file = await makeXlsx([
            ['教師', '節數'],
            ['王小明', 5],
        ]);
        await expect(
            parseRequirementsExcel(file, baseClasses, baseCourses, baseTeachers)
        ).rejects.toThrow(/班級|科目/);
    });

    it('clamps periodsNeeded into [1, 14]', async () => {
        const file = await makeXlsx([
            ['班級', '科目', '節數'],
            ['3年1班', '國語', 0],
            ['3年2班', '數學', 99],
        ]);
        const { matched } = await parseRequirementsExcel(
            file, baseClasses, baseCourses, baseTeachers
        );
        expect(matched[0].periodsNeeded).toBe(1);
        expect(matched[1].periodsNeeded).toBe(14);
    });
});

describe('toRequirements', () => {
    it('converts matched rows into requirement objects', () => {
        const matched = [
            { classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 5, rowNumber: 2 },
            { classId: 'cls2', courseId: 'MATH', teacherId: null, periodsNeeded: 4, rowNumber: 3 },
        ];
        const reqs = toRequirements(matched);
        expect(reqs).toEqual([
            { classId: 'cls1', courseId: 'CHN', teacherId: 'T1', periodsNeeded: 5 },
            { classId: 'cls2', courseId: 'MATH', teacherId: null, periodsNeeded: 4 },
        ]);
    });
});
