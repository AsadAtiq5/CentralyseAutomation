#!/usr/bin/env node
/**
 * Runs the MidMarket (application 3) specs, in dependency order, one worker.
 *
 * Kept SEPARATE from run-parallel-workers.js on purpose: MidMarket is a brand
 * new app target with its own domain, its own broker account and its own
 * session file, and none of it has been through a live pass yet. Folding it
 * into the shared CI runner before that would lengthen every pipeline run and
 * risk a red build over environment setup rather than a real regression.
 *
 * Login MUST run first - there is no globalSetup in this repo, so
 * storageState.midmarket.json only exists once MMLOGIN - 05 has written it.
 * Every other spec opts into that session via test.use().
 *
 * Order matters INSIDE a spec (declaration order, workers: 1). Between specs it
 * matters only for the wizard suites: the draft suite's MMW - 21 resumes the
 * draft that MMW - 20 saved, and the main suite's MMW - 07 reopens the entity
 * MMW - 06 created, so a suite is never split across runs.
 *
 * Usage:
 *   node scripts/run-midmarket-suite.js                   login + every suite
 *   node scripts/run-midmarket-suite.js --group wizard    one suite
 *   node scripts/run-midmarket-suite.js --skip-login      reuse the saved session
 */
const { spawnSync } = require("child_process");

const LOGIN_SPEC = "tests/MidMarket/Login/login.spec.js";

const SUITES = {
  // Step rendering plus the end-to-end create. Kept first so a break in the
  // happy path surfaces before the narrower negative cases.
  wizard: "tests/MidMarket/Wizard/midMarketWizard.spec.js",
  validation: "tests/MidMarket/Wizard/midMarketWizardValidation.spec.js",
  draft: "tests/MidMarket/Wizard/midMarketWizardDraft.spec.js",
};

const args = process.argv.slice(2);
const groupIndex = args.indexOf("--group");
const skipLogin = args.includes("--skip-login");

let suites;
if (groupIndex !== -1) {
  const name = args[groupIndex + 1];
  const spec = SUITES[name];
  if (!spec) {
    console.error(
      `Unknown group "${name}". Available: ${Object.keys(SUITES).join(", ")}`,
    );
    process.exit(1);
  }
  suites = [[name, spec]];
} else {
  suites = Object.entries(SUITES);
}

// APP pins testData/MidMarket/ and the MidMarket storageState for any spec that
// does not set it itself. The specs also assign process.env.APP at module load,
// so this is belt and braces for a --group run.
const env = { ...process.env, APP: "MidMarket" };

function runSpec(name, spec) {
  console.log(`\n=== ${name}: ${spec} ===\n`);
  const run = spawnSync("npx", ["playwright", "test", spec, "--workers=1"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env,
  });
  return run.status === 0;
}

// Login is a hard gate, not just another suite: without the session file every
// downstream spec lands on the login screen and fails for the wrong reason.
if (!skipLogin) {
  const loggedIn = runSpec("login", LOGIN_SPEC);
  if (!loggedIn) {
    console.error(
      "\nMidMarket login failed - storageState.midmarket.json was not written. " +
        "Check BASE_URL_MIDMARKET, and USER_EMAIL/USER_PASSWORD (MidMarket " +
        "reuses the shared account unless MIDMARKET_USER_EMAIL/PASSWORD are " +
        "set), and that the OTP is reaching " +
        "public/AUTOMATION/{email}/OTP.txt on S3.",
    );
    process.exit(1);
  }
}

const results = [];
for (const [name, spec] of suites) {
  // Not aborting on failure: one suite failing says nothing about the next, and
  // a full picture is more useful than a fast exit when triaging new coverage.
  results.push({ name, spec, passed: runSpec(name, spec) });
}

console.log("\n=== MidMarket suite summary ===");
for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name}`);
}
const failed = results.filter((result) => !result.passed);
process.exit(failed.length > 0 ? 1 : 0);
