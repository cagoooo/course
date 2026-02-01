import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, '../Ys110-1');
const OUTPUT_FILE = path.resolve(__dirname, '../smes_data.json');

// --- Helper Functions ---
function readBig5Lines(filename) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    const buf = fs.readFileSync(filePath);
    const str = iconv.decode(buf, 'big5');
    // Split by CRLF and filter empty
    return str.split(/\r\n|\n/).filter(line => line.trim().length > 0);
}

function readBinaryLines(filename, lineLength = null) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    const buf = fs.readFileSync(filePath);
    const lines = [];

    if (lineLength) {
        // Fixed width reading if CRLF is inconsistent, but here we saw CRLF in ClassTab
        // We'll try split by CRLF first.
        // Actually ClassCur has mixed lengths (20/40), so we might need raw buffer slicing if split fails.
        // But analyze_deep showed CRLF works.
    }

    // For ClassTab (mixed binary/ascii), we treat as string but keep carefully
    // We'll use binary encoding to preserve byte values for mapping
    const content = buf.toString('binary');
    return content.split('\r\n').filter(l => l.length > 0);
}

// --- Main Parsing Logic ---
function parse() {
    console.log('Starting SMES Data Parsing...');

    // 1. Teachers
    // Format: Name per line
    const rawTeachers = readBig5Lines('TeachNam');
    const teachers = rawTeachers.map((name, index) => ({
        id: String(index),
        name: name.trim()
    }));
    console.log(`Loaded ${teachers.length} Teachers.`);

    // 2. Courses
    // Format: Name per line
    const rawCourses = readBig5Lines('CoursNam');
    const courses = rawCourses.map((name, index) => ({
        id: String(index),
        name: name.trim()
    }));
    console.log(`Loaded ${courses.length} Courses.`);

    // 3. Class Structure (ClassNum)
    // Format: " 6 ", " 6 "... lines
    const rawClassNum = readBig5Lines('ClassNum');
    const gradeCounts = rawClassNum
        .map(l => parseInt(l.trim(), 10))
        .filter(n => !isNaN(n));

    console.log('Grade Counts:', gradeCounts);

    // Generate Classes
    // Assume 6 grades.
    const classes = [];
    let classGlobalIndex = 0;

    // We need to map linear index (0..32) to "Grade-Class"
    // Also map Grid Index (0..41) to "Grade-Class"
    const validClassIndices = []; // Maps linear index 0..32 to Grid Index

    const MAX_CLASSES_PER_GRADE = 7; // Derived from 42 lines / 6 grades

    gradeCounts.forEach((count, gradeIdx) => {
        const gradeNum = gradeIdx + 1;
        for (let c = 1; c <= count; c++) {
            const classObj = {
                id: `G${gradeNum}-C${c}`,
                name: `${gradeNum}年${c}班`,
                grade: gradeNum,
                classNum: c,
                gridIndex: (gradeIdx * MAX_CLASSES_PER_GRADE) + (c - 1)
            };
            classes.push(classObj);
            validClassIndices.push(classObj.gridIndex);
        }
    });
    console.log(`Generated ${classes.length} Classes (Expected from counts).`);

    // 4. Schedules (ClassTab)
    // 42 Lines. Valid lines are at validClassIndices.
    const rawClassTabFull = readBinaryLines('ClassTab');
    // Note: readBinaryLines splits by CRLF. 
    // ClassTab likely ends with CRLF, so last empty string might be removed.
    // We expect at least 42 lines.

    // 5. Teacher Map (ClassCur)
    // 33 Pairs (66 lines).
    const rawClassCur = readBinaryLines('ClassCur');
    // Should depend on 'classes' length.

    // Parse Schedule
    const schedules = [];

    classes.forEach((classObj, linearIdx) => {
        // Get Schedule Line
        if (classObj.gridIndex >= rawClassTabFull.length) {
            console.warn(`Missing ClassTab line for ${classObj.id}`);
            return;
        }
        const scheduleLine = rawClassTabFull[classObj.gridIndex];

        // Get Teacher Map Line
        // ClassCur is linear based on Valid Classes?
        // Pair: Header (Line 2*i), Data (Line 2*i + 1)
        const curLineIndex = linearIdx * 2 + 1; // Data line
        if (curLineIndex >= rawClassCur.length) {
            console.warn(`Missing ClassCur line for ${classObj.id}`);
            return;
        }
        const teacherMapLine = rawClassCur[curLineIndex];

        // Parse Grid (96 bytes)
        // Format: Sequence of CourseChars.
        // What is the period structure?
        // 5 Days * 7 Periods = 35?
        // Let's assume standard: M1..M7, T1..T7...
        // We just store raw array for now, or try to decode.

        const PERIODS_PER_WEEK = 35; // 5 Days * 7 Periods
        const periodData = [];
        for (let i = 0; i < PERIODS_PER_WEEK; i++) {
            // Safety check for line length
            if (i >= scheduleLine.length) break;

            const charCode = scheduleLine.charCodeAt(i);
            // 0x30 ('0') -> Course 0
            const courseId = String(charCode - 48);

            // Look up Teacher
            // teacherMapLine is 40 bytes. Index = CourseId?
            // "Who teaches Course X?"
            // teacherMapLine[courseId] = TeacherChar
            let teacherId = null;
            if (courseId >= 0 && courseId < teacherMapLine.length) {
                const teacherChar = teacherMapLine.charCodeAt(courseId);
                const tIdParsed = teacherChar - 48; // '0' -> 0
                if (tIdParsed >= 0 && tIdParsed < teachers.length) {
                    // Option A: Treat 0 ("杜惠玲") and 1 ("張乃心") as "Unassigned" 
                    // because they are used as default/homeroom placeholders in source data.
                    if (tIdParsed === 0 || tIdParsed === 1) {
                        teacherId = null;
                    } else {
                        teacherId = String(tIdParsed);
                    }
                }
            }

            periodData.push({
                courseId: (courseId >= 0 && courseId < courses.length) ? courseId : null,
                teacherId: teacherId
            });
        }

        schedules.push({
            classId: classObj.id,
            periods: periodData
        });
    });

    // Final Output
    const result = {
        meta: {
            semester: '110-1', // Should read from Stc.INI
            timestamp: new Date().toISOString()
        },
        teachers,
        courses,
        classes,
        schedules
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`Parsing Complete. Data saved to ${OUTPUT_FILE}`);
}

parse();
