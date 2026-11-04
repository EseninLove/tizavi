const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const root = path.resolve(__dirname, "../../..");
process.chdir(root);
Object.assign(
  process.env,
  JSON.parse(
    fs.readFileSync(
      path.join(process.env.HOME, ".config/tizavi/env.json"),
      "utf8",
    ),
  ),
);
import("tsx/esm/api")
  .then(async ({ tsImport }) => {
    const { run } = await tsImport(
      "./deploy/sprinthost/tools/sync-catalog.ts",
      pathToFileURL(path.join(root, "app.cjs")).href,
    );
    await run();
  })
  .catch(() => {
    console.error("Catalog sync startup failed");
    process.exitCode = 1;
  });
