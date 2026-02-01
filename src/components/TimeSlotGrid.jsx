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

    const getCellColor = (status) => {
        switch (status) {
            case SLOT_STATUS.UNAVAILABLE: return '#fca5a5'; // Red-300
            case SLOT_STATUS.AVOID: return '#fde047';       // Yellow-300
            default: return '#86efac';                      // Green-300
        }
    };

    const periodLabels = ["一", "二", "三", "四", "午", "五", "六", "七"]; // Using generic labels or maps
    const dayLabels = ["週一", "週二", "週三", "週四", "週五"];

    return (
        <div className="time-slot-grid-container" style={{ userSelect: 'none' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 12, height: 12, backgroundColor: '#86efac', border: '1px solid #ccc' }}></div>
                    <span>可排</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 12, height: 12, backgroundColor: '#fde047', border: '1px solid #ccc' }}></div>
                    <span>盡量不排</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: 12, height: 12, backgroundColor: '#fca5a5', border: '1px solid #ccc' }}></div>
                    <span>不排</span>
                </div>
            </div>

            <table className="time-slot-grid" style={{ borderCollapse: 'collapse', width: '100%', fontSize: '0.9rem' }}>
                <thead>
                    <tr>
                        <th style={{ width: '40px' }}></th>
                        {dayLabels.map((day, d) => (
                            <th
                                key={day}
                                onClick={() => handleColClick(d)}
                                style={{
                                    cursor: readOnly ? 'default' : 'pointer',
                                    padding: '4px',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: '#f3f4f6'
                                }}
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
                                style={{
                                    cursor: readOnly ? 'default' : 'pointer',
                                    padding: '4px',
                                    border: '1px solid #e5e7eb',
                                    backgroundColor: '#f3f4f6'
                                }}
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
                                        style={{
                                            backgroundColor: getCellColor(status),
                                            border: '1px solid #e5e7eb',
                                            textAlign: 'center',
                                            cursor: readOnly ? 'default' : 'pointer',
                                            height: '30px',
                                            transition: 'background-color 0.2s'
                                        }}
                                    >

                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            {!readOnly && <small style={{ color: '#6b7280', display: 'block', marginTop: '4px' }}>* 點擊格字/標題可循環切換狀態</small>}
        </div>
    );
};

export default TimeSlotGrid;
