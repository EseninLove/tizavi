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
// Passenger rejects client-supplied secure headers; direct CLI servers do not.
process.env.TIZAVI_PASSENGER = global.PhusionPassenger ? "1" : "";
import("tsx/esm/api")
  .then(({ tsImport }) =>
    tsImport("./deploy/sprinthost/server.ts", pathToFileURL(__filename).href),
  )
  .catch(() => {
    console.error("Tizavi startup failed");
    process.exit(1);
  });
