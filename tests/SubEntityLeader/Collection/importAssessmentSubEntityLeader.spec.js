const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ImportAssessmentSubEntityLeader = require("../../../pages/SubEntityLeader/Collection/importAssessmentSubEntityLeader");

const TIMEOUTS = {
  // No questions are answered by hand in either test - the workbook supplies
  // every answer. The long step is the post-import sweep through each question
  // set. Larger than the Secure spec's 180000 because this role reaches the
  // collection through the session redirect chain rather than a direct URL.
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

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Import Assessment Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - this spec is destructive, and its two tests run in order.
  //
  // Destructive: the import overwrites every answer on Business Email
  // Compromise. This role has ONE assigned entity, provisioned by SSEL - 01 and
  // shared by every spec in the suite, so that also invalidates the answer set
  // SCSEL - 01 stored and AFSEL - 01 reads back. It has to run after both.
  //
  // In order: IASEL - 02 is the UPDATE flow - it imports a second workbook over
  // the answers IASEL - 01 just imported, which is the whole point of the case.
  // It would still pass on a blank assessment, since the workbook supplies every
  // answer, but it would no longer be testing an update. workers: 1 and
  // fullyParallel: false preserve declaration order.
  //
  // The Secure IA1 - 01 and IA1 - 02 get the same pairing by having IA1 - 01
  // create the client and multi-entity and hand both to IA1 - 02 through
  // TestData. This role needs no such handoff - there is one assigned entity and
  // both tests are already on it.
  let importAssessmentSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    importAssessmentSubEntityLeader = new ImportAssessmentSubEntityLeader(page);
    // Armed before navigating: once the import lands the assessment is fully
    // answered, so the chapter completion modal surfaces part-way through the
    // question sweep and intercepts every click underneath it.
    await importAssessmentSubEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await importAssessmentSubEntityLeader.goto("/");
    await importAssessmentSubEntityLeader.waitForLoad();
  });

  test("IASEL - 01 | @smoke Import Assessment and verify answers on collection as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Business Email Compromise, addressed BY NAME throughout: this entity can
    // carry more than one framework, and nothing pins which card the collection
    // paints first.
    const frameworkName = ImportAssessmentSubEntityLeader.DEFAULT_FRAMEWORK;

    // 1) Get to the collection from wherever the restored session landed. This
    //    replaces the whole of the Secure spec's Step 1-3 setup: there is no
    //    client or entity to create and no picker to go through, the leader is
    //    already inside its one assigned entity.
    await importAssessmentSubEntityLeader.ensureOnCollection();

    // 2) Open the edit panel and pick the framework to import into.
    await importAssessmentSubEntityLeader.openEditFrameworkPanel();
    await importAssessmentSubEntityLeader.selectFrameworkCard(frameworkName);

    // 3) Open the Import Assessment modal and step past its first screen.
    await importAssessmentSubEntityLeader.clickImportAssessment();
    await importAssessmentSubEntityLeader.openImportModal();

    // 4) Hand over the all-Yes workbook.
    await importAssessmentSubEntityLeader.uploadImportFile(
      IMPORT_FILES.ALL_YES,
    );

    // 5) Apply the imported answers and dismiss the success modal. No error
    //    border is expected here - every answer in this workbook maps onto an
    //    option, unlike the one IASEL - 02 uses.
    await importAssessmentSubEntityLeader.clickAddButton();
    await importAssessmentSubEntityLeader.confirmImportSuccess();

    // 6) The card score follows from the workbook's answers, so it is a fixed
    //    figure rather than something derived from the run.
    await importAssessmentSubEntityLeader.verifyScoreByName(
      EXPECTED_SCORES.ALL_YES,
      frameworkName,
    );

    // 7) Open the assessment and confirm the answers actually landed. The page
    //    object owns the assertion and walks every question set.
    await importAssessmentSubEntityLeader.openFrameworkByName(frameworkName);
    await importAssessmentSubEntityLeader.verifyAllQuestionsAnsweredYes();
  });

  test("IASEL - 02 | @smoke Import Assessment Update answers flow as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const frameworkName = ImportAssessmentSubEntityLeader.DEFAULT_FRAMEWORK;

    // 1) Get to the collection from wherever the restored session landed. The
    //    Secure spec spends its Step 1-2 re-finding the client and entity it
    //    stored in TestData; this role has neither to re-find.
    await importAssessmentSubEntityLeader.ensureOnCollection();

    // 2) Open the edit panel and pick the framework to import into. It is
    //    carrying IASEL - 01's all-Yes answers at this point, which is what
    //    makes this an update rather than a first import.
    await importAssessmentSubEntityLeader.openEditFrameworkPanel();
    await importAssessmentSubEntityLeader.selectFrameworkCard(frameworkName);

    // 3) Open the Import Assessment modal and step past its first screen.
    await importAssessmentSubEntityLeader.clickImportAssessment();
    await importAssessmentSubEntityLeader.openImportModal();

    // 4) Hand over the workbook that answers the first question Yes and the
    //    rest No.
    await importAssessmentSubEntityLeader.uploadImportFile(
      IMPORT_FILES.FIRST_YES_REST_NO,
    );

    // 5) The preview must flag the first question - its Not Applicable answer
    //    is the one this workbook cannot map onto an option.
    await importAssessmentSubEntityLeader.verifyImportErrorBorderVisible();

    // 6) Apply the imported answers and dismiss the success modal.
    await importAssessmentSubEntityLeader.clickAddButton();
    await importAssessmentSubEntityLeader.confirmImportSuccess();

    // 7) The score has to have moved off IASEL - 01's figure - that is what
    //    shows the update actually replaced the previous answers.
    await importAssessmentSubEntityLeader.verifyScoreByName(
      EXPECTED_SCORES.FIRST_YES_REST_NO,
      frameworkName,
    );

    // 8) Open the assessment and confirm the answers actually landed: first
    //    question Yes, every remaining question No.
    await importAssessmentSubEntityLeader.openFrameworkByName(frameworkName);
    await importAssessmentSubEntityLeader.verifyFirstQuestionYesRestNo();
  });
});
