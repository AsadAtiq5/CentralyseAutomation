const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const SelectMandatoryOptions = require("../../../pages/Secure/FrameworkSettings/SelectMandatoryOptions");
const ScoreCalculation = require("../../../pages/Secure/Collection/ScoreCalculation");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  SCORE_BASE,
  MANDATORY_QUESTION_SETTINGS_NAME,
  MANDATORY_QUESTION_SETTINGS_VALUE,
} = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const {
  getAnswerOptions,
} = require("../../../helpers/collection/answerOptionsHelper");
const {
  calculateScoreFive,
} = require("../../../helpers/collection/calculateScoreHelper");

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 1200000,
  DEFAULT: 60000,
};

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Score Calculation Five - Setup", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let suggested;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    suggested = new SelectMandatoryOptions(page);
  });

  test("SCF - 01 | @smoke Setup Client with 0-5 Score Base", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    await managementPage.goto("/clients");
    await managementPage.waitForLoad();

    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();

    const clientName = await addClientPage.createUniqueClientName("SC5");
    TestData.setKey(
      FILE_KEYS.SCORE_FIVE_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.SCORE_FIVE,
    );
    console.log(`Created client: ${clientName}`);

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.selectScoringBase(SCORE_BASE.ONE_TO_FIVE);
    await addClientPage.clickAddClientButton();
    await addClientPage.waitForToast();
    await page.waitForTimeout(2000);
    await managementPage.waitForSpinner();

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();

    const entityName = await addEntityPage.createUniqueEntityName("SC5E");
    console.log(`Creating entity: ${entityName}`);

    await addEntityPage.selectBusinessEmailCompromise();

    await suggested.selectOptionFramework(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );

    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await page.waitForTimeout(2000);
    await addEntityPage.verifyEntityInList(entityName);
    console.log(`Entity "${entityName}" verified in list`);

    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await page.waitForTimeout(2000);

    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.SCORE_FIVE_ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.SCORE_FIVE,
      );
      if (uuids.length > 1) {
        TestData.setKey(
          FILE_KEYS.SCORE_FIVE_SUBENTITY,
          { subEntityId: uuids[1], subEntityName: entityName },
          TEST_DATA_FILE_ENUMS.SCORE_FIVE,
        );
      }
    }
    console.log("Setup complete: entity and subentity IDs saved");
  });
});

test.describe("Score Calculation Five - Verify", () => {
  let scoreCalculationPage;
  let collectionPage;
  let questionEngine;

  test.beforeEach(async ({ page }) => {
    scoreCalculationPage = new ScoreCalculation(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);

    const entityID = TestData.getKey(
      FILE_KEYS.SCORE_FIVE_ENTITY_ID,
      TEST_DATA_FILE_ENUMS.SCORE_FIVE,
    );
    const subEntityID = TestData.getKey(
      FILE_KEYS.SCORE_FIVE_SUBENTITY,
      TEST_DATA_FILE_ENUMS.SCORE_FIVE,
    );

    await scoreCalculationPage.goto(
      `/first-party/${entityID}/collection/${subEntityID?.subEntityId}`,
    );
    await scoreCalculationPage.waitForLoad();
  });

  test("SCF - 02 | @regression Verify Score 0-5", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const frameworkName = await collectionPage.getFrameworkName(0);
    const answerOption = await getAnswerOptions(frameworkName);

    const answers = await questionEngine.answerAllQuestions();

    const totalScore = calculateScoreFive(answers, answerOption);

    const score = await scoreCalculationPage.getScore(0);
    const uiScore = score ? Number.parseFloat(score) : 0;
    const roundedTotalScore = Number.parseFloat(totalScore.toFixed(1));

    TestData.setKey(
      FILE_KEYS.SCORE_FIVE_ANSWERS,
      answers,
      TEST_DATA_FILE_ENUMS.SCORE_FIVE,
    );
    expect(uiScore).toBe(roundedTotalScore);
  });
});
