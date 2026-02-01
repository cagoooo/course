
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../smes_data.json');

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const teacherCounts = {};
const teacherCourses = {};

data.classes.forEach(c => {
    // We need to find the schedule for this class
    // In smes_data.json, schedules are in "schedules" array, linked by classId NOT nested in classes anymore (based on parser.js last output structure).
    // Wait, let's check smes_data.json structure from parser.js:2000. 
    // It seems "periods" ARE nested in classes... wait.
    // parser.js line 183: "schedules".
    // parser.js line 168: schedules.push({ classId, periods }).
    // So "schedules" is a separate top-level array.
});

// Re-read parser.js output structure:
// result = { meta, teachers, courses, classes, schedules }
const schedules = data.schedules;
const teachers = data.teachers;
const courses = data.courses;

const teacherMap = {};
teachers.forEach(t => teacherMap[t.id] = t.name);

const courseMap = {};
courses.forEach(c => courseMap[c.id] = c.name);

schedules.forEach(sch => {
    sch.periods.forEach(p => {
        const tId = p.teacherId;
        const cId = p.courseId;

        if (tId) {
            teacherCounts[tId] = (teacherCounts[tId] || 0) + 1;

            if (!teacherCourses[tId]) teacherCourses[tId] = {};
            if (cId) {
                teacherCourses[tId][cId] = (teacherCourses[tId][cId] || 0) + 1;
            }
        }
    });
});

console.log("Teacher Workload (Top 10):");
const sortedTeachers = Object.keys(teacherCounts).sort((a, b) => teacherCounts[b] - teacherCounts[a]);
sortedTeachers.slice(0, 10).forEach(tId => {
    console.log(`${teacherMap[tId]} (ID: ${tId}): ${teacherCounts[tId]} periods`);

    // Show top courses for this teacher
    const cIds = Object.keys(teacherCourses[tId]).sort((a, b) => teacherCourses[tId][b] - teacherCourses[tId][a]);
    cIds.slice(0, 5).forEach(cId => {
        console.log(`  - ${courseMap[cId]} (ID: ${cId}): ${teacherCourses[tId][cId]}`);
    });
});
