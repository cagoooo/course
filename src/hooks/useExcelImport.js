import { useCallback } from 'react';
import { parseRequirementsExcel, toRequirements } from '../utils/excel/ExcelImporter';
import { firestoreService } from '../services/firestoreService';
import { useToast } from '../contexts/ToastContext';

/**
 * useExcelImport — 封裝 Excel 配課表匯入流程
 *
 * 介面刻意保持「純函式 + callback」的風格,不強制依賴 store,
 * 以便單元測試,也讓 AutoSchedule.jsx 在重構初期能維持既有 preview state。
 *
 * 呼叫者提供:
 *   - classes / courses / teachers:Firestore 同步資料
 *   - requirements + setRequirements:現有配課 state
 *   - semesterId:目前學期
 *   - onParsed(matched, unmatched):解析完成後開啟預覽 UI
 *   - onImported():匯入成功後關閉預覽 UI
 *
 * 回傳:{ handleImportFile, handleConfirmImport }
 */
export function useExcelImport({
    classes, courses, teachers,
    requirements, setRequirements,
    semesterId,
    onParsed, onImported,
}) {
    const toast = useToast();

    const handleImportFile = useCallback(async (file) => {
        const loadingId = toast.loading('解析 Excel 檔案中…');
        try {
            const { matched, unmatched } = await parseRequirementsExcel(file, classes, courses, teachers);
            onParsed?.(matched, unmatched);
            toast.dismiss(loadingId);
            if (!matched.length && unmatched.length) {
                toast.warning(`全部 ${unmatched.length} 筆皆無法匹配,請檢查班級/科目名稱。`);
            }
        } catch (err) {
            toast.update(loadingId, 'error', `匯入失敗: ${err.message}`);
        }
    }, [classes, courses, teachers, onParsed, toast]);

    const handleConfirmImport = useCallback(async (matched) => {
        const loadingId = toast.loading('寫入匯入資料中…');
        try {
            const reqs = toRequirements(matched);

            // key 以 (classId, courseId, teacherId) 組合去重;舊值會被新匯入覆蓋
            const merged = new Map(
                requirements.map((r) => [`${r.classId}::${r.courseId}::${r.teacherId || ''}`, r])
            );
            reqs.forEach((r) => {
                merged.set(`${r.classId}::${r.courseId}::${r.teacherId || ''}`, r);
            });

            const mergedReqs = Array.from(merged.values());
            await firestoreService.saveRequirements(mergedReqs, semesterId);
            setRequirements(mergedReqs);
            onImported?.();
            toast.update(loadingId, 'success', `成功匯入 ${matched.length} 筆配課資料!`, {
                title: 'Excel 匯入完成',
            });
        } catch (err) {
            toast.update(loadingId, 'error', `儲存失敗: ${err.message}`);
        }
    }, [requirements, setRequirements, semesterId, onImported, toast]);

    return { handleImportFile, handleConfirmImport };
}
