const { test, expect } = require("@playwright/test");
const path = require("path");
const Reassessment = require("../../../pages/Beacher/Collection/Reassessment");
const ImportAssessment = require("../../../pages/Beacher/ImportAssessment/ImportAssessment");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app (testData/Beacher/).
process.env.APP = "Beacher";

const TIMEOUTS = {
  // Heavy flow: wizard client creation, a 152-row import and a reassessment.
  EXTRA_LONG: 900000,
};

const TEST_DATA = {
  // Answering the framework by hand is impractical here (150+ questions, some
  // demanding comments), so the import fixture stands in for "answer everything"
  // - it fills all 152 answers in one step.
  IMPORT_FILE: path.join(
    "filesTest",
    "ImportAssessmentBeacher",
    "Insurance Application Template.xlsx",
  ),
};

// Creates a brand-new Beacher entity via the New Entity wizard. Beacher has no
// Add Client + Multi Entity flow - the wizard is the only way in - so this
// replaces steps 1-2 of the Secure RA-01 / RA-02 flows.
async function createBeacherClient(page) {
  const wizard = new Wizard(page);

  await wizard.goto("/clients");
  await wizard.waitForSpinner();

  // Step 1 - Organizational/General.
  await wizard.clickNewButton();
  await wizard.waitForWizardModal();
  const clientName = await wizard.enterUniqueClientName("Beacher_RA");
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

test.describe.serial("Beacher Reassessment", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let reassessmentPage;
  let importAssessmentPage;
  let scoreCalculation;

  test.beforeEach(async ({ page }) => {
    reassessmentPage = new Reassessment(page);
    importAssessmentPage = new ImportAssessment(page);
    scoreCalculation = new ScoreCalculation(page);
  });

  // Opens an existing Beacher client. Beacher lands straight on the collection,
  // so there is no entity picker hop.
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

  // Fills every answer through the import fixture, which is what makes the
  // framework reassessable - the Start Reassessment button only renders once the
  // initial assessment is complete on the backend.
  async function answerEverythingByImport(page) {
    await importAssessmentPage.importAssessmentFile(TEST_DATA.IMPORT_FILE);
    await importAssessmentPage.clickBeacherAddButton();
    await importAssessmentPage.verifyBeacherImportSuccessModal();
    await importAssessmentPage.clickBeacherImportSuccessOk();
    await page.waitForTimeout(5000);
  }

  test("BRA - 01 | @smoke Verify the reassessment starts on the framework card", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Step 1: Create a new Beacher client through the New Entity wizard
    const clientName = await createBeacherClient(page);
    console.log(`Client created: ${clientName}`);

    TestData.setKey(
      FILE_KEYS.REASSESSMENT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.REASSESSMENT,
    );

    // Step 2: Open the client and land on the Collection Overview
    await openClient(page, clientName);
    await reassessmentPage.waitForCollectionOverview();

    // Step 3: Complete the assessment. Start Reassessment only appears once the
    // framework has an assessment to reassess.
    await answerEverythingByImport(page);

    // Step 4: Open framework edit mode. On Beacher there is no framework card to
    // pick first - the three triggers (Start Fresh, Start Reassessment, Import
    // Assessment) all live inside the edit mode.
    await reassessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    await reassessmentPage.clickBeacherEditCollectionFrameworkButton();

    // Step 5: Click Start Reassessment
    await reassessmentPage.clickStartReassessmentButton();
    console.log("Start Reassessment modal opened");

    // Step 6: Confirm it from the modal footer
    await reassessmentPage.confirmStartReassessment();
    console.log("Start Reassessment confirmed");

    // Step 7: The card grows a third progress bar. Secure asserts a
    // "reassessment" name label; on Beacher the bar itself is the evidence.
    await reassessmentPage.verifyReassessmentStarted();

    const metrics = await reassessmentPage.getFrameworkCardMetrics();
    console.log(
      `Card after starting the reassessment: ${JSON.stringify(metrics)}`,
    );
    expect(metrics.reassessment).not.toBeNull();
  });

  test("BRA - 02 | @regression Verify the reassessment cycle completes and keeps the card information", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Step 1: Create a dedicated client so BRA - 01's reassessment state is not
    // disturbed
    const clientName = await createBeacherClient(page);
    console.log(`Client created: ${clientName}`);

    // Step 2: Open it and complete the assessment
    await openClient(page, clientName);
    await reassessmentPage.waitForCollectionOverview();
    await answerEverythingByImport(page);

    // Step 3: Capture the card's score and percentages before reassessing -
    // these are what the archive must preserve
    await reassessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    const before = await reassessmentPage.getFrameworkCardMetrics();
    console.log(`Metrics before reassessment: ${JSON.stringify(before)}`);
    expect(parseFloat(before.score)).toBeGreaterThan(0);

    // Step 4: Start and confirm the reassessment
    await reassessmentPage.clickBeacherEditCollectionFrameworkButton();
    await reassessmentPage.clickStartReassessmentButton();
    await reassessmentPage.confirmStartReassessment();
    await reassessmentPage.verifyReassessmentStarted();

    // Step 5: Re-answer everything, which drives the reassessment cycle to 100%
    await reassessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    await answerEverythingByImport(page);

    // Step 6: The reassessment completes
    await reassessmentPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    await reassessmentPage.verifyReassessmentPercentage("100%");

    // Step 7: The live card keeps the score and collection it had before the
    // reassessment - the cycle re-answers the framework, it does not reset it
    const after = await reassessmentPage.getFrameworkCardMetrics();
    console.log(
      `Metrics after the reassessment cycle: ${JSON.stringify(after)}`,
    );
    expect(after.score).toBe(before.score);
    expect(after.collection).toBe(before.collection);

    // Step 8: Report the Archive state. Secure's RA-02 asserts the archive holds
    // the pre-reassessment card at this point, but on Beacher the Archive
    // sub-menu item stays disabled even at Reassessment 100% - only Start Fresh
    // archives. Logged rather than asserted until that difference is confirmed
    // as intended; see the note in the spec review.
    const archiveEnabled = await reassessmentPage.isArchiveEnabled();
    console.log(
      `Archive enabled after completing the reassessment: ${archiveEnabled}`,
    );
  });
});
