import React from 'react';
import './ScheduleGrid.css';
import { PERIODS_PER_DAY, getDayIndex, getTimeSlotIndex, isSlotAllowed } from '../algorithms/types.js';

const PERIODS = [
    '早自習',
    '第一節',
    '第二節',
    '第三節',
    '第四節',
    '午休',
    '第五節',
    '第六節',
    '第七節'
];

const DAYS = ['週一', '週二', '週三', '週四', '週五'];

const renderName = (nameVal) => {
    if (typeof nameVal === 'object' && nameVal !== null) {
        return nameVal.name || Object.values(nameVal)[0] || 'Unknown';
    }
    return nameVal || '';
};

const ScheduleGrid = ({
    schedule,
    type = 'teacher',
    editable = false,
    onMove,
    grade = null,
    conflicts = null,
    onDragStart,
    onDragEnd,
    safeSlots = [],
    onCellClick // New prop for smart fill
}) => {
    // schedule: Array[35] of { classId, courseId, teacherId, name... }
    // conflicts: Set of indices that have teacher conflicts

    if (!schedule) return <div className="loading">查無課表資料</div>;

    const handleDragStart = (e, index) => {
        if (!editable) return;
        e.dataTransfer.setData('text/plain', index);
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.5';
        if (onDragStart) onDragStart(index);
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        if (onDragEnd) onDragEnd();
    };

    const handleDragOver = (e) => {
        if (!editable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetIndex) => {
        if (!editable) return;
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (sourceIndex !== targetIndex && onMove) {
            onMove(sourceIndex, targetIndex);
        }
    };

    const getDataPeriodIndex = (uiRowIndex) => {
        if (uiRowIndex === 0) return -1; // Morning Study
        if (uiRowIndex >= 1 && uiRowIndex <= 4) return uiRowIndex - 1; // Periods 1-4 -> 0-3
        if (uiRowIndex === 5) return -1; // Lunch
        if (uiRowIndex >= 6 && uiRowIndex <= 8) return uiRowIndex - 2; // Periods 5-7 -> 4-6
        return -1;
    };

    const renderCell = (dayIndex, uiRowIndex) => {
        const dataPeriodIndex = getDataPeriodIndex(uiRowIndex);

        if (dataPeriodIndex === -1) return <div className="cell-break"></div>;
        if (grade && !isSlotAllowed(grade, dayIndex * 7 + dataPeriodIndex)) return <div className="cell-break"></div>;
        if (!grade && dayIndex === 2 && dataPeriodIndex >= 4) return <div className="cell-break"></div>;

        const index = dayIndex * 7 + dataPeriodIndex;
        const cellData = schedule[index];
        const isEmpty = !cellData || (!cellData.topLine && !cellData.bottomLine);
        const hasConflict = conflicts && conflicts.has(index);

        const content = isEmpty ? (
            <div className="cell-empty" onClick={() => editable && onCellClick && onCellClick(index)}>
                {editable ? <span className="placeholder">+</span> : '-'}
            </div>
        ) : (
            <div className={`cell-content ${hasConflict ? 'conflict-glow' : ''}`}>
                <div className="cell-main">{renderName(cellData.topLine) || '-'}</div>
                <div className="cell-sub">{renderName(cellData.bottomLine) || ''}</div>
                {hasConflict && <div className="conflict-tag">⚠️ 衝突</div>}
            </div>
        );

        let tooltip = isEmpty ? "空時段" : `${renderName(cellData.topLine)} (${renderName(cellData.bottomLine)})`;
        if (hasConflict) tooltip = `⚠️ 警告：此時段已有排課或專科教室衝突！\n${tooltip}`;

        if (editable) {
            const isSafe = safeSlots.includes(index);
            const isActiveDragging = safeSlots.length > 0;

            return (
                <div
                    className={`cell-wrapper ${!isEmpty ? 'draggable' : 'droppable'} 
                        ${hasConflict ? 'cell-conflict' : ''} 
                        ${isActiveDragging && isSafe ? 'cell-safe' : ''}
                        ${isActiveDragging && !isSafe ? 'cell-unsafe' : ''}`}
                    draggable={!isEmpty}
                    onDragStart={(e) => !isEmpty && handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    title={tooltip}
                >
                    {content}
                </div>
            );
        }

        return <div className={`cell-static ${hasConflict ? 'cell-conflict' : ''}`} title={tooltip}>{content}</div>;
    };

    return (
        <div className="schedule-outer-wrapper">
            <div className="schedule-container">
                <div className="schedule-header">
                    <div className="header-cell time-col">節次</div>
                    {DAYS.map(day => (
                        <div key={day} className="header-cell day-col">{day}</div>
                    ))}
                </div>

                {PERIODS.map((periodName, uiRowIndex) => (
                    <div key={uiRowIndex} className={`schedule-row ${getDataPeriodIndex(uiRowIndex) === -1 ? 'row-break' : ''}`}>
                        <div className="time-cell">{periodName}</div>
                        {DAYS.map((_, dayIdx) => (
                            <div key={`${dayIdx}-${uiRowIndex}`} className="data-cell">
                                {renderCell(dayIdx, uiRowIndex)}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
            <div className="mobile-scroll-hint">↔ 左右滑動查看完整課表</div>
        </div>
    );
};

export default ScheduleGrid;
