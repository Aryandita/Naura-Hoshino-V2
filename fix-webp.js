const fs = require('fs');
const glob = require('fast-glob');

const files = glob.sync('plugin/**/*.js', { cwd: __dirname, absolute: true });

let modified = 0;
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Replace canvas.toBuffer('image/png') with canvas.encodeSync('webp')
    content = content.replace(/canvas\.toBuffer\('image\/png'\)/g, "canvas.encodeSync('webp')");
    
    // Replace encodeSync('png') with encodeSync('webp')
    content = content.replace(/canvas\.encodeSync\('png'\)/g, "canvas.encodeSync('webp')");

    // Fix attachment names from .png to .webp in AttachmentBuilder
    content = content.replace(/\{ name: '(.*?)\.png' \}/g, "{ name: '$1.webp' }");
    content = content.replace(/\{ name: "(.*?)\.png" \}/g, '{ name: "$1.webp" }');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        modified++;
        console.log('Modified: ' + file);
    }
}
console.log('Total modified files: ' + modified);
