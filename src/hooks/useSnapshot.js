import { useCallback } from 'react';
import { firestoreService } from '../services/firestoreService';
import { useToast, useConfirm } from '../contexts/ToastContext';
import { useScheduleStore } from '../store/scheduleStore';

/**
 * useSnapshot — 封裝 Smart Seed(跨學期最佳染色體)的讀寫
 *
 * 這與「UI 上的快照管理」SnapshotManager 元件是兩件事:
 *   - SnapshotManager:使用者自訂名稱的版本備份(Firestore `snapshots/*`)
 *   - useSnapshot(本 hook):純粹處理 Smart Seed — 系統性儲存當學期最佳染色體
 *     供下學期排課初始化使用。
 *
 * 提供:
 *   - saveSmartSeed(bestSolution, semesterId)
 *   - loadSmartSeed(targetSemesterId)
 */
export function useSnapshot() {
    const toast = useToast();
    const setSmartSeedGenes = useScheduleStore((s) => s.setSmartSeedGenes);
    const setSmartSeedInfo = useScheduleStore((s) => s.setSmartSeedInfo);

    const saveSmartSeed = useCallback(async (bestSolution, semesterId) => {
        if (!bestSolution?.length) {
            toast.warning('請先完成排課再儲存智慧種子。');
            return false;
        }
        const loadingId = toast.loading('儲存智慧種子中…');
        try {
            await firestoreService.saveBestChromosome(bestSolution, semesterId);
            toast.update(loadingId, 'success',
                `已將當前學期 (${semesterId}) 的最佳課表儲存為智慧種子,下學期可載入使用。`,
                { title: '智慧種子已儲存' }
            );
            return true;
        } catch (err) {
            toast.update(loadingId, 'error', `儲存失敗: ${err.message}`);
            return false;
        }
    }, [toast]);

    const loadSmartSeed = useCallback(async (targetSemesterId) => {
        if (!targetSemesterId) return null;
        const loadingId = toast.loading('載入智慧種子中…');
        try {
            const genes = await firestoreService.loadBestChromosome(targetSemesterId);
            if (genes) {
                setSmartSeedGenes(genes);
                setSmartSeedInfo({ semesterId: targetSemesterId, geneCount: genes.length });
                toast.update(loadingId, 'success',
                    `已載入學期 (${targetSemesterId}) 的智慧種子(${genes.length} 個基因)。`
                );
                return genes;
            }
            toast.update(loadingId, 'info',
                `學期 (${targetSemesterId}) 尚未儲存智慧種子。`
            );
            return null;
        } catch (err) {
            toast.update(loadingId, 'error', `載入失敗: ${err.message}`);
            return null;
        }
    }, [setSmartSeedGenes, setSmartSeedInfo, toast]);

    return { saveSmartSeed, loadSmartSeed };
}
