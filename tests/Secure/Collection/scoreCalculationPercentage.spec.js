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
  QUESTION_SETTING_PARTIAL_REPRESENTATION_TYPE,
} = require("../../../constant/enums");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const SelectPartialRepresentation = require("../../../pages/Secure/FrameworkSettings/selectPartialRepresentation");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 180000,
  EXTRA_LONG: 360000, // Percentage flow has many questions + sliders
  DEFAULT: 60000,
};

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

// IDs of the dedicated client/sub-entity created by this spec's setup test.
// Kept in module scope so the verify test is independent of shared TestData.
let percentageEntityId = "";
let percentageSubEntityId = "";

test.describe("Score Calculation Percentage - Setup", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let selectPartialRepresentation;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    selectPartialRepresentation = new SelectPartialRepresentation(page);
  });

  test("SCP - 00 | Setup dedicated client and percentage sub-entity", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // 1) Create a new dedicated client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("SCP");
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

    // 3) Create a sub-entity with BEC risk framework and Percentage representation
    const entityName = await addEntityPage.createUniqueEntityName("SCPEntity");
    console.log(`Creating entity: ${entityName}`);
    await addEntityPage.selectBusinessEmailCompromise();
    await selectPartialRepresentation.selectPartialRepresentation(
      QUESTION_SETTING_PARTIAL_REPRESENTATION_TYPE.PERCENTAGE,
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
    percentageEntityId = uuids[0];
    percentageSubEntityId = uuids[1];
    console.log(
      `Setup complete: entityId=${percentageEntityId}, subEntityId=${percentageSubEntityId}`,
    );
    expect(percentageEntityId).toBeTruthy();
    expect(percentageSubEntityId).toBeTruthy();
  });
});

test.describe("Score Calculation Percentage", () => {
  let scoreCalculationPage;
  let collectionPage;
  let questionEngine;

  test.beforeEach(async ({ page }) => {
    scoreCalculationPage = new ScoreCalculation(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);

    await scoreCalculationPage.goto(
      `/first-party/${percentageEntityId}/collection/${percentageSubEntityId}`,
    );
    await scoreCalculationPage.waitForLoad();
  });

  test("SCP - 01 | Verify score calculation for percentage type", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);
    const frameworkName = await collectionPage.getFrameworkName(0);
    const answerOption = await getAnswerOptions(frameworkName);

    const answers = await questionEngine.answerAllQuestions(false, true);

    // calculate expected score
    const totalScore = calculateScore(answers, answerOption, true);

    // get score from UI
    const score = await scoreCalculationPage.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    //round totalScore to 1 decimal and convert to number
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));
    // Assert that UI score matches calculated score
    TestData.setKey(
      FILE_KEYS.COLLABORATIVE_PERCENTAGE_SCORE_CALCULATION,
      answers,
      TEST_DATA_FILE_ENUMS.COLLECTION,
    );
    expect(uiScore).toBe(roundedTotalScore);
  });
});
