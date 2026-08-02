const fs = require('fs');
const path = require('path');
const glob = require('fast-glob');

async function extractStrings() {
    const files = await glob(['plugin/**/*.js', 'src/events/**/*.js'], { absolute: true });
    
    let extracted = {};
    let keyCounter = 1;

    for (const file of files) {
        let content = fs.readFileSync(file, 'utf8');

        // Regex untuk menemukan ui.sendError(..., 'teks', ...)
        const sendErrorRegex = /ui\.sendError\(([^,]+),\s*(['"`])(.*?)\2(.*?)\)/g;
        
        let match;
        while ((match = sendErrorRegex.exec(content)) !== null) {
            const originalString = match[3];
            // Skip jika sudah diterjemahkan atau menggunakan variabel kompleks
            if (originalString.includes('languageManager') || originalString.includes('${')) continue;

            const key = `auto_str_${keyCounter++}`;
            extracted[key] = originalString;
        }
    }

    fs.writeFileSync(path.join(__dirname, '..', 'extracted_strings.json'), JSON.stringify(extracted, null, 4));
    console.log(`[Localize Script] Berhasil mengekstrak ${Object.keys(extracted).length} string ke extracted_strings.json`);
}

extractStrings();
