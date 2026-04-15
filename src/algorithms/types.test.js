import { describe, it, expect } from 'vitest';
import {
    PERIODS_PER_DAY,
    DAYS_PER_WEEK,
    TOTAL_PERIODS,
    getDayIndex,
    getTimeSlotIndex,
    isSlotAllowed,
} from './types.js';

describe('types constants', () => {
    it('defines 7 periods per day, 5 days per week, 35 total', () => {
        expect(PERIODS_PER_DAY).toBe(7);
        expect(DAYS_PER_WEEK).toBe(5);
        expect(TOTAL_PERIODS).toBe(35);
    });
});

describe('getDayIndex', () => {
    it.each([
        [0, 0], [6, 0],   // 週一
        [7, 1], [13, 1],  // 週二
        [14, 2], [20, 2], // 週三
        [21, 3], [27, 3], // 週四
        [28, 4], [34, 4], // 週五
    ])('periodIndex %i → day %i', (periodIndex, expected) => {
        expect(getDayIndex(periodIndex)).toBe(expected);
    });
});

describe('getTimeSlotIndex', () => {
    it.each([
        [0, 0], [6, 6],  // 週一
        [7, 0], [13, 6], // 週二
        [34, 6],          // 週五最後一節
    ])('periodIndex %i → slot %i', (periodIndex, expected) => {
        expect(getTimeSlotIndex(periodIndex)).toBe(expected);
    });
});

describe('isSlotAllowed — 分年級的可排時段規則', () => {
    describe('全校共通:週三下午禁排', () => {
        it.each([1, 2, 3, 4, 5, 6])('grade %i 週三第5-7節禁排', (grade) => {
            // 週三 = dayIndex 2 → slots 14~20,下午 = 18, 19, 20
            expect(isSlotAllowed(grade, 18)).toBe(false);
            expect(isSlotAllowed(grade, 19)).toBe(false);
            expect(isSlotAllowed(grade, 20)).toBe(false);
        });
    });

    describe('一、二年級:週一/三/四/五下午禁排,週二全天', () => {
        it('週一下午(slot 4-6)禁排', () => {
            expect(isSlotAllowed(1, 4)).toBe(false);
            expect(isSlotAllowed(2, 6)).toBe(false);
        });

        it('週二全天可排', () => {
            // 週二 = dayIndex 1 → slots 7~13
            for (let s = 7; s <= 13; s++) {
                expect(isSlotAllowed(1, s)).toBe(true);
                expect(isSlotAllowed(2, s)).toBe(true);
            }
        });

        it('週四/週五下午禁排', () => {
            expect(isSlotAllowed(1, 25)).toBe(false); // 週四下午
            expect(isSlotAllowed(2, 32)).toBe(false); // 週五下午
        });
    });

    describe('三、四年級:週五下午禁排', () => {
        it('週五下午禁排', () => {
            expect(isSlotAllowed(3, 32)).toBe(false);
            expect(isSlotAllowed(4, 33)).toBe(false);
            expect(isSlotAllowed(4, 34)).toBe(false);
        });

        it('週一下午可排', () => {
            expect(isSlotAllowed(3, 5)).toBe(true);
            expect(isSlotAllowed(4, 6)).toBe(true);
        });
    });

    describe('五、六年級:僅週三下午禁排(其餘全日)', () => {
        it('週一至週二下午可排', () => {
            expect(isSlotAllowed(5, 5)).toBe(true);
            expect(isSlotAllowed(6, 12)).toBe(true);
        });

        it('週四/週五下午可排', () => {
            expect(isSlotAllowed(5, 25)).toBe(true);
            expect(isSlotAllowed(6, 32)).toBe(true);
        });
    });

    describe('上午皆可排', () => {
        it.each([1, 2, 3, 4, 5, 6])('grade %i 週一上午 slot 0-3 皆可排', (grade) => {
            for (let s = 0; s <= 3; s++) {
                expect(isSlotAllowed(grade, s)).toBe(true);
            }
        });
    });
});
