const fs = require('fs');
const path = require('path');

const baseDir = 'h:/course/Ys110-1';

const classCurPath = path.join(baseDir, 'ClassCur');
const classTabPath = path.join(baseDir, 'ClassTab');

// Analyze ClassCur
if (fs.existsSync(classCurPath)) {
    const curBuf = fs.readFileSync(classCurPath);
    console.log(`\n=== ClassCur (${curBuf.length} bytes) ===`);

    // Hex dump first 128 bytes
    let hex = '';
    for (let i = 0; i < 128 && i < curBuf.length; i++) {
        hex += curBuf[i].toString(16).padStart(2, '0') + ' ';
        if ((i + 1) % 16 === 0) hex += '\n';
    }
    console.log(hex);

    // Look for CRLF
    let lineStarts = [0];
    for (let i = 0; i < curBuf.length - 1; i++) {
        if (curBuf[i] === 0x0D && curBuf[i + 1] === 0x0A) {
            lineStarts.push(i + 2);
        }
    }
    console.log(`ClassCur Lines detected: ${lineStarts.length} (Note: Last line might not have CRLF)`);
    // Check line lengths
    const lengths = {};
    for (let i = 0; i < lineStarts.length - 1; i++) {
        const len = lineStarts[i + 1] - lineStarts[i] - 2; // -2 for CRLF
        lengths[len] = (lengths[len] || 0) + 1;
    }
    const lastLen = curBuf.length - lineStarts[lineStarts.length - 1];
    lengths[lastLen] = (lengths[lastLen] || 0) + 1;
    console.log('ClassCur Line Lengths:', lengths);
}

// Analyze ClassTab Ranges
if (fs.existsSync(classTabPath)) {
    const tabBuf = fs.readFileSync(classTabPath);
    let minChar = 255, maxChar = 0;
    const chars = new Set();

    // Scan only valid lines (length 96)
    // We assume from previous step we know where lines are
    // But let's just scan all bytes excluding CRLF
    for (let i = 0; i < tabBuf.length; i++) {
        const b = tabBuf[i];
        if (b === 0x0D || b === 0x0A) continue;
        if (b < minChar) minChar = b;
        if (b > maxChar) maxChar = b;
        chars.add(String.fromCharCode(b));
    }
    console.log(`\n=== ClassTab Char Range ===`);
    console.log(`Min: ${minChar} ('${String.fromCharCode(minChar)}')`);
    console.log(`Max: ${maxChar} ('${String.fromCharCode(maxChar)}')`);
    console.log(`Unique Chars: ${Array.from(chars).sort().join('')}`);
}
