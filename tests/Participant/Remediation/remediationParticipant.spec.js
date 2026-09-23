const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const RemediationParticipantPage = require("../../../pages/Participant/Remediation/RemediationParticipantPage");
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

const PARTICIPANT_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_PARTICIPANT;
const SCOPE = APP_SCOPE.PARTICIPANT;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.participant.json",
);

test.describe("Participant Remediation Access", () => {
  // Runs as the PARTICIPANT, reusing the session the participant setup spec
  // saved. Without that file the run lands on the login screen instead.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  let remediationParticipantPage;
  let entityId = "";

  test.beforeEach(async ({ page }) => {
    test.setTimeout(TIMEOUTS.DEFAULT);
    remediationParticipantPage = new RemediationParticipantPage(page);

    // "/" is enough for this role - the app redirects a participant into their
    // own entity, and the entity id has to be read back off that URL because
    // the role has no management screen to navigate from.
    await remediationParticipantPage.goto("/");
    await remediationParticipantPage.waitForLoad();
    entityId =
      TestData.getKey(
        FILE_KEYS.REMEDIATION_ACTIONS_ENTITY_ID,
        PARTICIPANT_FILE,
        SCOPE,
      ) || fetchPageURL(page.url())[0];
    if (!entityId) {
      throw new Error(
        "Could not resolve the participant's entity id from the landing URL.",
      );
    }
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ENTITY_ID,
      entityId,
      PARTICIPANT_FILE,
      SCOPE,
    );
    await remediationParticipantPage.openRemediation(entityId);
  });

  // A participant gets My Tasks and nothing else - the app removes the other
  // three tabs from the DOM for the role.
  test("RMDPT - 01 | @regression Verify a participant only sees the My Tasks tab", async () => {
    await remediationParticipantPage.verifyMyTasksTabVisible();
    await remediationParticipantPage.verifyTabNotRendered(
      REMEDIATION_ENUMS.RISK_TASK,
    );
    await remediationParticipantPage.verifyTabNotRendered(
      REMEDIATION_ENUMS.COMPLAINCE_TASK,
    );
    await remediationParticipantPage.verifyTabNotRendered(
      REMEDIATION_ENUMS.ADDITIONAL_TASK,
    );
  });

  // The integrations block and the simulation entry point are both admin-only.
  test("RMDPT - 02 | @regression Verify a participant gets no management tools or simulation", async () => {
    await remediationParticipantPage.verifyManagementToolsNotRendered();
    await remediationParticipantPage.verifySimulateRemediationNotRendered();
  });

  // The count has to render even when the participant has nothing assigned,
  // which is the difference between "no tasks" and "screen failed to load".
  test("RMDPT - 03 | @regression Verify the participant My Tasks count renders", async () => {
    const count = await remediationParticipantPage.getMyTasksCount();
    console.log(`expected a number >= 0 | actual ${count}`);
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
