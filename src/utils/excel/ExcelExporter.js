import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Constants
const DAYS = ['週一', '週二', '週三', '週四', '週五'];
const PERIODS = [
    '08:00\n08:40', // Morning Study
    '08:45\n09:25', // 1
    '09:35\n10:15', // 2
    '10:30\n11:10', // 3
    '11:20\n12:00', // 4
    '12:00\n12:40', // Lunch
    '12:40\n13:20', // Nap
    '13:30\n14:10', // 5
    '14:20\n15:00', // 6
    '15:20\n16:00'  // 7
];

const PERIOD_LABELS = ['早自習', '第一節', '第二節', '第三節', '第四節', '午餐', '午休', '第五節', '第六節', '第七節'];

/**
 * Excel Export Utility
 * Handles generation of formatted Excel files for schedules.
 */
export class ExcelExporter {
    constructor() {
        this.workbook = new ExcelJS.Workbook();
        this.workbook.creator = 'SMES Intelligent Scheduler';
        this.workbook.created = new Date();
    }

    /**
     * Export Class Schedules (One sheet per class)
     * @param {Object} scheduleData - The full schedule data (chromosome)
     * @param {Map} courseNameMap - Map of courseId -> courseName
     * @param {Map} teacherNameMap - Map of teacherId -> teacherName
     */
    async exportClassSchedules(chromosome, courseNameMap, teacherNameMap) {
        // Group genes by classId
        const classMap = {};
        chromosome.forEach(gene => {
            if (!classMap[gene.classId]) classMap[gene.classId] = [];
            classMap[gene.classId].push(gene);
        });

        // Create a sheet for each class
        // Sort class IDs naturally (101, 102...)
        const sortedClassIds = Object.keys(classMap).sort();

        for (const classId of sortedClassIds) {
            const sheet = this.workbook.addWorksheet(`${classId}班課表`);
            this._setupScheduleSheet(sheet, `${classId}班 課表`);
            this._fillClassSchedule(sheet, classMap[classId], courseNameMap, teacherNameMap);
        }

        // Generate buffer
        const buffer = await this.workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `全校班級課表_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    /**
     * Export Teacher Schedules (One sheet per teacher)
     */
    async exportTeacherSchedules(chromosome, courseNameMap, teacherNameMap) {
        // Group genes by teacherId
        const teacherMap = {};
        chromosome.forEach(gene => {
            if (!gene.teacherId || gene.teacherId === '0' || gene.teacherId === '1') return;
            if (!teacherMap[gene.teacherId]) teacherMap[gene.teacherId] = [];
            teacherMap[gene.teacherId].push(gene);
        });

        const sortedTeacherIds = Object.keys(teacherMap).sort();

        for (const teacherId of sortedTeacherIds) {
            const teacherName = teacherNameMap.get(teacherId) || teacherId;
            // Sheet name max length is 31, sanitize
            const sheetName = `${teacherName}`.slice(0, 30);
            const sheet = this.workbook.addWorksheet(sheetName);
            this._setupScheduleSheet(sheet, `${teacherName}老師 課表`);
            this._fillTeacherSchedule(sheet, teacherMap[teacherId], courseNameMap);
        }

        const buffer = await this.workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `全校教師課表_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }

    // --- Private Helpers ---

    _setupScheduleSheet(sheet, title) {
        // Set column widths
        sheet.columns = [
            { header: '節次', key: 'period', width: 15 },
            { header: '時間', key: 'time', width: 12 },
            { header: '週一', key: 'mon', width: 18 },
            { header: '週二', key: 'tue', width: 18 },
            { header: '週三', key: 'wed', width: 18 },
            { header: '週四', key: 'thu', width: 18 },
            { header: '週五', key: 'fri', width: 18 },
        ];

        // Merge title row
        sheet.mergeCells('A1:G1');
        const titleCell = sheet.getCell('A1');
        titleCell.value = title;
        titleCell.font = { size: 16, bold: true };
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        sheet.getRow(1).height = 30;

        // Header styling
        const headerRow = sheet.getRow(2);
        headerRow.values = ['節次', '時間', ...DAYS];
        headerRow.font = { bold: true };
        headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFEEEEEE' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });
    }

    _fillClassSchedule(sheet, genes, courseNameMap, teacherNameMap) {
        // Prepare grid 7 days x 10 periods (0-9: morning study to period 7)
        // gene.periodIndex 0-34 corresponds to period 1-7 (5 days * 7 periods)
        // We need to map periodIndex to (day, period)
        // standard periods 1-7 map to rows index 1-4, 7-9 (skipping lunch/nap)

        // Map slot index 0-34 to grid coordinates (day 0-4, period 1-7)
        // Slot 0 = Mon Period 1
        // Slot 1 = Tue Period 1 ...
        // Slot 5 = Mon Period 2 ...

        // Wait, current logic:
        // getDayIndex(i) = i % 5
        // getTimeSlotIndex(i) = Math.floor(i / 5) (0-6)

        // This corresponds to:
        // Period 1: slots 0-4
        // Period 2: slots 5-9
        // ...
        // Period 7: slots 30-34

        // Layout rows:
        // Row 3: Morning Study (Empty for now)
        // Row 4: Period 1 (Slots 0-4)
        // Row 5: Period 2 (Slots 5-9)
        // Row 6: Period 3 (Slots 10-14)
        // Row 7: Period 4 (Slots 15-19)
        // Row 8: Lunch (Merged)
        // Row 9: Nap (Merged)
        // Row 10: Period 5 (Slots 20-24)
        // Row 11: Period 6 (Slots 25-29)
        // Row 12: Period 7 (Slots 30-34)

        const grid = Array(10).fill(null).map(() => Array(5).fill(''));

        genes.forEach(g => {
            const periodIdx = Math.floor(g.periodIndex / 5); // 0-6
            const dayIdx = g.periodIndex % 5; // 0-4

            // Map periodIdx (0-6) to grid row index
            // 0 -> Period 1 (row index 1 in our grid array)
            // ...
            // 6 -> Period 7 (row index 9 in our grid array) 
            // Wait, let's map directly to rows to write

            let gridRow = -1;
            if (periodIdx <= 3) gridRow = 1 + periodIdx; // Periods 1-4
            else gridRow = 7 + (periodIdx - 4); // Periods 5-7

            if (gridRow >= 0 && gridRow < 10) {
                const courseName = courseNameMap.get(g.courseId) || g.courseId;
                const teacherName = teacherNameMap.get(g.teacherId) || '';
                // Optional: add teacher name in parenthesis
                grid[gridRow][dayIdx] = `${courseName}\n(${teacherName})`;
            }
        });

        // Write rows
        for (let i = 0; i < 10; i++) {
            const rowIndex = i + 3; // Excel row index (1-based, starts at 3)
            const row = sheet.getRow(rowIndex);

            // Set Period Label and Time
            row.getCell(1).value = PERIOD_LABELS[i];
            row.getCell(2).value = PERIODS[i];
            row.getCell(2).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

            // Special rows: Lunch, Nap
            if (i === 0) { // Morning study
                // Empty for now or specific logic
            } else if (i === 5 || i === 6) { // Lunch, Nap
                sheet.mergeCells(`C${rowIndex}:G${rowIndex}`);
                row.getCell(3).value = i === 5 ? '午 餐 時 間' : '午 休 時 間';
                row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                // Content rows
                for (let d = 0; d < 5; d++) {
                    const cell = row.getCell(d + 3); // Columns C-G for Mon-Fri
                    cell.value = grid[i][d] || '';
                    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
                }
            }

            // Styling
            row.height = 40;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber <= 7) { // Only columns A-G
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
            });
        }
    }

    _fillTeacherSchedule(sheet, genes, courseNameMap) {
        // Similar structure to class schedule, but shows (Class - Subject)
        const grid = Array(10).fill(null).map(() => Array(5).fill(''));

        genes.forEach(g => {
            const periodIdx = Math.floor(g.periodIndex / 5);
            const dayIdx = g.periodIndex % 5;

            let gridRow = -1;
            if (periodIdx <= 3) gridRow = 1 + periodIdx;
            else gridRow = 7 + (periodIdx - 4);

            if (gridRow >= 0 && gridRow < 10) {
                const courseName = courseNameMap.get(g.courseId) || '';
                const display = `${g.classId}\n${courseName}`;
                grid[gridRow][dayIdx] = display;
            }
        });

        // Write rows (Reuse logic?)
        for (let i = 0; i < 10; i++) {
            const rowIndex = i + 3;
            const row = sheet.getRow(rowIndex);

            row.getCell(1).value = PERIOD_LABELS[i];
            row.getCell(2).value = PERIODS[i];
            row.getCell(2).alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };

            if (i === 5 || i === 6) {
                sheet.mergeCells(`C${rowIndex}:G${rowIndex}`);
                row.getCell(3).value = i === 5 ? '午 餐 時 間' : '午 休 時 間';
                row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
            } else {
                for (let d = 0; d < 5; d++) {
                    const cell = row.getCell(d + 3);
                    cell.value = grid[i][d] || '';
                    cell.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
                }
            }

            row.height = 40;
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                if (colNumber <= 7) {
                    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                }
            });
        }
    }
}
