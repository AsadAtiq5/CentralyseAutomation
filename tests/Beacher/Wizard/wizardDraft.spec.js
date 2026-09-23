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

test.describe("Beacher Wizard Draft", () => {
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
   * A partially filled wizard can be parked with SAVE DRAFT. The modal stays
   * open (draftSaved only emits and toasts), and the draft is listed on
   * /clients so it can be resumed later.
   */
  test("WIZARD - 19 | @regression Save Draft persists a partially filled wizard", async () => {
    test.setTimeout(600000);

    const clientName = await wizard.fillOrganizationalStepValid(
      "Beacher_Draft",
      INDUSTRY,
    );
    TestData.setKey(
      FILE_KEYS.WIZARD_DRAFT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    await wizard.clickSaveDraft();
    await wizard.verifyDraftSavedToast(WIZARD_TOAST_ENUMS.DRAFT_SAVED);

    // The wizard stays open on the same step after saving.
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.ORGANIZATIONAL);

    // The saved draft is listed back on /clients.
    await wizard.goto("/clients");
    await wizard.waitForSpinner();
    await wizard.verifyClientCardVisible(clientName);
  });
});
