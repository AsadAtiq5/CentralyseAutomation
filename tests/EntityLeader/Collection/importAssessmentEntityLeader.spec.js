const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ImportAssessmentEntityLeader = require("../../../pages/EntityLeader/Collection/importAssessmentEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  // No questions are answered by hand in either test - the workbook supplies
  // every answer. The long steps are creating the sub-entity and the
  // post-import sweep through each question set. Larger than the Secure spec's
  // 180000 because IAEL - 01 also provisions the entity.
  LONG: 600000,
};

// Both workbooks target Business Email Compromise, so the scores they produce
// are fixed figures rather than anything derived at runtime.
const IMPORT_FILES = {
  // Answers every question Yes.
  ALL_YES: path.join(
    process.cwd(),
    "filesTest",
    "ImportAssessmentFiles",
    "BusinessEmailComplianceYes.xlsx",
  ),
  // Answers the first question Yes and every other question No.
  FIRST_YES_REST_NO: path.join(
    process.cwd(),
    "filesTest",
    "ImportAssessmentFiles",
    "BusinessEmailComplianceNo.xlsx",
  ),
};

const EXPECTED_SCORES = {
  ALL_YES: "10",
  FIRST_YES_REST_NO: "0.4",
};

const ENTITY_PREFIX = "IAEL_Entity";

// This suite owns its OWN data file. It has to: the import overwrites every
// answer on the framework it targets, so its entity is disposable and must not
// be confused with SCEL_Entity, whose answer set AFEL - 01 still asserts
// against.
const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_IMPORT_ASSESSMENT;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Collection/importAssessmentEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Import Assessment Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ONE NEW SUB-ENTITY, BUILT BY IAEL - 01 AND REUSED BY IAEL - 02.
  //
  // That is the Secure pairing: IA1 - 01 creates the client and multi-entity
  // and hands both to IA1 - 02 through TestData. Here there is no client to
  // create - this role is already inside the one ELS - 01 provisioned - so only
  // the sub-entity is built and handed forward.
  //
  // The two tests MUST run in that order, and not only for the handoff:
  // IAEL - 02 is the UPDATE flow. It imports a second workbook over the answers
  // IAEL - 01 just imported, which is the whole point of the case. It would
  // still pass on a blank assessment, since the workbook supplies every answer,
  // but it would no longer be testing an update. workers: 1 and
  // fullyParallel: false preserve declaration order.
  //
  // WHY A DEDICATED ENTITY, and not the SCEL one: the import OVERWRITES every
  // answer on the framework. Pointing it at SCEL_Entity would destroy the
  // answer set SCEL - 01 recorded, which AFEL - 01 asserts against - the same
  // reason the reassessment suite builds its own.
  let importAssessmentEntityLeader;

  test.beforeEach(async ({ page }) => {
    importAssessmentEntityLeader = new ImportAssessmentEntityLeader(page);
    // Armed before navigating: once the import lands the assessment is fully
    // answered, so the chapter completion modal surfaces part-way through the
    // question sweep and intercepts every click underneath it.
    await importAssessmentEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await importAssessmentEntityLeader.goto("/");
    await importAssessmentEntityLeader.waitForLoad();
  });

  test("IAEL - 01 | @smoke Import Assessment and verify answers on collection", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Business Email Compromise, addressed BY NAME throughout - see the page
    // object on why an exact card-label match is not relied on.
    const frameworkName = ImportAssessmentEntityLeader.DEFAULT_FRAMEWORK;

    // Step 1: Arrival, not navigation - the session puts this role on the
    // upperdeck. This replaces the Secure spec's /clients navigation and client
    // creation entirely.
    await importAssessmentEntityLeader.ensureOnUpperdeck();

    // Step 2: Create the sub-entity this flow imports into.
    await importAssessmentEntityLeader.navigateToMultiEntity();
    const entityName =
      await importAssessmentEntityLeader.createEntityWithBEC(ENTITY_PREFIX);

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_IMPORT_ASSESSMENT_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    console.log(`Saved test data: entityName=${entityName}`);

    // Step 3: Navigate to the collection screen, by name - this client holds
    // many entities, so the dropdown selection has to be explicit.
    await importAssessmentEntityLeader.openEntityCollection(entityName);

    // Step 4/5: Open the edit panel and pick the framework to import into.
    await importAssessmentEntityLeader.openEditFrameworkPanel();
    await importAssessmentEntityLeader.selectFrameworkCard(frameworkName);

    // Step 6/7: Open the Import Assessment modal and step past its first
    // screen.
    await importAssessmentEntityLeader.clickImportAssessment();
    await importAssessmentEntityLeader.openImportModal();

    // Step 8: Hand over the all-Yes workbook.
    await importAssessmentEntityLeader.uploadImportFile(IMPORT_FILES.ALL_YES);

    // Step 9/10: Apply the imported answers and dismiss the success modal. No
    // error border is expected here - every answer in this workbook maps onto
    // an option, unlike the one IAEL - 02 uses.
    await importAssessmentEntityLeader.clickAddButton();
    await importAssessmentEntityLeader.confirmImportSuccess();

    // Step 11: The card score follows from the workbook's answers, so it is a
    // fixed figure rather than something derived from the run.
    await importAssessmentEntityLeader.verifyScoreByName(
      EXPECTED_SCORES.ALL_YES,
      frameworkName,
    );

    // Step 12: Open the assessment and confirm the answers actually landed. The
    // page object owns the assertion and walks every question set.
    await importAssessmentEntityLeader.openFrameworkByName(frameworkName);
    await importAssessmentEntityLeader.verifyAllQuestionsAnsweredYes();
  });

  test("IAEL - 02 | @smoke Import Assessment Update answers flow", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const frameworkName = ImportAssessmentEntityLeader.DEFAULT_FRAMEWORK;

    // The entity IAEL - 01 built, carrying its all-Yes answers. That is what
    // makes this an update rather than a first import.
    const entityName = required(
      FILE_KEYS.ENTITY_LEADER_IMPORT_ASSESSMENT_ENTITY_NAME,
      "IAEL - 01",
    );
    console.log(`Loaded test data: entityName=${entityName}`);

    // Step 1: Arrival. The Secure spec spends its Step 1 re-finding the client
    // it stored; this role has no client to re-find.
    await importAssessmentEntityLeader.ensureOnUpperdeck();

    // Step 2: Navigate to the collection screen for the same entity.
    await importAssessmentEntityLeader.openEntityCollection(entityName);

    // Step 3/4: Open the edit panel and pick the framework to import into.
    await importAssessmentEntityLeader.openEditFrameworkPanel();
    await importAssessmentEntityLeader.selectFrameworkCard(frameworkName);

    // Step 5/6: Open the Import Assessment modal and step past its first
    // screen.
    await importAssessmentEntityLeader.clickImportAssessment();
    await importAssessmentEntityLeader.openImportModal();

    // Step 7: Hand over the workbook that answers the first question Yes and
    // the rest No.
    await importAssessmentEntityLeader.uploadImportFile(
      IMPORT_FILES.FIRST_YES_REST_NO,
    );

    // Step 8: The preview must flag the first question - its Not Applicable
    // answer is the one this workbook cannot map onto an option.
    await importAssessmentEntityLeader.verifyImportErrorBorderVisible();

    // Step 9/10: Apply the imported answers and dismiss the success modal.
    await importAssessmentEntityLeader.clickAddButton();
    await importAssessmentEntityLeader.confirmImportSuccess();

    // Step 11: The score has to have moved off IAEL - 01's figure - that is
    // what shows the update actually replaced the previous answers.
    await importAssessmentEntityLeader.verifyScoreByName(
      EXPECTED_SCORES.FIRST_YES_REST_NO,
      frameworkName,
    );

    // Step 12/13: Open the assessment and confirm the answers actually landed:
    // first question Yes, every remaining question No.
    await importAssessmentEntityLeader.openFrameworkByName(frameworkName);
    await importAssessmentEntityLeader.verifyFirstQuestionYesRestNo();
  });
});
