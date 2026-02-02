import { useState, useMemo, Fragment } from 'react';
import './PreScheduleManager.css';

// PreScheduleManager: Allows user to lock specific courses to specific time slots
// Affects 'requirements' by adding a 'fixedSlots' property: [slotIndex, ...]
function PreScheduleManager({
    classes,
    courses,
    teachers,
    requirements,
    onUpdateRequirements,
    onNavigateToWorkload
}) {
    const [scope, setScope] = useState('grade'); // 'grade' | 'class'
    const [selectedGrade, setSelectedGrade] = useState('1');
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedCourseName, setSelectedCourseName] = useState('');

    // --- Conflict Detection Logic ---
    // Map: slotIndex -> [ { teacherId, classId, courseId, className, courseName, teacherName } ]
    const teacherOccupationMap = useMemo(() => {
        const map = {};
        requirements.forEach(req => {
            if (req.fixedSlots && req.fixedSlots.length > 0 && req.teacherId) {
                const cls = classes.find(c => c.id === req.classId);
                const crs = courses.find(c => c.id === req.courseId);
                const tch = teachers.find(t => t.id === req.teacherId);

                req.fixedSlots.forEach(slot => {
                    if (!map[slot]) map[slot] = [];
                    map[slot].push({
                        teacherId: req.teacherId,
                        classId: req.classId,
                        courseId: req.courseId,
                        className: cls?.name || req.classId,
                        courseName: crs?.name || req.courseId,
                        teacherName: tch?.name || '未知老師'
                    });
                });
            }
        });
        return map;
    }, [requirements, classes, courses, teachers]);

    // Check if the current selection's teachers have conflicts at this slot
    const getConflicts = (slotIndex) => {
        if (!selectedCourseName || targetClasses.length === 0) return [];

        const targetCourseIds = getTargetCourseIds();
        const involvedTeachers = new Set();

        // Find which teachers are involved for our selected target classes/course
        targetClasses.forEach(cls => {
            const req = requirements.find(r => r.classId === cls.id && targetCourseIds.includes(r.courseId));
            if (req && req.teacherId) involvedTeachers.add(req.teacherId);
        });

        if (involvedTeachers.size === 0) return [];

        // Check if these teachers are occupied by OTHER classes (or other courses in same class)
        const occupied = teacherOccupationMap[slotIndex] || [];
        return occupied.filter(occ => {
            // Is it one of our teachers?
            const isOurTeacher = involvedTeachers.has(occ.teacherId);
            if (!isOurTeacher) return false;

            // Is it a different requirement? (different class OR different course)
            const isThisSelection = targetClasses.some(c => c.id === occ.classId) && targetCourseIds.includes(occ.courseId);
            return !isThisSelection;
        });
    };

    // Deduplicate courses by name for the dropdown
    const uniqueCourseNames = Array.from(new Set(courses.map(c => c.name))).sort();

    // Helper: Get all course IDs that match the selected name
    const getTargetCourseIds = () => {
        return courses.filter(c => c.name === selectedCourseName).map(c => c.id);
    };

    // Helper to get periods
    const periods = [1, 2, 3, 4, 5, 6, 7];
    const days = [
        { val: 1, label: '週一' },
        { val: 2, label: '週二' },
        { val: 3, label: '週三' },
        { val: 4, label: '週四' },
        { val: 5, label: '週五' }
    ];

    // Filter Logic
    const targetClasses = scope === 'grade'
        ? classes.filter(c => String(c.grade) === String(selectedGrade))
        : classes.filter(c => c.id === selectedClassId);

    // Check if a slot is locked for the current selection
    const isSlotLocked = (slotIndex) => {
        if (!selectedCourseName || targetClasses.length === 0) return false;

        const targetCourseIds = getTargetCourseIds();

        // Find requirements for target classes
        const targetReqs = requirements.filter(r =>
            targetClasses.some(c => c.id === r.classId) &&
            targetCourseIds.includes(r.courseId)
        );

        if (targetReqs.length === 0) return false;

        // Return true if ALL existing target requirements have this slot locked
        return targetReqs.every(req => req.fixedSlots && req.fixedSlots.includes(slotIndex));
    };

    // Toggle a slot for the entire selection
    const toggleSlot = (slotIndex) => {
        if (!selectedCourseName) {
            alert("請先選擇科目");
            return;
        }
        if (targetClasses.length === 0) {
            alert(scope === 'grade' ? "找不到該年級的班級" : "請選擇班級");
            return;
        }

        const targetCourseIds = getTargetCourseIds();

        // Check if ANY of the target classes actually have this requirement
        const classesWithReq = targetClasses.filter(cls =>
            requirements.some(r => r.classId === cls.id && targetCourseIds.includes(r.courseId))
        );

        if (classesWithReq.length === 0) {
            if (confirm(`在所選範圍中，找不到「${selectedCourseName}」的課程分配。\n\n是否立即前往「師資配課」區塊進行設定？`)) {
                onNavigateToWorkload && onNavigateToWorkload();
            }
            return;
        }

        const currentlyLocked = isSlotLocked(slotIndex);

        // Conflict Check before adding lock
        if (!currentlyLocked) {
            const conflicts = getConflicts(slotIndex);
            if (conflicts.length > 0) {
                const conflictMsgs = conflicts.map(c => `・[${c.className}] ${c.teacherName}老師 (${c.courseName})`).join('\n');
                if (!confirm(`⚠️ 教師時段衝突！\n\n在此時段，以下老師已被佔用：\n${conflictMsgs}\n\n確定要強制鎖定嗎？ (可能導致排課失敗)`)) {
                    return;
                }
            }
        }

        const newReqs = requirements.map(req => {
            const isTargetClass = targetClasses.some(c => c.id === req.classId);
            const isTargetCourse = targetCourseIds.includes(req.courseId);

            if (isTargetClass && isTargetCourse) {
                const currentLocks = req.fixedSlots || [];
                if (currentlyLocked) {
                    // Remove lock
                    return { ...req, fixedSlots: currentLocks.filter(s => s !== slotIndex) };
                } else {
                    // Add lock
                    if (currentLocks.includes(slotIndex)) return req;
                    return { ...req, fixedSlots: [...currentLocks, slotIndex] };
                }
            }
            return req;
        });

        onUpdateRequirements(newReqs);
    };

    const handleClearSelection = () => {
        if (!confirm(`確定要清除目前範圍內「${selectedCourseName}」的所有預排鎖定嗎？`)) return;

        const targetCourseIds = getTargetCourseIds();
        const newReqs = requirements.map(req => {
            const isTargetClass = targetClasses.some(c => c.id === req.classId);
            const isTargetCourse = targetCourseIds.includes(req.courseId);

            if (isTargetClass && isTargetCourse) {
                return { ...req, fixedSlots: [] };
            }
            return req;
        });
        onUpdateRequirements(newReqs);
    };

    const handleClearAllLocks = () => {
        if (!confirm('⚠️ 嚴重警告：這將會清除「全校所有年級、班級與科目」的預排鎖定設定！\n\n此操作將使所有已設定的鎖定時段失效，且無法復原。\n\n確定要執行嗎？')) return;

        const newReqs = requirements.map(req => {
            if (req.fixedSlots && req.fixedSlots.length > 0) {
                return { ...req, fixedSlots: [] };
            }
            return req;
        });
        onUpdateRequirements(newReqs);
        alert('已成功清除所有鎖定設定，回復至原始預設狀態。');
    };

    return (
        <div className="card pre-schedule-panel">
            <div className="pre-schedule-header">
                <h3>🔒 預排與鎖定 (批次設定)</h3>
                <span className="badge-info">適用於：本土語、資源班、社團等</span>
            </div>

            <div className="pre-schedule-content">
                <div className="settings-left">
                    <div className="control-row">
                        <label>範圍模式:</label>
                        <div className="radio-group">
                            <label>
                                <input
                                    type="radio"
                                    name="scope"
                                    value="grade"
                                    checked={scope === 'grade'}
                                    onChange={() => setScope('grade')}
                                />
                                全學年
                            </label>
                            <label>
                                <input
                                    type="radio"
                                    name="scope"
                                    value="class"
                                    checked={scope === 'class'}
                                    onChange={() => setScope('class')}
                                />
                                指定班級
                            </label>
                        </div>
                    </div>

                    <div className="control-row">
                        {scope === 'grade' ? (
                            <>
                                <label>選擇年級:</label>
                                <select value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
                                    {[1, 2, 3, 4, 5, 6].map(g => <option key={g} value={g}>{g} 年級</option>)}
                                </select>
                            </>
                        ) : (
                            <>
                                <label>選擇班級:</label>
                                <select value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
                                    <option value="">請選擇...</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </>
                        )}
                    </div>

                    <div className="control-row">
                        <label>選擇科目:</label>
                        <select value={selectedCourseName} onChange={e => setSelectedCourseName(e.target.value)}>
                            <option value="">-- 點此選擇科目 --</option>
                            {uniqueCourseNames.map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                    </div>

                    <div className="selection-stats">
                        {selectedCourseName && (
                            <div className="info-box">
                                <strong>目前對象:</strong> {scope === 'grade' ? `${selectedGrade}年級各班` : classes.find(c => c.id === selectedClassId)?.name || '未選擇'} <br />
                                <strong>所選科目:</strong> {selectedCourseName}
                            </div>
                        )}
                    </div>

                    <div className="pre-schedule-actions">
                        <button className="btn btn-outline btn-small" onClick={handleClearSelection} disabled={!selectedCourseName}>
                            🗑 清除目前範圍
                        </button>
                        <button className="btn btn-danger btn-small" onClick={handleClearAllLocks}>
                            ⚠️ 一鍵清除所有設定
                        </button>
                    </div>
                </div>

                <div className="settings-right">
                    <div className="lock-grid-container">
                        <label className="grid-label">點擊格子以 鎖定/解鎖 時段:</label>
                        <div className="lock-grid">
                            <div className="grid-header-cell"></div>
                            {days.map(d => <div key={d.val} className="grid-header-cell">{d.label}</div>)}

                            {periods.map(p => (
                                <Fragment key={p}>
                                    <div className="grid-side-cell">第{p}節</div>
                                    {days.map(d => {
                                        const slotIndex = (d.val - 1) * 7 + (p - 1);
                                        const locked = isSlotLocked(slotIndex);
                                        const conflicts = getConflicts(slotIndex);
                                        const hasConflict = conflicts.length > 0;

                                        let tooltip = locked ? "已鎖定" : "點擊鎖定";
                                        if (hasConflict) {
                                            tooltip = `⚠️ 教師衝突！\n${conflicts.map(c => `${c.className}: ${c.teacherName}`).join(', ')}`;
                                        }

                                        return (
                                            <div
                                                key={`${d.val}-${p}`}
                                                className={`grid-cell ${locked ? 'locked' : ''} ${hasConflict ? 'conflict' : ''} ${!selectedCourseName ? 'disabled' : ''}`}
                                                onClick={() => toggleSlot(slotIndex)}
                                                title={tooltip}
                                            >
                                                {locked ? '🔒' : (hasConflict ? '⚠️' : '')}
                                            </div>
                                        );
                                    })}
                                </Fragment>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="tip-box">
                <small>💡 批次設定說明：選擇學年與科目後，在右側網格點選時段，該年級所有班級的該科就會同步鎖定在該時段。</small>
            </div>
        </div>
    );
}

export default PreScheduleManager;
