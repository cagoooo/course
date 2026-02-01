import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ScheduleGrid from './ScheduleGrid';

const ExportPanel = ({ classes, teachers, courses, bestSolution, classrooms }) => {
    const [generating, setGenerating] = useState(false);
    const [statusText, setStatusText] = useState('');
    const printRef = useRef(null);

    // --- Helper Functions ---
    const renderName = (val) => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        return val.name || Object.values(val)[0] || '';
    };

    const getScheduleForTarget = (targetId, type) => {
        const schedule = Array(35).fill(null);

        bestSolution.forEach(gene => {
            let match = false;
            // Class Match
            if (type === 'class' && gene.classId === targetId) match = true;

            // Teacher Match (Show where this teacher is teaching)
            if (type === 'teacher' && gene.teacherId === targetId) match = true;

            if (match && gene.periodIndex >= 0 && gene.periodIndex < 35) {
                const course = courses.find(c => c.id === gene.courseId);
                const teacher = teachers.find(t => t.id === gene.teacherId);
                const cls = classes.find(c => c.id === gene.classId);
                const classroom = gene.classroomId ? classrooms.find(c => c.id === gene.classroomId) :
                    (teacher && teacher.classroomId ? classrooms.find(c => c.id === teacher.classroomId) : null);

                let cellData = {};
                if (type === 'class') {
                    // Class View: Show Subject + Teacher
                    cellData = {
                        top: course ? renderName(course.name) : '無',
                        bottom: teacher ? renderName(teacher.name) : ''
                    };
                } else if (type === 'teacher') {
                    // Teacher View: Show Class + Subject
                    cellData = {
                        top: cls ? renderName(cls.name) : '未知班級',
                        bottom: course ? renderName(course.name) : ''
                    };
                } else if (type === 'classroom') {
                    // Classroom View: Show Class + Teacher + Subject
                    cellData = {
                        top: cls ? renderName(cls.name) : '空堂',
                        bottom: `${course ? renderName(course.name) : ''} ${teacher ? renderName(teacher.name) : ''}`
                    };
                }

                schedule[gene.periodIndex] = cellData;
            }
        });
        return schedule;
    };

    // --- PDF Generation ---
    const generateBatchPDF = async (items, type, fileName) => {
        setGenerating(true);
        setStatusText('準備中...');
        const doc = new jsPDF('p', 'mm', 'a4');
        let firstPage = true;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            setStatusText(`正在處理: ${renderName(item.name)} (${i + 1}/${items.length})`);

            // 1. Update State to Render Hidden View
            const schedule = getScheduleForTarget(item.id, type);
            // We use a Promise to wait for React to render the new state
            await new Promise(resolve => {
                setPreviewData({ type, data: item, schedule });
                setTimeout(resolve, 100); // Wait for render
            });

            // 2. Capture
            const element = printRef.current;
            if (element) {
                const canvas = await html2canvas(element, {
                    scale: 2,
                    logging: false,
                    backgroundColor: '#ffffff',
                    useCORS: true
                });
                const imgData = canvas.toDataURL('image/png');

                const pdfWidth = doc.internal.pageSize.getWidth();
                const pdfHeight = doc.internal.pageSize.getHeight();
                // Maintain aspect ratio, fit width with margin
                const margin = 10;
                const imgWidth = pdfWidth - (margin * 2);
                const imgHeight = (canvas.height * imgWidth) / canvas.width;

                if (!firstPage) doc.addPage();
                doc.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
                firstPage = false;
            }
        }

        doc.save(`${fileName}.pdf`);
        setGenerating(false);
        setStatusText('');
        setPreviewData(null);
    };

    // --- Actions ---
    const handleExportGrade = (grade) => {
        const targetClasses = classes.filter(c => Number(c.grade) === grade);
        if (targetClasses.length === 0) return alert('該年級無班級資料');
        generateBatchPDF(targetClasses, 'class', `${grade}年級`);
    };

    const handleExportTeachers = (category) => {
        let targetTeachers = teachers;
        let filename = '教師課表';

        if (category === 'homeroom') {
            const homeroomTeacherIds = new Set(classes.map(c => c.teacherId).filter(id => id));
            targetTeachers = teachers.filter(t => homeroomTeacherIds.has(t.id));
            filename = '導師課表';
        } else if (category === 'subject') {
            const homeroomTeacherIds = new Set(classes.map(c => c.teacherId).filter(id => id));
            targetTeachers = teachers.filter(t => !homeroomTeacherIds.has(t.id) && !t.name.includes('主任') && !t.name.includes('校長'));
            filename = '科任教師課表';
        } else if (category === 'admin') {
            targetTeachers = teachers.filter(t => t.name.includes('主任') || t.name.includes('校長') || t.name.includes('組長'));
            filename = '行政教師課表';
        } else {
            filename = '全體教師課表';
        }

        if (targetTeachers.length === 0) return alert('查無此類別教師資料');
        generateBatchPDF(targetTeachers, 'teacher', filename);
    };

    const handleExportClassrooms = () => {
        if (classrooms.length === 0) return alert('無專科教室資料');
        generateBatchPDF(classrooms, 'classroom', '專科教室課表');
    };

    const [previewData, setPreviewData] = useState(null);

    // Get title helper
    const getPrintTitle = (preview) => {
        if (!preview) return '';
        const name = renderName(preview.data.name);
        if (preview.type === 'class') return `${name} 班級課表`;
        if (preview.type === 'teacher') return `${name}老師 課表`;
        if (preview.type === 'classroom') return `${name} 使用課表`;
        return `${name} 課表`;
    };

    return (
        <div className="export-panel" style={{ padding: '20px' }}>
            <h3 style={{ marginTop: 0 }}>🖨️ 列印/匯出中心</h3>
            <p className="text-secondary" style={{ marginBottom: '20px' }}>
                系統將會自動依據類別分頁彙整為單一 PDF 檔案 (A4)。
            </p>

            {generating && (
                <div style={{
                    backgroundColor: '#eff6ff',
                    color: '#1d4ed8',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}>
                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                    <span>⏳ {statusText}</span>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                {/* 班級課表 */}
                <div className="card" style={{ padding: '15px' }}>
                    <h4 style={{ borderBottom: '2px solid #3b82f6', paddingBottom: '8px', marginBottom: '15px', color: '#1e40af' }}>
                        📚 班級課表 (分年級)
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {[1, 2, 3, 4, 5, 6].map(g => (
                            <button
                                key={g}
                                className="btn btn-outline-primary"
                                disabled={generating}
                                onClick={() => handleExportGrade(g)}
                                style={{ minWidth: '80px' }}
                            >
                                📄 {g} 年級
                            </button>
                        ))}
                    </div>
                </div>

                {/* 教師課表 */}
                <div className="card" style={{ padding: '15px' }}>
                    <h4 style={{ borderBottom: '2px solid #10b981', paddingBottom: '8px', marginBottom: '15px', color: '#047857' }}>
                        👨‍🏫 教師課表
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        <button
                            className="btn btn-outline-success"
                            disabled={generating}
                            onClick={() => handleExportTeachers('all')}
                        >
                            👨‍🏫 全體教師 (彙整)
                        </button>
                        <button
                            className="btn btn-outline-success"
                            disabled={generating}
                            onClick={() => handleExportTeachers('homeroom')}
                        >
                            📋 導師
                        </button>
                        <button
                            className="btn btn-outline-success"
                            disabled={generating}
                            onClick={() => handleExportTeachers('subject')}
                        >
                            🧪 科任教師
                        </button>
                        <button
                            className="btn btn-outline-secondary"
                            disabled={generating}
                            onClick={() => handleExportTeachers('admin')}
                        >
                            💼 行政教師
                        </button>
                    </div>
                </div>

                {/* 專科教室 */}
                <div className="card" style={{ padding: '15px' }}>
                    <h4 style={{ borderBottom: '2px solid #f59e0b', paddingBottom: '8px', marginBottom: '15px', color: '#b45309' }}>
                        🏫 空間課表
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        <button
                            className="btn btn-outline-warning"
                            disabled={generating}
                            onClick={handleExportClassrooms}
                        >
                            🎹 專科教室 (彙整)
                        </button>
                    </div>
                </div>
            </div>

            {/* OFF-SCREEN CAPTURE AREA */}
            <div style={{ position: 'fixed', top: -10000, left: -10000, overflow: 'hidden' }}>
                <div ref={printRef} style={{ width: '210mm', minHeight: '297mm', padding: '20mm', backgroundColor: 'white', boxSizing: 'border-box' }}>
                    {previewData && (
                        <div className="print-template" style={{ fontFamily: '"Microsoft JhengHei", "Noto Sans TC", sans-serif', color: '#000' }}>
                            <h1 style={{ textAlign: 'center', fontSize: '28px', marginBottom: '10px', fontWeight: 'bold' }}>
                                {getPrintTitle(previewData)}
                            </h1>
                            <div style={{ marginBottom: '20px', textAlign: 'center', fontSize: '16px', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
                                {previewData.type === 'class' ? `導師：${renderName(previewData.data.homeroomTeacher) || '__________'}` : '113學年度 下學期'}
                            </div>

                            {/* We use a specialized "print-mode" grid or standard one with overrides */}
                            <div className="print-grid-container" style={{ border: '2px solid #000', borderRadius: '4px', overflow: 'hidden' }}>
                                <ScheduleGrid
                                    schedule={previewData.schedule}
                                    type={previewData.type === 'class' ? 'print-class' : 'print-teacher'}
                                    readOnly={true}
                                    showPeriods={true}
                                />
                            </div>

                            <div style={{ marginTop: '20px', textAlign: 'right', fontSize: '12px', color: '#666' }}>
                                產出日期：{new Date().toLocaleDateString()}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ExportPanel;
