const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const LegacyRemediationPage = require("../../../pages/Secure/RemediationPage");
const RemediationPage = require("../../../pages/Secure/Remediation/RemediationPage");
const RemediationActionsPage = require("../../../pages/Secure/Remediation/RemediationActionsPage");
const RemediationFiltersPage = require("../../../pages/Secure/Remediation/RemediationFiltersPage");
const RemediationScoringPage = require("../../../pages/Secure/Remediation/RemediationScoringPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  ANSWER_ENUM,
  REMEDIATION_ENUMS,
  REMEDIATION_STATUS_ENUMS,
  REMEDIATION_FILTER_ENUMS,
} = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  // Answering every question deliberately (one "No" at a time, each waiting for
  // its own save toast) is far slower than the random-answer flow.
  SETUP: 1800000,
  DEFAULT: 900000,
};

const SCORING_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_SCORING;
const ENTITY_PREFIX = "RMDSEntity";

test.describe("Remediation Scoring and Scale", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let legacyRemediationPage;
  let remediationPage;
  let actionsPage;
  let filtersPage;
  let scoringPage;
  let questionEngine;
  let entityId = "";
  let subEntityName = "";

  test.beforeEach(async ({ page }) => {
    test.setTimeout(TIMEOUTS.SETUP);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    legacyRemediationPage = new LegacyRemediationPage(page);
    remediationPage = new RemediationPage(page);
    actionsPage = new RemediationActionsPage(page);
    filtersPage = new RemediationFiltersPage(page);
    scoringPage = new RemediationScoringPage(page);
    questionEngine = new QuestionEngine(page);

    const isSetupTest = test.info().title.includes("RMDS - 00");
    entityId = TestData.getKey(
      FILE_KEYS.REMEDIATION_SCORING_ENTITY_ID,
      SCORING_FILE,
    );
    const subEntity = TestData.getKey(
      FILE_KEYS.REMEDIATION_SCORING_SUBENTITY,
      SCORING_FILE,
    );
    if (!isSetupTest && entityId && subEntity?.[FILE_KEYS.SUBENTITY_NAME]) {
      subEntityName = subEntity[FILE_KEYS.SUBENTITY_NAME];
      await actionsPage.openRemediationForEntity(entityId, subEntityName);
    }
  });

  // Unlike the other remediation suites this one answers EVERY question "No"
  // (score 0) rather than randomly, so the expected risk task count is exactly
  // the number of questions and the score threshold tests have a clean start.
  test("RMDS - 00 | Setup: create client, sub-entity and answer every question No", async ({
    page,
  }) => {
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.addClient();
    const clientName = TestData.getKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_CLIENT_NAME,
      clientName,
      SCORING_FILE,
    );

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    entityId = fetchPageURL(page.url())[0];
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_ENTITY_ID,
      entityId,
      SCORING_FILE,
    );

    await addEntityPage.goto(`/first-party/${entityId}/multi-entity`);
    await addEntityPage.waitForLoad();
    await addEntityPage.clickNewEntity();
    subEntityName = await addEntityPage.createUniqueEntityName(ENTITY_PREFIX);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_SUBENTITY,
      { [FILE_KEYS.SUBENTITY_NAME]: subEntityName },
      SCORING_FILE,
    );
    await addEntityPage.selectBusinessEmailCompromise();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(subEntityName);

    await remediationPage.goto(`/first-party/${entityId}/collection`);
    await remediationPage.waitForSpinner();
    await addEntityPage.selectEntityAndNavigate(subEntityName);
    await remediationPage.clickFirstEntityOpen();

    const total = await legacyRemediationPage.getNoRadioButtonCount();
    await legacyRemediationPage.answerAllNoQuestions(total);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_ANSWERS,
      { answeredNo: total },
      SCORING_FILE,
    );
    console.log(`Setup complete: ${total} question(s) answered "No".`);
  });

  // Score 0 is below the tenant's remediation threshold of 10, so every
  // answered question has to surface as an open risk task.
  test("RMDS - 01 | @regression Verify every No answer produces an open risk task", async () => {
    const stored = TestData.getKey(
      FILE_KEYS.REMEDIATION_SCORING_ANSWERS,
      SCORING_FILE,
    );
    const count = await scoringPage.getRiskTasksCount();
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_RISK_TASK_COUNT,
      count,
      SCORING_FILE,
    );
    console.log(`expected ${stored?.answeredNo} | actual ${count}`);
    expect(count).toBe(stored?.answeredNo);
  });

  // Records the starting score so the remediation test can prove it moved.
  test("RMDS - 02 | @regression Capture the baseline entity score", async () => {
    const score = await scoringPage.getEntityScore();
    const total = await scoringPage.getEntityTotalScore();
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_INITIAL_SCORE,
      score,
      SCORING_FILE,
    );
    console.log(`Baseline score ${score} out of ${total}`);
    expect(total).toBeGreaterThan(0);
  });

  // "Yes" scores 10, which is the threshold, so re-answering one question Yes
  // must retire exactly one open risk task.
  test("RMDS - 03 | @regression Re-answering a question Yes removes its risk task", async () => {
    const before = TestData.getKey(
      FILE_KEYS.REMEDIATION_SCORING_RISK_TASK_COUNT,
      SCORING_FILE,
    );
    if (!before) {
      throw new Error(
        "No risk task count recorded. Ensure 'RMDS - 01' ran before this test.",
      );
    }
    await remediationPage.goto(`/first-party/${entityId}/collection`);
    await remediationPage.waitForSpinner();
    await addEntityPage.selectEntityAndNavigate(subEntityName);
    await remediationPage.clickFirstEntityOpen();
    const answered = await questionEngine.answerQuestionByLabel(
      0,
      ANSWER_ENUM.YES,
    );
    console.log(`Answered question 1 with "${answered}" (score 10).`);

    await actionsPage.openRemediationForEntity(entityId, subEntityName);
    const after = await scoringPage.getRiskTasksCount();
    console.log(`expected ${before - 1} | actual ${after}`);
    expect(after).toBe(before - 1);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_RISK_TASK_COUNT,
      after,
      SCORING_FILE,
    );
  });

  // "Not Applicable" scores 999, well past the threshold, so it retires a task
  // the same way Yes does.
  test("RMDS - 04 | @regression Re-answering a question Not Applicable removes its risk task", async () => {
    const before = TestData.getKey(
      FILE_KEYS.REMEDIATION_SCORING_RISK_TASK_COUNT,
      SCORING_FILE,
    );
    await remediationPage.goto(`/first-party/${entityId}/collection`);
    await remediationPage.waitForSpinner();
    await addEntityPage.selectEntityAndNavigate(subEntityName);
    await remediationPage.clickFirstEntityOpen();
    const answered = await questionEngine.answerQuestionByLabel(
      1,
      ANSWER_ENUM.NOT_APPLICABLE,
    );
    console.log(`Answered question 2 with "${answered}" (score 999).`);

    await actionsPage.openRemediationForEntity(entityId, subEntityName);
    const after = await scoringPage.getRiskTasksCount();
    console.log(`expected ${before - 1} | actual ${after}`);
    expect(after).toBe(before - 1);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SCORING_RISK_TASK_COUNT,
      after,
      SCORING_FILE,
    );
  });

  // Remediating from the remediation screen answers the question Yes behind the
  // scenes, so the header score has to climb.
  test("RMDS - 05 | @regression Remediating a task raises the entity score", async () => {
    const before = await scoringPage.getEntityScore();
    const card = await actionsPage.findCardByStatus(
      REMEDIATION_STATUS_ENUMS.OPEN,
    );
    await actionsPage.selectCard(card);
    await actionsPage.clickActionButton(REMEDIATION_ENUMS.REMEDIATE);
    await remediationPage.remediateTask(actionsPage.selectors.remediateModal);
    await actionsPage.page.waitForSelector(actionsPage.selectors.taskUpdated, {
      state: "visible",
      timeout: 60000,
    });

    await actionsPage.openRemediationForEntity(entityId, subEntityName);
    await scoringPage.verifyScoreIncreased(before);
  });

  // The list renders 12 cards up front and fetches the next page on scroll.
  test("RMDS - 06 | @regression Verify the task list pages in more cards on scroll", async () => {
    const count = await scoringPage.getRiskTasksCount();
    const rendered = await scoringPage.getRenderedCardCount();
    console.log(
      `total ${count} | rendered ${rendered} | page size ${scoringPage.initialLoadCount}`,
    );
    test.skip(
      count <= scoringPage.initialLoadCount,
      `Entity has only ${count} task(s); nothing to page through.`,
    );
    const { before, after } = await scoringPage.scrollTaskListToEnd();
    expect(after).toBeGreaterThan(before);
  });

  // The app declares a remediation/:subEntityId route; opening it directly has
  // to land on the remediation screen rather than bounce.
  test("RMDS - 07 | @regression Verify the sub-entity deep link opens the remediation screen", async () => {
    const subEntity = TestData.getKey(
      FILE_KEYS.REMEDIATION_SCORING_SUBENTITY,
      SCORING_FILE,
    );
    const route = await scoringPage.openSubEntityDeepLink(
      entityId,
      subEntity?.[FILE_KEYS.SUBENTITY_NAME],
    );
    console.log(`Deep link resolved: ${route}`);
    await expect(
      scoringPage.page.locator(scoringPage.selectors.remediationTopSection),
    ).toBeVisible({ timeout: 60000 });
  });

  // A status no task holds yet must show the tab's empty state, not a stale
  // list left over from the previous filter.
  test("RMDS - 08 | @regression Verify the empty state for a status with no tasks", async () => {
    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      REMEDIATION_FILTER_ENUMS.SECTIONS.STATUS,
      REMEDIATION_FILTER_ENUMS.STATUS.IGNORED,
    );
    await filtersPage.applyFilters();
    await scoringPage.verifyNoTasksMessage();
  });
});
