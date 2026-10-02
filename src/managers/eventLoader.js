"use strict";

const fs = require("fs");
const path = require("path");

function loadEvents(client, eventsPath) {
  if (!fs.existsSync(eventsPath)) return 0;

  const eventFiles = fs
    .readdirSync(eventsPath, { recursive: true })
    .filter((file) => typeof file === "string" && file.endsWith(".js"));

  let loaded = 0;

  for (const relPath of eventFiles) {
    const fullPath = path.join(eventsPath, relPath);
    const event = require(fullPath);
    const eventName = path.basename(relPath, ".js");

    if (typeof event === "function") {
      client.on(eventName, (...args) => event(client, ...args));
      loaded += 1;
    } else if (event.name) {
      const handler = (...args) => event.execute(...args, client);
      if (event.once) client.once(event.name, handler);
      else client.on(event.name, handler);
      loaded += 1;
    }
  }

  return loaded;
}

module.exports = { loadEvents };

