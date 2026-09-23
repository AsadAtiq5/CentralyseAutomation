#!/usr/bin/env node
/**
 * Runs a SELECTED slice of the suite: one app's complete suite, or a single
 * spec (optionally a single test inside it).
 *
 * Standalone on purpose - it does not modify or import run-parallel-workers.js.
 * For a complete suite it simply delegates to that runner, so the curated worker
 * grouping and ordering stay defined in exactly one place. For a single spec it
 * does the two things that spec needs on its own: the app's login/setup step
 * (which writes the storageState the spec expects) and then the spec itself.
 *
 * Driven by env vars so the manual GitHub workflow can pass inputs straight
 * through:
 *
 *   APP=Beacher                                  # which application
 *   SPEC=Controls/navigator.spec.js              # omit for the complete suite
 *   GREP="BCN - 01"                              # optional single test title
 *   LIST=1                                       # print this app's specs, exit
 *   DRY_RUN=1                                    # print the plan, run nothing
 *
 * Examples:
 *   APP=Beacher LIST=1 node scripts/run-selected-tests.js
 *   APP=Beacher SPEC=Controls/navigator.spec.js node scripts/run-selected-tests.js
 *   APP=Secure SPEC=addClient.spec.js GREP="AC - 06" node scripts/run-selected-tests.js
 *   APP=Beacher node scripts/run-selected-tests.js        # complete suite
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const APP = (process.env.APP || "Secure").trim();
const SPEC = (process.env.SPEC || "").trim();
const GREP = (process.env.GREP || "").trim();
const LIST = /^(1|true|yes)$/i.test(process.env.LIST || "");
const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN || "");

const resultsDir = path.join(process.cwd(), "parallel-results");
const allureDir = path.join(process.cwd(), "allure-results");

// Login/setup spec that creates this app's session before the selected spec
// runs. Mirrors the map in run-parallel-workers.js: for the invite-based roles
// the setup spec IS the login step, because the user has to be provisioned and
// registered before a session exists.
const loginSpecByApp = {
  Secure: "tests/Secure/login.spec.js",
  Beacher: "tests/Beacher/Login/login.spec.js",
  Participant: "tests/Participant/Setup/setupParticipant.spec.js",
  SubEntityLeader: "tests/SubEntityLeader/Setup/setupSubEntityLeader.spec.js",
  EntityLeader: "tests/EntityLeader/Setup/setupEntityLeader.spec.js",
  MSSP: "tests/MSSP/Setup/setupMSSP.spec.js",
};

const APPS = Object.keys(loginSpecByApp);

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!APPS.includes(APP)) {
  fail(`Unknown APP "${APP}". Expected one of: ${APPS.join(", ")}`);
}

// Every spec this app owns, read off disk rather than from the worker map, so a
// newly authored spec can be run before anyone has added it to a worker group.
function specsForApp(app) {
  const root = path.join(process.cwd(), "tests", app);
  if (!fs.existsSync(root)) return [];

  const found = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".spec.js")) {
        found.push(path.relative(process.cwd(), full).replace(/\\/g, "/"));
      }
    });
  })(root);

  return found.sort();
}

// Accepts a full path ("tests/Beacher/Controls/navigator.spec.js"), an
// app-relative path ("Controls/navigator.spec.js") or a bare file name
// ("navigator.spec.js"). Anything ambiguous, missing, or belonging to another
// app is refused rather than guessed - running a Secure spec under APP=Beacher
// would quietly use the wrong session instead of failing.
function resolveSpec(spec, app) {
  const known = specsForApp(app);
  const normalized = spec.replace(/\\/g, "/").replace(/^\.\//, "");

  const exact = known.find((file) => file === normalized);
  if (exact) return exact;

  const matches = known.filter(
    (file) =>
      file === `tests/${app}/${normalized}` ||
      file.endsWith(`/${normalized}`) ||
      path.basename(file) === normalized,
  );
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    fail(
      `SPEC "${spec}" matches ${matches.length} specs under tests/${app}:\n  ` +
        matches.join("\n  ") +
        `\nPass a longer path to disambiguate.`,
    );
  }

  const otherApp = APPS.filter((candidate) => candidate !== app).find(
    (candidate) =>
      specsForApp(candidate).some(
        (file) =>
          file === normalized ||
          file.endsWith(`/${normalized}`) ||
          path.basename(file) === normalized,
      ),
  );
  if (otherApp) {
    fail(
      `SPEC "${spec}" belongs to APP=${otherApp}, not ${app}. Select the ${otherApp} app instead.`,
    );
  }

  fail(
    `SPEC "${spec}" not found under tests/${app}. Available (${known.length}):\n  ` +
      known.join("\n  "),
  );
}

function printList() {
  const known = specsForApp(APP);
  console.log(`Specs for APP=${APP} (${known.length}):`);
  known.forEach((file) => console.log(`  ${file}`));

  if (process.env.GITHUB_STEP_SUMMARY) {
    const md =
      `### Specs available for \`${APP}\` (${known.length})\n\n` +
      known.map((file) => `- \`${file}\`\n`).join("") +
      `\nRe-run this workflow with **Scope = single-spec** and paste one of these ` +
      `into **Spec** (the path after \`tests/${APP}/\` is enough).\n`;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }
}

// A complete suite keeps its curated grouping, so hand it straight to the
// existing parallel runner rather than re-implementing the worker map here.
function runCompleteSuite() {
  console.log(`Running the COMPLETE ${APP} suite via regression:parallel...\n`);
  const run = spawnSync("npm", ["run", "regression:parallel"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, APP },
  });
  process.exit(run.status === 0 ? 0 : 1);
}

function runSingleSpec(specFile) {
  const loginSpec = loginSpecByApp[APP];

  fs.rmSync(resultsDir, { recursive: true, force: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  console.log(`Step 1: login/setup for ${APP} -> ${loginSpec}`);
  const login = spawnSync(
    "npx",
    [
      "playwright",
      "test",
      loginSpec,
      "--workers=1",
      "--reporter=list,json,allure-playwright",
    ],
    {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        APP,
        CI: "1",
        PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(resultsDir, "login.json"),
        ALLURE_RESULTS_DIR: allureDir,
      },
    },
  );
  if (login.status !== 0) {
    fail("Login/setup failed. Aborting the selected run.");
  }

  const args = [
    "playwright",
    "test",
    specFile,
    "--workers=1",
    "--reporter=list,json,allure-playwright",
  ];
  if (GREP) args.push("-g", `"${GREP}"`);

  console.log(`\nStep 2: running ${specFile}${GREP ? ` -g "${GREP}"` : ""}\n`);
  const run = spawnSync("npx", args, {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      APP,
      CI: "1",
      PLAYWRIGHT_HTML_REPORT: "playwright-report/selected",
      PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(resultsDir, "selected.json"),
      ALLURE_RESULTS_DIR: allureDir,
    },
  });

  console.log("\nStep 3: generating Allure report...");
  spawnSync(
    "npx",
    [
      "allure",
      "generate",
      "./allure-results",
      "--clean",
      "-o",
      "./allure-report",
    ],
    { stdio: "inherit", shell: true },
  );

  const passed = run.status === 0;
  const summary =
    `### Selected run - \`${APP}\`\n\n` +
    `| App | Spec | Test filter | Result |\n| --- | --- | --- | --- |\n` +
    `| ${APP} | \`${specFile}\` | ${GREP ? `\`${GREP}\`` : "_all tests in the spec_"} | ` +
    `${passed ? "passed :white_check_mark:" : "failed :x:"} |\n`;

  fs.writeFileSync(path.join(process.cwd(), "TEST_SUMMARY.md"), summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  }

  console.log(`\n${passed ? "PASSED" : "FAILED"}: ${specFile}`);
  process.exit(passed ? 0 : 1);
}

if (LIST) {
  printList();
  process.exit(0);
}

if (!SPEC) {
  if (DRY_RUN) {
    console.log(`APP=${APP}`);
    console.log(
      "Scope: complete suite (delegates to npm run regression:parallel)",
    );
    process.exit(0);
  }
  runCompleteSuite();
}

const specFile = resolveSpec(SPEC, APP);

if (DRY_RUN) {
  console.log(`APP=${APP}`);
  console.log(`Login spec: ${loginSpecByApp[APP]}`);
  console.log(`Spec: ${specFile}`);
  console.log(`Test filter: ${GREP || "(none - all tests in the spec)"}`);
  process.exit(0);
}

runSingleSpec(specFile);
