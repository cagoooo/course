/**
 * RBAC Utilities
 * 用於判斷課程屬性與執行權限檢查
 */

// 核心主科列表 (不可由導師/Editor 微調)
const CORE_SUBJECT_KEYWORDS = [
    '國語', '數學', '英語', '自然', '社會',
    '國小國語', '國小數學', '國小英語'
];

/**
 * 檢查課程是否為「彈性路徑」
 * @param {string} courseName 
 * @returns {boolean}
 */
export const isElasticCourse = (courseName) => {
    if (!courseName) return true; // 空堂視為可微調

    // 如果名稱包含任何核心關鍵字，則不是彈性課程
    const isCore = CORE_SUBJECT_KEYWORDS.some(k => courseName.includes(k));
    return !isCore;
};

/**
 * 檢查當前用戶是否有權限移動該課程
 * @param {string} role - 'admin' | 'editor' | 'viewer'
 * @param {string} courseName 
 * @returns {boolean}
 */
export const canMoveCourse = (role, courseName) => {
    if (role === 'admin') return true;
    if (role === 'editor') {
        return isElasticCourse(courseName);
    }
    return false; // Viewer 什麼都不能動
};
