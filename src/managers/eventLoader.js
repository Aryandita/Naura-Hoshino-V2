// Pemuat event rekursif. Dipisahkan dari index.js tanpa mengubah perilaku.
const fs = require("fs");
const path = require("path");
const glob = require("fast-glob");

function loadEvents(client, eventsPath) {
  if (!fs.existsSync(eventsPath)) return 0;

  // fast-glob dipakai agar berkas event di dalam sub-folder ikut terbaca.
  const searchPattern = path.posix.join(
    eventsPath.split(path.sep).join("/"),
    "**/*.js",
  );
  const eventFiles = glob.sync(searchPattern);
  let loaded = 0;

  for (const filePath of eventFiles) {
    const event = require(filePath);
    // Nama berkas dipakai sebagai nama event bila modulnya berupa fungsi.
    const eventName = path.basename(filePath, ".js");

    if (typeof event === "function") {
      client.on(eventName, (...args) => event(client, ...args));
      loaded += 1;
    } else if (event.name) {
      if (event.once)
        client.once(event.name, (...args) => event.execute(...args, client));
      else client.on(event.name, (...args) => event.execute(...args, client));
      loaded += 1;
    }
  }

  return loaded;
}

module.exports = { loadEvents };
