const { test } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const {
  WIZARD_STEP_ENUMS,
  WIZARD_STEP_TITLE_ENUMS,
  WIZARD_STEPPER_SECTION_ENUMS,
} = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

const INDUSTRY = "FINANCIAL SERVICES";
const ANNUAL_REVENUE = "1000000";
const ANNUAL_COST_OF_GOODS = "500000";
// The search filters the Regulatory Requirements list, not Risk Assessment.
const FRAMEWORK_SEARCH_KEYWORD = "PCI";

test.describe("Beacher Wizard Navigation", () => {
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

  // The 8-step rail and the third stepper section only exist on Beacher -
  // totalSteps is 6 elsewhere - so this doubles as a white-label guard.
  test("WIZARD - 11 | @regression Step rail and stepper show the Beacher layout", async () => {
    test.setTimeout(600000);

    await wizard.verifyStepRailTitles(Object.values(WIZARD_STEP_TITLE_ENUMS));
    await wizard.verifyUpperStepperSections(
      Object.values(WIZARD_STEPPER_SECTION_ENUMS),
    );
    await wizard.verifyActiveStepNumber(WIZARD_STEP_ENUMS.ORGANIZATIONAL);
  });

  // Values entered on a step must survive stepping away and back.
  test("WIZARD - 12 | @regression Previous Step retains the entered values", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.FINANCIAL, {
      prefix: "Beacher_Previous",
      industry: INDUSTRY,
    });

    await wizard.fillFinancialStepValid(ANNUAL_REVENUE, ANNUAL_COST_OF_GOODS);
    await wizard.clickNextButton();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.FRAMEWORKS);
    await wizard.verifyActiveStepNumber(WIZARD_STEP_ENUMS.FRAMEWORKS);

    await wizard.previousStep();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.FINANCIAL);
    await wizard.verifyAnnualRevenueValue(ANNUAL_REVENUE);
  });

  // Step 3 has no validation case, so it advances on the preselected risk
  // framework alone. The search narrows the separate Regulatory Requirements list.
  test("WIZARD - 13 | @regression Frameworks step preselects a risk framework and filters compliance on search", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.FRAMEWORKS, {
      prefix: "Beacher_Frameworks",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
    });

    await wizard.verifyRiskFrameworkPreselected();

    await wizard.searchFramework(FRAMEWORK_SEARCH_KEYWORD);
    await wizard.verifyFrameworkSearchResults(FRAMEWORK_SEARCH_KEYWORD);

    // The preselection alone is enough to advance.
    await wizard.clickNextButton();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.DATA_SCOPE);
  });
});
