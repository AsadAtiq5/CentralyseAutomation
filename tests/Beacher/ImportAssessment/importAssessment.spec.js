const { test, expect } = require("@playwright/test");
const path = require("path");
const ImportAssessment = require("../../../pages/Beacher/ImportAssessment/ImportAssessment");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const {
  fetchFrameworkCSV,
} = require("../../../helpers/common/getFirstPartyEnumsHelper");
const {
  calculateBeacherScore,
} = require("../../../helpers/collection/beacherScoreHelper");

// Scope this spec's test data to the Beacher app (testData/Beacher/).
process.env.APP = "Beacher";

const TIMEOUTS = {
  // Heavy flow: wizard client creation, a 152-row import and a walk across
  // every question page.
  LONG: 900000,
};

const TEST_DATA = {
  // The only Beacher import fixture. Unlike the Secure files (all-Yes /
  // all-No), it carries a mix of Yes / No / Not Applicable answers.
  IMPORT_FILE: path.join(
    "filesTest",
    "ImportAssessmentBeacher",
    "Insurance Application Template.xlsx",
  ),
  // The framework the wizard selects, used to fetch the scoring CSV.
  FRAMEWORK_NAME: "Insurance Application",
  SCORE_BEFORE_IMPORT: "0.0",
  EXPECTED_QUESTIONS: 152,
};

// Creates a brand-new Beacher entity via the New Entity wizard. Beacher has no
// Add Client + Multi Entity flow - the wizard is the only way in - so this
// replaces steps 1-2 of the Secure IA1-01 flow.
async function createBeacherClient(page) {
  const wizard = new Wizard(page);

  await wizard.goto("/clients");
  await wizard.waitForSpinner();

  // Step 1 - Organizational/General.
  await wizard.clickNewButton();
  await wizard.waitForWizardModal();
  const clientName = await wizard.enterUniqueClientName("Beacher_IA");
  await wizard.enterPrimaryRiskManagementContact("Risk Manager");
  await wizard.clickIndustryDropdown();
  await wizard.verifyIndustryListVisible();
  await wizard.selectIndustry("FINANCIAL SERVICES");
  await wizard.clickNextButton();

  // Step 2 - Financial.
  await wizard.waitForFinancialStep();
  await wizard.enterAnnualRevenue("1000000");
  await wizard.enterAnnualCostOfGoods("500000");
  await wizard.clickNextButton();

  // Step 3 - Frameworks.
  await wizard.waitForFrameworksStep();
  await wizard.selectRiskAssessment("Insurance Application");
  await wizard.clickNextButton();
  await wizard.clickNextButton();

  // Step 5 - Technical.
  await wizard.waitForTechnicalStep();
  await wizard.enterNumberOfServers("10");
  await wizard.enterNumberOfWorkstations("50");
  await wizard.clickNextButton();
  await wizard.clickNextButton();

  // Step 7 - Account Details.
  await wizard.waitForAccountDetailsStep();
  await wizard.clickRenewalDateCalendar();
  await wizard.verifyCalendarDisplayed();
  await wizard.selectCalendarToday();
  await wizard.clickNextButton();

  // Step 8 - Current/Previous Year: calculate and complete.
  await wizard.waitForCurrentPreviousYearStep();
  await wizard.clickCalculateButton();
  await wizard.clickCompleteButton();
  await wizard.verifyEntityCreatedToast();

  return clientName;
}

test.describe.serial("Beacher Import Assessment", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let importAssessmentPage;
  let scoreCalculation;

  test.beforeEach(async ({ page }) => {
    importAssessmentPage = new ImportAssessment(page);
    scoreCalculation = new ScoreCalculation(page);
  });

  // Opens an existing Beacher client from the clients screen. Beacher lands
  // straight on the collection, so there is no entity picker hop.
  async function openClient(page, clientName) {
    await scoreCalculation.goto("/clients");
    await scoreCalculation.waitForSpinner();
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();
    await page.waitForTimeout(3000);
  }

  // Derives the expected collection score from the answers the import actually
  // wrote, using the same Beacher weighted model the score-calculation spec
  // uses (severity weights, the critical-questions formula constant and the
  // whole-framework totalWeightSum). Hardcoding a score here would only ever be
  // valid for one fixture on one pristine client.
  async function calculateExpectedScore(page) {
    const severityCounts = await scoreCalculation.getAllSeverityCounts();
    const answers = await importAssessmentPage.readAnsweredQuestions();
    const frameworkRows = await fetchFrameworkCSV(TEST_DATA.FRAMEWORK_NAME);
    const expectedScore = calculateBeacherScore(answers, frameworkRows, {
      severityCounts,
    });
    console.log(
      `Beacher model -> answers: ${answers.length} | severities: ${JSON.stringify(severityCounts)} | expected score: ${expectedScore}`,
    );
    return { expectedScore, answers };
  }

  test("BIA - 01 | @smoke Import Assessment and verify answers on collection", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    // Step 1: Create a new Beacher client through the New Entity wizard
    const clientName = await createBeacherClient(page);
    console.log(`Client created: ${clientName}`);

    TestData.setKey(
      FILE_KEYS.IMPORT_ASSESSMENT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );

    // Step 2: Open the client and land on the Collection Overview
    await openClient(page, clientName);
    await importAssessmentPage.waitForCollectionOverview();

    // Step 3: A freshly created client scores zero, so the score change below
    // is attributable to the import
    await importAssessmentPage.verifyFrameworkCardScore(
      TEST_DATA.SCORE_BEFORE_IMPORT,
    );

    // Step 4: Open framework edit mode, start Import Assessment and upload the
    // template. On Beacher there is no framework card to pick first - the
    // Import Assessment button lives inside the edit mode.
    await importAssessmentPage.importAssessmentFile(TEST_DATA.IMPORT_FILE);

    // Step 5: The modal previews every mapped answer before ADD; the row count
    // proves the file was parsed rather than silently ignored
    const previewRows = await importAssessmentPage.getImportPreviewRowCount();
    console.log(
      `Preview rows -> expected: ${TEST_DATA.EXPECTED_QUESTIONS} | actual: ${previewRows}`,
    );
    expect(previewRows).toBe(TEST_DATA.EXPECTED_QUESTIONS);

    // Step 6: This fixture maps cleanly, so no row may be flagged. Secure's
    // IA1-02 asserts the opposite using an unmappable file; Beacher has no such
    // fixture yet.
    const errorRows = await importAssessmentPage.getImportErrorBorderCount();
    console.log(`Rows flagged with an error border: ${errorRows}`);
    expect(errorRows).toBe(0);

    // Step 7: Confirm the import and acknowledge the success modal
    await importAssessmentPage.clickBeacherAddButton();
    await importAssessmentPage.verifyBeacherImportSuccessModal();
    await importAssessmentPage.clickBeacherImportSuccessOk();

    // Step 8: Verify the import left no question unanswered. The Beacher
    // template mixes Yes / No / Not Applicable, so - unlike Secure's all-Yes
    // fixture - the assertion is coverage rather than one literal answer.
    await importAssessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    const answered = await importAssessmentPage.verifyAllQuestionsAnswered();
    console.log(
      `Answered questions -> expected: ${TEST_DATA.EXPECTED_QUESTIONS} | actual: ${answered}`,
    );
    expect(answered).toBe(TEST_DATA.EXPECTED_QUESTIONS);

    // Step 9: Calculate what those answers are worth under the Beacher weighted
    // model and verify the UI agrees
    const { expectedScore } = await calculateExpectedScore(page);
    await importAssessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    await importAssessmentPage.verifyFrameworkScoreMatches(expectedScore);
  });

  test("BIA - 02 | @smoke Import Assessment update answers flow", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = TestData.getKey(
      FILE_KEYS.IMPORT_ASSESSMENT_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );
    console.log(`Loaded test data: clientName=${clientName}`);

    // Step 1: Open the client imported into by BIA - 01
    await openClient(page, clientName);
    await importAssessmentPage.waitForCollectionOverview();

    // Step 2: It still carries a score from the BIA - 01 import
    const scoreBefore = await importAssessmentPage.getFrameworkCardScore();
    console.log(`Score carried over from BIA - 01: ${scoreBefore}`);
    expect(parseFloat(scoreBefore)).toBeGreaterThan(0);

    // Step 3: Re-import the same file over the existing answers. This is the
    // update path - Secure covers it with a second fixture that lowers the
    // score; with a single Beacher fixture the check is that a re-import
    // overwrites cleanly and leaves the assessment consistent.
    await importAssessmentPage.importAssessmentFile(TEST_DATA.IMPORT_FILE);

    const previewRows = await importAssessmentPage.getImportPreviewRowCount();
    console.log(
      `Re-import preview rows -> expected: ${TEST_DATA.EXPECTED_QUESTIONS} | actual: ${previewRows}`,
    );
    expect(previewRows).toBe(TEST_DATA.EXPECTED_QUESTIONS);

    // Step 4: Confirm the re-import
    await importAssessmentPage.clickBeacherAddButton();
    await importAssessmentPage.verifyBeacherImportSuccessModal();
    await importAssessmentPage.clickBeacherImportSuccessOk();

    // Step 5: Every question is still answered - the re-import overwrote the
    // answers rather than dropping or duplicating them
    await importAssessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    const answered = await importAssessmentPage.verifyAllQuestionsAnswered();
    console.log(
      `Answered after re-import -> expected: ${TEST_DATA.EXPECTED_QUESTIONS} | actual: ${answered}`,
    );
    expect(answered).toBe(TEST_DATA.EXPECTED_QUESTIONS);

    // Step 6: The score still matches the Beacher weighted model for those
    // answers, and is unchanged from before the re-import
    const { expectedScore } = await calculateExpectedScore(page);
    await importAssessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    await importAssessmentPage.verifyFrameworkScoreMatches(expectedScore);
    console.log(
      `Score before re-import: ${scoreBefore} | after: ${expectedScore}`,
    );
    expect(parseFloat(scoreBefore)).toBe(expectedScore);
  });
});
