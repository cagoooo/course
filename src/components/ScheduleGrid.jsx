import React from 'react';
import './ScheduleGrid.css';
import './ScheduleGrid_Diff.css';
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
    onCellClick,
    canDrag, // New prop: (index) => boolean
    diffMap // New prop: Map<index, { status, old, new }>
}) => {

    if (!schedule) return <div className="loading">查無課表資料</div>;

    const handleDragStart = (e, index) => {
        if (!editable) return;

        // RBAC Check
        if (canDrag && !canDrag(index)) {
            e.preventDefault();
            return;
        }

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
                {editable ? (
                    <div className="empty-hover-hint">
                        <span className="placeholder">+</span>
                        <span className="hint-text">填寫</span>
                    </div>
                ) : '-'}
            </div>
        ) : (
            <div className={`cell-content ${hasConflict ? 'conflict-glow' : ''}`}>
                <div className="cell-main">{renderName(cellData.topLine) || '-'}</div>
                <div className="cell-sub">{renderName(cellData.bottomLine) || ''}</div>
                {hasConflict && <div className="conflict-tag">⚠️ 衝突</div>}

                {/* Hover Action Overlay */}
                {editable && (
                    <div className="cell-action-overlay">
                        <div className="action-icons">
                            {(!canDrag || canDrag(index)) && (
                                <span className="action-btn move" title="拖拽移動">✋ </span>
                            )}
                            {(!canDrag || canDrag(index)) && (
                                <span
                                    className="action-btn remove"
                                    title="移除課程"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (confirm(`確定要移除「${renderName(cellData.topLine)}」嗎？`)) {
                                            onMove && onMove(index, -1);
                                        }
                                    }}
                                >
                                    🗑️
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );

        let tooltip = isEmpty ? "空時段" : `${renderName(cellData.topLine)} (${renderName(cellData.bottomLine)})`;
        if (hasConflict) tooltip = `⚠️ 警告：此時段已有排課或專科教室衝突！\n${tooltip}`;

        if (editable) {
            const isSafe = safeSlots.includes(index);
            const isActiveDragging = safeSlots.length > 0;
            const isDraggable = !isEmpty && (!canDrag || canDrag(index));

            return (
                <div
                    className={`cell-wrapper ${isDraggable ? 'draggable' : 'droppable'} 
                        ${hasConflict ? 'cell-conflict' : ''} 
                        ${isActiveDragging && isSafe ? 'cell-safe' : ''}
                        ${isActiveDragging && !isSafe ? 'cell-unsafe' : ''}`}
                    draggable={isDraggable}
                    onDragStart={(e) => isDraggable && handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    title={tooltip}
                >
                    {content}
                </div>
            );
        }

        // --- Diff View Logic ---
        if (diffMap && diffMap.has(index)) {
            const diff = diffMap.get(index);
            // diff = { status: 'added' | 'removed' | 'modified', old: ..., new: ... }
            let diffClass = '';
            let diffTooltip = '';
            let diffContent = content; // Default to current content

            if (diff.status === 'added') {
                diffClass = 'diff-added'; // Green
                diffTooltip = '新增排課';
                // Content is already what's in 'schedule' (if schedule is Target)
                // If schedule is Base, 'added' wouldn't be in schedule.
                // We assume 'schedule' passed to grid is the TARGET (New Version).
                // So 'added' items ARE in schedule.
            } else if (diff.status === 'removed') {
                diffClass = 'diff-removed'; // Red
                diffTooltip = '移除排課: ' + (renderName(diff.old?.topLine) || '');
                // Removed items are NOT in 'schedule'. We need to render them specially.
                diffContent = (
                    <div className="cell-content diff-content-removed">
                        <div className="cell-main">{renderName(diff.old?.topLine)}</div>
                        <div className="cell-sub">{renderName(diff.old?.bottomLine)}</div>
                        <div className="diff-badge">-</div>
                    </div>
                );
            } else if (diff.status === 'modified') {
                diffClass = 'diff-modified'; // Orange
                diffTooltip = `變更: ${renderName(diff.old?.topLine)} ➝ ${renderName(diff.new?.topLine)}`;
                // Content is 'new' (from schedule).
                // Maybe overlay 'Changed'?
            }

            return (
                <div className={`cell-static ${diffClass}`} title={diffTooltip}>
                    {diffContent}
                    {diff.status === 'modified' && <div className="diff-badge-mod">✎</div>}
                    {diff.status === 'added' && <div className="diff-badge-add">+</div>}
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

                {PERIODS.map((periodName, uiRowIndex) => {
                    const isBreak = getDataPeriodIndex(uiRowIndex) === -1;
                    return (
                        <div key={uiRowIndex} className={`schedule-row ${isBreak ? 'row-break' : ''}`}>
                            <div className="time-cell">
                                {isBreak ? (
                                    <div className="break-label">{periodName}</div>
                                ) : periodName}
                            </div>
                            {DAYS.map((_, dayIdx) => (
                                <div key={`${dayIdx}-${uiRowIndex}`} className="data-cell">
                                    {renderCell(dayIdx, uiRowIndex)}
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>
            <div className="mobile-scroll-hint">↔ 左右滑動查看完整課表</div>
        </div>
    );
};

export default ScheduleGrid;
