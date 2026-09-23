const { test } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const {
  WIZARD_STEP_ENUMS,
  WIZARD_TOAST_ENUMS,
} = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app so it saves under
// testData/Beacher/ (TestData resolves the folder from process.env.APP).
process.env.APP = "Beacher";

// Valid values used only to walk the wizard to the step under test.
const INDUSTRY = "FINANCIAL SERVICES";
const ANNUAL_REVENUE = "1000000";
const ANNUAL_COST_OF_GOODS = "500000";
// Any Data Scope row works; the first one keeps the walk short.
const DATA_SCOPE_LABEL = "Number of External PII Records";
const DATA_SCOPE_VALUE = "1500";

test.describe("Beacher Wizard Steps", () => {
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

  // Data Scope validates only the rows whose checkbox is ticked, so an untouched
  // step must pass straight through with every input left disabled.
  test("WIZARD - 02 | @regression Data Scope validates only checked rows", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.DATA_SCOPE, {
      prefix: "Beacher_DataScope",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
    });

    // Nothing ticked: all record-count inputs stay disabled and NEXT advances.
    await wizard.verifyDataScopeInputsDisabled();
    await wizard.clickNextButton();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.TECHNICAL);

    // Back on Data Scope, tick a row and leave it empty - the step must block.
    await wizard.previousStep();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.DATA_SCOPE);
    await wizard.checkDataScopeRow(DATA_SCOPE_LABEL);
    await wizard.verifyDataScopeRowChecked(DATA_SCOPE_LABEL);
    await wizard.verifyStepBlockedWithToast(
      WIZARD_STEP_ENUMS.DATA_SCOPE,
      WIZARD_TOAST_ENUMS.CHECKED_FIELDS,
    );

    // Filling the ticked row lets the wizard advance.
    await wizard.enterDataScopeValue(DATA_SCOPE_LABEL, DATA_SCOPE_VALUE);
    await wizard.clickNextButton();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.TECHNICAL);
  });

  // Ticked rows must survive a Previous/Next round trip.
  test("WIZARD - 03 | @regression Data Scope retains a checked row and its value", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.DATA_SCOPE, {
      prefix: "Beacher_DataScopeKeep",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
    });

    await wizard.checkDataScopeRow(DATA_SCOPE_LABEL);
    await wizard.enterDataScopeValue(DATA_SCOPE_LABEL, DATA_SCOPE_VALUE);
    await wizard.clickNextButton();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.TECHNICAL);

    await wizard.previousStep();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.DATA_SCOPE);
    await wizard.verifyDataScopeRowChecked(DATA_SCOPE_LABEL);

    const retained = await wizard.getDataScopeValue(DATA_SCOPE_LABEL);
    console.log(
      `expected value ${DATA_SCOPE_VALUE} | actual value ${retained}`,
    );
    await wizard.verifyDataScopeValue(DATA_SCOPE_LABEL, DATA_SCOPE_VALUE);
  });

  // Risk Scenarios is a read-only computed step and the only one rendered
  // without the "outer-border" wrapper.
  test("WIZARD - 04 | @regression Risk Scenarios step is displayed", async () => {
    test.setTimeout(600000);

    await wizard.advanceToStep(WIZARD_STEP_ENUMS.RISK_SCENARIOS, {
      prefix: "Beacher_RiskScenarios",
      industry: INDUSTRY,
      revenue: ANNUAL_REVENUE,
      costOfGoods: ANNUAL_COST_OF_GOODS,
      servers: "10",
      workstations: "50",
    });

    await wizard.verifyRiskScenariosStepDisplayed();
    await wizard.verifyRiskScenariosContent();

    // No mandatory input, so the step advances untouched.
    await wizard.clickNextButton();
    await wizard.verifyOnStep(WIZARD_STEP_ENUMS.ACCOUNT_DETAILS);
  });
});
