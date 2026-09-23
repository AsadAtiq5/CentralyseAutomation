const { test, expect } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

test.describe("Beacher Wizard Tests", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session,
  // regardless of the APP env var.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let wizard;

  test.beforeEach(async ({ page }) => {
    wizard = new Wizard(page);
    // Auto-login (via storageState) lands us on the app; open the clients screen.
    await wizard.goto("/clients");
    await wizard.waitForSpinner();
  });

  test("WIZARD - 01 | @regression Create a new entity via the New Entity wizard (Step 1)", async () => {
    test.setTimeout(120000);

    // Open the New Entity wizard from the /clients screen.
    await wizard.clickNewButton();
    await wizard.waitForWizardModal();

    // Enter and save a unique client name.
    const clientName = await wizard.enterUniqueClientName("Beacher_Client");
    TestData.setKey(
      FILE_KEYS.WIZARD_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    // Enter the Primary Risk Management Contact.
    await wizard.enterPrimaryRiskManagementContact("Risk Manager");

    // Open the Industry dropdown, verify the list, and select an industry
    // (Industry is mandatory, required to advance to the next step).
    await wizard.clickIndustryDropdown();
    await wizard.verifyIndustryListVisible();
    await wizard.selectIndustry("FINANCIAL SERVICES");

    // Proceed to the next step.
    await wizard.clickNextButton();

    // Step 2 - Financial: verify the step is displayed, enter and save the
    // mandatory financial figures, then continue.
    await wizard.waitForFinancialStep();

    const annualRevenue = "1000000";
    const annualCostOfGoods = "500000";
    await wizard.enterAnnualRevenue(annualRevenue);
    await wizard.enterAnnualCostOfGoods(annualCostOfGoods);
    TestData.setKey(
      FILE_KEYS.WIZARD_ANNUAL_REVENUE,
      annualRevenue,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );
    TestData.setKey(
      FILE_KEYS.WIZARD_ANNUAL_COST_OF_GOODS,
      annualCostOfGoods,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    // Proceed to the next step.
    await wizard.clickNextButton();

    // Step 3 - Frameworks: verify the step, select the Risk Assessment
    // framework, save it, then continue.
    await wizard.waitForFrameworksStep();

    const riskAssessment = "Insurance Application";
    await wizard.selectRiskAssessment(riskAssessment);
    TestData.setKey(
      FILE_KEYS.WIZARD_RISK_ASSESSMENT,
      riskAssessment,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    // Advance through the remaining steps.
    await wizard.clickNextButton();
    await wizard.clickNextButton();

    // Step 5 - Technical: verify the step, enter the mandatory technical
    // figures (no save required), then continue.
    await wizard.waitForTechnicalStep();
    await wizard.enterNumberOfServers("10");
    await wizard.enterNumberOfWorkstations("50");

    // Advance through the remaining steps.
    await wizard.clickNextButton();
    await wizard.clickNextButton();

    // Step 7 - Account Details: open the Renewal Date calendar, verify it,
    // select a date, then continue.
    await wizard.waitForAccountDetailsStep();
    await wizard.clickRenewalDateCalendar();
    await wizard.verifyCalendarDisplayed();
    await wizard.selectCalendarToday();

    // Proceed to the next step.
    await wizard.clickNextButton();

    // Step 8 - Current/Previous Year: calculate, complete the wizard, and
    // verify the success toast appears and then disappears.
    await wizard.waitForCurrentPreviousYearStep();
    await wizard.clickCalculateButton();
    await wizard.clickCompleteButton();
    await wizard.verifyEntityCreatedToast();
  });
});
