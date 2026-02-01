const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const baseDir = 'h:/course/Ys110-1';

function hexDump(buffer, limit = 256) {
    let output = '';
    for (let i = 0; i < Math.min(buffer.length, limit); i += 16) {
        const chunk = buffer.slice(i, i + 16);
        const hex = chunk.toString('hex').match(/../g).join(' ');
        const ascii = chunk.toString().replace(/[^\x20-\x7E]/g, '.');
        output += `${i.toString(16).padStart(4, '0')}  ${hex.padEnd(48)}  ${ascii}\n`;
    }
    return output;
}

// Analyze TeachNam (Text based?)
const teachBuf = fs.readFileSync(path.join(baseDir, 'TeachNam'));
console.log('=== TeachNam ===');
// Check for 0x0D 0x0A
console.log('Hex Dump (First 128 bytes):');
console.log(hexDump(teachBuf, 128));

// Analyze CoursNam
const courseBuf = fs.readFileSync(path.join(baseDir, 'CoursNam'));
console.log('\n=== CoursNam ===');
console.log('Hex Dump (First 128 bytes):');
console.log(hexDump(courseBuf, 128));


// Analyze ClassTab (Binary Schedule?)
const classTabBuf = fs.readFileSync(path.join(baseDir, 'ClassTab'));
console.log('\n=== ClassTab ===');
console.log(`Total Size: ${classTabBuf.length}`);
console.log('Hex Dump (First 256 bytes):');
console.log(hexDump(classTabBuf, 256));

// Check patterns in ClassTab
// Count frequency of bytes
const counts = {};
for (const b of classTabBuf) {
    counts[b] = (counts[b] || 0) + 1;
}
console.log('Most common bytes:', Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5));
