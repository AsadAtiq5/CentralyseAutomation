const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ScoreCalculation = require("../../../pages/Secure/Collection/ScoreCalculation");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const {
  getAnswerOptions,
} = require("../../../helpers/collection/answerOptionsHelper");
const {
  calculateScore,
} = require("../../../helpers/collection/calculateScoreHelper");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  MANDATORY_QUESTION_SETTINGS_VALUE,
} = require("../../../constant/enums");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const ReviewerScoreCalculation = require("../../../pages/Secure/Collection/ReviewerScoreCalculation");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const SelectMandatoryOptions = require("../../../pages/Secure/FrameworkSettings/SelectMandatoryOptions");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 600000,
  // RSC - 01 walks every question twice (answer pass, then reviewer pass), so it
  // needs more headroom than the single-pass specs.
  EXTRA_LONG: 1200000,
  DEFAULT: 60000,
};

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

// IDs of the dedicated client/sub-entity created by this spec's setup test.
// Kept in module scope so the verify test is independent of shared TestData.
let reviewerEntityId = "";
let reviewerSubEntityId = "";

test.describe("Reviewer Answer and Score Calculations - Setup", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let selectMandatoryOptions;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    selectMandatoryOptions = new SelectMandatoryOptions(page);
  });

  test("RSC - 00 | Setup dedicated client and reviewer-all sub-entity", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Create a new dedicated client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("RSC");
    console.log(`Created client: ${clientName}`);
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await addClientPage.waitForToast();
    await page.waitForTimeout(2000);
    await managementPage.waitForSpinner();

    // 2) Open the client and go to Multi Entity
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();

    // 3) Create a sub-entity with BEC risk framework and Reviewer = All
    const entityName = await addEntityPage.createUniqueEntityName("RSCEntity");
    console.log(`Creating entity: ${entityName}`);
    await addEntityPage.selectBusinessEmailCompromise();
    await selectMandatoryOptions.selectMandatoryReviewerByName(
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await page.waitForTimeout(2000);
    await addEntityPage.verifyEntityInList(entityName);
    console.log(`Entity "${entityName}" verified in list`);

    // 4) Navigate into the collection to capture entity/sub-entity IDs
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await page.waitForTimeout(2000);

    const uuids = fetchPageURL(page.url());
    reviewerEntityId = uuids[0];
    reviewerSubEntityId = uuids[1];
    console.log(
      `Setup complete: entityId=${reviewerEntityId}, subEntityId=${reviewerSubEntityId}`,
    );
    expect(reviewerEntityId).toBeTruthy();
    expect(reviewerSubEntityId).toBeTruthy();
  });
});

test.describe("Reviewer Answer and Score Calculations", () => {
  let reviewerScoreCalculation;
  test.beforeEach(async ({ page }) => {
    reviewerScoreCalculation = new ReviewerScoreCalculation(page);
    await reviewerScoreCalculation.goto(
      `/first-party/${reviewerEntityId}/collection/${reviewerSubEntityId}`,
    );
    await reviewerScoreCalculation.waitForLoad();
  });

  test("RSC - 01 | [@regression] Answer the Assessment and verify score", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    const frameworkName = await reviewerScoreCalculation.getFrameworkName(0);
    const answerOption = await getAnswerOptions(frameworkName);

    // Pass 1 - answer every question with no reviewer action. The Approve/Deny
    // footer renders as a live `.round-checkbox` control only on cards that were
    // already answered when they rendered; an unanswered card gets a
    // `.round-checkbox-viewmode` footer with `pointer-events: none`, so the
    // reviewer action cannot be taken in the same pass that answers the question.
    const answered = await reviewerScoreCalculation.answerAllQuestions(false);

    // Re-enter the collection so every card re-renders in its answered state and
    // the reviewer radios become clickable
    await reviewerScoreCalculation.goto(
      `/first-party/${reviewerEntityId}/collection/${reviewerSubEntityId}`,
    );
    await reviewerScoreCalculation.waitForLoad();
    await reviewerScoreCalculation.getFrameworkName(0);

    // Pass 2 - every question is already answered, so QuestionEngine takes its
    // already-answered branch, reads the saved answer, and goes straight to the
    // Approve/Deny radios
    const reviewed = await reviewerScoreCalculation.answerAllQuestions(true);

    // Merge on questionNo: pass 2 carries the reviewer status, pass 1 carries
    // partialValue, which the already-answered branch never captures and
    // calculateScore needs to score a Partial answer
    const byQuestionNo = new Map(answered.map((a) => [a.questionNo, a]));
    const answers = reviewed.map((r) => ({
      ...byQuestionNo.get(r.questionNo),
      ...r,
    }));

    // calculate expected score
    const totalScore = calculateScore(answers, answerOption);

    // get score from UI
    const score = await reviewerScoreCalculation.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    //round totalScore to 1 decimal and convert to number
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));
    // Assert that UI score matches calculated score
    TestData.setKey(
      FILE_KEYS.REVIEWER_SCORE_CALCULATION,
      answers,
      TEST_DATA_FILE_ENUMS.COLLECTION,
    );
    expect(uiScore).toBe(roundedTotalScore);
  });
});
