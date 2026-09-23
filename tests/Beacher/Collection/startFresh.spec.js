const { test, expect } = require("@playwright/test");
const StartFresh = require("../../../pages/Beacher/Collection/StartFresh");
const LockAssessment = require("../../../pages/Beacher/LockAssessment/LockAssessment");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");

// Scope this spec's test data to the Beacher app (testData/Beacher/).
process.env.APP = "Beacher";

const TIMEOUTS = {
  // Heavy flow: creates a client through the wizard, answers, resets and walks
  // every question page verifying the answers are gone.
  EXTRA_LONG: 900000,
};

// Creates a brand-new Beacher entity via the New Entity wizard. Beacher has no
// Add Client + Multi Entity flow - the wizard is the only way in - so this
// replaces steps 1-3 of the Secure SF-01 flow.
async function createBeacherClient(page) {
  const wizard = new Wizard(page);

  await wizard.goto("/clients");
  await wizard.waitForSpinner();

  // Step 1 - Organizational/General.
  await wizard.clickNewButton();
  await wizard.waitForWizardModal();
  const clientName = await wizard.enterUniqueClientName("Beacher_SF");
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

test.describe("Beacher Start Fresh", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let startFreshPage;
  let lockAssessment;
  let scoreCalculation;

  test.beforeEach(async ({ page }) => {
    startFreshPage = new StartFresh(page);
    lockAssessment = new LockAssessment(page);
    scoreCalculation = new ScoreCalculation(page);
  });

  test("BSF - 01 | @smoke Start Fresh - answer collection and reset the framework", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Step 1: Create a new Beacher client through the New Entity wizard
    const clientName = await createBeacherClient(page);
    console.log(`Client created: ${clientName}`);

    // Step 2: Open the client. Beacher lands straight on the collection screen,
    // so there is no Multi Entity + entity picker hop like Secure has.
    await scoreCalculation.goto("/clients");
    await scoreCalculation.waitForSpinner();
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();
    await page.waitForTimeout(3000);

    // Step 3: Answer a question so the reset has something to clear. Secure
    // answers the whole framework, which is not practical here - the Insurance
    // Application carries 150+ questions, several of which also demand a
    // comment before they will save.
    await lockAssessment.clickApplicationSideMenu();
    await lockAssessment.waitForQuestionCardsLoaded();
    await lockAssessment.answerSingleQuestion();
    await page.waitForTimeout(3000);

    // Step 4: Confirm an answer is actually recorded, so "all answers removed"
    // below cannot pass on an untouched framework
    const answeredBefore = await startFreshPage.getCheckedAnswerCount();
    console.log(`Checked answers before Start Fresh: ${answeredBefore}`);
    expect(answeredBefore).toBeGreaterThan(0);

    // Step 5: Save the framework score before resetting
    await startFreshPage.clickApplicationSidemenu();
    await page.waitForTimeout(3000);
    const frameworkScore = await startFreshPage.getFrameworkCardScore();
    console.log(`Saved framework score: ${frameworkScore}`);

    // Step 6: Open the collection framework edit mode, which is where the
    // Start Fresh trigger lives
    await startFreshPage.clickEditCollectionFrameworkButton();

    // Step 7: Open the Start Fresh modal and confirm it
    await startFreshPage.clickStartFreshButton();
    console.log("Start Fresh modal opened");
    await startFreshPage.confirmStartFresh();
    console.log("Start Fresh confirmed");

    // Step 8: Reopen the collection and verify every answer was cleared
    await startFreshPage.clickApplicationSidemenu();
    await lockAssessment.waitForQuestionCardsLoaded();
    await startFreshPage.verifyAllAnswersRemoved();

    // Step 9: Open the Archive sub-menu item
    await startFreshPage.clickArchiveSubMenuItem();
    await page.waitForTimeout(3000);
    console.log("Archive sub-menu item clicked");

    // Step 10: Verify the archived framework kept the pre-reset score
    await startFreshPage.verifyArchivedFrameworkScore(frameworkScore);
  });
});
