const { test } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const {
  WIZARD_STEP_ENUMS,
  WIZARD_TOAST_ENUMS,
} = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

const INDUSTRY = "FINANCIAL SERVICES";
const ANNUAL_REVENUE = "1000000";
const ANNUAL_COST_OF_GOODS = "500000";

test.describe("Beacher Wizard Validation", () => {
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
    await wizard.goto("/clients");
    await wizard.waitForSpinner();
    await wizard.clickNewButton();
    await wizard.waitForWizardModal();
  });

  /**
   * Step 1 validation runs through forEach with `return false`, so the last
   * evaluated message wins and an empty Client Name can surface as the industry
   * message. Every other mandatory field is filled here so Client Name is the
   * only possible failure and the expected toast is deterministic.
   */
  test("WIZARD - 06 | @regression Step 1 blocks when the Client Name is empty", async () => {
    test.setTimeout(600000);

    await wizard.enterPrimaryRiskManagementContact("Risk Manager");
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(INDUSTRY);

    await wizard.verifyStepBlockedWithToast(
      WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      WIZARD_TOAST_ENUMS.MANDATORY_FIELDS,
    );
  });

  test("WIZARD - 07 | @regression Step 1 blocks when no Industry is selected", async () => {
    test.setTimeout(600000);

    await wizard.enterUniqueClientName("Beacher_NoIndustry");
    await wizard.enterPrimaryRiskManagementContact("Risk Manager");

    await wizard.verifyStepBlockedWithToast(
      WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      WIZARD_TOAST_ENUMS.SELECT_INDUSTRY,
    );
  });

  test("WIZARD - 08 | @regression Step 2 blocks when the financial figures are empty", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.FINANCIAL, {
      prefix: "Beacher_NoFinancial",
      industry: INDUSTRY,
    });

    // Landing on step 2 leaves Annual Revenue and Cost of Goods empty.
    await wizard.verifyStepBlockedWithToast(
      WIZARD_STEP_ENUMS.FINANCIAL,
      WIZARD_TOAST_ENUMS.MANDATORY_FIELDS,
    );
  });

  test("WIZARD - 09 | @regression Step 5 blocks when servers and workstations are empty", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.TECHNICAL, {
      prefix: "Beacher_NoTechnical",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
    });

    await wizard.verifyStepBlockedWithToast(
      WIZARD_STEP_ENUMS.TECHNICAL,
      WIZARD_TOAST_ENUMS.MANDATORY_FIELDS,
    );
  });

  test("WIZARD - 10 | @regression Step 7 blocks when the Renewal Date is missing", async () => {
    test.setTimeout(600000);

    // advanceToStep fills a step only while moving past it, so this lands on
    // step 7 with the Renewal Date still empty.
    await wizard.advanceToStep(WIZARD_STEP_ENUMS.ACCOUNT_DETAILS, {
      prefix: "Beacher_NoRenewal",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
      servers: "10",
      workstations: "50",
    });

    await wizard.verifyStepBlockedWithToast(
      WIZARD_STEP_ENUMS.ACCOUNT_DETAILS,
      WIZARD_TOAST_ENUMS.RENEWAL_DATE_REQUIRED,
    );
  });
});
