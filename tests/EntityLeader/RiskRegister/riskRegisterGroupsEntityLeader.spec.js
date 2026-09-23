const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const RiskRegisterGroupsEntityLeader = require("../../../pages/EntityLeader/RiskRegister/riskRegisterGroupsEntityLeader");
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

const ENTITY_PREFIX = "RRGEL_Entity";

// Framework the entity is provisioned with. The Secure spec stores the
// identical string from selectBusinessEmailCompromise() and keys the backend
// group counts on it.
const RISK_FRAMEWORK = RiskRegisterGroupsEntityLeader.DEFAULT_FRAMEWORK;

// The automatic risk groups are generated on the backend after the sub-entity
// is created, and nothing on screen reports when that finishes - the table
// simply stays empty until it does. Inherited from the Secure RRG - 02, which
// waits the same three minutes for the same reason.
const WAIT_FOR_AUTOMATIC_GROUPS = 180000;

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_RISK_GROUPS;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing - a
// missing key means an earlier test has not run, not a bug in this one.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/RiskRegister/riskRegisterGroupsEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Risk Register Groups", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // RRG - 01 HAS NO COUNTERPART HERE, which is why the numbering starts at 02.
  //
  // That test creates a client with NO sub-entity and asserts the risk register
  // refuses it: a "No Subentity Were Found" toast and a redirect back to the
  // multi entity screen. An entity leader cannot create a client, so it cannot
  // construct that state on demand.
  //
  // It is not strictly unreachable for this role - the client ELS - 01
  // provisions genuinely does start with zero sub-entities - but the state
  // survives only until the first spec that creates one, and this file runs in
  // worker-2 alongside a worker-1 that starts by creating four. Covering it
  // would mean pinning this test as the very first thing in worker-1, before
  // the upperdeck spec, and depending on nothing else having run yet. That is
  // worth doing deliberately or not at all, so the number is left as a gap
  // rather than asserted somewhere it will race.
  //
  // ORDERING - the remaining tests form one chain and run in declaration order.
  // RRGEL - 02 builds the sub-entity every other test scopes to; 04 creates the
  // group that 05 and 06 act on; 08 and 09 act on a random group from the
  // table. workers: 1 and fullyParallel: false preserve declaration order.
  //
  // Nothing here touches a collection assessment, so this file disturbs no
  // other EntityLeader spec's data.
  let riskGroups;

  test.beforeEach(async ({ page }) => {
    riskGroups = new RiskRegisterGroupsEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await riskGroups.goto("/");
    await riskGroups.waitForLoad();
  });

  // Every test after the setup starts the same way: arrive, open the groups
  // screen and narrow it to the sub-entity RRGEL - 02 built.
  const openScopedGroups = async () => {
    const entityName = required(
      FILE_KEYS.ENTITY_LEADER_RISK_GROUPS_ENTITY_NAME,
      "RRGEL - 02",
    );
    await riskGroups.ensureOnUpperdeck();
    await riskGroups.navigateToRiskGroups();
    await riskGroups.scopeGroupsToEntity(entityName);
    await riskGroups.verifyRiskGroupsTitleVisible();
    return entityName;
  };

  test("RRGEL - 02 | @smoke verify risk groups should be visible after creating sub entity", async () => {
    test.setTimeout(TIMEOUT);

    // 1. Arrival, not navigation - this replaces the Secure spec's client
    //    search and click-into-client entirely.
    await riskGroups.ensureOnUpperdeck();

    // 2. Create the sub-entity this whole suite reads groups from, on Business
    //    Email Compromise - the framework the automatic groups come from.
    await riskGroups.navigateToMultiEntity();
    const entityName = await riskGroups.createEntityWithBEC(ENTITY_PREFIX);

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_GROUPS_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    console.log(`Saved risk groups entity: "${entityName}"`);

    // 3. Let the backend generate the automatic groups. Nothing on screen says
    //    when that has finished, so this is a fixed wait rather than a
    //    condition - the same one the Secure spec takes.
    console.log("Waiting for the automatic risk groups to be generated...");
    await riskGroups.page.waitForTimeout(WAIT_FOR_AUTOMATIC_GROUPS);

    // 4. Open Risk Register > Groups, scoped to the new entity.
    await riskGroups.navigateToRiskGroups();
    await riskGroups.scopeGroupsToEntity(entityName);
    await riskGroups.verifyRiskGroupsTitleVisible();

    // 5. The automatic groups have to be there. This is the assertion the
    //    three-minute wait exists to make possible.
    await riskGroups.verifyRiskGroupsVisible();
  });

  test("RRGEL - 03 | @regression Severity Count From Backend Risk Groups", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedGroups();

    const uiTotal = await riskGroups.getSeverityCount("Total");
    const uiCritical = await riskGroups.getSeverityCount("Critical");
    const uiHigh = await riskGroups.getSeverityCount("High");
    const uiMedium = await riskGroups.getSeverityCount("Medium");
    const uiLow = await riskGroups.getSeverityCount("Low");

    // Counts derived from the S3 framework template, never read off the screen
    // the assertion is checking. Only comparable because the screen is scoped
    // to one entity - see the note in the page object.
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

  test("RRGEL - 04 | @smoke Add new risk group", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedGroups();

    await riskGroups.openNewGroupPopup();

    const riskGroupName = await riskGroups.createUniqueGroupName("RG");
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_GROUP_NAME,
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

  test("RRGEL - 05 | @smoke Update group status", async () => {
    test.setTimeout(TIMEOUT);

    const riskGroupName = required(
      FILE_KEYS.ENTITY_LEADER_RISK_GROUP_NAME,
      "RRGEL - 04",
    );

    await openScopedGroups();

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

  test("RRGEL - 06 | @regression Add Comment to Risk Group", async () => {
    test.setTimeout(TIMEOUT);

    const riskGroupName = required(
      FILE_KEYS.ENTITY_LEADER_RISK_GROUP_NAME,
      "RRGEL - 04",
    );
    const testComment = "This is an automated test comment for risk group.";

    await openScopedGroups();

    await riskGroups.searchGroup(riskGroupName);
    await riskGroups.openGroup(riskGroupName);

    await riskGroups.addCommentToGroup(testComment);
    await riskGroups.verifyComment(testComment);
  });

  test("RRGEL - 07 | @regression Severity Count Risk Groups", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedGroups();

    // Each band's badge count has to match the rows that band actually leaves
    // on screen. Soft so one mismatched band does not hide the rest.
    for (const severity of ["Total", "Critical", "High", "Medium", "Low"]) {
      const rows = await riskGroups.applySeverityFilterAndCountRows(severity);
      const badgeCount = await riskGroups.getSeverityCount(severity);
      console.log(`${severity} rows - expected ${badgeCount} | actual ${rows}`);
      expect.soft(rows, `${severity} row count mismatch`).toBe(badgeCount);
    }
  });

  test("RRGEL - 08 | @regression Automatic group deletion", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedGroups();

    // Any group from the table, unsearched - the point is that the app refuses
    // to delete an automatic one, so the refusal toast is the assertion.
    await riskGroups.openRandomGroup();
    await riskGroups.attemptDeleteAndExpectRefusal();
  });

  test("RRGEL - 09 | @regression Archive group", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedGroups();

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
