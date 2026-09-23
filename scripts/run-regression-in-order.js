#!/usr/bin/env node
/**
 * Runs regression test files in a fixed order, one after the other.
 * Continues to the next file even if one fails (full regression run).
 * Does not open the report on failure; reports are listed at the end.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const testFiles = [
  "tests/Secure/login.spec.js",
  "tests/Secure/addClient.spec.js",
  // "tests/Secure/PolicyManagement/policyManagementAI.spec.js",
  // "tests/Secure/PolicyManagement/policyManagementTemplate.spec.js",
  // "tests/Secure/Upperdeck/upperdeck.spec.js",
  // "tests/Secure/addMultiEntity.spec.js",
  // "tests/Secure/Remediation/remediation.spec.js",
  // "tests/Secure/FramworkSettings/selectMandatoryOptions.spec.js",
  // "tests/Secure/FramworkSettings/selectPartialRepresentation.spec.js",
  // "tests/Secure/FramworkSettings/selectFooterOptions.spec.js",
  // "tests/Secure/FramworkSettings/selectQuestionType.spec.js",
  // "tests/Secure/Collection/scoreCalculation.spec.js",
  // "ests/Collection/scoreCalculationFive.spec.js",
  // "tests/Secure/Collection/applyFilters.spec.js",
  // "tests/Secure/Collection/scoreCalculationPercentage.spec.js",
  // "tests/Secure/Collection/reviewerScoreCalculations.spec.js",
  // "tests/Secure/Collection/verifyReviewerModal.spec.js",
  // "tests/Secure/Collection/addComment.spec.js",
  // "tests/Secure/Collection/artifactregistry.spec.js",
  // "tests/Secure/Collection/reassessment.spec.js",
  // "tests/Secure/Collection/startFresh.spec.js",
  // "tests/Secure/RiskRegister/riskRegisterRisks.spec.js",
  // "tests/Secure/RiskRegister/riskRegisterGroups.spec.js",
  // "tests/Secure/instanceSetting.spec.js",
  // "tests/Secure/addVendor.spec.js",
  // "tests/Secure/Collection3rdParty/remediation3rdParty.spec.js",
  // "tests/Secure/Collection3rdParty/scoreCalculationThirdParty.spec.js",
  // "tests/Secure/Collection3rdParty/filtersThirdParty.spec.js",
  // "tests/Secure/Collection3rdParty/addCommentThirdParty.spec.js",
  // "tests/Secure/Collection3rdParty/addArtifactThirdParty.spec.js",
  // "tests/Secure/Collection3rdParty/scoreCalculationVendor.spec.js",
  // "tests/Secure/Vendor/bulkUpload.spec.js",
  // "tests/Secure/Vendor/emergingSercurityEvent.spec.js",
  // "tests/Secure/Vendor/vendorArtifacts.spec.js",
  // "tests/Secure/RegulatoryWatch/regulatoryWatch.spec.js",
  // "tests/Secure/ImportAssessment/importAssessment.spec.js",
  // "tests/Secure/ImportAssessment/importAssessmentVendor.spec.js",
  // "tests/Secure/Controls/table.spec.js",
  // "tests/Secure/Controls/navigator.spec.js",
  // "tests/Secure/Controls/filter.spec.js",
  // "tests/Secure/GlobalControls/globalControl.spec.js",
  // "tests/Secure/DynamicLabelManagement/dynamicLabelManagementSettings.spec.js",
  // "tests/Secure/DynamicLabelManagement/policyManagementDLM.spec.js",
  // "tests/Secure/DynamicLabelManagement/policyManagementFiltersDLM.spec.js",
  // "tests/Secure/DynamicLabelManagement/riskRegisterDLM.spec.js",
  // "tests/Secure/DynamicLabelManagement/riskRegisterFiltersDLM.spec.js",
  // "tests/Secure/RemediationSimulation/remediationSimulation.spec.js",
  // "tests/Secure/DynamicLabelManagement/dynamicViewMultientity.spec.j",
  // "tests/Secure/Settings/addAdminUser.spec.js",
  // "tests/Secure/Settings/addEntityLeader.spec.js",
  // "tests/Secure/Settings/addMSSPUser.spec.js",
  // "tests/Secure/Settings/addSubEntityLeader.spec.js",
  // "tests/Secure/Settings/customRole.spec.js",
];

const reportBase = "playwright-report/regression";
const results = []; // { name, passed, reportDir, failedTests: string[] }

// Playwright list reporter prints failed tests like: "  1) [chromium] › file:line:col › suite › test name"
function parseFailedTests(output) {
  if (!output) return [];
  const lines = (typeof output === "string" ? output : output.toString()).split(
    "\n",
  );
  const failed = [];
  const re = /^\s*\d+\)\s+\[.*?\]\s*›\s*(.+)$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) failed.push(m[1].trim());
  }
  return failed;
}

for (const file of testFiles) {
  const name = path.basename(file, ".spec.js");
  const reportDir = `${reportBase}/${name}`;
  console.log("\n------------------------------------------------");
  console.log(`Running: ${file}`);
  console.log("------------------------------------------------\n");
  const result = spawnSync("npx", ["playwright", "test", file, "--workers=1"], {
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    env: {
      ...process.env,
      CI: "1",
      PLAYWRIGHT_HTML_REPORT: reportDir,
    },
  });
  const out = (result.stdout && result.stdout.toString()) || "";
  const err = (result.stderr && result.stderr.toString()) || "";
  process.stdout.write(out);
  process.stderr.write(err);
  const passed = result.status === 0;
  const failedTests = passed ? [] : parseFailedTests(err || out);
  results.push({ name, passed, reportDir, failedTests });
  if (!passed) {
    console.log(
      `\n❌ ${name} failed (exit ${result.status}). Continuing to next suite...\n`,
    );
  } else {
    console.log(`\n✅ ${name} passed.\n`);
  }
}

const failedCount = results.filter((r) => !r.passed).length;
console.log("\n================================================");
console.log("           REGRESSION RUN SUMMARY");
console.log("================================================");
console.log(`Total suites: ${results.length}`);
console.log(`Passed:      ${results.length - failedCount}`);
console.log(`Failed:      ${failedCount}`);
console.log("================================================");
console.log("\nResults:");
results.forEach((r) => {
  console.log(`  ${r.passed ? "✅" : "❌"} ${r.name}`);
});
if (failedCount > 0) {
  console.log("\nFailed test cases by spec:");
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`\n  ❌ ${r.name} (${r.reportDir})`);
      if (r.failedTests && r.failedTests.length > 0) {
        r.failedTests.forEach((t) => console.log(`      • ${t}`));
      } else {
        console.log("      (failed test names could not be parsed)");
      }
    });
  console.log("\nFailed suite reports:");
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      const exists = fs.existsSync(r.reportDir);
      console.log(`  - ${r.reportDir}${exists ? "" : " (generating...)"}`);
    });
}
console.log("\nReports saved under: playwright-report/regression/<suite-name>");
console.log(
  "To view a report: npx playwright show-report playwright-report/regression/<suite-name>",
);
console.log("================================================\n");
process.exit(failedCount > 0 ? 1 : 0);
