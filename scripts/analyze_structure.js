const fs = require('fs');
const iconv = require('iconv-lite');
const path = require('path');

const baseDir = 'h:/course/Ys110-1';
const files = ['TeachNam', 'CoursNam', 'RoomNam', 'ClassNum', 'ClassCur'];

function analyzeFile(filename) {
    const filePath = path.join(baseDir, filename);
    if (!fs.existsSync(filePath)) {
        console.log(`[${filename}] NOT FOUND`);
        return;
    }

    const buffer = fs.readFileSync(filePath);
    console.log(`\n=== Analyzing ${filename} (${buffer.length} bytes) ===`);
    
    // Attempt 1: Decode as pure Big5 stream
    const decoded = iconv.decode(buffer, 'big5');
    console.log('--- Decoded Preview (First 500 chars) ---');
    console.log(decoded.substring(0, 500));
    console.log('-----------------------------------------');

    // Attempt 2: Auto-detect fixed width patterns
    // Often there are null bytes (0x00) or spaces (0x20) padding fields
    // Let's print hex of first 64 bytes to see padding
    console.log('--- Hex Dump (First 64 bytes) ---');
    let hex = '';
    for(let i=0; i<Math.min(buffer.length, 64); i++) {
        hex += buffer[i].toString(16).padStart(2, '0') + ' ';
    }
    console.log(hex);
}

files.forEach(analyzeFile);
