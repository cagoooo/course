import './ConflictResolver.css';
import { SuggestionService } from '../services/SuggestionService';

const DAYS = ['週一', '週二', '週三', '週四', '週五'];
const PERIODS = ['第一節', '第二節', '第三節', '第四節', '第五節', '第六節', '第七節'];

/**
 * ConflictResolver - 衝突解決面板
 * 顯示所有衝突詳情並提供解決建議
 */
const ConflictResolver = ({
    conflictDetails,      // Array of conflict objects
    bestSolution,         // Current chromosome
    classes,
    teachers,
    courses,
    classrooms,
    onResolveConflict,    // (classId, fromIndex, toIndex) => void
    onDismiss
}) => {
    const [selectedConflict, setSelectedConflict] = useState(null);
    const [expandedClass, setExpandedClass] = useState(null);

    // 格式化時段名稱
    const formatSlot = (slotIndex) => {
        const dayIndex = Math.floor(slotIndex / 7);
        const periodIndex = slotIndex % 7;
        return `${DAYS[dayIndex]} ${PERIODS[periodIndex]}`;
    };

    // 找出衝突課程的可用空時段
    const findAvailableSlots = (conflictedGene) => {
        if (!conflictedGene || !bestSolution) return [];

        const teacherId = conflictedGene.teacherId;
        const classId = conflictedGene.classId;

        // 找出該老師已佔用的時段
        const teacherOccupiedSlots = new Set(
            bestSolution
                .filter(g => g.teacherId === teacherId)
                .map(g => g.periodIndex)
        );

        // 找出該班級已佔用的時段
        const classOccupiedSlots = new Set(
            bestSolution
                .filter(g => g.classId === classId)
                .map(g => g.periodIndex)
        );

        // 檢查老師綁定的教室
        const teacher = teachers.find(t => t.id === teacherId);
        let classroomOccupiedSlots = new Set();
        if (teacher?.classroomId) {
            // 找出使用同一教室的其他老師
            const sameClassroomTeacherIds = teachers
                .filter(t => t.classroomId === teacher.classroomId)
                .map(t => t.id);

            classroomOccupiedSlots = new Set(
                bestSolution
                    .filter(g => sameClassroomTeacherIds.includes(g.teacherId))
                    .map(g => g.periodIndex)
            );
        }

        // 找出所有可用時段 (0-34)
        const available = [];
        for (let i = 0; i < 35; i++) {
            // 排除已佔用的時段
            if (teacherOccupiedSlots.has(i) && i !== conflictedGene.periodIndex) continue;
            if (classOccupiedSlots.has(i) && i !== conflictedGene.periodIndex) continue;
            if (classroomOccupiedSlots.has(i) && i !== conflictedGene.periodIndex) continue;

            // 排除不可用時段（週三下午等）
            const dayIndex = Math.floor(i / 7);
            const periodIndex = i % 7;
            if (dayIndex === 2 && periodIndex >= 4) continue; // 週三下午

            available.push(i);
        }

        // 過濾掉目前有課的時段（只保留空時段）
        return available.filter(slot => {
            const existingGene = bestSolution.find(
                g => g.classId === classId && g.periodIndex === slot
            );
            return !existingGene || slot === conflictedGene.periodIndex;
        });
    };

    // 依班級分組衝突
    const conflictsByClass = useMemo(() => {
        if (!conflictDetails || conflictDetails.length === 0) return {};

        const grouped = {};
        conflictDetails.forEach(conflict => {
            conflict.affectedClasses.forEach(classId => {
                if (!grouped[classId]) grouped[classId] = [];
                grouped[classId].push(conflict);
            });
        });
        return grouped;
    }, [conflictDetails]);

    const totalConflicts = conflictDetails?.length || 0;

    if (totalConflicts === 0) {
        return (
            <div className="conflict-resolver empty">
                <div className="no-conflicts">
                    <span className="icon">✅</span>
                    <span>目前沒有任何衝突</span>
                </div>
            </div>
        );
    }

    return (
        <div className="conflict-resolver">
            <div className="resolver-header">
                <h3>⚠️ 衝突解決中心</h3>
                <span className="conflict-count">{totalConflicts} 個衝突</span>
                {onDismiss && (
                    <button className="btn-dismiss" onClick={onDismiss}>✕</button>
                )}
            </div>

            <div className="conflict-list">
                {Object.entries(conflictsByClass).map(([classId, conflicts]) => {
                    const cls = classes.find(c => c.id === classId);
                    const isExpanded = expandedClass === classId;

                    return (
                        <div key={classId} className="conflict-class-group">
                            <div
                                className="class-header"
                                onClick={() => setExpandedClass(isExpanded ? null : classId)}
                            >
                                <span className="class-name">{cls?.name || classId}</span>
                                <span className="conflict-badge">{conflicts.length}</span>
                                <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                            </div>

                            {isExpanded && (
                                <div className="conflicts-detail">
                                    {conflicts.map((conflict, idx) => {
                                        const isSelected = selectedConflict === `${classId}-${idx}`;
                                        const conflictedGene = bestSolution?.find(
                                            g => g.classId === classId && g.periodIndex === conflict.slotIndex
                                        );
                                        const aiSuggestions = isSelected ? SuggestionService.findSwapSuggestions(
                                            classId,
                                            conflict.slotIndex,
                                            conflict.type,
                                            classes.map(cls => ({
                                                classId: cls.id,
                                                periods: Array(35).fill(null).map((_, i) => {
                                                    const g = bestSolution?.find(bg => bg.classId === cls.id && bg.periodIndex === i);
                                                    const course = g ? courses.find(c => c.id === g.courseId) : null;
                                                    return {
                                                        courseId: g?.courseId || null,
                                                        teacherId: g?.teacherId || null,
                                                        courseName: course?.name || ''
                                                    };
                                                })
                                            })),
                                            [], // Requirements (not fully needed for simple swap check here)
                                            classes,
                                            teachers
                                        ) : [];

                                        const availableSlots = isSelected ? findAvailableSlots(conflictedGene) : [];

                                        return (
                                            <div
                                                key={idx}
                                                className={`conflict-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => setSelectedConflict(isSelected ? null : `${classId}-${idx}`)}
                                            >
                                                <div className="conflict-info">
                                                    <div className="slot-info">
                                                        📍 {formatSlot(conflict.slotIndex)}
                                                    </div>
                                                    <div className="conflict-type">
                                                        {conflict.type === 'teacher' ? '👩‍🏫 教師衝突' : '🏫 教室衝突'}
                                                    </div>
                                                    <div className="conflict-detail">
                                                        {conflict.type === 'teacher'
                                                            ? `${teachers.find(t => t.id === conflict.conflictId)?.name || conflict.conflictId} 同時在多班上課`
                                                            : `${classrooms.find(c => c.id === conflict.conflictId)?.name || conflict.conflictId} 同時被多人使用`
                                                        }
                                                    </div>
                                                </div>

                                                {isSelected && (
                                                    <div className="resolution-panel">
                                                        <div className="resolution-title">💡 建議解決方案</div>
                                                        <div className="suggestions-container">
                                                            {/* AI Suggestions (Swaps) */}
                                                            {aiSuggestions.length > 0 && (
                                                                <div className="ai-suggestions">
                                                                    <div className="section-label">🧠 AI 智慧推薦</div>
                                                                    {aiSuggestions.map((s, si) => (
                                                                        <button
                                                                            key={`ai-${si}`}
                                                                            className="suggestion-btn ai"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onResolveConflict?.(classId, s.from, s.to);
                                                                            }}
                                                                        >
                                                                            <span className="type-icon">{s.type === 'MOVE' ? '➡️' : '🔁'}</span>
                                                                            {s.description}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Empty Slots */}
                                                            <div className="empty-slots">
                                                                <div className="section-label">🕳️ 前往空時段</div>
                                                                {availableSlots.length > 0 ? (
                                                                    <div className="slot-grid">
                                                                        {availableSlots.slice(0, 10).map(slot => (
                                                                            <button
                                                                                key={slot}
                                                                                className="suggestion-btn"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onResolveConflict?.(classId, conflict.slotIndex, slot);
                                                                                }}
                                                                            >
                                                                                {formatSlot(slot)}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="no-solution">無可用空時段</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ConflictResolver;
