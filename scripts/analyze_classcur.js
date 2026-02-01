
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILE_PATH = path.join(__dirname, '../Ys110-1/ClassCur');

if (!fs.existsSync(FILE_PATH)) {
    console.error(`File not found: ${FILE_PATH}`);
    process.exit(1);
}

const buffer = fs.readFileSync(FILE_PATH);
console.log(`File Size: ${buffer.length} bytes`);

// Dump first 256 bytes
console.log("Hex Dump (first 256 bytes):");
let output = '';
for (let i = 0; i < Math.min(buffer.length, 256); i++) {
    const byte = buffer[i];
    output += byte.toString(16).padStart(2, '0') + ' ';
    if ((i + 1) % 16 === 0) {
        console.log(output);
        output = '';
    }
}
if (output) console.log(output);

// Dump as characters (replace non-printable with '.')
console.log("\nChar Dump (first 256 bytes):");
output = '';
for (let i = 0; i < Math.min(buffer.length, 256); i++) {
    const byte = buffer[i];
    const char = (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
    output += char;
    if ((i + 1) % 16 === 0) {
        console.log(output);
        output = '';
    }
}
if (output) console.log(output);

// Analyze line structure if CRLF present
console.log("\nSearching for CRLF (0D 0A)...");
let lineCount = 0;
let lastIndex = 0;
for (let i = 0; i < buffer.length - 1; i++) {
    if (buffer[i] === 0x0D && buffer[i + 1] === 0x0A) {
        lineCount++;
        const lineLen = i - lastIndex;
        console.log(`Line ${lineCount}: Length ${lineLen} bytes (Offset ${lastIndex})`);

        // Dump line content
        const lineBuf = buffer.slice(lastIndex, i);
        console.log(`  Content: ${lineBuf.toString('ascii')}`);

        lastIndex = i + 2;
        i++; // skip LF

        if (lineCount >= 5) break;
    }
}
