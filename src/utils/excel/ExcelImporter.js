import ExcelJS from 'exceljs';

/**
 * ExcelImporter - 解析學校配課表 Excel 並比對 Firestore 資料
 * 
 * 預期 Excel 格式（第一列為欄位名稱）：
 * | 班級 | 科目 | 教師 | 節數/週 |
 * 
 * 回傳 { matched[], unmatched[], preview[] }
 */

// 常見欄位名稱別名（容錯用）
const CLASS_ALIASES = ['班級', '班別', '年班', '班'];
const COURSE_ALIASES = ['科目', '科', '課程', '課', '學科'];
const TEACHER_ALIASES = ['教師', '老師', '任課教師', '任課老師', '教師姓名'];
const PERIODS_ALIASES = ['節數', '節數/週', '週節數', '每週節數', '節', '週次'];

/** 全半形正規化（數字、英文）並去除頭尾空白 */
const normalize = (str) => {
    if (str == null) return '';
    return String(str)
        .trim()
        .replace(/[\uff01-\uff5e]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) // 全形→半形
        .replace(/\u3000/g, ' ') // 　→ 空格
        .trim();
};

/** 找出欄位名稱對應的 column index（0-based），找不到回傳 -1 */
const findCol = (headers, aliases) => {
    const normalized = headers.map(h => normalize(h).toLowerCase());
    for (const alias of aliases) {
        const idx = normalized.findIndex(h => h.includes(alias));
        if (idx !== -1) return idx;
    }
    return -1;
};

/** 模糊比對：名稱包含目標字串（忽略空格） */
const fuzzyMatch = (name, target) => {
    const a = normalize(name).replace(/\s/g, '');
    const b = normalize(target).replace(/\s/g, '');
    return a === b || a.includes(b) || b.includes(a);
};

/**
 * 主要解析函式
 * @param {File} file - 使用者上傳的 .xlsx File 物件
 * @param {Array} classes   - Firestore classes[]，每筆含 { id, grade, classNum, name }
 * @param {Array} courses   - Firestore courses[]，每筆含 { id, name }
 * @param {Array} teachers  - Firestore teachers[]，每筆含 { id, name }
 * @returns {Promise<{ matched: Array, unmatched: Array, total: number }>}
 */
export async function parseRequirementsExcel(file, classes, courses, teachers) {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('Excel 檔案中找不到任何工作表');

    // 讀取第一列作為欄位名稱
    const firstRow = sheet.getRow(1).values; // index 1-based in ExcelJS
    const headers = Array.from({ length: firstRow.length }, (_, i) => {
        const v = firstRow[i];
        return v == null ? '' : (typeof v === 'object' ? (v.text || '') : String(v));
    });

    const classCol = findCol(headers, CLASS_ALIASES);
    const courseCol = findCol(headers, COURSE_ALIASES);
    const teacherCol = findCol(headers, TEACHER_ALIASES);
    const periodsCol = findCol(headers, PERIODS_ALIASES);

    if (classCol === -1 || courseCol === -1) {
        throw new Error(`找不到必要的欄位。需要「班級」和「科目」欄位，目前找到：${headers.filter(Boolean).join(', ')}`);
    }

    const matched = [];
    const unmatched = [];

    // 建立查找 Map（名稱 → 物件）
    const classNameMap = new Map();
    classes.forEach(c => {
        const name = typeof c.name === 'string' ? c.name : (c.name?.name || `${c.grade}年${c.classNum}班`);
        classNameMap.set(normalize(name), c);
        // 額外加「N年M班」格式
        classNameMap.set(`${c.grade}年${c.classNum}班`, c);
    });

    const courseNameMap = new Map();
    courses.forEach(c => {
        const name = typeof c.name === 'string' ? c.name : (c.name?.name || '');
        courseNameMap.set(normalize(name), c);
    });

    const teacherNameMap = new Map();
    teachers.forEach(t => {
        const name = typeof t.name === 'string' ? t.name : (t.name?.name || '');
        teacherNameMap.set(normalize(name), t);
    });

    // 從第二列開始讀取資料
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // 跳過標題列

        const vals = row.values; // 1-based

        const rawClass = vals[classCol + 1];   // +1 因為 ExcelJS values 是 1-based
        const rawCourse = vals[courseCol + 1];
        const rawTeacher = teacherCol !== -1 ? vals[teacherCol + 1] : null;
        const rawPeriods = periodsCol !== -1 ? vals[periodsCol + 1] : null;

        const className = normalize(rawClass);
        const courseName = normalize(rawCourse);
        const teacherName = normalize(rawTeacher);
        const periodsVal = rawPeriods ? parseInt(normalize(rawPeriods), 10) : 1;

        // 跳過完全空白列
        if (!className && !courseName) return;

        // 比對班級
        let matchedClass = classNameMap.get(className);
        if (!matchedClass) {
            // 嘗試模糊比對
            matchedClass = classes.find(c => {
                const n = typeof c.name === 'string' ? c.name : (c.name?.name || `${c.grade}年${c.classNum}班`);
                return fuzzyMatch(n, className);
            });
        }

        // 比對科目
        let matchedCourse = courseNameMap.get(courseName);
        if (!matchedCourse) {
            matchedCourse = courses.find(c => {
                const n = typeof c.name === 'string' ? c.name : (c.name?.name || '');
                return fuzzyMatch(n, courseName);
            });
        }

        // 比對教師（可選）
        let matchedTeacher = teacherName ? teacherNameMap.get(teacherName) : null;
        if (!matchedTeacher && teacherName) {
            matchedTeacher = teachers.find(t => {
                const n = typeof t.name === 'string' ? t.name : (t.name?.name || '');
                return fuzzyMatch(n, teacherName);
            });
        }

        const periodCount = isNaN(periodsVal) ? 1 : Math.max(1, Math.min(periodsVal, 14));

        if (matchedClass && matchedCourse) {
            matched.push({
                rowNumber,
                rawClass: className,
                rawCourse: courseName,
                rawTeacher: teacherName,
                rawPeriods: periodsVal,
                classId: matchedClass.id,
                className: typeof matchedClass.name === 'string'
                    ? matchedClass.name
                    : `${matchedClass.grade}年${matchedClass.classNum}班`,
                courseId: matchedCourse.id,
                courseName: typeof matchedCourse.name === 'string'
                    ? matchedCourse.name
                    : matchedCourse.name?.name || '',
                teacherId: matchedTeacher?.id || null,
                teacherName: matchedTeacher
                    ? (typeof matchedTeacher.name === 'string' ? matchedTeacher.name : matchedTeacher.name?.name)
                    : (teacherName || '（未指定）'),
                teacherNotFound: Boolean(teacherName && !matchedTeacher),
                periodsNeeded: periodCount,
            });
        } else {
            unmatched.push({
                rowNumber,
                rawClass: className,
                rawCourse: courseName,
                rawTeacher: teacherName,
                rawPeriods: periodsVal,
                reason: !matchedClass
                    ? `找不到班級「${className}」`
                    : `找不到科目「${courseName}」`,
            });
        }
    });

    return { matched, unmatched, total: matched.length + unmatched.length };
}

/**
 * 將 matched 結果轉換成 firestoreService.saveRequirements() 接受的格式
 */
export function toRequirements(matched) {
    return matched.map(m => ({
        classId: m.classId,
        courseId: m.courseId,
        teacherId: m.teacherId || null,
        periodsNeeded: m.periodsNeeded,
    }));
}
