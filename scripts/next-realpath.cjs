const { spawnSync } = require("node:child_process");
const { realpathSync } = require("node:fs");

const projectRoot = realpathSync(process.cwd());
process.chdir(projectRoot);

const nextBin = require.resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [nextBin, ...process.argv.slice(2)], {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
