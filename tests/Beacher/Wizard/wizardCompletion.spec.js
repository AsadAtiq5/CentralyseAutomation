const { test } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const { WIZARD_STEP_ENUMS } = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

// Valid values used only to walk the wizard to the step under test.
const INDUSTRY = "FINANCIAL SERVICES";
const ANNUAL_REVENUE = "1000000";
const ANNUAL_COST_OF_GOODS = "500000";
const NUMBER_OF_SERVERS = "10";
const NUMBER_OF_WORKSTATIONS = "50";

test.describe("Beacher Wizard Completion", () => {
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
   * The whole Calculate gate in one walk: COMPLETE stays disabled until
   * Calculate runs, and closing the result popup re-disables it because
   * toggleCurrentYearPopup() toggles rather than closes. Batched deliberately -
   * reaching step 8 costs a full 8-step walk each time.
   */
  test("WIZARD - 05 | @smoke Calculate gates the COMPLETE button on the final step", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.CURRENT_YEAR, {
      prefix: "Beacher_Gating",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
      servers: NUMBER_OF_SERVERS,
      workstations: NUMBER_OF_WORKSTATIONS,
    });

    // Before Calculate the final button is present but not actionable.
    await wizard.verifyCompleteButtonDisabled();

    // Calculate opens the result popup and releases the gate.
    await wizard.clickCalculateButton();
    await wizard.verifyCurrentYearPopupDisplayed();
    await wizard.verifyCompleteButtonEnabled();

    // Closing the popup toggles the gate shut again - regression guard.
    await wizard.closeCurrentYearPopup();
    await wizard.verifyCompleteButtonDisabled();
  });
});
