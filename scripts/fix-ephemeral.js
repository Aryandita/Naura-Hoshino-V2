const fs = require("fs");
const glob = require("fast-glob");

async function run() {
  const files = await glob(["plugin/**/*.js", "src/**/*.js"], {
    cwd: "d:/Naura Hoshino V2",
    absolute: true,
  });
  let totalReplaced = 0;

  for (const file of files) {
    let content = fs.readFileSync(file, "utf8");
    if (content.includes("ephemeral: true")) {
      const originalContent = content;

      // Replace ephemeral: true with flags: MessageFlags.Ephemeral
      content = content.replace(
        /ephemeral:\s*true/g,
        "flags: MessageFlags.Ephemeral",
      );

      if (content !== originalContent) {
        // If the original file didn't have MessageFlags, we need to add it to the discord.js require
        if (!/\\bMessageFlags\\b/.test(originalContent)) {
          // Find const { ... } = require('discord.js');
          const requireRegex =
            /const\s+\{([^}]+)\}\s*=\s*require\(['\"]discord\.js['\"]\);/;
          const match = content.match(requireRegex);
          if (match) {
            if (!match[1].includes("MessageFlags")) {
              const newImports = match[1] + ", MessageFlags";
              content = content.replace(
                match[0],
                `const { ${newImports.trim().replace(/^,|,$/g, "")} } = require('discord.js');`,
              );
            }
          } else {
            // No discord.js require found, add it
            content =
              "const { MessageFlags } = require('discord.js');\n" + content;
          }
        }

        fs.writeFileSync(file, content);
        totalReplaced++;
        console.log("Fixed " + file);
      }
    }
  }
  console.log("Total files fixed:", totalReplaced);
}
run();
