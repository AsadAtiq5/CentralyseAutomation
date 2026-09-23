const { test } = require("@playwright/test");
const Wizard = require("../../../pages/MidMarket/Wizard/Wizard");
const {
  MIDMARKET_WIZARD_STEP_ENUMS,
  MIDMARKET_WIZARD_FIELD_ENUMS,
  MIDMARKET_INDUSTRY_ENUMS,
  MIDMARKET_WIZARD_TOAST_ENUMS,
} = require("../../../constant/enums");

// Scope this spec's test data to the MidMarket app so it saves under
// testData/MidMarket/ (TestData resolves the folder from process.env.APP).
process.env.APP = "MidMarket";

const MIDMARKET_BASE_URL =
  process.env.BASE_URL_MIDMARKET || "https://midmarket.cygovdev.com/";

const TIMEOUTS = {
  DEFAULT: 60000,
  SHORT: 120000,
  LONG: 600000,
};

const TEST_DATA = {
  CLIENT_PREFIX: "MMWV",
  POC_NAME: "MidMarket PoC",
  POC_EMAIL: "midmarket.poc@mailinator.com",
  INDUSTRY: MIDMARKET_INDUSTRY_ENUMS.FINANCIAL_SERVICES,
  // 21 characters - one past the checkValidation cap of 20.
  OVERLONG_NAME: "MidMarketClientNameXX",
  INVALID_EMAIL: "midmarket.poc.at.mailinator",
  DOMAIN: "midmarket-automation.com",
};

test.describe("MidMarket Wizard Validation", () => {
  // Target the MidMarket domain and auto-login using the saved MidMarket
  // session, regardless of the APP env var.
  test.use({
    baseURL: MIDMARKET_BASE_URL,
    storageState: "storageState.midmarket.json",
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
   * checkValidation walks organizational[0] in order and breaks on the first
   * failure, so every other mandatory field is filled here to make Client Name
   * the only possible cause and the expected toast deterministic.
   */
  test("MMW - 10 | @regression Step 1 blocks when the Client Name is empty", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.enterPrimaryPocEmail(TEST_DATA.POC_EMAIL);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    await wizard.verifyStepBlockedWithToast(
      MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      MIDMARKET_WIZARD_TOAST_ENUMS.CLIENT_NAME_MISSING,
    );
  });

  test("MMW - 11 | @regression Step 1 blocks when the Primary PoC Name is empty", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    await wizard.enterUniqueClientName(TEST_DATA.CLIENT_PREFIX);
    await wizard.enterPrimaryPocEmail(TEST_DATA.POC_EMAIL);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    await wizard.verifyStepBlockedWithToast(
      MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      MIDMARKET_WIZARD_TOAST_ENUMS.PRIMARY_POC_NAME_MISSING,
    );
  });

  /**
   * The 20-character cap applies to Client Name and Primary PoC Name only - the
   * email field has no length rule. The toast is built as
   * `${title} Cannot Be More Than 20 Characters`, so the assertion matches on
   * the shared tail and the field name is confirmed by which step blocks.
   */
  test("MMW - 12 | @regression Step 1 blocks when the Client Name exceeds 20 characters", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    await wizard.enterClientName(TEST_DATA.OVERLONG_NAME);
    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.enterPrimaryPocEmail(TEST_DATA.POC_EMAIL);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    await wizard.verifyStepBlockedWithToast(
      MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      MIDMARKET_WIZARD_TOAST_ENUMS.NAME_LIMIT_EXCEEDED,
    );
  });

  test("MMW - 13 | @regression Step 1 blocks when the Primary PoC Email is malformed", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    await wizard.enterUniqueClientName(TEST_DATA.CLIENT_PREFIX);
    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.enterPrimaryPocEmail(TEST_DATA.INVALID_EMAIL);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    await wizard.verifyStepBlockedWithToast(
      MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      MIDMARKET_WIZARD_TOAST_ENUMS.INVALID_EMAIL,
    );
  });

  test("MMW - 14 | @regression Step 1 blocks when no Industry is selected", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    await wizard.enterUniqueClientName(TEST_DATA.CLIENT_PREFIX);
    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.enterPrimaryPocEmail(TEST_DATA.POC_EMAIL);

    await wizard.verifyStepBlockedWithToast(
      MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      MIDMARKET_WIZARD_TOAST_ENUMS.SELECT_INDUSTRY,
    );
  });

  /**
   * Active Scan is optional, but enabling it makes at least one non-blank
   * domain mandatory. The domain row is always rendered - it is only greyed out
   * via .reduce-opacity while the toggle is off - so the failure is an empty
   * value, not a missing input.
   */
  test("MMW - 15 | @regression Step 1 blocks when Active Scan is on with no domain", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    await wizard.enterUniqueClientName(TEST_DATA.CLIENT_PREFIX);
    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.enterPrimaryPocEmail(TEST_DATA.POC_EMAIL);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    await wizard.toggleActiveScan();

    await wizard.verifyStepBlockedWithToast(
      MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL,
      MIDMARKET_WIZARD_TOAST_ENUMS.ACTIVE_SCAN_DOMAIN,
    );
  });

  /**
   * The positive half of MMW - 15: with Active Scan on AND a domain supplied,
   * step 1 advances. Without this, MMW - 15 would still pass if the domain rule
   * became unconditional.
   */
  test("MMW - 16 | @regression Step 1 advances when Active Scan is on with a domain", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await wizard.enterUniqueClientName(TEST_DATA.CLIENT_PREFIX);
    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.enterPrimaryPocEmail(TEST_DATA.POC_EMAIL);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    await wizard.toggleActiveScan();
    await wizard.enterDomain(TEST_DATA.DOMAIN);

    await wizard.clickNextButton();
    await wizard.verifyOnStep(MIDMARKET_WIZARD_STEP_ENUMS.ACCOUNT_DETAILS);
  });

  /**
   * Account Details has NO validation - checkValidation case 2 is commented out
   * in MidmarketWizardPopUpComponent, so NEXT always advances from step 2 even
   * with every field blank.
   *
   * This asserts the behaviour as it currently ships. If validation is ever
   * added to step 2, this test is the one that should fail first and be
   * rewritten - do not weaken it into a skip.
   */
  test("MMW - 17 | @regression Step 2 advances with every Account Details field blank", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await wizard.advanceToStep(MIDMARKET_WIZARD_STEP_ENUMS.ACCOUNT_DETAILS, {
      prefix: TEST_DATA.CLIENT_PREFIX,
      industry: TEST_DATA.INDUSTRY,
      pocName: TEST_DATA.POC_NAME,
      pocEmail: TEST_DATA.POC_EMAIL,
    });

    // Nothing is filled in here on purpose.
    await wizard.clickNextButton();
    await wizard.verifyOnStep(MIDMARKET_WIZARD_STEP_ENUMS.DATA_SCOPE);
  });

  /**
   * Previous Step walks back without re-validating, and the values entered on
   * step 1 survive the round trip (they live on this.organizational, which
   * initLocalVariables rehydrates rather than resets).
   */
  test("MMW - 18 | @regression Previous Step returns to step 1 with its values intact", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = await wizard.advanceToStep(
      MIDMARKET_WIZARD_STEP_ENUMS.ACCOUNT_DETAILS,
      {
        prefix: TEST_DATA.CLIENT_PREFIX,
        industry: TEST_DATA.INDUSTRY,
        pocName: TEST_DATA.POC_NAME,
        pocEmail: TEST_DATA.POC_EMAIL,
      },
    );

    await wizard.clickPreviousButton();
    await wizard.verifyOnStep(MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL);

    await wizard.verifyStringFieldValue(
      MIDMARKET_WIZARD_FIELD_ENUMS.CLIENT_NAME,
      clientName,
    );
    await wizard.verifyStringFieldValue(
      MIDMARKET_WIZARD_FIELD_ENUMS.PRIMARY_POC_NAME,
      TEST_DATA.POC_NAME,
    );
    await wizard.verifySelectedIndustry(TEST_DATA.INDUSTRY);
  });
});
