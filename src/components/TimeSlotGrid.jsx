import React, { useState, useEffect } from 'react';
import { PERIODS_PER_DAY, DAYS_PER_WEEK, getDayIndex, getTimeSlotIndex } from '../algorithms/types';

// Constants for grid state
const SLOT_STATUS = {
    AVAILABLE: 0, // Green
    AVOID: 1,     // Yellow (Soft constraint)
    UNAVAILABLE: 2 // Red (Hard constraint)
};

const TimeSlotGrid = ({ unavailableSlots = [], avoidSlots = [], onChange, readOnly = false }) => {
    // Local state to manage rapid UI updates before syncing up
    const [slotsState, setSlotsState] = useState({});

    useEffect(() => {
        // Initialize state from props
        const initialState = {};
        for (let i = 0; i < PERIODS_PER_DAY * DAYS_PER_WEEK; i++) {
            if (unavailableSlots.includes(i)) {
                initialState[i] = SLOT_STATUS.UNAVAILABLE;
            } else if (avoidSlots.includes(i)) {
                initialState[i] = SLOT_STATUS.AVOID;
            } else {
                initialState[i] = SLOT_STATUS.AVAILABLE;
            }
        }
        setSlotsState(initialState);
    }, [unavailableSlots, avoidSlots]);

    const handleSlotClick = (periodIndex) => {
        if (readOnly) return;

        const currentState = slotsState[periodIndex] || SLOT_STATUS.AVAILABLE;
        const nextState = (currentState + 1) % 3; // Cycle: 0 -> 1 -> 2 -> 0

        const newState = { ...slotsState, [periodIndex]: nextState };
        setSlotsState(newState);
        notifyChange(newState);
    };

    const handleRowClick = (timeSlotIndex) => {
        if (readOnly) return;
        // Toggle entire row based on the first cell's next state
        const firstPeriod = timeSlotIndex; // Monday's slot for this time
        const currentState = slotsState[firstPeriod] || SLOT_STATUS.AVAILABLE;
        const nextState = (currentState + 1) % 3;

        const newState = { ...slotsState };
        for (let d = 0; d < DAYS_PER_WEEK; d++) {
            const idx = d * PERIODS_PER_DAY + timeSlotIndex;
            newState[idx] = nextState;
        }
        setSlotsState(newState);
        notifyChange(newState);
    };

    const handleColClick = (dayIndex) => {
        if (readOnly) return;
        // Toggle entire column
        const firstPeriod = dayIndex * PERIODS_PER_DAY;
        const currentState = slotsState[firstPeriod] || SLOT_STATUS.AVAILABLE;
        const nextState = (currentState + 1) % 3;

        const newState = { ...slotsState };
        for (let t = 0; t < PERIODS_PER_DAY; t++) {
            const idx = dayIndex * PERIODS_PER_DAY + t;
            newState[idx] = nextState;
        }
        setSlotsState(newState);
        notifyChange(newState);
    };

    const notifyChange = (state) => {
        const newUnavailable = [];
        const newAvoid = [];

        Object.entries(state).forEach(([key, value]) => {
            const idx = parseInt(key);
            if (value === SLOT_STATUS.UNAVAILABLE) {
                newUnavailable.push(idx);
            } else if (value === SLOT_STATUS.AVOID) {
                newAvoid.push(idx);
            }
        });

        onChange(newUnavailable, newAvoid);
    };

    const getCellClass = (status) => {
        switch (status) {
            case SLOT_STATUS.UNAVAILABLE: return 'ts-cell-unavailable';
            case SLOT_STATUS.AVOID: return 'ts-cell-avoid';
            default: return 'ts-cell-available';
        }
    };

    const periodLabels = ["一", "二", "三", "四", "午", "五", "六", "七"];
    const dayLabels = ["週一", "週二", "週三", "週四", "週五"];

    return (
        <div className="time-slot-grid-container">
            <div className="ts-legend">
                <div className="ts-legend-item">
                    <div className="ts-dot ts-available"></div>
                    <span>可排</span>
                </div>
                <div className="ts-legend-item">
                    <div className="ts-dot ts-avoid"></div>
                    <span>盡量不排</span>
                </div>
                <div className="ts-legend-item">
                    <div className="ts-dot ts-unavailable"></div>
                    <span>不排</span>
                </div>
            </div>

            <div className="ts-table-wrapper">
                <table className="time-slot-grid">
                    <thead>
                        <tr>
                            <th className="ts-corner-cell"></th>
                            {dayLabels.map((day, d) => (
                                <th
                                    key={day}
                                    onClick={() => handleColClick(d)}
                                    className={`ts-header-cell ${readOnly ? '' : 'clickable'}`}
                                    title="點擊切換整列狀態"
                                >
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: PERIODS_PER_DAY }).map((_, t) => (
                            <tr key={t}>
                                <th
                                    onClick={() => handleRowClick(t)}
                                    className={`ts-header-cell ${readOnly ? '' : 'clickable'}`}
                                    title="點擊切換整行狀態"
                                >
                                    {t + 1}
                                </th>
                                {Array.from({ length: DAYS_PER_WEEK }).map((_, d) => {
                                    const idx = d * PERIODS_PER_DAY + t;
                                    const status = slotsState[idx] || SLOT_STATUS.AVAILABLE;
                                    return (
                                        <td
                                            key={idx}
                                            onClick={() => handleSlotClick(idx)}
                                            className={`ts-cell ${getCellClass(status)} ${readOnly ? '' : 'clickable'}`}
                                        >

                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {!readOnly && <small className="ts-hint">* 點擊格子/標題可循環切換狀態</small>}
        </div>
    );
};

export default TimeSlotGrid;
