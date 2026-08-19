"use strict";

const fs = require("fs");
const path = require("path");

const contextMenus = new Map();

function loadContextMenus() {
  if (contextMenus.size > 0) return contextMenus;

  const currentDir = __dirname;
  const files = fs.readdirSync(currentDir).filter((f) => f.endsWith(".js") && f !== "index.js");

  for (const file of files) {
    try {
      const fullPath = path.join(currentDir, file);
      const cmd = require(fullPath);
      if (cmd && cmd.name && cmd.execute) {
        contextMenus.set(cmd.name, cmd);
      }
    } catch (e) {
      // ignore individual load errors
    }
  }

  return contextMenus;
}

function getContextMenuCommands() {
  loadContextMenus();
  return Array.from(contextMenus.values()).map((cmd) => ({
    name: cmd.name,
    type: cmd.type,
    integration_types: cmd.integration_types || [0],
    contexts: cmd.contexts || [0],
  }));
}

function resolveContextMenu(name) {
  loadContextMenus();
  return contextMenus.get(name);
}

module.exports = {
  loadContextMenus,
  getContextMenuCommands,
  resolveContextMenu,
};
