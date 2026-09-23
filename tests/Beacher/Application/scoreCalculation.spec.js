const { test, expect } = require("@playwright/test");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const {
  fetchFrameworkCSV,
} = require("../../../helpers/common/getFirstPartyEnumsHelper");
const {
  calculateBeacherScore,
} = require("../../../helpers/collection/beacherScoreHelper");

// Scope test data to the Beacher app (reads from testData/Beacher/).
process.env.APP = "Beacher";

test.describe("Beacher Score Calculation Tests", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let scoreCalculation;
  let questionEngine;

  test.beforeEach(async ({ page }) => {
    scoreCalculation = new ScoreCalculation(page);
    questionEngine = new QuestionEngine(page);
    // Auto-login (via storageState) lands us on the app; open the clients screen.
    await scoreCalculation.goto("/clients");
    await scoreCalculation.waitForSpinner();
  });

  test("SC - 01 | @regression Search, open the client, filter Critical and answer the questions", async () => {
    test.setTimeout(1200000);

    // Client created by the wizard flow.
    const clientName = TestData.getKey(
      FILE_KEYS.WIZARD_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    // Search for the client (types char-by-char, no .fill()).
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);

    // Wait for the card to be filtered, then open it (collection opens by default).
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();
    // Collection Overview loads slowly; wait for the questions to render.
    await scoreCalculation.waitForQuestions();

    // 1) Read the per-severity question counts (for the full-framework totalWeightSum).
    const severityCounts = await scoreCalculation.getAllSeverityCounts();

    // 2) Filter the collection by Critical severity and answer every question.
    await scoreCalculation.clickFilterButton();
    await scoreCalculation.verifyFiltersModal();
    await scoreCalculation.selectSeverity("Critical");
    await scoreCalculation.clickApplyFilter();
    await scoreCalculation.waitForQuestions();

    const answers = await questionEngine.answerAllUniqueQuestions();
    TestData.setKey(
      FILE_KEYS.WIZARD_SCORE_ANSWERS,
      answers,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    // 3) Compute the expected score and verify against the UI.
    const frameworkName = TestData.getKey(
      FILE_KEYS.WIZARD_RISK_ASSESSMENT,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );
    const frameworkRows = await fetchFrameworkCSV(frameworkName);
    const expectedScore = calculateBeacherScore(answers, frameworkRows, {
      severityCounts,
    });

    // Read the score from the UI and compare.
    await scoreCalculation.waitForSpinner();
    const uiScoreText = await scoreCalculation.getCollectionScore();
    const uiScore = uiScoreText ? parseFloat(uiScoreText) : 0;
    console.log(`Expected score: ${expectedScore} | UI score: ${uiScore}`);
    expect(uiScore).toBe(expectedScore);
  });
});
