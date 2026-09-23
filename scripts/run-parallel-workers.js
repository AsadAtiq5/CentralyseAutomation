#!/usr/bin/env node
/**
 * Runs login ONCE to create storageState.json, then runs all worker groups in
 * PARALLEL. Each group runs its spec files SEQUENTIALLY (one after the other),
 * all reusing the same storageState.json. Continues even if a spec fails.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const resultsDir = path.join(process.cwd(), "parallel-results");
const allureDir = path.join(process.cwd(), "allure-results");
const summaryFile = path.join(process.cwd(), "TEST_SUMMARY.md");
const statsFile = path.join(process.cwd(), "TEST_SUMMARY.json");

// Which application this run targets (set via env in CI, one job per app).
// Defaults to "Secure" so existing local/CI behaviour is unchanged.
const APP = process.env.APP || "Secure";

// Login spec that creates this app's session (storageState) before the workers run.
const loginSpecByApp = {
  Secure: "tests/Secure/login.spec.js",
  Beacher: "tests/Beacher/Login/login.spec.js",
  // The Participant session cannot come from a plain login: the user has to be
  // invited and registered first, so the setup spec IS this app's login step.
  Participant: "tests/Participant/Setup/setupParticipant.spec.js",
  // Same for the Sub Entity Leader - SSEL - 01 provisions the user and saves
  // storageState.subEntityLeader.json, so it is this app's login step.
  SubEntityLeader: "tests/SubEntityLeader/Setup/setupSubEntityLeader.spec.js",
  // And for the Entity Leader - ELS - 01 provisions the user and saves
  // storageState.entityLeader.json, so it is this app's login step.
  EntityLeader: "tests/EntityLeader/Setup/setupEntityLeader.spec.js",
  // And for the MSSP user - MSSPS - 01 provisions the user and saves
  // storageState.mssp.json, so it is this app's login step.
  MSSP: "tests/MSSP/Setup/setupMSSP.spec.js",
};
const loginSpec = loginSpecByApp[APP] || loginSpecByApp.Secure;

// Worker groups per app. Each group's files run SEQUENTIALLY; groups run in
// PARALLEL. Add Beacher feature specs to its map as they are built.
const workersByApp = {
  Secure: {
    "worker-1": [
      "tests/Secure/addClient.spec.js",
      "tests/Secure/addMultiEntity.spec.js",
      "tests/Secure/Remediation/remediation.spec.js",
      "tests/Secure/FramworkSettings/selectMandatoryOptions.spec.js",
      "tests/Secure/FramworkSettings/selectPartialRepresentation.spec.js",
      "tests/Secure/FramworkSettings/selectFooterOptions.spec.js",
      "tests/Secure/FramworkSettings/selectQuestionType.spec.js",
      "tests/Secure/Collection/scoreCalculation.spec.js",
      "tests/Secure/Collection/scoreCalculationFive.spec.js",
      "tests/Secure/Collection/applyFilters.spec.js",
      "tests/Secure/Collection/scoreCalculationPercentage.spec.js",
      "tests/Secure/Collection/reviewerScoreCalculations.spec.js",
      "tests/Secure/Collection/verifyReviewerModal.spec.js",
      "tests/Secure/Collection/addComment.spec.js",
    ],
    "worker-2": [
      "tests/Secure/instanceSetting.spec.js",
      "tests/Secure/addVendor.spec.js",
      "tests/Secure/Collection3rdParty/remediation3rdParty.spec.js",
      "tests/Secure/Collection3rdParty/scoreCalculationThirdParty.spec.js",
      "tests/Secure/Collection3rdParty/filtersThirdParty.spec.js",
      "tests/Secure/Collection3rdParty/addArtifactThirdParty.spec.js",
      "tests/Secure/Collection3rdParty/addCommentThirdParty.spec.js",
      "tests/Secure/Collection3rdParty/scoreCalculationVendor.spec.js",
    ],
    "worker-3": [
      "tests/Secure/Vendor/bulkUpload.spec.js",
      "tests/Secure/Vendor/emergingSercurityEvent.spec.js",
      "tests/Secure/Vendor/vendorArtifacts.spec.js",
    ],
    "worker-4": [
      { file: "tests/Secure/addClient.spec.js", grep: "AC - 06" },
      "tests/Secure/PolicyManagement/policyManagementPolicies.spec.js",
      "tests/Secure/DynamicLabelManagement/dynamicLabelManagementSettings.spec.js",
      "tests/Secure/DynamicLabelManagement/riskRegisterDLM.spec.js",
      "tests/Secure/DynamicLabelManagement/riskRegisterFiltersDLM.spec.js",
      "tests/Secure/DynamicLabelManagement/policyManagementDLM.spec.js",
      "tests/Secure/DynamicLabelManagement/policyManagementFiltersDLM.spec.js",
      "tests/Secure/DynamicLabelManagement/dynamicViewMultientity.spec.js",
    ],
    "worker-5": [
      "tests/Secure/Settings/addAdminUser.spec.js",
      "tests/Secure/Settings/addEntityLeader.spec.js",
      "tests/Secure/Settings/addMSSPUser.spec.js",
      "tests/Secure/Settings/addSubEntityLeader.spec.js",
      "tests/Secure/Settings/addParticipantUser.spec.js",
      "tests/Secure/Settings/customRole.spec.js",
    ],
    "worker-7": [
      "tests/Secure/Controls/table.spec.js",
      "tests/Secure/Controls/navigator.spec.js",
      "tests/Secure/Controls/filter.spec.js",
      "tests/Secure/RiskRegister/riskRegisterRisks.spec.js",
      "tests/Secure/RiskRegister/riskRegisterGroups.spec.js",
      "tests/Secure/Upperdeck/upperdeck.spec.js",
      "tests/Secure/RemediationSimulation/remediationSimulation.spec.js",
      "tests/Secure/RegulatoryWatch/regulatoryWatch.spec.js",
    ],
    "worker-9": [
      "tests/Secure/Collection/artifactregistry.spec.js",
      "tests/Secure/Collection/reassessment.spec.js",
      "tests/Secure/Collection/startFresh.spec.js",
      "tests/Secure/ImportAssessment/importAssessment.spec.js",
      "tests/Secure/ImportAssessment/importAssessmentVendor.spec.js",
      "tests/Secure/AIAnswering/aIAutoAnswering.spec.js",
      "tests/Secure/GlobalControls/globalControl.spec.js",
    ],
  },
  // Beacher (app 2) feature worker groups. Add more Beacher specs here as they
  // are authored under tests/Beacher/.
  Beacher: {
    "worker-1": [
      "tests/Beacher/Wizard/wizard.spec.js",
      "tests/Beacher/Wizard/wizardSteps.spec.js",
      "tests/Beacher/Wizard/wizardValidation.spec.js",
      "tests/Beacher/Wizard/wizardCompletion.spec.js",
      "tests/Beacher/Wizard/wizardNavigation.spec.js",
      "tests/Beacher/Wizard/wizardBoundary.spec.js",
      "tests/Beacher/Wizard/wizardWhiteLabel.spec.js",
      "tests/Beacher/Wizard/wizardDraft.spec.js",
      "tests/Beacher/Wizard/wizardEntityCreation.spec.js",
      "tests/Beacher/Application/scoreCalculation.spec.js",
      "tests/Beacher/Application/artifactregistry.spec.js",
      "tests/Beacher/LockAssessment/lockAssessment.spec.js",
      "tests/Beacher/Controls/table.spec.js",
      "tests/Beacher/Controls/navigator.spec.js",
      "tests/Beacher/Remediation/remediation.spec.js",
      "tests/Beacher/Collection/reassessment.spec.js",
      "tests/Beacher/Collection/startFresh.spec.js",
      "tests/Beacher/ImportAssessment/importAssessment.spec.js",
    ],
  },
  // Participant (app 3) feature worker groups. The setup spec runs as this
  // app's login step above and writes storageState.participant.json, so the
  // specs added here start already logged in as the participant.
  Participant: {
    "worker-1": [
      "tests/Participant/Collection/scoreCalculationParticipant.spec.js",
    ],
  },
  // Sub Entity Leader (app 4) feature worker groups. The setup spec runs as
  // this app's login step above and writes storageState.subEntityLeader.json,
  // so the specs added here start already logged in as the sub entity leader,
  // landing on the multi entity screen.
  SubEntityLeader: {
    "worker-1": [
      "tests/SubEntityLeader/Controls/navigatorSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Collection/scoreCalculationSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Collection/addCommentSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Collection/applyFilterSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Collection/artifactRegistrySubEntityLeader.spec.js",
      "tests/SubEntityLeader/Controls/tableSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Controls/controlFIltersSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Controls/navigatorSubEntityLeader.spec.js",
      "tests/SubEntityLeader/RiskRegister/riskRegisterRisksSubEntityLeader.spec.js",
      "tests/SubEntityLeader/RiskRegister/riskRegisterGroupsSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Collection/startFreshSubEntityLeader.spec.js",
      "tests/SubEntityLeader/Collection/importAssessmentSubEntityLeader.spec.js",
    ],
  },
  // Entity Leader (app 5) feature worker groups. The setup spec runs as this
  // app's login step above and writes storageState.entityLeader.json, so the
  // specs added here start already logged in as the entity leader, landing on
  // the client's upperdeck.
  //
  // UDEL - 01 builds the sub-entities this role is allowed to create and hands
  // the count forward to UDEL - 03, so the three tests run in declaration order
  // within the file.
  //
  // THIS ORDER IS LOAD-BEARING. Every spec here runs against the ONE client
  // ELS - 01 provisions per invocation, so each leaves state the next can see.
  // The constraints, in the order they force:
  //   - UDEL - 01 averages the entity cards on the client, and asserts the
  //     figure. It has to read them before anything else adds one.
  //   - SCEL - 00 builds the sub-entity that AREL and ACMEL both reuse, and
  //     stores its UUIDs. Nothing downstream can run before it, and it has to
  //     run in the SAME invocation - IDs from a previous run point at a client
  //     this session's leader cannot reach.
  //   - AREL - 01 asserts an EMPTY Artifacts Registry, so it comes before
  //     anything that could put a file in one.
  //   - PMEL - 02/03 assert the Policy Management empty state, which holds as
  //     long as nothing upstream creates a policy. None of the specs above do.
  EntityLeader: {
    "worker-1": [
      "tests/EntityLeader/Upperdeck/upperDeckEntityLeader.spec.js",
      "tests/EntityLeader/Collection/scoreCalculationEntityLeader.spec.js",
      "tests/EntityLeader/Collection/artifactRegistryEntityLeader.spec.js",
      "tests/EntityLeader/Collection/addCommentEntityLeader.spec.js",
      "tests/EntityLeader/Collection/applyFiltersEntityLeader.spec.js",
      "tests/EntityLeader/Collection/reassessmentEntityLeader.spec.js",
      "tests/EntityLeader/Collection/importAssessmentEntityLeader.spec.js",
      "tests/EntityLeader/Collection/startFreshEntityLeader.spec.js",
      "tests/EntityLeader/PolicyManagement/policyManagementPoliciesEntityLeader.spec.js",
    ],
    // SECOND WORKER - runs in PARALLEL with worker-1, in its own browser and
    // its own process, on the SAME session file and therefore the SAME client.
    //
    // The Controls Table specs are the right shape for it: they provision the
    // sub-entities they need, read nothing any worker-1 spec produces, and only
    // ever attach label metadata to controls - they never touch an answer, a
    // policy or an artifact.
    //
    // ONE COLLISION TO BE AWARE OF, and it is with worker-1's FIRST spec.
    // CTEL - 01 and CTEL - 03 each add a Business Email Compromise sub-entity to
    // the shared client while UDEL - 01 is averaging the entity cards and
    // UDEL - 03 is asserting totalRiskCount === backendRiskCount x entityCount.
    // An entity that appears mid-read moves both figures. In the sequential
    // order every entity-creating spec runs AFTER the upperdeck spec, which is
    // what protects those two assertions; a parallel worker removes that
    // protection. If UDEL - 01 or UDEL - 03 starts failing on the aggregate,
    // move this file into worker-1 (after the upperdeck spec) rather than
    // weakening the assertion.
    "worker-2": [
      "tests/EntityLeader/Controls/tableEntityLeader.spec.js",
      // Same worker as the table spec, and after it: both drive Controls >
      // Table and both build a sub-entity of their own, so they share the
      // collision note above rather than adding a new one. Kept sequential
      // within this worker because the Controls table is one screen with one
      // entity dropdown - two browsers re-scoping it at once would be a race
      // neither spec could see.
      "tests/EntityLeader/Controls/controlFiltersEntityLeader.spec.js",
      // Last in this worker, because it is the only Controls spec that WRITES:
      // CNEL - 01 answers one question through the Navigator, which is what the
      // node has to recolour from. It answers on a sub-entity it builds itself,
      // so nothing else in the job reads it.
      "tests/EntityLeader/Controls/navigatorEntityLeader.spec.js",
      // Risk Register, in this worker because it is self-sufficient the same
      // way the Controls specs are: RRREL - 00 builds its own sub-entity and
      // answers its own assessment, and every test then narrows the risks
      // screen to that entity, so nothing it counts or asserts depends on what
      // worker-1 is doing to the rest of the client. It is 14 tests, which also
      // evens out the two workers.
      "tests/EntityLeader/RiskRegister/riskRegisterRiskEntityLeader.spec.js",
      // Risk Groups last in this worker. Same self-sufficient shape - its own
      // sub-entity, every reading scoped to it - but RRGEL - 02 spends three
      // minutes waiting for the backend to generate the automatic groups, so it
      // is the one spec here with dead time and belongs where it delays nothing.
      "tests/EntityLeader/RiskRegister/riskRegisterGroupsEntityLeader.spec.js",
      // Vendors last in this worker. It is the only EntityLeader spec that
      // works on the 3RD PARTY side of the client: it creates vendors, not
      // entities, so it moves neither the entity cards UDEL - 01 averages nor
      // the first-party risk total UDEL - 03 asserts, and it reads nothing any
      // worker-1 spec produces. It needs only the client the session already
      // lands in, which is why it can sit anywhere - it is placed last simply
      // to keep the Controls and Risk ordering above untouched.
      "tests/EntityLeader/Vendor/addVendorEntityLeader.spec.js",
      // Third party score calculation, after the vendor spec because both
      // work the same 3rd Party screens and each builds its own vendor - two
      // browsers driving the vendor list at once would be a race neither
      // could see. It reads nothing worker-1 produces and scores only the
      // vendor it creates, so its assertion is unaffected by the rest of the
      // job.
      "tests/EntityLeader/Collection3rdParty/scoreCalculationVendorEntityLeader.spec.js",
      // Comments on the vendor the score calculation spec above built, so it
      // MUST stay after it and in the same invocation - ELS - 01 provisions a
      // new client every run, so a vendor id from a previous run points at a
      // client this session's leader cannot reach.
      "tests/EntityLeader/Collection3rdParty/addCommentVenodrEntityLeader.spec.js",
      // Filters the same vendor's questionnaire, and needs the score
      // calculation spec for BOTH halves of its comparison: SC3PEL - 00 for
      // the vendor UUIDs and SC3PEL - 01 for the answer set that becomes the
      // expected result. Same-invocation rule as the comment spec above.
      "tests/EntityLeader/Collection3rdParty/collectionFiltersVendorEntityLeader.spec.js",
      // Emerging Security Event, last because it is the only 3rd Party spec
      // that depends on nothing - it builds its own vendor and publishes to
      // that vendor alone, since the ESE builder targets whichever vendors are
      // ticked. Kept in this worker rather than worker-1 because it drives the
      // same vendor list as the specs above, which two browsers must not do at
      // once.
      "tests/EntityLeader/Vendor/ESEVendorEntityLeader.spec.js",
      // Vendor Artifacts, last. Self-sufficient like the ESE spec - it builds
      // the two vendors it needs and every action is scoped to them - but it
      // is placed last because VAEL - 01 and VAEL - 05 each sit through a
      // three minute artifact-list rebuild, so it is the spec with the most
      // dead time and belongs where it delays nothing.
      "tests/EntityLeader/Vendor/vendorArtifactEntityLeader.spec.js",
    ],
  },
  // MSSP mirrors the SECURE suite - the role lands on /clients and gets the
  // same screens the admin does, so its coverage is the Secure coverage minus
  // login.spec.js (MSSPS - 01 is this job's login step). Specs are added here
  // in the same order the Secure worker map runs them, since that order is
  // already proven to satisfy their data dependencies.
  // MSSP mirrors the SECURE suite - the role lands on /clients and gets the same
  // screens the admin does, so its coverage is the Secure coverage minus
  // login.spec.js (MSSPS - 01 is this job's login step).
  //
  // The groups below are the SECURE worker groups, file for file and in the
  // same order: that order is already proven to satisfy the suite's data
  // dependencies, and reproducing it is the cheapest way to inherit that.
  // Group numbering is kept from the Secure map (there is no worker-6 or
  // worker-8 there either) so the two maps can be diffed against each other.
  MSSP: {
    "worker-1": [
      "tests/MSSP/addClientMSSP.spec.js",
      "tests/MSSP/addMultiEntityMSSP.spec.js",
      "tests/MSSP/Remediation/remediationMSSP.spec.js",
      "tests/MSSP/FramworkSettings/selectMandatoryOptionsMSSP.spec.js",
      "tests/MSSP/FramworkSettings/selectPartialRepresentationMSSP.spec.js",
      "tests/MSSP/FramworkSettings/selectFooterOptionsMSSP.spec.js",
      "tests/MSSP/FramworkSettings/selectQuestionTypeMSSP.spec.js",
      "tests/MSSP/Collection/scoreCalculationMSSP.spec.js",
      "tests/MSSP/Collection/scoreCalculationFiveMSSP.spec.js",
      "tests/MSSP/Collection/applyFiltersMSSP.spec.js",
      "tests/MSSP/Collection/scoreCalculationPercentageMSSP.spec.js",
      "tests/MSSP/Collection/reviewerScoreCalculationsMSSP.spec.js",
      "tests/MSSP/Collection/verifyReviewerModalMSSP.spec.js",
      "tests/MSSP/Collection/addCommentMSSP.spec.js",
    ],
    "worker-2": [
      "tests/MSSP/addVendorMSSP.spec.js",
      "tests/MSSP/Collection3rdParty/remediation3rdPartyMSSP.spec.js",
      "tests/MSSP/Collection3rdParty/scoreCalculationThirdPartyMSSP.spec.js",
      "tests/MSSP/Collection3rdParty/filtersThirdPartyMSSP.spec.js",
      "tests/MSSP/Collection3rdParty/addArtifactThirdPartyMSSP.spec.js",
      "tests/MSSP/Collection3rdParty/addCommentThirdPartyMSSP.spec.js",
      "tests/MSSP/Collection3rdParty/scoreCalculationVendorMSSP.spec.js",
    ],
    "worker-3": [
      "tests/MSSP/Vendor/bulkUploadMSSP.spec.js",
      "tests/MSSP/Vendor/emergingSercurityEventMSSP.spec.js",
      "tests/MSSP/Vendor/vendorArtifactsMSSP.spec.js",
    ],
    "worker-4": [
      "tests/MSSP/PolicyManagement/policyManagementPoliciesMSSP.spec.js",
      "tests/MSSP/DynamicLabelManagement/dynamicLabelManagementSettingsMSSP.spec.js",
      "tests/MSSP/DynamicLabelManagement/riskRegisterDLMMSSP.spec.js",
      "tests/MSSP/DynamicLabelManagement/riskRegisterFiltersDLMMSSP.spec.js",
      "tests/MSSP/DynamicLabelManagement/policyManagementDLMMSSP.spec.js",
      "tests/MSSP/DynamicLabelManagement/policyManagementFiltersDLMMSSP.spec.js",
      "tests/MSSP/DynamicLabelManagement/dynamicViewMultientityMSSP.spec.js",
    ],
    "worker-5": [],
    "worker-7": [
      "tests/MSSP/Controls/tableMSSP.spec.js",
      "tests/MSSP/Controls/navigatorMSSP.spec.js",
      "tests/MSSP/Controls/filterMSSP.spec.js",
      "tests/MSSP/RiskRegister/riskRegisterRisksMSSP.spec.js",
      "tests/MSSP/RiskRegister/riskRegisterGroupsMSSP.spec.js",
      "tests/MSSP/Upperdeck/upperdeckMSSP.spec.js",
      "tests/MSSP/RemediationSimulation/remediationSimulationMSSP.spec.js",
      "tests/MSSP/RegulatoryWatch/regulatoryWatchMSSP.spec.js",
    ],
    "worker-9": [
      "tests/MSSP/Collection/artifactregistryMSSP.spec.js",
      "tests/MSSP/Collection/reassessmentMSSP.spec.js",
      "tests/MSSP/Collection/startFreshMSSP.spec.js",
      "tests/MSSP/ImportAssessment/importAssessmentMSSP.spec.js",
      "tests/MSSP/ImportAssessment/importAssessmentVendorMSSP.spec.js",
      "tests/MSSP/GlobalControls/globalControlMSSP.spec.js",
      // These have no counterpart in the Secure worker map, so their run
      // order and data dependencies are unproven there too. Appended last
      // rather than interleaved, so they cannot disturb the order above.
      "tests/MSSP/Collection/addAtifactMSSP.spec.js",
      "tests/MSSP/Collection/scoreCalculationSingleMSSP.spec.js",
      "tests/MSSP/PolicyManagement/policyManagementAIMSSP.spec.js",
      "tests/MSSP/PolicyManagement/policyManagementMyActionsMSSP.spec.js",
      "tests/MSSP/PolicyManagement/policyManagementTemplateMSSP.spec.js",
      "tests/MSSP/Vendor/vendorFiltersMSSP.spec.js",
    ],
  },
};

const workers = workersByApp[APP] || {};

const reportBase = "playwright-report/parallel";

function runSpec(name, step, idx) {
  return new Promise((resolve) => {
    const file = typeof step === "string" ? step : step.file;
    const grep = typeof step === "string" ? null : step.grep;
    const reportDir = `${reportBase}/${name}`;
    const jsonOut = path.join(resultsDir, `${name}-${idx}.json`);
    const args = [
      "playwright",
      "test",
      file,
      "--workers=1",
      "--reporter=list,json,allure-playwright",
    ];
    if (grep) args.push("-g", `"${grep}"`);
    const child = spawn("npx", args, {
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        CI: "1",
        PLAYWRIGHT_HTML_REPORT: reportDir,
        PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOut,
        ALLURE_RESULTS_DIR: allureDir,
      },
    });
    child.on("close", (code) => resolve(code === 0));
  });
}

// Each worker group runs its files SEQUENTIALLY (order preserved). A file can be
// a string (full file) or { file, grep } to run only matching tests.
async function runWorker(name, steps) {
  let passed = true;
  for (let i = 0; i < steps.length; i++) {
    const ok = await runSpec(name, steps[i], i);
    if (!ok) passed = false;
  }
  console.log(`\n${passed ? "✅" : "❌"} ${name} finished`);
  return { name, passed, reportDir: `${reportBase}/${name}` };
}

function collectTests(suite, file, out) {
  if (suite.suites) suite.suites.forEach((s) => collectTests(s, file, out));
  (suite.specs || []).forEach((spec) => {
    spec.tests.forEach((t) => {
      const r = t.results[t.results.length - 1] || {};
      out.push({
        title: `${file} › ${spec.title}`,
        status: r.status || "unknown",
        duration: r.duration || 0,
      });
    });
  });
}

function buildMarkdown() {
  const tests = [];
  if (fs.existsSync(resultsDir)) {
    for (const f of fs
      .readdirSync(resultsDir)
      .filter((f) => f.endsWith(".json"))) {
      try {
        const data = JSON.parse(
          fs.readFileSync(path.join(resultsDir, f), "utf-8"),
        );
        (data.suites || []).forEach((s) =>
          collectTests(s, s.title || f, tests),
        );
      } catch (e) {
        console.warn(`Skip ${f}: ${e.message}`);
      }
    }
  }
  const total = tests.length;
  const passed = tests.filter((t) => t.status === "passed").length;
  const failed = tests.filter((t) => t.status === "failed").length;
  const timedOut = tests.filter((t) => t.status === "timedOut").length;
  const skipped = tests.filter((t) => t.status === "skipped").length;
  const rate = total ? Math.round((passed / total) * 100) : 0;
  const icon = (s) =>
    ({
      passed: "✅ passed",
      failed: "❌ failed",
      timedOut: "⏱ timed out",
      skipped: "⏭ skipped",
    })[s] || s;

  // Emit machine-readable stats so downstream steps (e.g. Slack notification)
  // report the exact same numbers as this summary.
  fs.writeFileSync(
    statsFile,
    JSON.stringify({ total, passed, failed, timedOut, skipped, rate }, null, 2),
  );
  let md = `# Test Execution Summary\n\n`;
  md += `**Overall result:** ${failed + timedOut === 0 ? "✅ PASSED" : "❌ FAILED"}  \n`;
  md += `**Date:** ${new Date().toISOString()}  \n\n`;
  md += `| Metric | Count |\n| --- | --- |\n`;
  md += `| Total | ${total} |\n| ✅ Passed | ${passed} |\n| ❌ Failed | ${failed} |\n`;
  md += `| ⏱ Timed out | ${timedOut} |\n| ⏭ Skipped | ${skipped} |\n| Pass rate | ${rate}% |\n\n`;
  md += `## Test Results\n\n| # | Test | Status | Duration |\n| --- | --- | --- | --- |\n`;
  tests.forEach((t, i) => {
    md += `| ${i + 1} | ${t.title} | ${icon(t.status)} | ${(t.duration / 1000).toFixed(1)}s |\n`;
  });
  fs.writeFileSync(summaryFile, md);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  }
  return { total, passed, failed };
}

(async () => {
  fs.rmSync(resultsDir, { recursive: true, force: true });
  fs.mkdirSync(resultsDir, { recursive: true });

  console.log(`Step 1: login for ${APP} (1 worker) -> storageState file`);
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
        CI: "1",
        PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(resultsDir, "login.json"),
        ALLURE_RESULTS_DIR: allureDir,
      },
    },
  );
  if (login.status !== 0) {
    console.error("Login setup failed. Aborting parallel run.");
    process.exit(1);
  }

  console.log(
    `\nStep 2: running ${Object.keys(workers).length} worker groups in parallel...\n`,
  );
  const results = await Promise.all(
    Object.entries(workers).map(([name, files]) => runWorker(name, files)),
  );

  console.log("\nStep 3: building consolidated Markdown summary...");
  const agg = buildMarkdown();

  console.log("Step 4: generating merged Allure report...");
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
    {
      stdio: "inherit",
      shell: true,
    },
  );

  const failed = results.filter((r) => !r.passed);
  console.log("\n================ PARALLEL SUMMARY ================");
  results.forEach((r) =>
    console.log(`  ${r.passed ? "✅" : "❌"} ${r.name} (${r.reportDir})`),
  );
  console.log(
    `  Tests: ${agg.passed}/${agg.total} passed, ${agg.failed} failed`,
  );
  console.log(`  Markdown: ${summaryFile}  |  Allure: ./allure-report`);
  console.log("=================================================");
  process.exit(failed.length ? 1 : 0);
})();
