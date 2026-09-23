const { test } = require("@playwright/test");
const Wizard = require("../../../pages/MidMarket/Wizard/Wizard");
const TestData = require("../../../constant/testData");
const {
  MIDMARKET_WIZARD_STEP_ENUMS,
  MIDMARKET_WIZARD_FIELD_ENUMS,
  MIDMARKET_INDUSTRY_ENUMS,
  MIDMARKET_WIZARD_TOAST_ENUMS,
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
  LONG: 600000,
};

const TEST_DATA = {
  CLIENT_PREFIX: "MMWD",
  POC_NAME: "MidMarket PoC",
  INDUSTRY: MIDMARKET_INDUSTRY_ENUMS.FINANCIAL_SERVICES,
  INVALID_EMAIL: "not-an-email",
};

// Each run invites a distinct client address. addUser() short-circuits on
// UserByEmail with "User Already Added", so reusing one address would turn the
// second run of MMW - 22 into a false negative.
const uniqueClientEmail = () => `midmarket.client.${Date.now()}@mailinator.com`;

test.describe("MidMarket Wizard Draft and Send to Client", () => {
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
   * SAVE DRAFT parks a partially filled wizard. It calls
   * saveWizardDraft(true, {}, false) - the third argument is inviteClient, so
   * unlike NEXT this path does NOT create the client user.
   *
   * draftValidation() is entirely commented out in the app, so a draft saves
   * even with mandatory fields blank; only the fields needed to identify the
   * draft on /clients are filled here.
   *
   * Two toasts fire in sequence ("Saving Draft . . ." then "Draft Saved!"), so
   * the wait must be text-scoped or it resolves on the wrong one.
   */
  test("MMW - 20 | @regression Save Draft persists a partially filled wizard", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = await wizard.enterUniqueClientName(
      TEST_DATA.CLIENT_PREFIX,
    );
    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_DRAFT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );

    await wizard.clickSaveDraft();
    await wizard.verifyToastByText(
      MIDMARKET_WIZARD_TOAST_ENUMS.DRAFT_SAVED,
      TIMEOUTS.LONG,
    );

    // saveWizardDraft closes the modal for a broker once the draft is stored
    // (isClient is false and nextClicked is false), so /clients is already up.
    await wizard.waitForSpinner();
    await wizard.searchClient(clientName);
    await wizard.verifyDraftCardVisible(clientName);
  });

  /**
   * Reopening the draft must rehydrate what was entered. ngOnInit refetches the
   * full wizard when applicantInfo/revenueDetails/dataInventory come back
   * undefined from the list query, precisely so a resumed draft does not save
   * back a hollowed-out record - this is the test that would catch that
   * regression.
   */
  test("MMW - 21 | @regression A saved draft reopens with its values rehydrated", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = TestData.getKey(
      FILE_KEYS.MIDMARKET_WIZARD_DRAFT_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );

    // This case needs the existing draft, not the new wizard beforeEach opened.
    await wizard.click(wizard.selectors.wizardCloseIcon);
    await wizard.waitForSpinner();

    await wizard.searchClient(clientName);
    await wizard.openClientCard(clientName);
    await wizard.waitForWizardModal();

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

  /**
   * SEND TO CLIENT is bound to [disableClick]="enableClientBtn" and
   * enableClientButton() runs on keyup, requiring Client Name, Primary PoC Name
   * and a regex-valid Primary PoC Email. cygov-button surfaces that as
   * aria-disabled on div.body-back.
   *
   * The email is deliberately malformed first so the gate is proven to depend
   * on validity, not merely on the field being non-empty.
   */
  test("MMW - 22 | @regression SEND TO CLIENT stays disabled until the PoC details are valid", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await wizard.verifySendToClientDisabled();

    await wizard.enterUniqueClientName(TEST_DATA.CLIENT_PREFIX);
    await wizard.verifySendToClientDisabled();

    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.verifySendToClientDisabled();

    // Present but malformed - the button must still be disabled.
    await wizard.enterPrimaryPocEmail(TEST_DATA.INVALID_EMAIL);
    await wizard.verifySendToClientDisabled();

    await wizard.enterPrimaryPocEmail(uniqueClientEmail());
    await wizard.verifySendToClientEnabled();
  });

  /**
   * The full invite handoff: SEND TO CLIENT opens a confirmation modal, and
   * confirming calls saveWizardDraft(true) with inviteClient defaulted to true,
   * which creates an entity-leader user with onBoardingStatus STEP_1 and toasts
   * "Invite Sent To Client".
   *
   * The invited address is stored so a client-onboarding spec can log in as it
   * later; it is generated fresh because addUser() refuses a duplicate with
   * "User Already Added".
   */
  test("MMW - 23 | @regression SEND TO CLIENT invites the client and saves the draft", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientEmail = uniqueClientEmail();
    const clientName = await wizard.enterUniqueClientName(
      TEST_DATA.CLIENT_PREFIX,
    );
    await wizard.enterPrimaryPocName(TEST_DATA.POC_NAME);
    await wizard.enterPrimaryPocEmail(clientEmail);
    await wizard.clickIndustryDropdown();
    await wizard.selectIndustry(TEST_DATA.INDUSTRY);

    TestData.setKey(
      FILE_KEYS.MIDMARKET_WIZARD_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );
    TestData.setKey(
      FILE_KEYS.MIDMARKET_INVITED_CLIENT_EMAIL,
      clientEmail,
      TEST_DATA_FILE_ENUMS.MIDMARKET_WIZARD,
    );

    await wizard.verifySendToClientEnabled();
    await wizard.sendWizardToClient();

    await wizard.verifyToastByText(
      MIDMARKET_WIZARD_TOAST_ENUMS.INVITE_SENT,
      TIMEOUTS.LONG,
    );

    // The wizard is stored as a draft on the way out, and a sent draft is the
    // card state the broker sees until the client completes their half.
    await wizard.waitForSpinner();
    await wizard.searchClient(clientName);
    await wizard.verifyDraftCardVisible(clientName);
  });
});
