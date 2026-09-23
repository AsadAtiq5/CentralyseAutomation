const { test, expect } = require("@playwright/test");
const Wizard = require("../../../pages/MidMarket/Wizard/Wizard");
const TestData = require("../../../constant/testData");
const {
  MIDMARKET_WIZARD_STEP_ENUMS,
  MIDMARKET_WIZARD_FIELD_ENUMS,
  MIDMARKET_ACCOUNT_DETAILS_FIELD_ENUMS,
  MIDMARKET_ACCOUNT_TYPE_ENUMS,
  MIDMARKET_DATA_SCOPE_FIELD_ENUMS,
  MIDMARKET_INDUSTRY_ENUMS,
  MIDMARKET_WIZARD_TOAST_ENUMS,
  MIDMARKET_WIZARD_BUTTON_ENUMS,
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
} = require("../../../constant/enums");

// Scope this spec's test data to the MidMarket app so it saves under
// testData/MidMarket/ (TestData resolves the folder from process.env.APP).
process.env.APP = "MidMarket";

const MIDMARKET_BASE_URL =
  process.env.BASE_URL_MIDMARKET || "https://midmarket.cygovdev.com/";

const TIMEOUTS = {
  DEFAULT: 60000,
  SHORT: 120000,
  // Completion fires a screenshot pass (html2canvas), createWizardRootEntity,
  // a broker notification lambda and - when Active Scan is on - a domain scan.
  LONG: 600000,
};

const TEST_DATA = {
  // inputUnique appends "_<13-digit epoch>", and Client Name is capped at 20
  // characters, so the prefix cannot exceed 6.
  CLIENT_PREFIX: "MMW",
  POC_NAME: "MidMarket PoC",
  POC_EMAIL: "midmarket.poc@mailinator.com",
  INDUSTRY: MIDMARKET_INDUSTRY_ENUMS.FINANCIAL_SERVICES,
  ANNUAL_REVENUE: "1000000",
  ANNUAL_COST_OF_GOODS: "500000",
  NUMBER_OF_SERVERS: "10",
  NUMBER_OF_WORKSTATIONS: "50",
  RISK_ANALYST_EMAIL: "midmarket.analyst@mailinator.com",
  PRODUCER: "Automation Producer",
  NOTES: "Created by the MidMarket wizard automation suite.",
};

test.describe("MidMarket Wizard", () => {
  // Target the MidMarket domain and auto-login using the saved MidMarket
  // session, regardless of the APP env var.
  test.use({
    baseURL: MIDMARKET_BASE_URL,
    storageState: "storageState.midmarket.json",
  });

  let wizard;

  test.beforeEach(async ({ page }) => {
    wizard = new Wizard(page);
    // Auto-login (via storageState) lands us on the app; open the clients screen.
    await wizard.goto("/clients");
    await wizard.waitForSpinner();
    await wizard.clickNewButton();
    await wizard.waitForWizardModal();
  });

  /**
   * Step 1 shell. The broker stepper only ever renders two chips
   * ("Administrative", "Account Details") even though the flow has three steps,
   * so the chip count is asserted rather than assumed to match totalSteps.
   */
  test("MMW - 01 | @smoke Verify the Organizational step renders with its mandatory fields", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    await wizard.verifyOnStep(MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL);

    // The three mandatory strings, the industry control and the framework
    // radios all belong to step 1 in MidMarket (Beacher splits them apart).
    await wizard.expectToBeVisible(
      wizard.selectors.stringInputByLabel(
        MIDMARKET_WIZARD_FIELD_ENUMS.CLIENT_NAME,
      ),
    );
    await wizard.expectToBeVisible(
      wizard.selectors.stringInputByLabel(
        MIDMARKET_WIZARD_FIELD_ENUMS.PRIMARY_POC_NAME,
      ),
    );
    await wizard.expectToBeVisible(
      wizard.selectors.stringInputByLabel(
        MIDMARKET_WIZARD_FIELD_ENUMS.PRIMARY_POC_EMAIL,
      ),
    );
    await wizard.expectToBeVisible(wizard.selectors.industryDropdown);

    // Step 1 renders frameworkList.slice(0, 5).
    const frameworkCount = await wizard.getFrameworkOptionCount();
    console.log(`expected framework options 5 | actual ${frameworkCount}`);
    expect(frameworkCount).toBe(5);

    const stepperCount = await wizard.getStepperCount();
    console.log(`expected stepper chips 2 | actual ${stepperCount}`);
    expect(stepperCount).toBe(2);
  });

  /**
   * The cost constants are prefilled by returnEmptyStepObject() and feed the
   * risk-scenario maths, so a regression that drops them would silently change
   * every projected inherent value.
   */
  test("MMW - 02 | @regression Verify the Organizational cost defaults", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    const expectedDefaults = {
      [MIDMARKET_WIZARD_FIELD_ENUMS.COST_PER_EMPLOYEE]: "2000",
      [MIDMARKET_WIZARD_FIELD_ENUMS.COST_PER_SERVER]: "15000",
      [MIDMARKET_WIZARD_FIELD_ENUMS.COST_PER_WORKSTATION]: "2000",
      [MIDMARKET_WIZARD_FIELD_ENUMS.PR_AND_RESPONSE_EXPENSES]: "20149",
    };

    for (const [label, expected] of Object.entries(expectedDefaults)) {
      const actual = await wizard.getCostField(label);
      // parseInput() masks the field, so "2000" renders as "2,000".
      const actualDigits = actual.replace(/\D/g, "");
      console.log(`expected ${label} ${expected} | actual ${actualDigits}`);
      expect(actualDigits).toBe(expected);
    }
  });

  /**
   * Step 2 is Account Details in MidMarket, and it renders TWO panels side by
   * side inside .step2-parent: account details (step-7) and the
   * Current/Previous Year grid (step-8). Neither carries a "step-2" class.
   */
  test("MMW - 03 | @regression Verify the Account Details step and its two panels", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await wizard.advanceToStep(MIDMARKET_WIZARD_STEP_ENUMS.ACCOUNT_DETAILS, {
      prefix: TEST_DATA.CLIENT_PREFIX,
      industry: TEST_DATA.INDUSTRY,
      pocName: TEST_DATA.POC_NAME,
      pocEmail: TEST_DATA.POC_EMAIL,
    });

    await wizard.expectToBeVisible(wizard.selectors.accountDetailsLeftPanel);
    await wizard.verifyCurrentYearPanelVisible();
    await wizard.verifyAssignBrokerVisible();

    // Account Type is the one dropdown on this step; its options are
    // Fee / Commission / Other on a new wizard.
    const selected = await wizard.selectAccountType(
      MIDMARKET_ACCOUNT_TYPE_ENUMS.COMMISSION,
    );
    const actual = await wizard.getAccountType();
    console.log(`expected Account Type ${selected} | actual ${actual}`);
    expect(actual).toBe(selected);
  });

  /**
   * Every date field on step 2 is [disabled]="true", so the calendar icon is
   * the only way to set one. Asserting the input is populated afterwards proves
   * saveDate() actually bound the value rather than just closing the calendar.
   */
  test("MMW - 04 | @regression Verify the Renewal Date is set through the calendar", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await wizard.advanceToStep(MIDMARKET_WIZARD_STEP_ENUMS.ACCOUNT_DETAILS, {
      prefix: TEST_DATA.CLIENT_PREFIX,
      industry: TEST_DATA.INDUSTRY,
      pocName: TEST_DATA.POC_NAME,
      pocEmail: TEST_DATA.POC_EMAIL,
    });

    await wizard.setDateToToday(
      MIDMARKET_ACCOUNT_DETAILS_FIELD_ENUMS.RENEWAL_DATE,
    );

    const dateValue = await wizard.getDateFieldValue(
      MIDMARKET_ACCOUNT_DETAILS_FIELD_ENUMS.RENEWAL_DATE,
    );
    console.log(`expected Renewal Date non-empty | actual "${dateValue}"`);
    expect(dateValue.trim().length).toBeGreaterThan(0);
  });

  /**
   * Data Scope is logical step 3 but renders with the hardcoded class "step-4".
   * Values are masked by parseInput(), so they are compared on digits only.
   */
  test("MMW - 05 | @regression Verify the Data Scope step accepts and masks its values", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await wizard.advanceToStep(MIDMARKET_WIZARD_STEP_ENUMS.DATA_SCOPE, {
      prefix: TEST_DATA.CLIENT_PREFIX,
      industry: TEST_DATA.INDUSTRY,
      pocName: TEST_DATA.POC_NAME,
      pocEmail: TEST_DATA.POC_EMAIL,
    });

    await wizard.fillDataScopeStep(
      TEST_DATA.ANNUAL_REVENUE,
      TEST_DATA.ANNUAL_COST_OF_GOODS,
      TEST_DATA.NUMBER_OF_SERVERS,
      TEST_DATA.NUMBER_OF_WORKSTATIONS,
    );

    await wizard.verifyDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.ANNUAL_REVENUE,
      TEST_DATA.ANNUAL_REVENUE,
    );
    await wizard.verifyDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.ANNUAL_COST_OF_GOODS,
      TEST_DATA.ANNUAL_COST_OF_GOODS,
    );
    await wizard.verifyDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.NUMBER_OF_SERVERS,
      TEST_DATA.NUMBER_OF_SERVERS,
    );
    await wizard.verifyDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.NUMBER_OF_WORKSTATIONS,
      TEST_DATA.NUMBER_OF_WORKSTATIONS,
    );

    // The last step must offer COMPLETE (not UPDATE) for a brand-new wizard.
    await wizard.verifyFinalButtonLabel(MIDMARKET_WIZARD_BUTTON_ENUMS.COMPLETE);
  });

  /**
   * Happy path. COMPLETE calls createWizardRootEntity, which creates a root
   * entity whose id equals the wizard id plus a same-named child sub-entity, so
   * the toast and the /clients card are both asserted.
   *
   * The name is stored for MMW - 07 (reopen in UPDATE mode).
   */
  test("MMW - 06 | @smoke Create a new entity end to end through the MidMarket wizard", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Step 1 - Organizational.
    await wizard.verifyOnStep(MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL);
    const clientName = await wizard.fillOrganizationalStepValid(
      TEST_DATA.CLIENT_PREFIX,
      TEST_DATA.INDUSTRY,
      TEST_DATA.POC_NAME,
      TEST_DATA.POC_EMAIL,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_CREATED_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_POC_EMAIL,
      TEST_DATA.POC_EMAIL,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_INDUSTRY,
      TEST_DATA.INDUSTRY,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );
    await wizard.clickNextButton();

    // Step 2 - Account Details. Nothing here is mandatory (checkValidation
    // case 2 is commented out in the app), but a realistic entity carries an
    // account type, a renewal date and the analyst contact.
    await wizard.verifyOnStep(MIDMARKET_WIZARD_STEP_ENUMS.ACCOUNT_DETAILS);
    await wizard.selectAccountType(MIDMARKET_ACCOUNT_TYPE_ENUMS.FEE);
    await wizard.setDateToToday(
      MIDMARKET_ACCOUNT_DETAILS_FIELD_ENUMS.RENEWAL_DATE,
    );
    await wizard.enterProducer(TEST_DATA.PRODUCER);
    await wizard.enterRiskAnalystEmail(TEST_DATA.RISK_ANALYST_EMAIL);
    await wizard.enterNotes(TEST_DATA.NOTES);
    await wizard.clickNextButton();

    // Step 3 - Data Scope.
    await wizard.verifyOnStep(MIDMARKET_WIZARD_STEP_ENUMS.DATA_SCOPE);
    await wizard.fillDataScopeStep(
      TEST_DATA.ANNUAL_REVENUE,
      TEST_DATA.ANNUAL_COST_OF_GOODS,
      TEST_DATA.NUMBER_OF_SERVERS,
      TEST_DATA.NUMBER_OF_WORKSTATIONS,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_ANNUAL_REVENUE,
      TEST_DATA.ANNUAL_REVENUE,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_ANNUAL_COST_OF_GOODS,
      TEST_DATA.ANNUAL_COST_OF_GOODS,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_NUMBER_OF_SERVERS,
      TEST_DATA.NUMBER_OF_SERVERS,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_NUMBER_OF_WORKSTATIONS,
      TEST_DATA.NUMBER_OF_WORKSTATIONS,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );

    // Complete. The modal closes on the success toast; the screenshot pass and
    // the broker notification finish afterwards.
    await wizard.clickCompleteButton();
    await wizard.verifyToastByText(
      MIDMARKET_WIZARD_TOAST_ENUMS.ENTITY_CREATED,
      TIMEOUTS.LONG,
    );

    // The created entity is listed back on /clients as a full (non-draft) card.
    await wizard.goto("/clients");
    await wizard.waitForSpinner();
    await wizard.searchClient(clientName);
    await wizard.verifyClientCardVisible(clientName);
  });

  /**
   * Reopening a completed entity puts the wizard in edit mode: the final footer
   * button becomes UPDATE instead of COMPLETE and SEND TO CLIENT disappears
   * entirely (it renders only when wizardData?.rootEntity is falsy).
   */
  test("MMW - 07 | @regression Reopening a completed entity switches the wizard to UPDATE mode", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = TestData.getKey(
      FILE_KEYS.MIDMARKET_WIZARD_CREATED_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );

    // MMW - 06 creates this entity. Close the freshly opened wizard from
    // beforeEach first - this case needs the existing card, not a new wizard.
    await wizard.click(wizard.selectors.wizardCloseIcon);
    await wizard.waitForSpinner();

    await wizard.searchClient(clientName);
    await wizard.openClientCard(clientName);
    await wizard.waitForWizardModal();

    await wizard.advanceToStep(MIDMARKET_WIZARD_STEP_ENUMS.DATA_SCOPE, {
      prefix: TEST_DATA.CLIENT_PREFIX,
      industry: TEST_DATA.INDUSTRY,
      pocName: TEST_DATA.POC_NAME,
      pocEmail: TEST_DATA.POC_EMAIL,
    });

    await wizard.verifyFinalButtonLabel(MIDMARKET_WIZARD_BUTTON_ENUMS.UPDATE);
    await wizard.expectToNotBeVisible(wizard.selectors.sendToClientButton);
  });
});
