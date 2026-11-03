import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("database transport permits local opt-in only for loopback and preserves remote TLS", () => {
  for (const [host, mode, expected] of [
    ["localhost", "local", false],
    ["127.0.0.1", "local", false],
    ["[::1]", "local", false],
    ["db.example.com", "", true],
    ["localhost", "", true],
    ["db.example.com", "local", "reject"],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "--input-type=module",
        "-e",
        "const {pool}=await import('./api/_db.ts'); console.log(JSON.stringify(pool.options.ssl)); await pool.end();",
      ],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          DB_URL: `postgresql://test:test@${host}/test?sslmode=disable`,
          DB_SSL_MODE: mode,
          DB_SSL_CA: "",
        },
      },
    );
    if (expected === "reject") {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /requires a loopback database URL/);
    } else {
      assert.equal(result.status, 0);
      assert.deepEqual(
        JSON.parse(result.stdout),
        expected ? { rejectUnauthorized: true } : false,
      );
    }
  }
});
