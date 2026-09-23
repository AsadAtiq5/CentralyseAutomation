const { test } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const TestData = require("../../../constant/testData");
const {
  WIZARD_STEP_ENUMS,
  WIZARD_TOAST_ENUMS,
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
} = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

const INDUSTRY = "FINANCIAL SERVICES";
const ANNUAL_REVENUE = "1000000";
const ANNUAL_COST_OF_GOODS = "500000";
const NUMBER_OF_SERVERS = "10";
const NUMBER_OF_WORKSTATIONS = "50";

test.describe("Beacher Wizard Entity Creation", () => {
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
   * Completion is only half verified by the success toast: the entity also has
   * to surface on /clients under the exact name that was entered. Completing
   * runs html2canvas over every step, zips it and uploads to S3 before the
   * entity is created, so this needs a long timeout and must not wait on the
   * step containers - they are swapped out during the screenshot phase.
   */
  test("WIZARD - 20 | @regression A completed wizard is listed on the clients screen", async () => {
    test.setTimeout(900000);

    const clientName = await wizard.advanceToStep(
      WIZARD_STEP_ENUMS.CURRENT_YEAR,
      {
        prefix: "Beacher_Created",
        industry: INDUSTRY,
        revenue: ANNUAL_REVENUE,
        costOfGoods: ANNUAL_COST_OF_GOODS,
        servers: NUMBER_OF_SERVERS,
        workstations: NUMBER_OF_WORKSTATIONS,
      },
    );
    TestData.setKey(
      FILE_KEYS.WIZARD_CREATED_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    // COMPLETE stays gated until Calculate has run.
    await wizard.clickCalculateButton();
    await wizard.verifyCurrentYearPopupDisplayed();
    await wizard.clickCompleteButton();

    await wizard.verifyEntityCreatedToast();

    // The user stays on /clients after finalizing - no navigation happens.
    await wizard.verifyClientCardVisible(clientName);
    console.log(`Entity created and listed: ${clientName}`);
  });
});
