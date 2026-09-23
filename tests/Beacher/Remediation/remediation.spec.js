const { test, expect } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const RemediationPage = require("../../../pages/Beacher/Remediation/RemediationPage");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const {
  fetchFrameworkCSV,
} = require("../../../helpers/common/getFirstPartyEnumsHelper");

// Scope this spec's test data to the Beacher app (testData/Beacher/).
process.env.APP = "Beacher";

const BEACHER_REMEDIATION = TEST_DATA_FILE_ENUMS.BEACHER_REMEDIATION;

test.describe("Beacher Remediation Module Tests", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let wizard;
  let scoreCalculation;
  let remediationPage;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(1200000);
    wizard = new Wizard(page);
    scoreCalculation = new ScoreCalculation(page);
    remediationPage = new RemediationPage(page);

    // Auto-login (via storageState) lands us on the app; open the clients screen.
    await scoreCalculation.goto("/clients");
    await scoreCalculation.waitForSpinner();

    // Every test except the "BRMD - 00" setup opens the client created by the
    // setup test and navigates to its remediation screen via the side menu.
    const isSetupTest = test.info().title.includes("BRMD - 00");
    if (!isSetupTest) {
      const clientName = TestData.getKey(
        FILE_KEYS.WIZARD_CLIENT_NAME,
        BEACHER_REMEDIATION,
      );
      if (!clientName) {
        throw new Error(
          "No Beacher remediation client found. Ensure 'BRMD - 00' ran first.",
        );
      }
      await scoreCalculation.clickSearchField();
      await scoreCalculation.searchClient(clientName);
      await scoreCalculation.waitForClientCard(clientName);
      await scoreCalculation.clickClientCard(clientName);
      await scoreCalculation.waitForLoad();
      await remediationPage.clickRemediationSideMenu();
    }
  });

  // Setup: create a Beacher entity via the wizard, open it, filter the
  // collection by Critical, answer every question the risk-generating way based
  // on the framework CSV isCustomScore flag (isCustomScore=true -> Yes,
  // isCustomScore=false -> No). Both answers score 0, so every Critical question
  // becomes a Risk Task. Persists the client, framework and Critical count.
  test("BRMD - 00 | Setup: create entity and answer questions by isCustomScore", async () => {
    // --- Create a new entity via the New Entity wizard ---
    await wizard.clickNewButton();
    await wizard.waitForWizardModal();

    const clientName = await wizard.enterUniqueClientName("Beacher_RMD");
    TestData.setKey(
      FILE_KEYS.WIZARD_CLIENT_NAME,
      clientName,
      BEACHER_REMEDIATION,
    );

    // Step 1 - Organizational.
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
    const riskAssessment = "Insurance Application";
    await wizard.selectRiskAssessment(riskAssessment);
    TestData.setKey(
      FILE_KEYS.WIZARD_RISK_ASSESSMENT,
      riskAssessment,
      BEACHER_REMEDIATION,
    );
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

    // --- Open the created entity (application/questions screen) ---
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();
    await scoreCalculation.waitForQuestions();

    // --- Filter by Critical and capture the filtered question count ---
    await scoreCalculation.clickFilterButton();
    await scoreCalculation.verifyFiltersModal();
    await scoreCalculation.selectSeverity("Critical");
    await scoreCalculation.clickApplyFilter();
    await scoreCalculation.waitForQuestions();

    const criticalCount = await scoreCalculation.getQuestionsTabCount();
    TestData.setKey(
      FILE_KEYS.BEACHER_CRITICAL_COUNT,
      criticalCount,
      BEACHER_REMEDIATION,
    );
    console.log(`Critical questions to answer: ${criticalCount}`);

    // --- Answer every Critical question based on the CSV isCustomScore flag ---
    const frameworkRows = await fetchFrameworkCSV(riskAssessment);
    const answers = await scoreCalculation.answerQuestionsByCustomScore(
      frameworkRows,
      "Critical",
    );
    console.log(`Setup complete: ${answers.length} question(s) answered.`);
  });

  // The number of Risk Tasks must equal the number of Critical questions, since
  // every Critical question was answered the risk-generating way.
  test("BRMD - 01 | @regression Verify the risk task count", async () => {
    const count = await remediationPage.getRiskTasksCount();
    const expected = TestData.getKey(
      FILE_KEYS.BEACHER_CRITICAL_COUNT,
      BEACHER_REMEDIATION,
    );
    console.log(`UI risk tasks: ${count} | Expected (Critical): ${expected}`);
    expect(count).toBe(expected);
  });

  // Remediate a random risk task and verify its status becomes "Remediated".
  test("BRMD - 02 | @regression Remediate task", async () => {
    const { statusTextLocator, expectedText } =
      await remediationPage.remediateTask();
    await expect(statusTextLocator).toHaveText(expectedText, {
      timeout: 60000,
    });
  });

  // Assign a random risk task to the logged-in admin and verify the assignee.
  // Asserting on the card status would be wrong here - assigning never changes
  // a task's status (it stays "Open"), so the assignment is verified through the
  // initials avatar the card renders for its assigned user.
  test("BRMD - 03 | @regression Assign task", async () => {
    const { assigneeLocator, expectedInitials, assignedName } =
      await remediationPage.assignTaskAndGetAssignee();
    const actualInitials = (await assigneeLocator.innerText()).trim();
    console.log(
      `Assigned to: ${assignedName} | expected ${expectedInitials} | actual ${actualInitials}`,
    );
    await expect(assigneeLocator).toHaveText(expectedInitials, {
      timeout: 60000,
    });
  });
});
