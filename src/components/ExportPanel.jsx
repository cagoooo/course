import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import ScheduleGrid from './ScheduleGrid';

const ExportPanel = ({ classes, teachers, courses, bestSolution, classrooms, onBatchPrint }) => {
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
                        topLine: course ? renderName(course.name) : '無',
                        bottomLine: teacher ? renderName(teacher.name) : ''
                    };
                } else if (type === 'teacher') {
                    // Teacher View: Show Class + Subject
                    cellData = {
                        topLine: cls ? renderName(cls.name) : '未知班級',
                        bottomLine: course ? renderName(course.name) : ''
                    };
                } else if (type === 'classroom') {
                    // Classroom View: Show Class + Teacher + Subject
                    cellData = {
                        topLine: cls ? renderName(cls.name) : '空堂',
                        bottomLine: `${course ? renderName(course.name) : ''} ${teacher ? renderName(teacher.name) : ''}`
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
        <div style={{ padding: '20px' }}>
            {/* ===== Header ===== */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                marginBottom: '8px',
            }}>
                <div style={{
                    width: '48px', height: '48px', flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    borderRadius: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '24px',
                    boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
                }}>🖨️</div>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#312e81' }}>列印 / 匯出中心</h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#6b7280' }}>自動依類別分頁彙整為單一 PDF 檔案 (A4 格式)</p>
                </div>
            </div>

            {/* ===== Loading Bar ===== */}
            {generating && (
                <div style={{
                    background: 'linear-gradient(90deg, #eff6ff, #dbeafe)',
                    color: '#1d4ed8',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    marginBottom: '20px',
                    border: '1px solid #bfdbfe',
                    display: 'flex', alignItems: 'center', gap: '10px',
                    fontWeight: 600, fontSize: '0.9rem',
                }}>
                    <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    ⏳ {statusText}
                </div>
            )}

            {/* ===== Three Cards Grid ===== */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '18px',
                marginTop: '16px',
            }}>

                {/* ── Card 1: 班級課表 ── */}
                <div style={{
                    background: 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%)',
                    borderRadius: '18px',
                    padding: '20px',
                    border: '1.5px solid rgba(59,130,246,0.25)',
                    boxShadow: '0 4px 20px rgba(59,130,246,0.12)',
                }}>
                    {/* Card Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '2px solid rgba(59,130,246,0.3)', paddingBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #3b82f6, #6366f1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, boxShadow: '0 3px 10px rgba(59,130,246,0.3)' }}>📚</div>
                        <div>
                            <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '0.95rem' }}>班級課表</div>
                            <div style={{ fontSize: '0.72rem', color: '#3b82f6' }}>依年級分頁匯出</div>
                        </div>
                    </div>
                    {/* Full Button */}
                    <button
                        disabled={generating}
                        onClick={() => onBatchPrint ? onBatchPrint('class', null) : alert('請使用批次列印功能')}
                        style={{
                            width: '100%', padding: '10px',
                            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                            marginBottom: '12px',
                            boxShadow: '0 4px 12px rgba(59,130,246,0.35)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(59,130,246,0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(59,130,246,0.35)'; }}
                    >
                        👨‍👩‍👧‍👦 全體班級（分頁彙整）
                    </button>
                    {/* Grade Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {[1, 2, 3, 4, 5, 6].map(g => (
                            <button
                                key={g}
                                disabled={generating}
                                onClick={() => onBatchPrint ? onBatchPrint('class', { type: 'grade', value: g }) : handleExportGrade(g)}
                                style={{
                                    padding: '5px 12px',
                                    background: 'white',
                                    color: '#2563eb',
                                    border: '1.5px solid #93c5fd',
                                    borderRadius: '20px',
                                    fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
                                    transition: 'all 0.15s',
                                    boxShadow: '0 2px 6px rgba(59,130,246,0.1)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#3b82f6'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#2563eb'; e.currentTarget.style.borderColor = '#93c5fd'; }}
                            >
                                📄 {g} 年級
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Card 2: 教師課表 ── */}
                <div style={{
                    background: 'linear-gradient(145deg, #f0fdf4 0%, #dcfce7 100%)',
                    borderRadius: '18px',
                    padding: '20px',
                    border: '1.5px solid rgba(34,197,94,0.25)',
                    boxShadow: '0 4px 20px rgba(34,197,94,0.12)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '2px solid rgba(34,197,94,0.3)', paddingBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #22c55e, #16a34a)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, boxShadow: '0 3px 10px rgba(34,197,94,0.3)' }}>👨‍🏫</div>
                        <div>
                            <div style={{ fontWeight: 700, color: '#166534', fontSize: '0.95rem' }}>教師課表</div>
                            <div style={{ fontSize: '0.72rem', color: '#16a34a' }}>依類別分頁匯出</div>
                        </div>
                    </div>
                    <button
                        disabled={generating}
                        onClick={() => onBatchPrint ? onBatchPrint('teacher', null) : handleExportTeachers('all')}
                        style={{
                            width: '100%', padding: '10px',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                            marginBottom: '12px',
                            boxShadow: '0 4px 12px rgba(34,197,94,0.35)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(34,197,94,0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(34,197,94,0.35)'; }}
                    >
                        👨‍🏫 全體教師（彙整）
                    </button>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {[
                            { label: '📋 導師', value: 'homeroom' },
                            { label: '🧪 科任教師', value: 'subject' },
                            { label: '💼 行政教師', value: 'admin' },
                        ].map(cat => (
                            <button
                                key={cat.value}
                                disabled={generating}
                                onClick={() => onBatchPrint ? onBatchPrint('teacher', { type: 'category', value: cat.value }) : handleExportTeachers(cat.value)}
                                style={{
                                    padding: '5px 12px',
                                    background: 'white', color: '#15803d',
                                    border: '1.5px solid #86efac',
                                    borderRadius: '20px',
                                    fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem',
                                    transition: 'all 0.15s',
                                    boxShadow: '0 2px 6px rgba(34,197,94,0.1)',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#22c55e'; e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#22c55e'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = '#15803d'; e.currentTarget.style.borderColor = '#86efac'; }}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Card 3: 空間課表 ── */}
                <div style={{
                    background: 'linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)',
                    borderRadius: '18px',
                    padding: '20px',
                    border: '1.5px solid rgba(245,158,11,0.25)',
                    boxShadow: '0 4px 20px rgba(245,158,11,0.12)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', borderBottom: '2px solid rgba(245,158,11,0.3)', paddingBottom: '12px' }}>
                        <div style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #f59e0b, #d97706)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0, boxShadow: '0 3px 10px rgba(245,158,11,0.3)' }}>🏫</div>
                        <div>
                            <div style={{ fontWeight: 700, color: '#92400e', fontSize: '0.95rem' }}>空間課表</div>
                            <div style={{ fontSize: '0.72rem', color: '#d97706' }}>專科教室使用情況</div>
                        </div>
                    </div>
                    <button
                        disabled={generating}
                        onClick={() => onBatchPrint ? onBatchPrint('classroom', null) : handleExportClassrooms()}
                        style={{
                            width: '100%', padding: '10px',
                            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                            color: 'white', border: 'none', borderRadius: '10px',
                            fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem',
                            boxShadow: '0 4px 12px rgba(245,158,11,0.35)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(245,158,11,0.4)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(245,158,11,0.35)'; }}
                    >
                        🎹 專科教室（彙整）
                    </button>
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
