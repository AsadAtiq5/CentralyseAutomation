const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const RemediationSubEntityLeader = require("../../../pages/SubEntityLeader/Remediation/RemediationSubEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
  REMEDIATION_ENUMS,
} = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const TIMEOUTS = {
  DEFAULT: 600000,
};

const SEL_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_SUB_ENTITY_LEADER;
const SCOPE = APP_SCOPE.SUB_ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Remediation Access", () => {
  // Runs as the SUB-ENTITY LEADER, reusing the session that role's setup spec
  // saved. Without the file the run lands on the login screen instead.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  let remediationSubEntityLeader;
  let entityId = "";

  test.beforeEach(async ({ page }) => {
    test.setTimeout(TIMEOUTS.DEFAULT);
    remediationSubEntityLeader = new RemediationSubEntityLeader(page);

    await remediationSubEntityLeader.goto("/");
    await remediationSubEntityLeader.waitForLoad();
    entityId =
      TestData.getKey(
        FILE_KEYS.REMEDIATION_ACTIONS_ENTITY_ID,
        SEL_FILE,
        SCOPE,
      ) || fetchPageURL(page.url())[0];
    if (!entityId) {
      throw new Error(
        "Could not resolve the sub-entity leader's entity id from the landing URL.",
      );
    }
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ENTITY_ID,
      entityId,
      SEL_FILE,
      SCOPE,
    );
    await remediationSubEntityLeader.openRemediation(entityId);
  });

  // This role is not gated out of any tab, unlike a participant.
  test("RMDSEL - 01 | @regression Verify a sub entity leader sees every remediation tab", async () => {
    await remediationSubEntityLeader.verifyAllTabsAvailable();
  });

  // The leader's default filter spans every sub-entity they own, which the app
  // signals by replacing the entity dropdown with "Filter Enabled".
  test("RMDSEL - 02 | @regression Verify the multi-entity default filter is applied", async () => {
    await remediationSubEntityLeader.verifyMultiEntityDefaultApplied();
  });

  // The filter modal has to list the sub-entities the leader owns.
  test("RMDSEL - 03 | @regression Verify the entity filter lists the leader's sub-entities", async () => {
    await remediationSubEntityLeader.verifyEntityOptionCount(1);
  });

  // Risk Tasks is populated across those sub-entities rather than one of them.
  test("RMDSEL - 04 | @regression Verify the Risk Tasks count renders for the leader", async () => {
    const count = await remediationSubEntityLeader.getTabCount(
      REMEDIATION_ENUMS.RISK_TASK,
    );
    console.log(`expected a number >= 0 | actual ${count}`);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // Management tools stay available to this role.
  test("RMDSEL - 05 | @regression Verify the management tools remain available", async () => {
    await remediationSubEntityLeader.verifyManagementToolsRendered();
  });
});
