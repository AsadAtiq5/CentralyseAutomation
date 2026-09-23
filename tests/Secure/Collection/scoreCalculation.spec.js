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
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 1200000,
  DEFAULT: 60000,
};

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe.serial("Score Calculation Tests", () => {
  let scoreCalculationPage;
  let collectionPage;
  let questionEngine;
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let entityID = "";
  let subEntityID = "";

  test.beforeEach(async ({ page }) => {
    scoreCalculationPage = new ScoreCalculation(page);
    collectionPage = new CollectionPage(page);
    managementPage = new ManagementPage(page);
    questionEngine = new QuestionEngine(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);

    entityID = TestData.getKey(
      FILE_KEYS.SCORE_CALCULATION_ENTITY_ID,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
    );
    subEntityID = TestData.getKey(
      FILE_KEYS.SCORE_CALCULATION_SUBENTITY_ID,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
    );

    // If both IDs are already saved (setup has run), navigate directly to the collection page.
    if (entityID && subEntityID) {
      await scoreCalculationPage.goto(
        `/first-party/${entityID}/collection/${subEntityID}`,
      );
      await scoreCalculationPage.waitForLoad();
    }
    // For SC - 00 (setup), the hook doesn't navigate, setup test handles it
  });

  // ─── SMOKE ─────────────────────────────────────────────────────────────────
  // This test is fully standalone: it creates its own client, creates a sub-entity,
  // and saves the IDs to testData for use by regression tests below.
  // *** MUST RUN FIRST IN SERIAL MODE ***
  test("SC - 00 | @smoke Setup: Create Client and Sub-Entity", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1. Navigate to clients
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();

    // 2. Create a dedicated client for score calculation tests
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("ScoreCalc");
    TestData.setKey(
      FILE_KEYS.SCORE_CALCULATION_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await page.waitForTimeout(2000);
    await managementPage.waitForSpinner();

    // 3. Search and click the client
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // 4. Navigate to multi-entity and create a sub-entity
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();

    const subEntityName =
      await addEntityPage.createUniqueEntityName("ScoreCalc");
    await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);

    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await page.waitForTimeout(2000);
    await addEntityPage.verifyEntityInList(subEntityName);
    console.log(`Sub-entity "${subEntityName}" verified in list`);

    // 5. Navigate to collection and select entity
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(subEntityName);
    await page.waitForTimeout(2000);

    // 6. Extract UUIDs from collection URL and save them
    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.SCORE_CALCULATION_ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
      );
      if (uuids.length > 1) {
        TestData.setKey(
          FILE_KEYS.SCORE_CALCULATION_SUBENTITY_ID,
          uuids[1],
          TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
        );
      }
    }
    console.log("Setup complete: entity and subentity IDs saved");
  });

  // ─── REGRESSION ────────────────────────────────────────────────────────────
  // Tests below only run AFTER SC - 00 completes (serial mode).
  // beforeEach now navigates directly to the collection page using IDs from testData.
  // ─────────────────────────────────────────────────────────────────────────

  test("SC - 01 | @regression Answer the Assessment and verify score", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const frameworkName = await collectionPage.getFrameworkName(0);
    const answerOption = await getAnswerOptions(frameworkName);

    const answers = await questionEngine.answerAllQuestions();

    // Reload the screen and wait for it to completely load
    console.log("🔄 Reloading page to refresh score display...");
    await scoreCalculationPage.page.reload();
    await scoreCalculationPage.waitForLoad();
    await scoreCalculationPage.page.waitForTimeout(2000);
    console.log("✅ Page reloaded and ready");

    // calculate expected score
    const totalScore = calculateScore(answers, answerOption, false);

    // get score from UI
    const score = await scoreCalculationPage.getScore(0);

    const uiScore = score ? parseFloat(score) : 0;
    //round totalScore to 1 decimal and convert to number
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));

    // Log both scores for comparison
    console.log("═══════════════════════════════════════════════════════════");
    console.log(`📊 SCORE CALCULATION RESULTS`);
    console.log(`Framework: ${frameworkName}`);
    console.log(`Backend Score (Calculated): ${roundedTotalScore}`);
    console.log(`UI Score (From Display): ${uiScore}`);
    console.log(
      `Match: ${uiScore === roundedTotalScore ? "✅ PASS" : "❌ FAIL"}`,
    );
    console.log("═══════════════════════════════════════════════════════════");

    // Assert that UI score matches calculated score
    TestData.setKey(
      FILE_KEYS.SCORE_CALCULATION_ANSWERS,
      answers,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
    );
    expect(uiScore).toBe(roundedTotalScore);
  });
});
