const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ReassessmentEntityLeader = require("../../../pages/EntityLeader/Collection/reassessmentEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  // Creating a sub-entity and then waiting for the framework's initial
  // assessment to become ready (the Start Reassessment button appears only once
  // the backend finishes initializing) needs room for the reopen-and-retry loop.
  LONG: 420000,
  // Heavy reassessment flow: creates a sub-entity and answers all questions
  // twice (initial pass + full re-answer), so it needs a much larger budget
  // than RAEL - 01, which never answers a question.
  EXTRA_LONG: 720000,
};

// This suite owns its OWN data file, separate from the score calculation one.
// It has to: starting a reassessment archives the current assessment and resets
// the live one, so its entities are disposable and must not be confused with
// SCEL_Entity, whose answer set AFEL - 01 still asserts against.
const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_REASSESSMENT;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const ENTITY_PREFIX = "RAEL_Entity";
const ARCHIVE_ENTITY_PREFIX = "RAEL_Archive";

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

test.describe("Entity Leader Reassessment Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // EACH TEST BUILDS ITS OWN SUB-ENTITY, and reads nothing from the others.
  //
  // That mirrors the Secure spec, where RA - 01 and RA - 02 each create their
  // own client and entity rather than sharing one. The reason is the same here
  // and it is not tidiness: starting a reassessment ARCHIVES the current
  // assessment and resets the live one, so the target is consumed by the test
  // that uses it. RAEL - 01 leaves its entity mid-reassessment with no answers;
  // RAEL - 02 needs one that has been answered and never reassessed.
  //
  // WHY NOT THE SCEL SUB-ENTITY: for the same reason. Reassessing it would
  // destroy the answer set SCEL - 01 recorded, which AFEL - 01 asserts against.
  // This is the one EntityLeader Collection suite that must NOT share it.
  //
  // What this suite replaces from the Secure spec is only the client creation -
  // this role has no /clients screen and is already inside the client ELS - 01
  // provisioned - so the two tests are otherwise step-for-step ports.
  let reassessmentEntityLeader;

  test.beforeEach(async ({ page }) => {
    reassessmentEntityLeader = new ReassessmentEntityLeader(page);
    // Armed before navigating: this suite answers a full assessment and then
    // re-answers it, so the chapter completion modal is more likely here than
    // anywhere else in this job, and it intercepts every click underneath it.
    await reassessmentEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await reassessmentEntityLeader.goto("/");
    await reassessmentEntityLeader.waitForLoad();
  });

  test("RAEL - 01 | @smoke Verify reassessment icon on the card", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Step 1: Arrival, not navigation - the session puts this role on the
    // upperdeck. This replaces the Secure spec's /clients navigation and client
    // creation entirely.
    await reassessmentEntityLeader.ensureOnUpperdeck();

    // Step 2: Create a new multi-entity for this test to consume.
    await reassessmentEntityLeader.navigateToMultiEntity();
    const entityName =
      await reassessmentEntityLeader.createEntityWithBEC(ENTITY_PREFIX);

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_REASSESSMENT_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    console.log(`Saved test data: entityName=${entityName}`);

    // Step 3: Navigate to the collection screen, by name - this client holds
    // many entities, so the dropdown selection has to be explicit.
    await reassessmentEntityLeader.openEntityCollection(entityName);

    // Step 4/5: Open the edit panel on the Business Email Compromise framework.
    await reassessmentEntityLeader.openReassessmentPanel();

    // Step 6: Click Start Reassessment. A freshly-created framework's initial
    // assessment is not ready on the backend immediately, and the panel does not
    // live-refresh, so the page object reopens it and retries until the button
    // appears.
    await reassessmentEntityLeader.startReassessmentWhenReady(entityName);

    // Step 7: Confirm Start Reassessment in the footer dialog.
    await reassessmentEntityLeader.confirmStartReassessment();

    // Step 8: Verify the reassessment label on the framework card.
    await reassessmentEntityLeader.verifyReassessmentLabelVisible();
  });

  test("RAEL - 02 | @regression Verify the archive information remain the same before reassessment", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Step 1: Arrival, not navigation.
    await reassessmentEntityLeader.ensureOnUpperdeck();

    // Step 2: Create this test's own multi-entity. RAEL - 01 already consumed
    // its own, and this test needs one that has been answered and never
    // reassessed.
    await reassessmentEntityLeader.navigateToMultiEntity();
    const entityName = await reassessmentEntityLeader.createEntityWithBEC(
      ARCHIVE_ENTITY_PREFIX,
    );

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_REASSESSMENT_ARCHIVE_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    console.log(`Saved test data: archiveEntityName=${entityName}`);

    // Step 3: Navigate to the collection screen.
    await reassessmentEntityLeader.openEntityCollection(entityName);

    // Step 4: Open the Business Email Compromise card.
    await reassessmentEntityLeader.openFrameworkCard(0);

    // Step 5: Answer all questions.
    await reassessmentEntityLeader.answerAllQuestions();

    // Step 6/7: Back out to multi entity and into the collection again, so the
    // card figures are re-fetched rather than read from the pre-answer render.
    await reassessmentEntityLeader.navigateToMultiEntity();
    await reassessmentEntityLeader.openEntityCollection(entityName);

    // Step 7a-c: Capture the three figures the archive is compared against.
    const metrics = await reassessmentEntityLeader.getCardMetrics(0);

    // Persisted before the reassessment starts, not after. Once Start
    // Reassessment is confirmed these figures exist only on the archived card -
    // the live one resets - so if the comparison in step 15 fails there is
    // otherwise no record of what was expected.
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_REASSESSMENT_ARCHIVE_SCORE,
      metrics.score,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_REASSESSMENT_ARCHIVE_COLLECTION,
      metrics.collectionPercentage,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_REASSESSMENT_ARCHIVE_REMEDIATION,
      metrics.remediationPercentage,
      FILE,
      SCOPE,
    );

    // Step 8/9: Open the edit panel on the Business Email Compromise framework.
    await reassessmentEntityLeader.openReassessmentPanel();

    // Step 10: Click Start Reassessment. No readiness retry here, unlike
    // RAEL - 01: the assessment has just been answered, which is itself proof
    // the framework finished initializing.
    await reassessmentEntityLeader.startReassessment();

    // Step 11: Confirm Start Reassessment.
    await reassessmentEntityLeader.confirmStartReassessment();

    // Step 12: Open the card again, now on the reset live assessment.
    await reassessmentEntityLeader.openFrameworkCard(0);

    // Step 13: Re-answer every question, forcing a new selection even where one
    // is already set. This is what makes the live assessment diverge from the
    // archived one, so an archive that merely moved with it would be caught.
    await reassessmentEntityLeader.reAnswerAllQuestions();

    // Step 14: Open the Archive.
    await reassessmentEntityLeader.openArchive();

    // Step 15: The archived card must still carry the pre-reassessment figures.
    await reassessmentEntityLeader.verifyArchivedCardData(metrics);
  });
});
