const { execSync } = require("child_process");

const args = process.argv.slice(2);
const filename = args[0];

if (!filename) {
  execSync("playwright test --debug", { stdio: "inherit" });
} else {
  const testFile = `tests/Secure/${filename}.spec.js`;
  execSync(`playwright test --debug ${testFile}`, { stdio: "inherit" });
}
