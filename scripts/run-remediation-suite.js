#!/usr/bin/env node
/**
 * Runs the remediation module's specs, in dependency order, one worker.
 *
 * Kept SEPARATE from run-parallel-workers.js on purpose: these suites are new,
 * each owns a dedicated client + sub-entity, and each carries a slow "00" setup
 * test that answers a whole framework. Folding them into the shared CI runner
 * before they have been through a live pass would lengthen every pipeline run,
 * so this script lets the remediation coverage be exercised on its own first.
 *
 * Order matters INSIDE a spec (declaration order, workers: 1) but not between
 * specs - each suite is self-contained - so the list below is grouped only for
 * readability.
 *
 * Usage:
 *   node scripts/run-remediation-suite.js                  every Secure suite
 *   node scripts/run-remediation-suite.js --group actions  one suite
 *   node scripts/run-remediation-suite.js --roles          the role suites too
 */
const { spawnSync } = require("child_process");

const SECURE_SUITES = {
  // The original remediation coverage, kept first so a regression in the core
  // accept / ignore / assign / remediate flow surfaces before anything else.
  core: "tests/Secure/Remediation/remediation.spec.js",
  actions: "tests/Secure/Remediation/remediationActions.spec.js",
  filters: "tests/Secure/Remediation/remediationFilters.spec.js",
  tools: "tests/Secure/Remediation/remediationTools.spec.js",
  details: "tests/Secure/Remediation/remediationDetails.spec.js",
  export: "tests/Secure/Remediation/remediationExport.spec.js",
  scoring: "tests/Secure/Remediation/remediationScoring.spec.js",
};

// Role suites need their own storageState, produced by that role's setup spec,
// so they are opt-in rather than part of the default run.
const ROLE_SUITES = {
  participant: "tests/Participant/Remediation/remediationParticipant.spec.js",
  subEntityLeader:
    "tests/SubEntityLeader/Remediation/remediationSubEntityLeader.spec.js",
};

const args = process.argv.slice(2);
const groupIndex = args.indexOf("--group");
const includeRoles = args.includes("--roles");

let suites;
if (groupIndex !== -1) {
  const name = args[groupIndex + 1];
  const spec = SECURE_SUITES[name] || ROLE_SUITES[name];
  if (!spec) {
    console.error(
      `Unknown group "${name}". Available: ${[
        ...Object.keys(SECURE_SUITES),
        ...Object.keys(ROLE_SUITES),
      ].join(", ")}`,
    );
    process.exit(1);
  }
  suites = [[name, spec]];
} else {
  suites = Object.entries(SECURE_SUITES);
  if (includeRoles) {
    suites = suites.concat(Object.entries(ROLE_SUITES));
  }
}

const results = [];
for (const [name, spec] of suites) {
  console.log(`\n=== ${name}: ${spec} ===\n`);
  // Not aborting on failure: one suite failing says nothing about the next, and
  // a full picture is more useful than a fast exit when triaging new coverage.
  const run = spawnSync("npx", ["playwright", "test", spec], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  results.push({ name, spec, passed: run.status === 0 });
}

console.log("\n=== Remediation suite summary ===");
for (const result of results) {
  console.log(`${result.passed ? "PASS" : "FAIL"}  ${result.name}`);
}
const failed = results.filter((result) => !result.passed);
process.exit(failed.length > 0 ? 1 : 0);
