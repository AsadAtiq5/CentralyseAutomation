const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const RiskRegisterGroupsSubEntityLeader = require("../../../pages/SubEntityLeader/RiskRegister/riskRegisterGroupsSubEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");
const {
  getFilteredGroupCount,
} = require("../../../helpers/riskRegister/riskGroupHelper");

const TIMEOUT = 600000;

const FILE = TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_RISK_GROUPS;
const SCOPE = APP_SCOPE.SUB_ENTITY_LEADER;

// Framework SSEL - 01 provisions this role's entity with. The Secure spec
// stores the identical string from selectBusinessEmailCompromise() and keys the
// backend group counts on it.
const RISK_FRAMEWORK = "Business Email Compromise";

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing - a
// missing key means an earlier test has not run, not a bug in this one.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/SubEntityLeader/RiskRegister/riskRegisterGroupsSubEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Sub Entity Leader Risk Register Groups", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // RRG - 01 HAS NO COUNTERPART HERE, which is why the numbering starts at 02.
  //
  // That test creates a client with NO sub-entity and asserts the risk register
  // refuses it: a "No Subentity Were Found" toast and a redirect back to the
  // multi entity screen. A sub entity leader cannot construct that state at all
  // - it cannot create a client, and it is by definition scoped to a sub-entity
  // that already exists. Porting it would mean asserting a redirect that can
  // never fire for this role, so the number is left as a gap instead.
  //
  // ORDERING - the remaining tests form one chain and run in declaration order.
  //
  // The Secure RRG - 02 creates the sub-entity and then waits three minutes for
  // the backend to generate the automatic risk groups. This role's entity was
  // provisioned by SSEL - 01 long before, so no wait is needed - but the groups
  // still have to be THERE, and that is what RRGSEL - 02 asserts.
  //
  // RRGSEL - 04 creates the group that 05 and 06 act on. 08 and 09 act on a
  // random group from the table. workers: 1 and fullyParallel: false preserve
  // declaration order.
  //
  // Nothing here touches the collection assessment, so this file is safe to run
  // at any point after SSEL - 01.
  let riskGroups;

  test.beforeEach(async ({ page }) => {
    riskGroups = new RiskRegisterGroupsSubEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await riskGroups.goto("/");
    await riskGroups.waitForLoad();
  });

  test("RRGSEL - 02 | @smoke verify risk groups should be visible for the sub entity leader", async () => {
    test.setTimeout(TIMEOUT);

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    // The automatic groups are generated from the entity's risk framework. This
    // is the assertion the Secure spec waits three minutes to be able to make.
    await riskGroups.verifyRiskGroupsVisible();
  });

  test("RRGSEL - 03 | @regression Severity Count From Backend Risk Groups", async () => {
    test.setTimeout(TIMEOUT);

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    const uiTotal = await riskGroups.getSeverityCount("Total");
    const uiCritical = await riskGroups.getSeverityCount("Critical");
    const uiHigh = await riskGroups.getSeverityCount("High");
    const uiMedium = await riskGroups.getSeverityCount("Medium");
    const uiLow = await riskGroups.getSeverityCount("Low");

    // Counts derived from the S3 framework template, never read off the screen
    // the assertion is checking.
    const backendCounts = await getFilteredGroupCount([RISK_FRAMEWORK]);

    console.log(
      `Total    - expected ${backendCounts.total} | actual ${uiTotal}\n` +
        `Critical - expected ${backendCounts.critical} | actual ${uiCritical}\n` +
        `High     - expected ${backendCounts.high} | actual ${uiHigh}\n` +
        `Medium   - expected ${backendCounts.medium} | actual ${uiMedium}\n` +
        `Low      - expected ${backendCounts.low} | actual ${uiLow}`,
    );

    // Soft so one mismatched band does not hide the other four.
    expect.soft(uiTotal, "Total mismatch").toBe(backendCounts.total);
    expect.soft(uiCritical, "Critical mismatch").toBe(backendCounts.critical);
    expect.soft(uiHigh, "High mismatch").toBe(backendCounts.high);
    expect.soft(uiMedium, "Medium mismatch").toBe(backendCounts.medium);
    expect.soft(uiLow, "Low mismatch").toBe(backendCounts.low);
  });

  test("RRGSEL - 04 | @smoke Add new risk group", async () => {
    test.setTimeout(TIMEOUT);

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    await riskGroups.openNewGroupPopup();

    const riskGroupName = await riskGroups.createUniqueGroupName("RG");
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_GROUP_NAME,
      riskGroupName,
      FILE,
      SCOPE,
    );

    // The chosen risks are what the group's detail table has to show back.
    const selectedRiskNames = await riskGroups.selectRandomRisks();

    await riskGroups.createGroupAndWaitForToast();

    await riskGroups.searchGroup(riskGroupName);
    await riskGroups.verifyGroupVisible(riskGroupName);

    await riskGroups.openGroup(riskGroupName);
    await riskGroups.openRisksBox();
    await riskGroups.verifyRisksInDetailTable(selectedRiskNames);
  });

  test("RRGSEL - 05 | @smoke Update group status", async () => {
    test.setTimeout(TIMEOUT);

    const riskGroupName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_GROUP_NAME,
      "RRGSEL - 04",
    );

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    await riskGroups.searchGroup(riskGroupName);
    await riskGroups.openGroup(riskGroupName);

    const selectedStatus = await riskGroups.selectRandomRiskStatus();
    await riskGroups.saveGroup();

    const actualStatus = await riskGroups.getRiskStatusText();
    console.log(
      `Group status - expected ${selectedStatus} | actual ${actualStatus}`,
    );
    expect(actualStatus).toBe(selectedStatus);
  });

  test("RRGSEL - 06 | @regression Add Comment to Risk Group", async () => {
    test.setTimeout(TIMEOUT);

    const riskGroupName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_GROUP_NAME,
      "RRGSEL - 04",
    );
    const testComment = "This is an automated test comment for risk group.";

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    await riskGroups.searchGroup(riskGroupName);
    await riskGroups.openGroup(riskGroupName);

    await riskGroups.addCommentToGroup(testComment);
    await riskGroups.verifyComment(testComment);
  });

  test("RRGSEL - 07 | @regression Severity Count Risk Groups", async () => {
    test.setTimeout(TIMEOUT);

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    // Each band's badge count has to match the rows that band actually leaves
    // on screen. Soft so one mismatched band does not hide the rest.
    for (const severity of ["Total", "Critical", "High", "Medium", "Low"]) {
      const rows = await riskGroups.applySeverityFilterAndCountRows(severity);
      const badgeCount = await riskGroups.getSeverityCount(severity);
      console.log(`${severity} rows - expected ${badgeCount} | actual ${rows}`);
      expect.soft(rows, `${severity} row count mismatch`).toBe(badgeCount);
    }
  });

  test("RRGSEL - 08 | @regression Automatic group deletion", async () => {
    test.setTimeout(TIMEOUT);

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    // Any group from the table, unsearched - the point is that the app refuses
    // to delete an automatic one, so the refusal toast is the assertion.
    await riskGroups.openRandomGroup();
    await riskGroups.attemptDeleteAndExpectRefusal();
  });

  test("RRGSEL - 09 | @regression Archive group", async () => {
    test.setTimeout(TIMEOUT);

    await riskGroups.ensureOnCollection();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.verifyRiskGroupsTitleVisible();

    const archivedGroupName = await riskGroups.openRandomGroupAndGetName();
    console.log(`Archiving group: "${archivedGroupName}"`);

    await riskGroups.archiveGroup();

    // The Archive item is disabled until the entity has an archived group, so
    // this is only reachable now that one exists.
    await riskGroups.navigateToArchiveSection();
    await riskGroups.selectAllRiskGroupsFromDropdown();
    await riskGroups.verifyArchivedGroupInTable(archivedGroupName);
  });
});
