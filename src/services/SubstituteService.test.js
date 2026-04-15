import { describe, it, expect } from 'vitest';
import { findSubstitutes, periodIndexToLabel } from './SubstituteService';

/**
 * SubstituteService 單元測試
 *
 * 覆蓋:
 *   - periodIndexToLabel:索引 ↔ 人類可讀標籤
 *   - findSubstitutes:
 *     · 缺課老師辨識(absentInfo 完整)
 *     · tier 分級(best / ok / backup)
 *     · 空堂條件(busy 者排除)
 *     · 過勞防護(當日 >5 節排除)
 *     · 排序穩定性
 *     · 邊界:無候選 / 無人教此科目 / 缺課老師不存在
 */

describe('SubstituteService', () => {
    describe('periodIndexToLabel', () => {
        it('converts periodIndex 0 to 週一第1節', () => {
            expect(periodIndexToLabel(0)).toBe('週一 第1節');
        });
        it('converts periodIndex 6 to 週一第7節', () => {
            expect(periodIndexToLabel(6)).toBe('週一 第7節');
        });
        it('converts periodIndex 7 to 週二第1節', () => {
            expect(periodIndexToLabel(7)).toBe('週二 第1節');
        });
        it('converts periodIndex 34 to 週五第7節', () => {
            expect(periodIndexToLabel(34)).toBe('週五 第7節');
        });
    });

    /**
     * 測試情境:
     *   缺課老師 T1(數學)週一第 3 節(periodIndex=2)要找代課
     *   候選:
     *     T2:教過數學,該節空堂,當日 2 節 → best
     *     T3:教過數學,該節空堂,當日 4 節 → ok
     *     T4:教過國語(不同科),該節空堂,當日 1 節 → backup(科目不同但課少)
     *     T5:該節正在上課 → 排除
     *     T6:該節空堂但當日 6 節 → 排除(過勞)
     */
    const buildScenario = () => {
        const teachers = [
            { id: 'T1', name: 'T1' }, // 缺課老師
            { id: 'T2', name: 'T2' }, // 數學 + 少課 → best
            { id: 'T3', name: 'T3' }, // 數學 + 中課 → ok
            { id: 'T4', name: 'T4' }, // 國語 + 少課 → backup
            { id: 'T5', name: 'T5' }, // 同節忙 → 排除
            { id: 'T6', name: 'T6' }, // 當日 6 節 → 過勞排除
        ];

        // 週一第 3 節(index 2)T1 教數學給 Class A
        const schedA = {
            classId: 'A', periods: new Array(35).fill(null),
        };
        schedA.periods[2] = { teacherId: 'T1', courseId: 'MATH' };

        // T2 的教學紀錄:教過數學(MATH),週一只上 2 節(slot 5, 6)
        const schedB = { classId: 'B', periods: new Array(35).fill(null) };
        schedB.periods[5] = { teacherId: 'T2', courseId: 'MATH' };
        schedB.periods[6] = { teacherId: 'T2', courseId: 'MATH' };

        // T3 教過數學,週一 4 節(slot 0, 1, 3, 4) — 沒佔用 slot 2
        const schedC = { classId: 'C', periods: new Array(35).fill(null) };
        schedC.periods[0] = { teacherId: 'T3', courseId: 'MATH' };
        schedC.periods[1] = { teacherId: 'T3', courseId: 'MATH' };
        schedC.periods[3] = { teacherId: 'T3', courseId: 'MATH' };
        schedC.periods[4] = { teacherId: 'T3', courseId: 'MATH' };

        // T4 教國語 (CHN),週一 1 節(slot 6)
        const schedD = { classId: 'D', periods: new Array(35).fill(null) };
        schedD.periods[6] = { teacherId: 'T4', courseId: 'CHN' };

        // T5 該節(slot 2)忙 → 排除
        const schedE = { classId: 'E', periods: new Array(35).fill(null) };
        schedE.periods[2] = { teacherId: 'T5', courseId: 'MATH' };

        // T6 當日 6 節(slot 0, 1, 3, 4, 5, 6)→ >5 排除
        const schedF = { classId: 'F', periods: new Array(35).fill(null) };
        [0, 1, 3, 4, 5, 6].forEach(p => {
            schedF.periods[p] = { teacherId: 'T6', courseId: 'MATH' };
        });

        return {
            teachers,
            allSchedules: [schedA, schedB, schedC, schedD, schedE, schedF],
            absentPeriod: 2,
        };
    };

    it('identifies absent teacher info correctly', () => {
        const { teachers, allSchedules, absentPeriod } = buildScenario();
        const result = findSubstitutes('T1', absentPeriod, allSchedules, teachers);

        expect(result.absentInfo.teacherId).toBe('T1');
        expect(result.absentInfo.courseId).toBe('MATH');
        expect(result.absentInfo.classId).toBe('A');
        expect(result.absentInfo.periodIndex).toBe(2);
        expect(result.absentInfo.dayIndex).toBe(0); // 週一
    });

    it('excludes teacher who is busy at the absent period', () => {
        const { teachers, allSchedules } = buildScenario();
        const result = findSubstitutes('T1', 2, allSchedules, teachers);
        const ids = result.candidates.map(c => c.teacher.id);
        expect(ids).not.toContain('T5');
    });

    it('excludes overloaded teacher (>5 periods that day)', () => {
        const { teachers, allSchedules } = buildScenario();
        const result = findSubstitutes('T1', 2, allSchedules, teachers);
        const ids = result.candidates.map(c => c.teacher.id);
        expect(ids).not.toContain('T6');
    });

    it('excludes the absent teacher themself', () => {
        const { teachers, allSchedules } = buildScenario();
        const result = findSubstitutes('T1', 2, allSchedules, teachers);
        const ids = result.candidates.map(c => c.teacher.id);
        expect(ids).not.toContain('T1');
    });

    it('ranks subject-matching + low-load teacher as best', () => {
        const { teachers, allSchedules } = buildScenario();
        const result = findSubstitutes('T1', 2, allSchedules, teachers);
        const first = result.candidates[0];
        expect(first.teacher.id).toBe('T2');
        expect(first.tier).toBe('best');
        expect(first.subjectMatch).toBe(true);
    });

    it('ranks subject-matching + higher-load teacher as ok', () => {
        const { teachers, allSchedules } = buildScenario();
        const result = findSubstitutes('T1', 2, allSchedules, teachers);
        const t3 = result.candidates.find(c => c.teacher.id === 'T3');
        expect(t3).toBeDefined();
        expect(t3.tier).toBe('ok');
        expect(t3.subjectMatch).toBe(true);
    });

    it('categorizes non-matching subject with low load as backup', () => {
        const { teachers, allSchedules } = buildScenario();
        const result = findSubstitutes('T1', 2, allSchedules, teachers);
        const t4 = result.candidates.find(c => c.teacher.id === 'T4');
        expect(t4).toBeDefined();
        expect(t4.tier).toBe('backup');
        expect(t4.subjectMatch).toBe(false);
    });

    it('sorts best → ok → backup, then by dayPeriods ascending', () => {
        const { teachers, allSchedules } = buildScenario();
        const result = findSubstitutes('T1', 2, allSchedules, teachers);
        const tierOrder = { best: 0, ok: 1, backup: 2 };
        for (let i = 1; i < result.candidates.length; i++) {
            const prev = result.candidates[i - 1];
            const curr = result.candidates[i];
            const prevOrder = tierOrder[prev.tier];
            const currOrder = tierOrder[curr.tier];
            expect(prevOrder).toBeLessThanOrEqual(currOrder);
            if (prevOrder === currOrder) {
                expect(prev.dayPeriods).toBeLessThanOrEqual(curr.dayPeriods);
            }
        }
    });

    it('returns empty candidates when no teachers are free', () => {
        const teachers = [{ id: 'T1', name: 'T1' }];
        const sched = { classId: 'A', periods: new Array(35).fill(null) };
        sched.periods[0] = { teacherId: 'T1', courseId: 'MATH' };
        const result = findSubstitutes('T1', 0, [sched], teachers);
        expect(result.candidates).toEqual([]);
    });

    it('handles schedule without periods field gracefully', () => {
        const teachers = [{ id: 'T1' }, { id: 'T2' }];
        const result = findSubstitutes('T1', 0, [{ classId: 'X' }], teachers);
        expect(result.absentInfo.courseId).toBeNull();
        // T2 完全空堂,應該被列入 backup
        expect(result.candidates.some(c => c.teacher.id === 'T2')).toBe(true);
    });
});
