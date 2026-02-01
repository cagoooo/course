import { TOTAL_PERIODS, isSlotAllowed } from './types';

/**
 * Run diagnostics on the current scheduling data.
 * @param {Array} teachers 
 * @param {Array} requirements 
 * @param {Array} classrooms 
 * @param {Array} classes 
 * @returns {Array} List of diagnostic messages (type: 'error' | 'warning', message: string, suggestion: string)
 */
export const runDiagnostics = (teachers, requirements, classes) => {
    const results = [];

    // 1. Teacher Workload Analysis
    const overloadedTeachers = [];
    const highLoadTeachers = [];

    teachers.forEach(teacher => {
        // Calculate total periods needed for this teacher
        const teacherReqs = requirements.filter(r => r.teacherId === teacher.id);
        const totalPeriods = teacherReqs.reduce((sum, r) => sum + (r.periodsNeeded || 0), 0);

        // Calculate available slots
        const unavailableCount = (teacher.unavailableSlots || []).length;
        const availableSlots = TOTAL_PERIODS - unavailableCount;

        if (totalPeriods > availableSlots) {
            overloadedTeachers.push({
                id: teacher.id,
                name: teacher.name,
                total: totalPeriods,
                available: availableSlots
            });
        } else if (totalPeriods > availableSlots * 0.9) {
            highLoadTeachers.push({
                id: teacher.id,
                name: teacher.name,
                total: totalPeriods,
                available: availableSlots,
                ratio: Math.round((totalPeriods / availableSlots) * 100)
            });
        }
    });

    if (overloadedTeachers.length > 0) {
        results.push({
            type: 'error',
            title: `發現 ${overloadedTeachers.length} 位教師時段不足`,
            message: `這些老師的課務太多，但開放的時間太少。`,
            details: overloadedTeachers.map(t => `${t.name} (需排: ${t.total}, 可用: ${t.available})`),
            suggestion: '請點擊「前往調整」釋放紅色時段或減少配課。',
            action: 'JUMP_TO_TEACHER',
            payload: overloadedTeachers[0].id // Jump to the first one
        });
    }

    if (highLoadTeachers.length > 0) {
        results.push({
            type: 'warning',
            title: `發現 ${highLoadTeachers.length} 位教師負載過高`,
            message: `這些老師的排課難度極高（負載率 > 90%）。`,
            details: highLoadTeachers.map(t => `${t.name} (負載率: ${t.ratio}%)`),
            suggestion: '建議點擊「前往調整」釋放部分黃色時段以增加彈性。',
            action: 'JUMP_TO_TEACHER',
            payload: highLoadTeachers[0].id
        });
    }

    // 2. Class Workload Analysis
    const overloadedClasses = [];
    classes.forEach(cls => {
        const classReqs = requirements.filter(r => r.classId === cls.id);
        const totalClassPeriods = classReqs.reduce((sum, r) => sum + (r.periodsNeeded || 0), 0);

        let maxAllowed = 35;
        if (cls.grade === 1 || cls.grade === 2) maxAllowed = 26;
        else if (cls.grade === 3 || cls.grade === 4) maxAllowed = 32;

        if (totalClassPeriods > maxAllowed) {
            overloadedClasses.push({
                id: cls.id,
                name: cls.name,
                total: totalClassPeriods,
                max: maxAllowed
            });
        }
    });

    if (overloadedClasses.length > 0) {
        results.push({
            type: 'warning',
            title: `發現 ${overloadedClasses.length} 個班級課程超載`,
            message: `這些班級的節數可能超過每週上課上限。`,
            details: overloadedClasses.map(c => `${c.name} (已排: ${c.total}, 建議上限: ${c.max})`),
            suggestion: '請檢查是否有重複配課。',
            action: 'CHECK_CLASS', // Placeholder for now, maybe jump to data management?
            payload: null
        });
    }

    // 3. Missing Data Checks
    const invalidReqs = requirements.filter(r => !r.teacherId || !r.courseId || !r.classId);
    if (invalidReqs.length > 0) {
        results.push({
            type: 'error',
            title: '發現無效配課資料',
            message: `有 ${invalidReqs.length} 筆配課資料缺少老師、科目或班級資訊。`,
            suggestion: '建議使用下方按鈕一鍵清理無效資料。',
            action: 'FIX_INVALID_DATA',
            payload: null
        });
    }

    return results;
};
