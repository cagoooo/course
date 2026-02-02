import React, { useState, useEffect, useRef, useMemo } from 'react';
import { firestoreService } from '../services/firestoreService';
import { useSemester } from '../contexts/SemesterContext';
import ScheduleGrid from '../components/ScheduleGrid';
import PublicSchedule from './PublicSchedule';
import PrintSettingsModal from '../components/PrintSettingsModal';
import SchedulerWorker from '../workers/scheduler.worker.js?worker';
import DataManagementPanel from '../components/DataManagementPanel';
import TeacherWorkloadPanel from '../components/TeacherWorkloadPanel';
import ExportPanel from '../components/ExportPanel';
import ConflictResolver from '../components/ConflictResolver';
import { isSlotAllowed } from '../algorithms/types.js';
import { runDiagnostics } from '../algorithms/Diagnostics';
import SnapshotManager from '../components/SnapshotManager';
import { DiffService } from '../services/DiffService'; // Import Diff Service
import './AutoSchedule_ProgressBar.css';


function AutoSchedule() {
    const { currentSemesterId } = useSemester();
    const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'workload' | 'scheduler'
    const [status, setStatus] = useState('idle'); // idle, loading, running, stopped
    const [progress, setProgress] = useState({ generation: 0, score: 0 });
    const [bestSolution, setBestSolution] = useState([]);
    const [draggingIndex, setDraggingIndex] = useState(null); // For smart suggestions
    const [showQRCode, setShowQRCode] = useState(false);
    const [showSnapshotManager, setShowSnapshotManager] = useState(false);

    // Diff Mode State
    const [diffMode, setDiffMode] = useState(false);
    const [diffMap, setDiffMap] = useState(null); // Map<index, diffStatus>
    const [comparisonName, setComparisonName] = useState('');
    const [originalBestSolution, setOriginalBestSolution] = useState(null); // Backup logic

    // Smart Fill State
    const [smartFillModal, setSmartFillModal] = useState({ show: false, slotIndex: null, candidates: [] });

    // Diagnostics State
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [diagnosticResults, setDiagnosticResults] = useState([]);

    const handleRunDiagnostics = () => {
        const results = runDiagnostics(teachers, requirements, classes);
        setDiagnosticResults(results);
        setShowDiagnostics(true);
    };
    const [printSettings, setPrintSettings] = useState({
        fontSize: 14,
        paperSize: 'A4',
        layout: 'portrait',
        showTeacherName: true,
        showCourseName: true,
        showClassName: true,
        titleTemplate: '' // Will be set dynamically
    });
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [printType, setPrintType] = useState('class'); // 'class' or 'teacher'
    const [isBatchPrinting, setIsBatchPrinting] = useState(false);

    const [classes, setClasses] = useState([]);
    const [courses, setCourses] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [classrooms, setClassrooms] = useState([]);
    const [requirements, setRequirements] = useState([]);

    const [viewClassId, setViewClassId] = useState('');

    const [selectedTeacherId, setSelectedTeacherId] = useState(null);

    const workerRef = useRef(null);
    const isInitialLoad = useRef(true);
    const saveTimeoutRef = useRef(null);

    // Auto-save requirements with debounce
    useEffect(() => {
        // Skip initial load
        if (isInitialLoad.current || !currentSemesterId) {
            return;
        }

        // Clear existing timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce save (wait 1 second after last change)
        saveTimeoutRef.current = setTimeout(async () => {
            try {
                await firestoreService.saveRequirements(requirements, currentSemesterId);
                console.log('Requirements auto-saved');
            } catch (err) {
                console.error('Failed to save requirements:', err);
            }
        }, 1000);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [requirements, currentSemesterId]);

    // Load Data
    useEffect(() => {
        if (!currentSemesterId) return;

        async function loadData() {
            setStatus('loading');
            const [cl, cr, te, clr, semSchedules, savedReqs] = await Promise.all([
                firestoreService.getClasses(currentSemesterId),
                firestoreService.getCourses(currentSemesterId),
                firestoreService.getTeachers(currentSemesterId),
                firestoreService.getClassrooms(currentSemesterId),
                firestoreService.getAllSchedules(currentSemesterId),
                firestoreService.getRequirements(currentSemesterId)
            ]);

            setClasses(cl);

            // Sanitize Courses (Strict check for object wrapping)
            const sanitizedCourses = cr.map(c => {
                if (typeof c.name === 'object' && c.name !== null) {
                    return { ...c, name: c.name.name || Object.values(c.name)[0] || 'Unknown' };
                }
                return c;
            });
            setCourses(sanitizedCourses);

            // Sanitize Teachers
            const sanitizedTeachers = te.map(t => {
                if (typeof t.name === 'object' && t.name !== null) {
                    return { ...t, name: t.name.name || Object.values(t.name)[0] || 'Unknown' };
                }
                return t;
            });
            setTeachers(sanitizedTeachers);

            // Sanitize Classrooms (Fix for batched import error where name became object)
            const sanitizedClassrooms = clr.map(c => {
                if (typeof c.name === 'object' && c.name !== null) {
                    // Extract name from object if nested
                    return { ...c, name: c.name.name || Object.values(c.name)[0] || 'Unknown' };
                }
                return c;
            });
            setClassrooms(sanitizedClassrooms);

            // Optional: If we found bad data, we might want to save it back sanitized?
            // For now, client-side fix is safe enough to prevent crash.

            if (cl.length > 0) setViewClassId(cl[0].id);

            // Use saved requirements if available, otherwise derive from schedules
            if (savedReqs && savedReqs.length > 0) {
                setRequirements(savedReqs);
            } else {
                // Generate Requirements from existing semester data (legacy fallback)
                const reqs = [];
                semSchedules.forEach(sch => {
                    if (!sch.periods) return;
                    const counts = {};
                    sch.periods.forEach(p => {
                        if (!p.courseId) return;
                        const key = `${p.courseId}-${p.teacherId || ''}`;
                        counts[key] = (counts[key] || 0) + 1;
                    });

                    Object.entries(counts).forEach(([key, count]) => {
                        const [cId, tId] = key.split('-');
                        reqs.push({
                            classId: sch.id,
                            courseId: cId,
                            teacherId: tId || null,
                            periodsNeeded: count
                        });
                    });
                });
                setRequirements(reqs);
            }
            // Convert existing schedules into bestSolution (Genes) format
            const initialBestSolution = [];
            semSchedules.forEach(sch => {
                if (sch.periods) {
                    sch.periods.forEach((p, idx) => {
                        if (p && p.courseId) {
                            initialBestSolution.push({
                                classId: sch.id,
                                courseId: p.courseId,
                                teacherId: p.teacherId || null,
                                periodIndex: idx
                            });
                        }
                    });
                }
            });
            setBestSolution(initialBestSolution);

            setStatus('idle');
            // Mark initial load complete so auto-save kicks in for future changes
            isInitialLoad.current = false;
        }
        loadData();
    }, [currentSemesterId]);





    // Courses








    // Classrooms






    // Cleanup Helpers


    // Worker Control
    const handleStart = () => {
        if (requirements.length === 0) {
            alert("無排課需求，無法開始。");
            return;
        }

        if (!workerRef.current) {
            workerRef.current = new SchedulerWorker();
            workerRef.current.onmessage = (e) => {
                const { type, payload } = e.data;
                if (type === 'PROGRESS') {
                    setProgress({
                        generation: payload.generation,
                        score: payload.bestScore
                    });
                    setBestSolution(payload.bestSolution);
                }
            };
        }

        setStatus('running');
        // Sanitize data before sending to worker to prevent "name is object" errors
        const safeData = {
            classes,
            classrooms,
            requirements,
            courses: courses.map(c => ({
                ...c,
                name: (typeof c.name === 'object' && c.name !== null) ? (c.name.name || Object.values(c.name)[0] || 'Unknown') : c.name
            })),
            teachers: teachers.map(t => ({
                ...t,
                name: (typeof t.name === 'object' && t.name !== null) ? (t.name.name || Object.values(t.name)[0] || 'Unknown') : t.name
            }))
        };

        workerRef.current.postMessage({
            type: 'START',
            payload: {
                data: safeData,
                config: { populationSize: 50, mutationRate: 0.1 }
            }
        });
    };

    const handleStop = () => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
        setStatus('stopped');
    };

    const handleSave = async () => {
        if (!bestSolution || bestSolution.length === 0) return;

        const confirmSave = confirm("確定要將此課表寫入資料庫嗎？這將會覆蓋現有的課表資料。");
        if (!confirmSave) return;

        setStatus('saving');

        // Convert Chromosome to Schedule Objects
        const schedulesToSave = classes.map(cls => {
            const classGenes = bestSolution.filter(g => g.classId === cls.id);
            // Map to period array (0..34)
            const periods = Array(35).fill({ courseId: null, teacherId: null });
            classGenes.forEach(g => {
                if (g.periodIndex >= 0 && g.periodIndex < 35) {
                    periods[g.periodIndex] = {
                        courseId: g.courseId,
                        teacherId: g.teacherId
                    };
                }
            });
            return { classId: cls.id, periods };
        });

        try {
            await firestoreService.saveScheduleBatch(schedulesToSave, currentSemesterId);
            alert("課表儲存成功！");
            setStatus('idle');
        } catch (err) {
            console.error(err);
            alert("儲存失敗：" + err.message);
            setStatus('stopped');
        }
    };

    // --- Teacher Management ---
    const handleAddTeacher = async (name) => {
        try {
            const newTeacher = { name, id: '', classroomId: null };
            const saved = await firestoreService.addTeacher(newTeacher, currentSemesterId);
            setTeachers([...teachers, saved]);
        } catch (e) {
            console.error(e);
            alert("新增失敗: " + e.message);
        }
    };

    const handleUpdateTeacher = async (id, updates) => {
        try {
            const changes = typeof updates === 'string' ? { name: updates } : updates;
            const updated = { id, ...changes };

            await firestoreService.updateTeacher(updated, currentSemesterId);

            setTeachers(teachers.map(t => t.id === id ? { ...t, ...changes } : t));
        } catch (e) {
            console.error(e);
            alert("更新失敗: " + e.message);
        }
    };

    const handleDeleteTeacher = async (id) => {
        if (!confirm("確定要刪除這位老師嗎？相關的排課設定可能會失效。")) return;
        try {
            await firestoreService.deleteTeacher(id, currentSemesterId);
            setTeachers(teachers.filter(t => t.id !== id));
        } catch (e) {
            console.error(e);
            alert("刪除失敗: " + e.message);
        }
    };

    // --- Classroom Management ---
    const handleAddClassroom = async (name) => {
        try {
            const saved = await firestoreService.addClassroom({ name }, currentSemesterId);
            setClassrooms([...classrooms, saved]);
        } catch (e) {
            console.error(e);
            alert("新增失敗: " + e.message);
        }
    };

    const handleUpdateClassroom = async (id, name) => {
        try {
            await firestoreService.updateClassroom({ id, name }, currentSemesterId);
            setClassrooms(classrooms.map(c => c.id === id ? { ...c, name } : c));
        } catch (e) {
            console.error(e);
            alert("更新失敗: " + e.message);
        }
    };

    const handleDeleteClassroom = async (id) => {
        if (!confirm("確定要刪除這個教室嗎？已綁定的教師將失去教室關聯。")) return;
        try {
            await firestoreService.deleteClassroom(id, currentSemesterId);
            setClassrooms(classrooms.filter(c => c.id !== id));
            // Also need to clear classroomId for teachers who used it
            setTeachers(teachers.map(t => t.classroomId === id ? { ...t, classroomId: null } : t));
        } catch (e) {
            console.error(e);
            alert("刪除失敗: " + e.message);
        }
    };

    // --- Batch Import Handlers ---
    const handleBatchAddTeachers = async (data) => {
        try {
            // Support input as array of strings (names) or objects
            const teachersData = (Array.isArray(data) && typeof data[0] === 'string')
                ? data.map(name => ({ name }))
                : data;
            const results = await firestoreService.batchAddTeachers(teachersData, currentSemesterId);
            setTeachers([...teachers, ...results]);
            alert(`成功新增 ${results.length} 位教師`);
        } catch (e) {
            console.error(e);
            alert("批次新增失敗: " + e.message);
        }
    };

    const handleBatchAddCourses = async (data) => {
        try {
            // Support input as array of strings (names) or objects
            const coursesData = (Array.isArray(data) && typeof data[0] === 'string')
                ? data.map(name => ({ name }))
                : data;
            const results = await firestoreService.batchAddCourses(coursesData, currentSemesterId);
            setCourses([...courses, ...results]);
            alert(`成功新增 ${results.length} 個科目`);
        } catch (e) {
            console.error(e);
            alert("批次新增失敗: " + e.message);
        }
    };

    const handleBatchAddClassrooms = async (data) => {
        try {
            // Support input as array of strings (names) or objects
            const classroomsData = (Array.isArray(data) && typeof data[0] === 'string')
                ? data.map(name => ({ name }))
                : data;
            const results = await firestoreService.batchAddClassrooms(classroomsData, currentSemesterId);
            setClassrooms([...classrooms, ...results]);
            alert(`成功新增 ${results.length} 間教室`);
        } catch (e) {
            console.error(e);
            alert("批次新增失敗: " + e.message);
        }
    };


    // --- Course Management ---
    const handleAddCourse = async (name) => {
        try {
            const newCourse = { name, id: '' };
            const saved = await firestoreService.addCourse(newCourse, currentSemesterId);
            setCourses([...courses, saved]);
        } catch (e) {
            console.error(e);
            alert("新增失敗: " + e.message);
        }
    };

    const handleUpdateCourse = async (id, name) => {
        try {
            const courseToUpdate = courses.find(c => c.id === id);
            if (!courseToUpdate) return;

            const oldName = courseToUpdate.name;
            const updated = { id, name };

            // Find all courses with the same old name to update them all
            const sameNameCourses = courses.filter(c => c.name === oldName);

            // In a real database, we'd use a batch. For local testing/simplicity:
            for (const c of sameNameCourses) {
                await firestoreService.updateCourse({ id: c.id, name }, currentSemesterId);
            }

            setCourses(courses.map(c => c.name === oldName ? { ...c, name } : c));
        } catch (e) {
            console.error(e);
            alert("更新失敗: " + e.message);
        }
    };

    const handleDeleteCourse = async (id) => {
        const courseToDelete = courses.find(c => c.id === id);
        if (!courseToDelete) return;

        const targetName = courseToDelete.name;
        if (!confirm(`確定要刪除科目名稱「${targetName}」嗎？\n這將會移除清單中所有名為「${targetName}」的項目，相關排課設定可能會失效。`)) return;

        try {
            const sameNameCourses = courses.filter(c => c.name === targetName);
            for (const c of sameNameCourses) {
                await firestoreService.deleteCourse(c.id, currentSemesterId);
            }
            setCourses(courses.filter(c => c.name !== targetName));
        } catch (e) {
            console.error(e);
            alert("刪除失敗: " + e.message);
        }
    };

    // --- Cleanup Duplicate Courses ---
    const handleCleanupDuplicateCourses = async () => {
        const keeps = new Map(); // name -> firstId
        const duplicates = []; // { id, name, keepId }

        courses.forEach(c => {
            if (keeps.has(c.name)) {
                duplicates.push({ id: c.id, name: c.name, keepId: keeps.get(c.name) });
            } else {
                keeps.set(c.name, c.id);
            }
        });

        if (duplicates.length === 0) {
            alert('沒有找到重複的科目');
            return;
        }

        if (!confirm(`確定要清除 ${duplicates.length} 筆重複的科目嗎？\n系統會自動將相關配課重新指向保留的科目，確保顯示正常。`)) return;

        try {
            setStatus('loading');

            // 1. Prepare new requirements list with updated IDs
            let updatedCount = 0;
            const newRequirements = requirements.map(req => {
                const dup = duplicates.find(d => d.id === req.courseId);
                if (dup) {
                    updatedCount++;
                    return { ...req, courseId: dup.keepId };
                }
                return req;
            });

            // 2. Delete duplicate course records from Firestore
            for (const dup of duplicates) {
                await firestoreService.deleteCourse(dup.id, currentSemesterId);
            }

            // 3. Update requirements if any changed
            if (updatedCount > 0) {
                setRequirements(newRequirements);
                // Also trigger auto-save or manual save if needed
                await firestoreService.saveRequirements(newRequirements, currentSemesterId);
                console.log(`已重新對應 ${updatedCount} 筆配課需求`);
            }

            setCourses(courses.filter(c => !duplicates.find(d => d.id === c.id)));
            alert(`已清除 ${duplicates.length} 筆重複科目，並修復 ${updatedCount} 筆配課連結。`);
            setStatus('idle');
        } catch (e) {
            console.error(e);
            alert("清除失敗: " + e.message);
            setStatus('idle');
        }
    };

    // --- Class & Homeroom Management ---
    const handleUpdateClassCounts = async (grade, newCount) => {
        // Find existing classes for this grade
        const gradeClasses = classes.filter(c => c.grade === grade);
        const currentCount = gradeClasses.length;

        if (newCount === currentCount) return;

        try {
            if (newCount > currentCount) {
                // Add classes
                for (let i = currentCount + 1; i <= newCount; i++) {
                    const newClass = {
                        id: `G${grade}-C${i}`,
                        name: `${grade}年${i}班`,
                        grade: grade,
                        classNum: i,
                        // gridIndex is legacy, maybe not needed or calculate max
                    };
                    await firestoreService.addClass(newClass, currentSemesterId);
                    // Also create empty schedule doc if needed
                }
            } else {
                // Remove classes (from end)
                for (let i = currentCount; i > newCount; i--) {
                    const classId = `G${grade}-C${i}`;
                    await firestoreService.deleteClass(classId, currentSemesterId);
                    // Should also delete schedule doc?
                }
            }
            // Refresh classes
            const updatedClasses = await firestoreService.getClasses(currentSemesterId);
            setClasses(updatedClasses);
        } catch (e) {
            console.error(e);
            alert("更新班級數量失敗: " + e.message);
        }
    };

    const handleAssignHomeroom = async (classId, teacherId) => {
        try {
            await firestoreService.updateClassHomeroom(classId, teacherId, currentSemesterId);
            setClasses(classes.map(c => c.id === classId ? { ...c, homeroomTeacherId: teacherId } : c));
        } catch (e) {
            console.error(e);
            alert("設定導師失敗: " + e.message);
        }
    };

    // --- Repair Requirements ---
    const handleRepairRequirements = async () => {
        if (!confirm('系統將嘗試修復編號異常的配課資料（如顯示為數字的科目）。這會將失效的連結重新指向正確的科目，是否繼續？')) return;

        try {
            setStatus('loading');
            const newRequirements = [...requirements];
            let fixedCount = 0;

            // Define legacy ID mappings (based on smes_data.json analysis)
            const legacyMap = {
                '0': '國', '1': '國',
                '2': '數', '3': '數',
                '4': '社', '5': '社',
                '6': '自', '7': '自',
                '8': '英', '9': '英',
                '10': '生導', '11': '生導',
                '12': '生科', '13': '生科',
                '14': '健', '15': '健',
                '16': '體', '17': '體',
                '18': '音樂', '19': '音樂',
                '20': '美勞', '21': '美勞',
                '22': '閩語', '23': '閩語',
                '24': '客語', '25': '客語',
                '26': '創客', '27': '創客',
                '28': '綜合', '29': '綜合',
                '30': '鮮活', '31': '鮮活',
                '32': '手作', '33': '手作',
                '34': '專題', '35': '專題',
                '36': '閱讀', '37': '閱讀',
                '38': 'AB', '39': 'AB'
            };

            newRequirements.forEach((req, idx) => {
                const exists = courses.find(c => c.id === req.courseId);
                if (!exists) {
                    const possibleName = legacyMap[req.courseId];
                    if (possibleName) {
                        const targetCourse = courses.find(c => c.name === possibleName);
                        if (targetCourse) {
                            newRequirements[idx] = { ...req, courseId: targetCourse.id };
                            fixedCount++;
                        }
                    }
                }
            });

            if (fixedCount > 0) {
                setRequirements(newRequirements);
                await firestoreService.saveRequirements(newRequirements, currentSemesterId);
                alert(`修復完成！共更新了 ${fixedCount} 筆配課資料。`);
            } else {
                alert('沒有發現需要修復的資料。如果是自定義科目（如 13:生科），請到「配課管理」手動重新選擇科目即可。');
            }
            setStatus('idle');
        } catch (e) {
            console.error(e);
            alert("修復失敗: " + e.message);
            setStatus('idle');
        }
    };

    const handleAutoAssignHomeroomCourses = async () => {
        if (!confirm("確定要將所有班級的「國語」與「數學」課程自動分配給各班導師嗎？")) return;

        // Identify Homeroom Subjects (Mandarin, Math) - Find ALL matching course IDs
        const mandarinCourseIds = courses.filter(c => c.name === '國' || c.name === '國語').map(c => c.id);
        const mathCourseIds = courses.filter(c => c.name === '數' || c.name === '數學').map(c => c.id);

        // Add fallbacks if not found (though less likely if we search all)
        if (mandarinCourseIds.length === 0) mandarinCourseIds.push('0');
        if (mathCourseIds.length === 0) mathCourseIds.push('2');

        const targetCourseIds = [...mandarinCourseIds, ...mathCourseIds];

        let updatedCount = 0;
        const newRequirements = requirements.map(req => {
            const classObj = classes.find(c => c.id === req.classId);
            // If class has homeroom teacher AND course is one of the targets
            if (classObj && classObj.homeroomTeacherId && targetCourseIds.includes(req.courseId)) {

                // Only update if not already assigned to homeroom teacher
                if (req.teacherId !== classObj.homeroomTeacherId) {
                    updatedCount++;
                    return { ...req, teacherId: classObj.homeroomTeacherId };
                }
            }
            return req;
        });

        if (updatedCount === 0) {
            alert("沒有任何變更。請確認是否已設定導師。");
            return;
        }

        setRequirements(newRequirements);

        // Optional: Persist to Firestore Schedules?
        // Since we want this to be "default", we should save these assignments back to the 'schedules' definition
        // But 'schedules' structure in Firestore is array of periods.
        // We need to update the 'teacherId' in the periods for these courses.
        // This is complex because 'requirements' is aggregated count.
        // 'schedules' doc has explicit slots (or list of periods).
        // Let's assume for now Updating Requirements locallly is enough for the "Run Scheduler" step.
        // But if user wants to persist "Allocations", we usually save 'requirements' somewhere or update the source 'schedules' doc.
        // Given existing structure, let's just alert user.
        alert(`已自動分配 ${updatedCount} 筆課程給導師。請記得最後儲存排課結果。`);
    };

    // --- Reset / Clear Functions ---
    const handleClearAllConstraints = async () => {
        if (!confirm("確定要清除「所有」老師的排課時段限制嗎？此動作無法復原。")) return;
        try {
            await firestoreService.clearAllTeacherConstraints(teachers, currentSemesterId);
            setTeachers(teachers.map(t => ({ ...t, unavailableSlots: [] })));
            alert("已清除所有排課限制。");
        } catch (e) {
            console.error(e);
            alert("清除失敗: " + e.message);
        }
    };

    const handleClearAllHomerooms = async () => {
        if (!confirm("確定要清除「所有」班級的導師設定嗎？此動作無法復原。")) return;
        try {
            await firestoreService.clearAllClassHomerooms(classes, currentSemesterId);
            setClasses(classes.map(c => ({ ...c, homeroomTeacherId: null })));
            alert("已清除所有導師設定。");
        } catch (e) {
            console.error(e);
            alert("清除失敗: " + e.message);
        }
    };

    const handleClearAllAllocations = () => {
        if (!confirm("確定要清除「所有」課程的配課教師嗎？\n(這將移除所有已指定的任課老師，回復為未分配狀態)")) return;

        const newRequirements = requirements.map(req => ({
            ...req,
            teacherId: null
        }));
        setRequirements(newRequirements);
        alert("已清除所有配課教師 (請記得儲存排課結果以生效)。");
    };

    const handleMoveCourse = (fromIndex, toIndex) => {
        if (!viewClassId || !bestSolution) return;

        const otherGenes = bestSolution.filter(g => g.classId !== viewClassId);
        const myGenes = bestSolution.filter(g => g.classId === viewClassId);

        const sourceGeneIndex = myGenes.findIndex(g => g.periodIndex === fromIndex);
        const targetGeneIndex = myGenes.findIndex(g => g.periodIndex === toIndex);

        if (sourceGeneIndex === -1) return;

        if (toIndex === -1) {
            // Remove
            setBestSolution([...otherGenes, ...myGenes.filter((_, i) => i !== sourceGeneIndex)]);
            return;
        }

        const newMyGenes = [...myGenes];

        if (targetGeneIndex !== -1) {
            // Swap
            const sourceGene = { ...newMyGenes[sourceGeneIndex], periodIndex: toIndex };
            const targetGene = { ...newMyGenes[targetGeneIndex], periodIndex: fromIndex };
            newMyGenes[sourceGeneIndex] = sourceGene;
            newMyGenes[targetGeneIndex] = targetGene;
        } else {
            // Move to empty slot
            const sourceGene = { ...newMyGenes[sourceGeneIndex], periodIndex: toIndex };
            newMyGenes[sourceGeneIndex] = sourceGene;
        }

        setBestSolution([...otherGenes, ...newMyGenes]);
    };

    // --- Diff / Compare Logic ---
    const handleCompareSnapshot = (snapshot) => {
        if (!bestSolution || bestSolution.length === 0) {
            alert('目前沒有排課內容可供比對');
            return;
        }

        // 1. Calculate Diff (Current vs Snapshot)
        // Current is Base, Snapshot is Target.
        // We want to see "If I restore this snapshot, what changes?"
        // So Diff = Snapshot (Target) - Current (Base).

        // Wait, bestSolution format: Array of Gene { classId, teacherId, courseId, periodIndex }
        // Snapshot format: Array of Schedule Objects { classId, periods: [...] }
        // We need to normalize formats to use DiffService.

        // Convert bestSolution (Genes) to standard Schedule Objects for DiffService
        // But DiffService expects flattened items usually.
        // Let's adapt DiffService inputs.

        // Normalize Current (Genes) -> Flat Items
        const currentItems = bestSolution.map(g => ({
            teacherId: g.teacherId,
            weekday: Math.floor(g.periodIndex / 7),
            period: g.periodIndex % 7,
            classId: g.classId,
            courseId: g.courseId,
            topLine: courses.find(c => c.id === g.courseId), // Enrich for Display
            bottomLine: classes.find(c => c.id === g.classId)
        }));

        // Normalize Snapshot (Schedule Docs) -> Flat Items
        const snapshotItems = [];
        const sourceSchedules = snapshot.schedules || snapshot.data || [];

        sourceSchedules.forEach(sch => {
            if (!sch.periods) return;
            sch.periods.forEach((p, idx) => {
                if (p && p.courseId) {
                    snapshotItems.push({
                        teacherId: p.teacherId,
                        weekday: Math.floor(idx / 7),
                        period: idx % 7,
                        classId: sch.classId,
                        courseId: p.courseId,
                        topLine: courses.find(c => c.id === p.courseId),
                        bottomLine: classes.find(c => c.id === sch.classId)
                    });
                }
            });
        });

        const diffResult = DiffService.compare(currentItems, snapshotItems);

        // Convert Diff Result to Grid Map
        // Key: Teacher-based or Class-based?
        // AutoSchedule view depends on 'activeTab'.
        // If 'scheduler', it usually shows ONE class or ALL classes in tabs?
        // Wait, AutoSchedule shows ONE class via `viewClassId`.

        const map = new Map();

        // Helper to add to map using global class-aware keys
        const addToMap = (item, status, oldItem, newItem) => {
            if (!item || !item.classId) return;
            const idx = item.weekday * 7 + item.period;
            // Key: classId_index
            map.set(`${item.classId}_${idx}`, { status, old: oldItem, new: newItem });
        };

        diffResult.added.forEach(item => addToMap(item, 'added', null, item));
        diffResult.removed.forEach(item => addToMap(item, 'removed', item, null));
        diffResult.modified.forEach(change => addToMap(change.to, 'modified', change.from, change.to));

        setDiffMap(map);
        setDiffMode(true);
        setComparisonName(snapshot.name);

        // Backup current solution to restore later?
        // Actually, we are just overlaying the Diff Map on the CURRENT grid.
        // We don't need to change `bestSolution` data itself, just the visualization.
        // But wait, if we want to show "Added", and "Added" means it is in Snapshot but NOT in Current.
        // If we render `bestSolution` (Current), the "Added" slot is EMPTY in Current.
        // So the Grid renders Empty.
        // But our `ScheduleGrid` logic says: `if (diffMap.has(index)) override`.
        // So yes, ScheduleGrid will receive the 'added' content from the Diff Map.

        alert(`已開啟比對模式：正在比較「目前進度」與「${snapshot.name}」\n(切換左側班級可查看不同班級的異動)`);
    };

    const handleExitDiffMode = () => {
        setDiffMode(false);
        setDiffMap(null);
        setComparisonName('');
    };


    // --- Smart Fill Logic ---
    const handleEmptyCellClick = (slotIndex) => {
        if (diffMode) return; // Disable editing in diff mode
        if (!viewClassId || !status || (status !== 'idle' && status !== 'stopped')) {
            if (status === 'running') alert("請先停止演算法再進行手動編輯。");
            return;
        }

        // 1. Calculate remaining needs for this class
        const classReqs = requirements.filter(r => r.classId === viewClassId);
        const myGenes = bestSolution.filter(g => g.classId === viewClassId);

        const candidates = [];

        classReqs.forEach(req => {
            const scheduledCount = myGenes.filter(g => g.courseId === req.courseId && g.teacherId === req.teacherId).length;
            const remaining = req.periodsNeeded - scheduledCount;

            const teacher = teachers.find(t => t.id === req.teacherId);
            const course = courses.find(c => c.id === req.courseId);

            if (!teacher || !course) return;

            let state = 'available'; // available, avoid, busy, restricted, full
            let reason = '';

            if (remaining <= 0) {
                state = 'full';
                reason = '節數已滿';
            } else {
                // Check constraints only if needed
                // A. Check Teacher Busy
                const isBusy = bestSolution.some(g => g.teacherId === teacher.id && g.periodIndex === slotIndex);
                if (isBusy) {
                    state = 'busy';
                    reason = '老師此時段已有排課';
                }

                // B. Check Teacher Constraint
                if (state !== 'busy' && teacher.unavailableSlots?.includes(slotIndex)) {
                    state = 'restricted';
                    reason = '老師設定為不排課';
                }

                // C. Check Yellow (Avoid)
                if (state === 'available' && teacher.avoidSlots?.includes(slotIndex)) {
                    state = 'avoid';
                    reason = '老師希望盡量不排';
                }
            }

            candidates.push({
                courseId: req.courseId,
                teacherId: req.teacherId,
                courseName: course.name,
                teacherName: teacher.name,
                remaining: Math.max(0, remaining),
                state,
                reason
            });
        });

        // Sort candidates: Available > Avoid > Restricted > Busy
        const score = (s) => {
            if (s === 'available') return 0;
            if (s === 'avoid') return 1;
            if (s === 'restricted') return 2;
            if (s === 'busy') return 3;
            if (s === 'full') return 4; // Put full at the bottom
            return 5;
        };
        candidates.sort((a, b) => score(a.state) - score(b.state));

        setSmartFillModal({ show: true, slotIndex, candidates });
    };

    const handleSmartFillSelect = (candidate) => {
        // Create a new gene
        const newGene = {
            classId: viewClassId,
            courseId: candidate.courseId,
            teacherId: candidate.teacherId,
            periodIndex: smartFillModal.slotIndex
        };

        setBestSolution([...bestSolution, newGene]);
        setSmartFillModal({ show: false, slotIndex: null, candidates: [] });
    };

    const handleBatchPrint = (type) => {
        setPrintType(type);
        setPrintSettings(prev => ({
            ...prev,
            titleTemplate: type === 'class' ? '{grade}年{name}班 課表' : '{name} 老師課表'
        }));
        setShowPrintModal(true);
    };

    const handleCopyShareLink = () => {
        if (!viewClassId) return;
        const baseUrl = window.location.origin;
        const shareUrl = `${baseUrl}/public/class/${viewClassId}`;

        navigator.clipboard.writeText(shareUrl).then(() => {
            alert("已複製公開課表連結到剪貼簿！\n您可以將此連結傳送給老師。");
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert(`連結為: ${shareUrl}\n(自動複製失敗，請手動複製)`);
        });
    };

    const executePrint = (settings) => {
        setPrintSettings(settings);
        setShowPrintModal(false);
        setIsBatchPrinting(true);
        setTimeout(() => {
            window.print();
            setIsBatchPrinting(false);
        }, 800);
    };

    const formatPrintTitle = (template, item) => {
        if (!template) return '';
        return template
            .replace('{grade}', item.grade || '')
            .replace('{name}', item.name || item.classNum || ''); // Use classNum for classes, name for teachers
    };

    const getFullGridForClass = (classId) => {
        if (!bestSolution || bestSolution.length === 0) return Array(35).fill(null);
        const myGenes = bestSolution.filter(g => g.classId === classId);
        const grid = Array(35).fill(null);

        myGenes.forEach(g => {
            if (g.periodIndex >= 0 && g.periodIndex < 35) {
                const crs = courses.find(c => c.id === g.courseId);
                const tch = teachers.find(t => t.id === g.teacherId);
                grid[g.periodIndex] = {
                    topLine: crs ? crs.name : `ID:${g.courseId}`,
                    bottomLine: tch ? tch.name : (g.teacherId || '無')
                };
            }
        });
        return grid;
    };

    const getFullGridForTeacher = (teacherId) => {
        const grid = Array(35).fill(null);
        if (!bestSolution || bestSolution.length === 0) return grid;
        bestSolution.forEach(g => {
            if (g.teacherId === teacherId && g.periodIndex >= 0 && g.periodIndex < 35) {
                const crs = courses.find(c => c.id === g.courseId);
                const cls = classes.find(c => c.id === g.classId);
                grid[g.periodIndex] = {
                    topLine: crs ? crs.name : `ID:${g.courseId}`,
                    bottomLine: cls ? `${cls.grade}-${cls.classNum}班` : ''
                };
            }
        });
        return grid;
    };

    // derived display data for specific class
    const classScheduleDisplay = useMemo(() => {
        if (!viewClassId || bestSolution.length === 0) return Array(35).fill(null);
        const myGenes = bestSolution.filter(g => g.classId === viewClassId);
        const grid = Array(35).fill(null);

        myGenes.forEach(g => {
            if (g.periodIndex < 0 || g.periodIndex >= 35) return;
            const crs = courses.find(c => c.id === g.courseId);
            const tch = teachers.find(t => t.id === g.teacherId);
            grid[g.periodIndex] = {
                topLine: crs ? crs.name : `ID:${g.courseId}`,
                bottomLine: tch ? tch.name : (g.teacherId || '無'),
                isMissing: !crs,
                courseId: g.courseId,
                teacherId: g.teacherId
            };
        });
        return grid;
    }, [viewClassId, bestSolution, courses, teachers]);

    const safeSlots = useMemo(() => {
        if (draggingIndex === null || !viewClassId || bestSolution.length === 0) return [];

        const draggingGene = bestSolution.find(g => g.classId === viewClassId && g.periodIndex === draggingIndex);
        if (!draggingGene || !draggingGene.teacherId) return [];

        const grade = classes.find(c => c.id === viewClassId)?.grade;
        const otherClassesGenes = bestSolution.filter(g => g.classId !== viewClassId);

        const safe = [];
        for (let i = 0; i < 35; i++) {
            // 1. Check Student Restriction (isSlotAllowed)
            if (!isSlotAllowed(grade, i)) continue;

            // 2. Check Teacher Conflict (Is the teacher busy in another class at this slot?)
            const isBusy = otherClassesGenes.some(g => g.periodIndex === i && g.teacherId === draggingGene.teacherId);
            if (!isBusy) {
                safe.push(i);
            }
        }
        return safe;
    }, [draggingIndex, viewClassId, bestSolution, classes]);

    // Calculate Global Conflicts (Teacher & Classroom)
    const { globalConflicts, conflictDetails } = useMemo(() => {
        if (!bestSolution || bestSolution.length === 0) return { globalConflicts: {}, conflictDetails: [] };

        const tMap = {}; // slotIndex -> { teacherId -> [classIds] }
        const rMap = {}; // slotIndex -> { classroomId -> [classIds] }
        const conflicts = {}; // classId -> Set(slotIndices)
        const details = []; // Array of detailed conflict info

        bestSolution.forEach(gene => {
            if (!gene.teacherId || gene.teacherId === '0' || gene.teacherId === '1') return;

            const slot = gene.periodIndex;
            const tch = gene.teacherId;

            if (!tMap[slot]) tMap[slot] = {};
            if (!tMap[slot][tch]) tMap[slot][tch] = [];
            tMap[slot][tch].push(gene.classId);

            // Check for classroom conflicts
            const tData = teachers.find(t => t.id === tch);
            if (tData && tData.classroomId) {
                const rid = tData.classroomId;
                if (!rMap[slot]) rMap[slot] = {};
                if (!rMap[slot][rid]) rMap[slot][rid] = [];
                rMap[slot][rid].push(gene.classId);
            }
        });

        // Helper to record conflicts with details
        const recordConflicts = (map, type) => {
            Object.entries(map).forEach(([slotStr, items]) => {
                const slot = parseInt(slotStr);
                Object.entries(items).forEach(([id, classIds]) => {
                    if (classIds.length > 1) {
                        // Record detailed conflict info
                        details.push({
                            slotIndex: slot,
                            type: type, // 'teacher' or 'classroom'
                            conflictId: id,
                            affectedClasses: [...classIds]
                        });

                        classIds.forEach(cId => {
                            if (!conflicts[cId]) conflicts[cId] = new Set();
                            conflicts[cId].add(slot);
                        });
                    }
                });
            });
        };

        recordConflicts(tMap, 'teacher');
        recordConflicts(rMap, 'classroom');

        return { globalConflicts: conflicts, conflictDetails: details };
    }, [bestSolution, teachers]);

    // Handle conflict resolution
    const handleResolveConflict = (classId, fromIndex, toIndex, path = null) => {
        if (!bestSolution) return;

        const otherGenes = bestSolution.filter(g => g.classId !== classId);
        const myGenes = bestSolution.filter(g => g.classId === classId);
        const newMyGenes = [...myGenes];

        if (path && Array.isArray(path)) {
            // Support multi-step chain swap (AI generated path)
            path.forEach(op => {
                const idx = newMyGenes.findIndex(g => g.periodIndex === op.from);
                if (idx !== -1) {
                    if (op.type === 'MOVE') {
                        newMyGenes[idx] = { ...newMyGenes[idx], periodIndex: op.to };
                    } else if (op.type === 'SWAP') {
                        const targetIdx = newMyGenes.findIndex(g => g.periodIndex === op.to);
                        if (targetIdx !== -1) {
                            const sourceGene = { ...newMyGenes[idx], periodIndex: op.to };
                            const targetGene = { ...newMyGenes[targetIdx], periodIndex: op.from };
                            newMyGenes[idx] = sourceGene;
                            newMyGenes[targetIdx] = targetGene;
                        }
                    }
                }
            });
        } else {
            // Original simple move/swap logic
            const sourceGeneIndex = newMyGenes.findIndex(g => g.periodIndex === fromIndex);
            if (sourceGeneIndex === -1) return;

            const targetGeneIndex = newMyGenes.findIndex(g => g.periodIndex === toIndex);

            if (targetGeneIndex !== -1) {
                // Swap
                const sourceGene = { ...newMyGenes[sourceGeneIndex], periodIndex: toIndex };
                const targetGene = { ...newMyGenes[targetGeneIndex], periodIndex: fromIndex };
                newMyGenes[sourceGeneIndex] = sourceGene;
                newMyGenes[targetGeneIndex] = targetGene;
            } else {
                // Move to empty slot
                newMyGenes[sourceGeneIndex] = { ...newMyGenes[sourceGeneIndex], periodIndex: toIndex };
            }
        }

        setBestSolution([...otherGenes, ...newMyGenes]);
    };

    return (
        <div className="page-container">
            <h2 className="page-title">自動排課系統 (Beta)</h2>

            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    ⚙️ 1. 課表設定
                </button>
                <button
                    className={`tab ${activeTab === 'workload' ? 'active' : ''}`}
                    onClick={() => setActiveTab('workload')}
                >
                    🧑‍🏫 2. 師資配課
                </button>
                <button
                    className={`tab ${activeTab === 'scheduler' ? 'active' : ''}`}
                    onClick={() => setActiveTab('scheduler')}
                >
                    🚀 3. 排課執行
                </button>
                <button
                    className={`tab ${activeTab === 'export' ? 'active' : ''}`}
                    onClick={() => setActiveTab('export')}
                >
                    🖨️ 4. 列印匯出
                </button>
            </div>

            {activeTab === 'workload' && (
                <TeacherWorkloadPanel
                    teachers={teachers}
                    courses={courses}
                    classrooms={classrooms}
                    classes={classes}
                    requirements={requirements}
                    onAddTeacher={handleAddTeacher}
                    onUpdateTeacher={handleUpdateTeacher}
                    onDeleteTeacher={handleDeleteTeacher}
                    onAddCourse={handleAddCourse}
                    onUpdateCourse={handleUpdateCourse}
                    onDeleteCourse={handleDeleteCourse}
                    onAddClassroom={handleAddClassroom}
                    onUpdateClassroom={handleUpdateClassroom}
                    onDeleteClassroom={handleDeleteClassroom}
                    onUpdateRequirements={setRequirements}
                    onBatchAddTeachers={handleBatchAddTeachers}
                    onBatchAddCourses={handleBatchAddCourses}
                    onBatchAddClassrooms={handleBatchAddClassrooms}
                    onCleanupDuplicateCourses={handleCleanupDuplicateCourses}
                    onRepairRequirements={handleRepairRequirements}
                    // Controlled props
                    selectedTeacherId={selectedTeacherId}
                    onSelectTeacher={setSelectedTeacherId}
                />
            )}

            {activeTab === 'settings' && (
                <DataManagementPanel
                    classes={classes}
                    teachers={teachers}
                    courses={courses}
                    requirements={requirements}
                    onUpdateRequirements={setRequirements}
                    onUpdateClassCounts={handleUpdateClassCounts}
                    onAssignHomeroom={handleAssignHomeroom}
                    onAutoAssignHomeroom={handleAutoAssignHomeroomCourses}
                    onUpdateTeacher={handleUpdateTeacher} // Needed for unavailableSlots
                    onNavigateToWorkload={() => setActiveTab('workload')}
                />
            )}

            {activeTab === 'scheduler' && (
                <>
                    <div className="controls-panel card">
                        <div className="status-progress-container">
                            {status === 'running' || progress.score > -99999999 ? (
                                <div className="status-progress">
                                    <div className="progress-info">
                                        <div className="status-header">
                                            <span className={`status-badge ${status}`}>
                                                {status === 'running' ? '🚀 排課進行中' : status === 'stopped' ? '⏹ 已停止' : status === 'saving' ? '💾 儲存中' : '✅ 閒置'}
                                            </span>
                                            <span className="generation-info">第 {progress.generation} 代演化</span>
                                        </div>
                                    </div>

                                    <div className="score-visualization">
                                        <div className="progress-bar-container">
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${Math.max(0, Math.min(100, Math.max(0, progress.score) / 10000))}%` }}
                                            ></div>
                                        </div>
                                        <div className="score-details">
                                            <span className="score-percent">
                                                {progress.score > 0 ? (progress.score / 10000).toFixed(1) : '0.0'}%
                                            </span>
                                            <span className="score-desc">
                                                {progress.score >= 1000000 ? '🎉 完美無衝突' :
                                                    progress.score > 990000 ? '✨ 極佳 (微小優化中)' :
                                                        progress.score > 900000 ? '👌 良好 (無重大衝突)' :
                                                            progress.score > 0 ? '🚧 解決衝突中...' : '💥 嚴重衝突處理中'}
                                            </span>
                                        </div>
                                        <small className="raw-score-hint">
                                            演算法原始分數: {Math.floor(progress.score)}
                                        </small>
                                    </div>
                                </div>
                            ) : (
                                <div className="status-bar">
                                    <span>狀態: <strong className={`status-${status}`}>{status === 'idle' ? '閒置' : status.toUpperCase()}</strong></span>
                                </div>
                            )}
                        </div>

                        <div className="action-buttons">
                            {status === 'idle' || status === 'stopped' ? (
                                <>
                                    <button
                                        className="btn btn-outline"
                                        onClick={handleRunDiagnostics}
                                        title="檢查排課資料的健康度"
                                        style={{ marginRight: '8px' }}
                                    >
                                        🩺 排課前診斷
                                    </button>
                                    <button className="btn btn-primary" onClick={handleStart} disabled={status === 'loading'}>
                                        ▶ 開始演算
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => setShowSnapshotManager(true)}
                                        style={{ marginLeft: '8px', borderColor: '#3949ab', color: '#3949ab' }}
                                    >
                                        📸 快照管理
                                    </button>
                                    {bestSolution.length > 0 && (
                                        <>
                                            <button className="btn btn-primary" onClick={handleSave} style={{ background: '#10b981' }}>
                                                💾 儲存課表
                                            </button>
                                            <button className="btn btn-secondary" onClick={() => handleBatchPrint('class')}>
                                                🖨️ 列印全班
                                            </button>
                                            <button className="btn btn-secondary" onClick={() => handleBatchPrint('teacher')}>
                                                🖨️ 列印全師
                                            </button>
                                        </>
                                    )}
                                </>
                            ) : (
                                <button className="btn btn-danger" onClick={handleStop}>
                                    ⏹ 停止
                                </button>
                            )}
                        </div>

                        <div className="info-text">
                            已載入 {classes.length} 個班級, {requirements.length} 條排課需求。
                        </div>
                    </div>

                    <div className="preview-section">
                        <div className="preview-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <h3>{diffMode ? `🔍 比對模式: vs ${comparisonName}` : '即時預覽 (可拖拉調整)'}</h3>
                                {diffMode && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={handleExitDiffMode}
                                        style={{ background: '#6366f1', color: 'white', border: 'none' }}
                                    >
                                        退出比對
                                    </button>
                                )}
                                <button
                                    className="btn btn-outline btn-sm"
                                    onClick={handleCopyShareLink}
                                    title="複製公開分享連結"
                                    style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                                >
                                    🔗 分享
                                </button>
                                {viewClassId && !diffMode && (
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setShowQRCode(true)}
                                        style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                                    >
                                        📱 行動查詢 QR Code
                                    </button>
                                )}
                            </div>
                            <div className="preview-selector">
                                <select
                                    value={viewClassId}
                                    onChange={(e) => setViewClassId(e.target.value)}
                                    className="main-select"
                                >
                                    {classes.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="schedule-view">
                            {bestSolution.length > 0 ? (
                                <>
                                    {conflictDetails.length > 0 && (
                                        <ConflictResolver
                                            conflictDetails={conflictDetails}
                                            bestSolution={bestSolution}
                                            classes={classes}
                                            teachers={teachers}
                                            courses={courses}
                                            classrooms={classrooms}
                                            onResolveConflict={handleResolveConflict}
                                        />
                                    )}
                                    <ScheduleGrid
                                        schedule={classScheduleDisplay}
                                        type="class"
                                        editable={!diffMode}
                                        onMove={handleMoveCourse}
                                        grade={classes.find(c => c.id === viewClassId)?.grade}
                                        conflicts={globalConflicts[viewClassId]}
                                        onDragStart={setDraggingIndex}
                                        onDragEnd={() => setDraggingIndex(null)}
                                        safeSlots={safeSlots}
                                        onCellClick={handleEmptyCellClick}
                                        // Filter Diff Map for current class (Keys: classId_index -> index)
                                        diffMap={diffMode && diffMap ? new Map(
                                            Array.from(diffMap.entries())
                                                .filter(([k]) => k.startsWith(`${viewClassId}_`))
                                                .map(([k, v]) => [parseInt(k.split('_')[1]), v])
                                        ) : null}
                                    />
                                </>
                            ) : (
                                <div className="empty-state">尚未開始排課，請點擊開始。</div>
                            )}
                        </div>
                    </div>

                    {/* Diagnostics Modal */}
                    {showDiagnostics && (
                        <div className="modal-overlay" onClick={() => setShowDiagnostics(false)}>
                            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
                                <h3>🩺 系統診斷報告</h3>
                                {diagnosticResults.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: '#10b981' }}>
                                        <div style={{ fontSize: '3rem' }}>✅</div>
                                        <p>太棒了！沒有發現明顯的設定問題。</p>
                                        <p>您可以安心開始排課。</p>
                                    </div>
                                ) : (
                                    <div className="diagnostics-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                        <p style={{ marginBottom: '1rem', color: '#666' }}>
                                            發現 {diagnosticResults.length} 個潛在問題，建議修正後再開始排課以提高成功率。
                                        </p>
                                        {diagnosticResults.map((item, idx) => (
                                            <div key={idx} style={{
                                                marginBottom: '12px',
                                                padding: '12px',
                                                borderRadius: '6px',
                                                borderLeft: `4px solid ${item.type === 'error' ? '#ef4444' : '#f59e0b'}`,
                                                backgroundColor: '#f9fafb'
                                            }}>
                                                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {item.type === 'error' ? '❌' : '⚠️'} {item.title}
                                                </div>
                                                <div style={{ fontSize: '0.9rem', margin: '4px 0', color: '#374151' }}>
                                                    {item.message}
                                                </div>
                                                {/* Details List */}
                                                {item.details && item.details.length > 0 && (
                                                    <div style={{ margin: '8px 0', fontSize: '0.85rem', color: '#555', maxHeight: '100px', overflowY: 'auto', border: '1px solid #eee', padding: '4px', borderRadius: '4px' }}>
                                                        {item.details.map((detail, dIdx) => (
                                                            <div key={dIdx} style={{ padding: '2px 0' }}>• {detail}</div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                                                    {item.suggestion && (
                                                        <div style={{ fontSize: '0.85rem', color: '#4b5563', padding: '4px 8px', backgroundColor: '#f3f4f6', borderRadius: '4px', flex: 1 }}>
                                                            💡 建議：{item.suggestion}
                                                        </div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    {item.action === 'JUMP_TO_TEACHER' && (
                                                        <button
                                                            className="btn btn-primary btn-sm"
                                                            style={{ marginLeft: '8px', fontSize: '0.8rem' }}
                                                            onClick={() => {
                                                                setActiveTab('workload');
                                                                setSelectedTeacherId(item.payload);
                                                                setShowDiagnostics(false);
                                                            }}
                                                        >
                                                            前往調整
                                                        </button>
                                                    )}
                                                    {item.action === 'FIX_INVALID_DATA' && (
                                                        <button
                                                            className="btn btn-danger btn-sm"
                                                            style={{ marginLeft: '8px', fontSize: '0.8rem' }}
                                                            onClick={() => {
                                                                if (confirm('確定要清除這些無效的配課資料嗎？')) {
                                                                    const validReqs = requirements.filter(r => r.teacherId && r.courseId && r.classId);
                                                                    setRequirements(validReqs);
                                                                    setDiagnosticResults(prev => prev.filter(r => r.type !== 'error' || r.title !== item.title));
                                                                    alert(`已清除 ${requirements.length - validReqs.length} 筆無效資料。`);
                                                                }
                                                            }}
                                                        >
                                                            一鍵清除
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                                    <button className="btn btn-primary" onClick={() => setShowDiagnostics(false)}>知道了</button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}


            {activeTab === 'export' && (
                <div style={{ padding: '0 20px 20px' }}>
                    {bestSolution.length === 0 ? (
                        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
                            <h3>尚未產生排課結果</h3>
                            <p>請先進行「自動排課」，產生最佳課表後即可使用匯出功能。</p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('scheduler')}>
                                前往排課
                            </button>
                        </div>
                    ) : (
                        <ExportPanel
                            classes={classes}
                            teachers={teachers}
                            courses={courses}
                            bestSolution={bestSolution}
                            classrooms={classrooms} // Ensure this prop is passed
                        />
                    )}
                </div>
            )}

            {/* Smart Fill Modal */}
            {smartFillModal.show && (
                <div className="modal-overlay" onClick={() => setSmartFillModal({ ...smartFillModal, show: false })}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <h3>✨ 智慧填補 (週{['一', '二', '三', '四', '五'][Math.floor(smartFillModal.slotIndex / 7)]} 第{(smartFillModal.slotIndex % 7) + 1}節)</h3>
                        <p style={{ color: '#666', marginBottom: '1rem' }}>請選擇要排入的課程：</p>

                        <div className="candidates-list" style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                            {smartFillModal.candidates.filter(c => c.state !== 'busy' && c.state !== 'full').length === 0 && (
                                <div style={{ padding: '0.5rem', textAlign: 'center', color: '#888', fontSize: '0.9rem' }}>
                                    (目前沒有可排的候選人，以下顯示已排完或忙碌的項目)
                                </div>
                            )}

                            {smartFillModal.candidates.map((c, idx) => {
                                const isBusy = c.state === 'busy';
                                const isRestricted = c.state === 'restricted';
                                const isAvoid = c.state === 'avoid';
                                const isFull = c.state === 'full';

                                const isDisabled = isBusy; // Only busy is truly disabled now

                                const handleItemClick = () => {
                                    if (isFull) {
                                        // Jump to teacher settings
                                        setSmartFillModal({ ...smartFillModal, show: false });
                                        setActiveTab('workload');
                                        setSelectedTeacherId(c.teacherId);
                                    } else if (!isBusy) {
                                        // Select for scheduling
                                        handleSmartFillSelect(c);
                                    }
                                };

                                return (
                                    <button
                                        key={idx}
                                        className={`candidate-item ${isDisabled ? 'disabled' : ''}`}
                                        disabled={isDisabled}
                                        onClick={handleItemClick}
                                        title={isFull ? "點擊前往調整該老師配課設定" : ""}
                                        style={{
                                            width: '100%',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px',
                                            marginBottom: '8px',
                                            border: '1px solid #ddd',
                                            borderRadius: '8px',
                                            backgroundColor: isFull ? '#eff6ff' : isBusy ? '#f3f4f6' : isRestricted ? '#fee2e2' : isAvoid ? '#fef3c7' : 'white',
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                            textAlign: 'left',
                                            opacity: 1 // Full items are now actionable, so full opacity
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: isFull ? '#2563eb' : 'inherit' }}>
                                                {c.courseName}
                                                {isFull && <span style={{ fontSize: '0.8rem', marginLeft: '6px', color: '#60a5fa', fontWeight: 'normal' }}>↗ 前往調整</span>}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: '#555' }}>
                                                {c.teacherName} {c.reason && <span style={{ color: isRestricted ? '#ef4444' : '#d97706', fontSize: '0.8rem' }}>({c.reason})</span>}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.8rem', color: '#666' }}>剩餘</div>
                                            <div style={{ fontWeight: 'bold', color: isFull ? '#9ca3af' : '#2563eb' }}>{c.remaining} 節</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                            <button className="btn btn-secondary" onClick={() => setSmartFillModal({ ...smartFillModal, show: false })}>
                                取消
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QR Code Modal */}
            {showQRCode && (
                <div className="modal-overlay" onClick={() => setShowQRCode(false)}>
                    <div className="modal-content qr-modal" onClick={e => e.stopPropagation()}>
                        <h3>手機掃描查詢課表</h3>
                        <div className="qr-container" style={{ margin: '1.5rem 0', textAlign: 'center' }}>
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + '/public/class/' + viewClassId)}`}
                                alt="QR Code"
                                style={{ border: '4px solid white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                            />
                        </div>
                        <p style={{ fontSize: '0.9rem', color: '#666' }}>
                            將此 QR Code 列印或分享，老師即可隨時查看最新課表。<br />
                            <a href={`/public/class/${viewClassId}`} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>點此直接開啟連結</a>
                        </p>
                        <button className="btn btn-secondary" onClick={() => setShowQRCode(false)} style={{ marginTop: '1rem' }}>
                            關閉
                        </button>
                    </div>
                </div>
            )}
            {/* Batch Print Area (Hidden in browser, visible in print) */}
            {isBatchPrinting && (
                <div
                    className={`print-area print-page-${printSettings.paperSize.toLowerCase()} print-layout-${printSettings.layout}`}
                    style={{ '--print-font-size': `${printSettings.fontSize}px` }}
                >
                    {printType === 'class' ? (
                        classes.map(c => (
                            <div key={c.id} className="print-page-break">
                                <h1 className="print-report-title">{formatPrintTitle(printSettings.titleTemplate, c)}</h1>
                                <ScheduleGrid
                                    schedule={getFullGridForClass(c.id).map(p => ({
                                        ...p,
                                        topLine: printSettings.showCourseName ? p?.topLine : '',
                                        bottomLine: printSettings.showTeacherName ? p?.bottomLine : ''
                                    }))}
                                    type="class"
                                    editable={false}
                                />
                            </div>
                        ))
                    ) : (
                        teachers.filter(t => t.id !== 'none').map(t => (
                            <div key={t.id} className="print-page-break">
                                <h1 className="print-report-title">{formatPrintTitle(printSettings.titleTemplate, t)}</h1>
                                <ScheduleGrid
                                    schedule={getFullGridForTeacher(t.id).map(p => ({
                                        ...p,
                                        topLine: printSettings.showCourseName ? p?.topLine : '',
                                        bottomLine: printSettings.showClassName ? p?.bottomLine : ''
                                    }))}
                                    type="teacher"
                                    editable={false}
                                />
                            </div>
                        ))
                    )}
                </div>
            )}

            <PrintSettingsModal
                show={showPrintModal}
                type={printType}
                initialSettings={printSettings}
                onClose={() => setShowPrintModal(false)}
                onConfirm={executePrint}
            />

            {/* Snapshot Manager Modal */}
            {showSnapshotManager && (
                <SnapshotManager
                    currentRequirements={requirements}
                    currentSchedules={bestSolution.length > 0 ? classes.map(cls => {
                        const classGenes = bestSolution.filter(g => g.classId === cls.id);
                        // Ensure each slot is a unique object reference and contains no undefined
                        const periods = Array.from({ length: 35 }, () => ({ courseId: null, teacherId: null }));
                        classGenes.forEach(g => {
                            if (g.periodIndex >= 0 && g.periodIndex < 35) {
                                periods[g.periodIndex] = {
                                    courseId: g.courseId || null,
                                    teacherId: g.teacherId || null
                                };
                            }
                        });
                        return { classId: cls.id, periods };
                    }) : null}
                    onRestore={(snapshot) => {
                        // Restore requirements
                        if (snapshot.requirements) {
                            setRequirements(snapshot.requirements);
                        }
                        // Restore schedules (set as best solution for preview/save)
                        if (snapshot.schedules) {
                            const genes = [];
                            snapshot.schedules.forEach(sch => {
                                sch.periods.forEach((p, idx) => {
                                    if (p.courseId) {
                                        genes.push({
                                            classId: sch.classId,
                                            periodIndex: idx,
                                            courseId: p.courseId,
                                            teacherId: p.teacherId
                                        });
                                    }
                                });
                            });
                            setBestSolution(genes);
                            setProgress({ generation: 0, score: 1000000 }); // High score for restored snapshot
                            alert(`已載入快照「${snapshot.name}」，您可以預覽並點擊「儲存課表」正式套用。`);
                        }
                    }}
                    onCompare={handleCompareSnapshot}
                    onClose={() => setShowSnapshotManager(false)}
                />
            )}
        </div>
    );
}

export default AutoSchedule;
