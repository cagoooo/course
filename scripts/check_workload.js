import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../smes_data.json');

const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

const teacherCounts = {}; // teacherId -> count

data.schedules.forEach(s => {
    s.periods.forEach(p => {
        if (p.teacherId !== null) {
            teacherCounts[p.teacherId] = (teacherCounts[p.teacherId] || 0) + 1;
        }
    });
});

console.log('--- Teacher Workload Analysis ---');
let overloaded = 0;
Object.entries(teacherCounts).forEach(([tid, count]) => {
    const t = data.teachers.find(t => t.id === tid);
    const name = t ? t.name : 'Unknown';
    if (count > 35) {
        console.log(`[OVERLOAD] ${name} (ID: ${tid}): ${count} periods (Max 35)`);
        overloaded++;
    }
});

if (overloaded === 0) {
    console.log('No teachers overloaded.');
} else {
    console.log(`Found ${overloaded} overloaded teachers.`);
}
