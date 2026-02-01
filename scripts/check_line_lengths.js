const fs = require('fs');
const path = require('path');

const fileNames = ['TeachNam', 'CoursNam', 'ClassTab', 'RoomNam'];
const baseDir = 'h:/course/Ys110-1';

fileNames.forEach(name => {
    const p = path.join(baseDir, name);
    if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p);
        let lastParams = [];
        let ranges = [];

        // Scan for CRLF
        let start = 0;
        let lineLengths = [];
        for (let i = 0; i < buf.length; i++) {
            if (buf[i] === 0x0D && buf[i + 1] === 0x0A) {
                lineLengths.push(i - start);
                start = i + 2;
                i++; // skip 0A
            }
        }
        // Last line?
        if (start < buf.length) {
            lineLengths.push(buf.length - start);
        }

        console.log(`\n=== ${name} ===`);
        console.log(`Total Lines: ${lineLengths.length}`);

        // Group by length
        const distinct = {};
        lineLengths.forEach(len => distinct[len] = (distinct[len] || 0) + 1);
        console.log('Line Lengths:', distinct);

        // Print first 3 lines as hex/ascii
        const lines = buf.toString('binary').split('\r\n');
        lines.slice(0, 3).forEach((l, idx) => {
            console.log(`Line ${idx}: [${l}] (len: ${l.length})`);
        });
    }
});
