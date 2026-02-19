import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { getDayIndex, getTimeSlotIndex, PERIODS_PER_DAY } from '../algorithms/types.js';

const DAY_NAMES = ['星期一', '星期二', '星期三', '星期四', '星期五'];
const PERIOD_LABELS = ['第一節', '第二節', '第三節', '第四節', '第五節', '第六節', '第七節'];
const TIME_RANGES = ['08:40-09:20', '09:30-10:10', '10:30-11:10', '11:20-12:00', '13:20-14:00', '14:10-14:50', '15:00-15:40'];

const renderName = (val) => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') return val.name || Object.values(val)[0] || '';
    return String(val);
};

// ═══════════════════════════════════════════════
//  EXPORT: 排課結果 → Excel
// ═══════════════════════════════════════════════

/**
 * Export schedules to Excel workbook with multiple sheets.
 * @param {'class' | 'teacher'} mode
 */
export async function exportScheduleToExcel({
    mode = 'class',
    bestSolution,
    classes,
    teachers,
    courses,
    classrooms,
    semesterLabel = ''
}) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SMES 智慧排課系統';
    workbook.created = new Date();

    const items = mode === 'class' ? classes : teachers.filter(t => t.id !== '0' && t.id !== '1');
    const title = mode === 'class' ? '班級課表' : '教師課表';

    for (const item of items) {
        const sheetName = renderName(item.name).substring(0, 31); // Excel max 31 chars
        const ws = workbook.addWorksheet(sheetName);

        // Build schedule grid
        const schedule = Array(35).fill(null);
        bestSolution.forEach(gene => {
            const match = mode === 'class'
                ? gene.classId === item.id
                : gene.teacherId === item.id;
            if (match && gene.periodIndex >= 0 && gene.periodIndex < 35) {
                const course = courses.find(c => c.id === gene.courseId);
                const teacher = teachers.find(t => t.id === gene.teacherId);
                const cls = classes.find(c => c.id === gene.classId);

                if (mode === 'class') {
                    schedule[gene.periodIndex] = {
                        subject: course ? renderName(course.name) : '',
                        detail: teacher ? renderName(teacher.name) : ''
                    };
                } else {
                    schedule[gene.periodIndex] = {
                        subject: cls ? renderName(cls.name) : '',
                        detail: course ? renderName(course.name) : ''
                    };
                }
            }
        });

        // === Styling ===
        _applySheetLayout(ws, sheetName, schedule, mode, semesterLabel);
    }

    // Also add a summary sheet
    _addSummarySheet(workbook, mode, items, bestSolution, classes, teachers, courses);

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const fileName = `${semesterLabel || 'SMES'}${title}_${new Date().toLocaleDateString('zh-TW').replace(/\//g, '')}.xlsx`;
    saveAs(blob, fileName);
    return fileName;
}

function _applySheetLayout(ws, sheetName, schedule, mode, semesterLabel) {
    // Column widths
    ws.columns = [
        { width: 10 }, // Period label
        { width: 16 }, // Mon
        { width: 16 }, // Tue
        { width: 16 }, // Wed
        { width: 16 }, // Thu
        { width: 16 }, // Fri
    ];

    // Title row
    ws.mergeCells('A1:F1');
    const titleCell = ws.getCell('A1');
    titleCell.value = `${semesterLabel ? semesterLabel + ' ' : ''}${sheetName} — ${mode === 'class' ? '班級課表' : '教師課表'}`;
    titleCell.font = { name: '微軟正黑體', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } };
    titleCell.font = { name: '微軟正黑體', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).height = 36;

    // Header row (Day names)
    const headerRow = ws.getRow(2);
    headerRow.values = ['節次', ...DAY_NAMES];
    headerRow.height = 24;
    headerRow.eachCell((cell) => {
        cell.font = { name: '微軟正黑體', size: 11, bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
        cell.border = _thinBorder();
    });

    // Data rows (7 periods)
    for (let period = 0; period < 7; period++) {
        const row = ws.getRow(period + 3);
        row.height = 40;

        // Period label
        const periodCell = row.getCell(1);
        periodCell.value = `${PERIOD_LABELS[period]}\n${TIME_RANGES[period]}`;
        periodCell.font = { name: '微軟正黑體', size: 9 };
        periodCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        periodCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } };
        periodCell.border = _thinBorder();

        // Day cells
        for (let day = 0; day < 5; day++) {
            const slotIndex = day * PERIODS_PER_DAY + period;
            const cell = row.getCell(day + 2);
            const data = schedule[slotIndex];

            if (data && data.subject) {
                cell.value = {
                    richText: [
                        { text: data.subject + '\n', font: { name: '微軟正黑體', size: 11, bold: true } },
                        { text: data.detail, font: { name: '微軟正黑體', size: 9, color: { argb: 'FF666666' } } }
                    ]
                };
            } else {
                cell.value = '';
            }

            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = _thinBorder();

            // Alternate row color
            if (period % 2 === 0) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAFAFA' } };
            }
        }
    }
}

function _addSummarySheet(workbook, mode, items, bestSolution, classes, teachers, courses) {
    const ws = workbook.addWorksheet('📊 總覽');
    ws.columns = [
        { header: mode === 'class' ? '班級' : '教師', key: 'name', width: 16 },
        { header: '總節數', key: 'total', width: 10 },
        { header: '週一', key: 'd0', width: 8 },
        { header: '週二', key: 'd1', width: 8 },
        { header: '週三', key: 'd2', width: 8 },
        { header: '週四', key: 'd3', width: 8 },
        { header: '週五', key: 'd4', width: 8 },
    ];

    // Style header
    ws.getRow(1).font = { name: '微軟正黑體', size: 11, bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };

    items.forEach(item => {
        const genes = bestSolution.filter(g =>
            mode === 'class' ? g.classId === item.id : g.teacherId === item.id
        );
        const dayCount = [0, 0, 0, 0, 0];
        genes.forEach(g => { dayCount[getDayIndex(g.periodIndex)]++; });

        ws.addRow({
            name: renderName(item.name),
            total: genes.length,
            d0: dayCount[0],
            d1: dayCount[1],
            d2: dayCount[2],
            d3: dayCount[3],
            d4: dayCount[4]
        });
    });

    // Style all rows
    ws.eachRow((row, i) => {
        row.eachCell(cell => {
            cell.border = _thinBorder();
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
    });
}

function _thinBorder() {
    return {
        top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
        right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
    };
}

// ═══════════════════════════════════════════════
//  IMPORT: Excel 配課表 → requirements
// ═══════════════════════════════════════════════

/**
 * Parse an Excel file into requirements array.
 * Expected columns: 班級, 科目, 教師, 節數 (or similar variants)
 * @param {File} file 
 * @param {Array} classes - existing classes for matching
 * @param {Array} courses - existing courses for matching
 * @param {Array} teachers - existing teachers for matching
 * @returns {Promise<{ requirements: Array, warnings: string[], stats: Object }>}
 */
export async function importRequirementsFromExcel(file, classes, courses, teachers) {
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const requirements = [];
    const warnings = [];
    let totalRows = 0;
    let matchedRows = 0;

    // Try each sheet
    workbook.eachSheet((worksheet) => {
        // Find header row by scanning first 5 rows
        let headerRow = null;
        let colMap = {};

        for (let rowNum = 1; rowNum <= Math.min(5, worksheet.rowCount); rowNum++) {
            const row = worksheet.getRow(rowNum);
            const values = [];
            row.eachCell((cell, colNum) => {
                values.push({ col: colNum, val: _cellToString(cell) });
            });

            // Try to identify header columns
            const detected = _detectColumns(values);
            if (detected) {
                headerRow = rowNum;
                colMap = detected;
                break;
            }
        }

        if (!headerRow) {
            warnings.push(`工作表「${worksheet.name}」：找不到表頭（需包含班級、科目、教師、節數欄位）`);
            return;
        }

        // Parse data rows
        for (let rowNum = headerRow + 1; rowNum <= worksheet.rowCount; rowNum++) {
            const row = worksheet.getRow(rowNum);
            const className = _cellToString(row.getCell(colMap.class));
            const courseName = _cellToString(row.getCell(colMap.course));
            const teacherName = _cellToString(row.getCell(colMap.teacher));
            const periods = parseInt(_cellToString(row.getCell(colMap.periods))) || 0;

            if (!className || !courseName || periods <= 0) continue;
            totalRows++;

            // Match to existing entities
            const matchedClass = _fuzzyMatch(className, classes);
            const matchedCourse = _fuzzyMatch(courseName, courses);
            const matchedTeacher = teacherName ? _fuzzyMatch(teacherName, teachers) : null;

            if (!matchedClass) {
                warnings.push(`第 ${rowNum} 列：找不到班級「${className}」`);
                continue;
            }
            if (!matchedCourse) {
                warnings.push(`第 ${rowNum} 列：找不到科目「${courseName}」`);
                continue;
            }
            if (teacherName && !matchedTeacher) {
                warnings.push(`第 ${rowNum} 列：找不到教師「${teacherName}」，已跳過教師指定`);
            }

            requirements.push({
                classId: matchedClass.id,
                courseId: matchedCourse.id,
                teacherId: matchedTeacher?.id || null,
                periodsNeeded: periods,
                className: renderName(matchedClass.name),
                courseName: renderName(matchedCourse.name),
                teacherName: matchedTeacher ? renderName(matchedTeacher.name) : '未指定'
            });
            matchedRows++;
        }
    });

    return {
        requirements,
        warnings,
        stats: {
            totalRows,
            matchedRows,
            failedRows: totalRows - matchedRows,
            sheetsScanned: workbook.worksheets.length
        }
    };
}

function _cellToString(cell) {
    if (!cell || !cell.value) return '';
    const v = cell.value;
    if (typeof v === 'string') return v.trim();
    if (typeof v === 'number') return String(v);
    if (v.richText) return v.richText.map(r => r.text).join('').trim();
    if (v.result) return String(v.result).trim();
    return String(v).trim();
}

function _detectColumns(values) {
    const map = {};
    for (const { col, val } of values) {
        const lower = val.toLowerCase();
        if (lower.includes('班') || lower.includes('class')) map.class = col;
        else if (lower.includes('科') || lower.includes('課') || lower.includes('subject') || lower.includes('course')) map.course = col;
        else if (lower.includes('師') || lower.includes('teacher')) map.teacher = col;
        else if (lower.includes('節') || lower.includes('時') || lower.includes('period') || lower.includes('hour')) map.periods = col;
    }
    // Must have at least class, course, periods
    if (map.class && map.course && map.periods) return map;
    return null;
}

function _fuzzyMatch(name, list) {
    if (!list || !name) return null;
    const trimmed = name.trim();
    // Exact match first
    let match = list.find(item => renderName(item.name) === trimmed);
    if (match) return match;
    // Partial match
    match = list.find(item => renderName(item.name).includes(trimmed) || trimmed.includes(renderName(item.name)));
    return match || null;
}
