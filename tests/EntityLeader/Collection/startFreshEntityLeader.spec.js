const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const StartFreshEntityLeader = require("../../../pages/EntityLeader/Collection/startFreshEntityLeader");

const TIMEOUTS = {
  // Heavy flow: creates a sub-entity, answers every question, wipes them and
  // then sweeps every question set again to prove they are gone.
  EXTRA_LONG: 720000,
};

const TEST_DATA = {
  ENTITY_PREFIX: "SFEL_Entity",
};

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

test.describe("Entity Leader Start Fresh Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // THIS SUITE STORES NOTHING, and needs nothing stored.
  //
  // The Secure SF - 01 uses no TestData either: it is one self-contained test
  // that creates everything it needs, answers it, wipes it and asserts on the
  // archive. There is no second test to hand anything to, and the one value
  // that crosses steps - the pre-wipe score - is captured and asserted inside
  // the same test, so a local const is the right home for it.
  //
  // WHY A NEW SUB-ENTITY IS NEEDED HERE. Start Fresh CLEARS every answer on the
  // framework and archives them, and unlike the sub entity leader port this
  // spec also answers the assessment itself. Pointing either half at
  // SCEL_Entity would destroy the answer set SCEL - 01 recorded, which
  // AFEL - 01 asserts against - the same reason the reassessment and import
  // suites build their own.
  //
  // A fresh entity also keeps the two .first() lookups honest: it has exactly
  // one framework and, after this test, exactly one archive.
  let startFreshEntityLeader;

  test.beforeEach(async ({ page }) => {
    startFreshEntityLeader = new StartFreshEntityLeader(page);
    // Armed before navigating: this spec answers a full assessment, so the
    // chapter completion modal surfaces part-way through the question work and
    // intercepts every click underneath it.
    await startFreshEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await startFreshEntityLeader.goto("/");
    await startFreshEntityLeader.waitForLoad();
  });

  test("SFEL - 01 | @smoke Start Fresh - answer collection and edit collection framework", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Business Email Compromise, addressed BY NAME throughout - see the page
    // object on why index 0 and an exact card-label match are not relied on.
    const frameworkName = StartFreshEntityLeader.DEFAULT_FRAMEWORK;

    // Step 1/2: Arrival, not navigation - the session puts this role on the
    // upperdeck. This replaces the Secure spec's /clients navigation, client
    // creation and click-into-client entirely.
    await startFreshEntityLeader.ensureOnUpperdeck();

    // Step 3: Create the sub-entity this flow wipes.
    await startFreshEntityLeader.navigateToMultiEntity();
    const entityName = await startFreshEntityLeader.createEntityWithBEC(
      TEST_DATA.ENTITY_PREFIX,
    );

    // Step 4: Open the Collection, by name - this client holds many entities,
    // so the dropdown selection has to be explicit.
    await startFreshEntityLeader.openEntityCollection(entityName);

    // Step 5: Answer the questions. This is what gives the archive a non-zero
    // score to hold; on an unanswered assessment step 15 would assert nothing.
    await startFreshEntityLeader.openFrameworkByName(frameworkName);
    await startFreshEntityLeader.answerAllQuestions();

    // Step 6/7: Back out to multi entity and into the collection again, so the
    // card score is re-fetched rather than read from the pre-answer render.
    await startFreshEntityLeader.navigateToMultiEntity();
    await startFreshEntityLeader.openEntityCollection(entityName);

    // Step 7a: Save the framework score before wiping it. Captured here and
    // never read back off the screen step 15 asserts on.
    const frameworkScore =
      await startFreshEntityLeader.getScoreByName(frameworkName);
    console.log(`Saved framework score: ${frameworkScore}`);

    // Step 8/9: Open the edit panel and pick the framework to wipe.
    await startFreshEntityLeader.openEditFrameworkPanel();
    await startFreshEntityLeader.selectFrameworkCard(frameworkName);

    // Step 10/11/12: Start Fresh, then confirm it in the footer dialog.
    await startFreshEntityLeader.openStartFreshModal();
    await startFreshEntityLeader.confirmStartFresh();

    // Step 13: Reopen the assessment - every answer must be gone. The page
    // object owns the assertion and walks every page of questions.
    await startFreshEntityLeader.openFrameworkByName(frameworkName);
    await startFreshEntityLeader.verifyAllAnswersRemoved();

    // Step 14/15: The archived card must still carry the pre-wipe score. The
    // Archive menu item is greyed out until the archive actually exists, so the
    // page object waits for it to be enabled rather than merely visible.
    await startFreshEntityLeader.openArchiveWhenReady();
    await startFreshEntityLeader.verifyArchivedCardScoreByName(
      frameworkName,
      frameworkScore,
    );
  });
});
