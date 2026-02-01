const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const baseDir = 'h:/course/Ys110-1';

const classNumPath = path.join(baseDir, 'ClassNum');

if (fs.existsSync(classNumPath)) {
    const buf = fs.readFileSync(classNumPath);
    console.log(`\n=== ClassNum (${buf.length} bytes) ===`);
    console.log('Hex Dump:');
    let output = '';
    for (let i = 0; i < buf.length; i += 16) {
        const chunk = buf.slice(i, i + 16);
        output += chunk.toString('hex').match(/../g).join(' ') + '\n';
    }
    console.log(output);

    // Try decoding as Big5 lines
    console.log('--- Decoded (Big5) ---');
    console.log(iconv.decode(buf, 'big5'));
}
