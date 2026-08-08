const { ESLint } = require("eslint");
const fs = require("fs");

async function fixUnusedVars() {
    const eslint = new ESLint();
    const results = await eslint.lintFiles(["**/*.js"]);

    for (const result of results) {
        if (result.messages.length === 0) continue;

        let content = fs.readFileSync(result.filePath, "utf8");
        const lines = content.split("\n");
        let modified = false;

        // Sort messages in reverse order so line numbers don't shift when modifying
        const messages = result.messages.sort((a, b) => b.line - a.line);

        for (const msg of messages) {
            if (msg.ruleId === "no-unused-vars") {
                const lineIndex = msg.line - 1;
                const lineContent = lines[lineIndex];

                // Remove unused 'const X = require(...)'
                if (lineContent.includes("require(") && lineContent.includes(msg.message.split("'")[1])) {
                    if (lineContent.includes("{") && lineContent.includes("}")) {
                        // It's a destructured require, e.g., const { EmbedBuilder, ActionRowBuilder } = require('discord.js');
                        const varName = msg.message.split("'")[1];
                        const regex = new RegExp(`\\b${varName}\\b\\s*,?\\s*`);
                        const newLine = lineContent.replace(regex, "");
                        
                        // If it becomes empty destructured: const { } = require
                        if (newLine.match(/{\s*}\s*=\s*require/)) {
                            lines.splice(lineIndex, 1);
                        } else {
                            lines[lineIndex] = newLine;
                        }
                    } else {
                        // Standard require, e.g., const GuildSettings = require(...)
                        lines.splice(lineIndex, 1);
                    }
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(result.filePath, lines.join("\n"));
            console.log("Fixed unused vars in", result.filePath);
        }
    }
}

fixUnusedVars().catch(console.error);
