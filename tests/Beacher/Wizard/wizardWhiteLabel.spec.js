const { test } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const {
  WIZARD_STEP_ENUMS,
  WIZARD_BEACHER_FIELD_ENUMS,
} = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

const INDUSTRY = "FINANCIAL SERVICES";
const ANNUAL_REVENUE = "1000000";
const ANNUAL_COST_OF_GOODS = "500000";

test.describe("Beacher Wizard White Label", () => {
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
   * Guards the Beacher variant of step 1: the renamed labels, the hidden Line
   * of Business field, and the relaxed mandatory set (Number of Employees is
   * mandatory on the default build but not here). All three read from the same
   * screen, so they share one visit.
   */
  test("WIZARD - 17 | @regression Step 1 shows the Beacher field set", async () => {
    test.setTimeout(600000);

    await wizard.verifyStepOneFieldLabels(
      Object.values(WIZARD_BEACHER_FIELD_ENUMS),
    );

    // Rendered but display:none on Beacher.
    await wizard.verifyLineOfBusinessHidden();

    await wizard.verifyFieldMandatory(
      WIZARD_BEACHER_FIELD_ENUMS.CLIENT_NAME,
      true,
    );
    await wizard.verifyFieldMandatory(
      WIZARD_BEACHER_FIELD_ENUMS.PRIMARY_RISK_CONTACT,
      true,
    );
    // Not mandatory on Beacher - the wizard completes without it.
    await wizard.verifyFieldMandatory(
      WIZARD_BEACHER_FIELD_ENUMS.NUMBER_OF_EMPLOYEES,
      false,
    );
  });

  // Renewal Date is a forward-looking field: today is selectable, earlier
  // dates are not.
  test("WIZARD - 18 | @regression Renewal Date calendar disables past dates", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.ACCOUNT_DETAILS, {
      prefix: "Beacher_Renewal",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
      servers: "10",
      workstations: "50",
    });

    await wizard.clickRenewalDateCalendar();
    await wizard.verifyCalendarDisplayed();
    await wizard.verifyRenewalDateMinimumIsToday();
  });
});
