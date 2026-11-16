// Builds the no-account example that runs entirely in the browser on synthetic data,
// and writes it to docs/try/ for GitHub Pages. The API routes need a server, so they
// are set aside during the export and restored afterwards.
import { execSync } from "node:child_process";
import { cpSync, existsSync, renameSync, rmSync, writeFileSync } from "node:fs";

const api = "app/api";
const parked = ".api-parked";
if (existsSync(parked)) throw new Error(`${parked} exists; restore it to ${api} first.`);

renameSync(api, parked);
try {
  execSync("next build", { stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_HOSTED_EXAMPLE: "true" } });
} finally {
  renameSync(parked, api);
}

rmSync("docs/try", { recursive: true, force: true });
cpSync("out", "docs/try", { recursive: true });
writeFileSync("docs/try/.nojekyll", "");
console.log("Hosted example written to docs/try/");
