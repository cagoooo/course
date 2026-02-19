/**
 * SubstituteService.js - 智慧代課推薦引擎
 *
 * 篩選邏輯（依序）：
 * 1. 從 allSchedules 中找出「缺課老師在指定節次（periodIndex）的班級 & 科目」
 * 2. 篩選候選教師：
 *    a. 教過相同科目（從 schedules 推斷其科目），或直接科目 ID 相符
 *    b. 該 periodIndex 在所有 schedules 中無任何課程（真正空堂）
 *    c. 當日已上節數 ≤ 5（防過勞）
 * 3. 排序：當日節數最少者優先
 */

const DAYS_PER_WEEK = 5;
const PERIODS_PER_DAY = 7;

/**
 * 取得指定節次的「星期幾」（0-4）
 */
const getDayOfPeriod = (periodIndex) => Math.floor(periodIndex / PERIODS_PER_DAY);

/**
 * 取得指定星期的所有節次索引（0-34）
 */
const getDayPeriodIndices = (dayIndex) => {
    const indices = [];
    for (let p = 0; p < PERIODS_PER_DAY; p++) {
        indices.push(dayIndex * PERIODS_PER_DAY + p);
    }
    return indices;
};

/**
 * 從 allSchedules 建立 teacherId → 教過的 courseId Set
 */
const buildTeacherCourseMap = (allSchedules) => {
    const map = new Map(); // teacherId → Set<courseId>
    allSchedules.forEach(sch => {
        if (!sch.periods) return;
        sch.periods.forEach(period => {
            if (!period?.teacherId || !period?.courseId) return;
            if (!map.has(period.teacherId)) map.set(period.teacherId, new Set());
            map.get(period.teacherId).add(period.courseId);
        });
    });
    return map;
};

/**
 * 從 allSchedules 建立 teacherId → 忙碌的 periodIndex Set
 */
const buildTeacherBusyMap = (allSchedules) => {
    const map = new Map(); // teacherId → Set<periodIndex>
    allSchedules.forEach(sch => {
        if (!sch.periods) return;
        sch.periods.forEach((period, idx) => {
            if (!period?.teacherId) return;
            if (!map.has(period.teacherId)) map.set(period.teacherId, new Set());
            map.get(period.teacherId).add(idx);
        });
    });
    return map;
};

/**
 * 主要推薦函式
 *
 * @param {string} absentTeacherId       - 缺課老師的 ID
 * @param {number} periodIndex           - 缺課節次（0-34）
 * @param {Array}  allSchedules          - 全校所有 schedule documents
 * @param {Array}  teachers              - 全部教師陣列 [{ id, name, ... }]
 * @returns {{ absentInfo, candidates: Array }}
 *   candidates: [{ teacher, dayPeriods, tier, reason, subjectMatch }]
 *     tier: 'best' | 'ok' | 'backup'
 */
export function findSubstitutes(absentTeacherId, periodIndex, allSchedules, teachers) {
    const dayIndex = getDayOfPeriod(periodIndex);
    const dayPeriodIndices = getDayPeriodIndices(dayIndex);

    // 1. 找出缺課老師在這個節次的課程資訊
    let absentCourseId = null;
    let absentClassId = null;
    for (const sch of allSchedules) {
        if (!sch.periods) continue;
        const period = sch.periods[periodIndex];
        if (period?.teacherId === absentTeacherId) {
            absentCourseId = period.courseId;
            absentClassId = sch.classId;
            break;
        }
    }

    // 2. 建立查找表
    const teacherCourseMap = buildTeacherCourseMap(allSchedules);
    const teacherBusyMap = buildTeacherBusyMap(allSchedules);

    // 3. 該節次缺課老師教的科目（集合）
    const absentTeacherCourses = teacherCourseMap.get(absentTeacherId) || new Set();

    // 4. 逐一評估候選教師
    const candidates = [];

    for (const teacher of teachers) {
        // 跳過缺課老師本人
        if (teacher.id === absentTeacherId) continue;

        const busyPeriods = teacherBusyMap.get(teacher.id) || new Set();

        // 條件 A：該節次必須空堂
        if (busyPeriods.has(periodIndex)) continue;

        // 計算當日已上節數
        const dayPeriodCount = dayPeriodIndices.filter(pi => busyPeriods.has(pi)).length;

        // 條件 B：當日上課節數 ≤ 5
        if (dayPeriodCount > 5) continue;

        // 科目相符程度
        const teacherCourses = teacherCourseMap.get(teacher.id) || new Set();
        let subjectMatch = false;

        if (absentCourseId) {
            subjectMatch = teacherCourses.has(absentCourseId);
        }

        // 判斷推薦等級
        let tier;
        let reason;

        if (subjectMatch && dayPeriodCount <= 3) {
            tier = 'best';
            reason = `科目相符 ✦ 今日只有 ${dayPeriodCount} 節課`;
        } else if (subjectMatch) {
            tier = 'ok';
            reason = `科目相符 ✦ 今日 ${dayPeriodCount} 節課`;
        } else if (dayPeriodCount <= 2) {
            tier = 'backup';
            reason = `今日僅 ${dayPeriodCount} 節課（科目不同）`;
        } else {
            // 只要空堂且課數 ≤ 5 就列入備選
            tier = 'backup';
            reason = `今日 ${dayPeriodCount} 節課（科目不同）`;
        }

        candidates.push({
            teacher,
            dayPeriods: dayPeriodCount,
            tier,
            reason,
            subjectMatch,
        });
    }

    // 5. 排序：best > ok > backup，同 tier 內按 dayPeriods 由少到多
    const tierOrder = { best: 0, ok: 1, backup: 2 };
    candidates.sort((a, b) => {
        const td = tierOrder[a.tier] - tierOrder[b.tier];
        if (td !== 0) return td;
        return a.dayPeriods - b.dayPeriods;
    });

    return {
        absentInfo: {
            teacherId: absentTeacherId,
            courseId: absentCourseId,
            classId: absentClassId,
            periodIndex,
            dayIndex,
        },
        candidates,
    };
}

/**
 * 輔助：將 periodIndex 轉換為可讀的時段字串
 */
export function periodIndexToLabel(periodIndex) {
    const DAY_LABELS = ['週一', '週二', '週三', '週四', '週五'];
    const PERIOD_LABELS = ['第1節', '第2節', '第3節', '第4節', '第5節', '第6節', '第7節'];
    const dayIdx = getDayOfPeriod(periodIndex);
    const periodIdx = periodIndex % PERIODS_PER_DAY;
    return `${DAY_LABELS[dayIdx] || '?'} ${PERIOD_LABELS[periodIdx] || '?'}`;
}
