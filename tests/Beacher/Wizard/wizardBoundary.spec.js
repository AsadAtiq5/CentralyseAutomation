const { test } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const { WIZARD_STEP_ENUMS } = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

const INDUSTRY = "FINANCIAL SERVICES";
const ANNUAL_COST_OF_GOODS = "500000";

// parseInput() strips every non-digit, so the sign and letters are discarded
// and only the digits survive - "-500" and "abc500" both become "500".
const NEGATIVE_INPUT = "-500";
const NEGATIVE_EXPECTED = "500";
const ALPHANUMERIC_INPUT = "abc500xyz";
const ALPHANUMERIC_EXPECTED = "500";

// 16 digits, beyond any realistic revenue, to smoke out overflow in the
// downstream risk calculations.
const OVERSIZED_REVENUE = "9999999999999999";

// 255 characters plus a separate payload of characters that would break
// rendering if they were ever interpolated as markup.
const LONG_CLIENT_NAME = "B".repeat(255);
const SPECIAL_CHARS_CLIENT_NAME = "Beacher <img src=x> & \"quoted\" 'name' ÄÖÜ";

test.describe("Beacher Wizard Boundary Data", () => {
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

  test("WIZARD - 14 | @regression Currency fields discard signs and letters", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.FINANCIAL, {
      prefix: "Beacher_Negative",
      industry: INDUSTRY,
    });

    // clearAndEnter* is required here: the base fill() appends rather than
    // replaces, so a second value would land as "500,500".
    await wizard.clearAndEnterAnnualRevenue(NEGATIVE_INPUT);
    await wizard.verifyAnnualRevenueExact(NEGATIVE_EXPECTED);

    await wizard.clearAndEnterAnnualRevenue(ALPHANUMERIC_INPUT);
    await wizard.verifyAnnualRevenueExact(ALPHANUMERIC_EXPECTED);
  });

  // An extreme revenue must still produce usable figures on the computed step
  // rather than NaN or Infinity.
  test("WIZARD - 15 | @regression Oversized revenue does not break the computed figures", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.RISK_SCENARIOS, {
      prefix: "Beacher_Oversized",
      industry: INDUSTRY,
      revenue: OVERSIZED_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
      servers: "10",
      workstations: "50",
    });

    await wizard.verifyRiskScenariosStepDisplayed();
    await wizard.verifyRiskScenariosContent();
    await wizard.verifyNoInvalidComputedNumbers();
  });

  // The Client Name is free text: it must retain what was typed without
  // truncating or mangling it, and special characters must not break the field.
  test("WIZARD - 16 | @regression Client Name accepts long and special-character values", async () => {
    test.setTimeout(600000);

    await wizard.clearAndEnterClientName(LONG_CLIENT_NAME);
    await wizard.verifyClientNameValue(LONG_CLIENT_NAME);

    await wizard.clearAndEnterClientName(SPECIAL_CHARS_CLIENT_NAME);
    await wizard.verifyClientNameValue(SPECIAL_CHARS_CLIENT_NAME);

    // The wizard must still advance with such a name.
    await wizard.enterPrimaryRiskManagementContact("Risk Manager");
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(INDUSTRY);
    await wizard.clickNextButton();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.FINANCIAL);
  });
});
