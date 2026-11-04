// Bound esbuild worker threads on shared hosting.
process.env.GOMAXPROCS = "2";
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
process.chdir(__dirname);
const config =
  process.env.TIZAVI_CONFIG ||
  path.join(process.env.HOME, ".config/tizavi/env.json");
if (!fs.existsSync(config)) throw new Error("Tizavi configuration is missing");
Object.assign(process.env, JSON.parse(fs.readFileSync(config, "utf8")));
process.env.NODE_ENV = "production";
// This entry point runs behind Apache, which overwrites the trusted address header.
// For local checks, start server.ts directly instead.
process.env.TIZAVI_PASSENGER = "1";
import("tsx/esm/api")
  .then(({ tsImport }) =>
    tsImport("./deploy/sprinthost/server.ts", pathToFileURL(__filename).href),
  )
  .catch(() => {
    console.error("Tizavi startup failed");
    process.exit(1);
  });
