const { test } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const SetupEntityLeader = require("../../../pages/EntityLeader/Setup/setupEntityLeader");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const StorageHelper = require("../../../helpers/common/storageHelper");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  USER_ROLES,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 3000000,
};

const DEFAULT_FIRST_PARTY_URL = "";

// Every key this suite stores is pinned to APP_SCOPE.ENTITY_LEADER so the data
// lands in testData/EntityLeader/ even when the run is launched without APP set
// (TestData would otherwise default to the Secure folder).
//
// The suite also builds its own client as the admin user, so it has to start
// unauthenticated - any saved storageState is ignored on purpose.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Entity Leader Setup Tests", () => {
  let loginPage;
  let managementPage;
  let addClientPage;
  let globalControl;
  let setupEntityLeader;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    globalControl = new GlobalControl(page);
    setupEntityLeader = new SetupEntityLeader(page);
    await loginPage.navigate();
  });

  test("ELS - 01 | @smoke Add Entity Leader and successful login", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    await loginPage.login(process.env.USER_EMAIL, process.env.USER_PASSWORD);
    console.log("Credentials entered.");

    const mailinatorEmail = MailinatorHelper.extractMailinatorInput(
      process.env.MAILINATOR_ADDRESS,
    );
    const otp = await MailinatorHelper.getOTPFromMailinator(
      context,
      mailinatorEmail,
    );
    console.log("OTP received:", otp);

    await page.bringToFront();
    await loginPage.verifyOTP(otp);
    await loginPage.waitForURL(/\/clients/, TIMEOUTS.LONG);
    console.log("Login successful.");

    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();

    const clientName = await addClientPage.createUniqueClientName("ELClient");
    console.log("Generated client name:", clientName);

    await addClientPage.selectIndustry();
    // Enable the Policy Management solution on the client. Solutions are picked
    // at creation time and gate the leader's side menu: without this the Policy
    // Management item renders disabled for the invited entity leader, so any
    // policy spec built on this session would fail on a dead menu entry rather
    // than on anything it was testing.
    await addClientPage.selectPolicyManagement();
    await addClientPage.enterFirstPartyUrl(DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log("Add Client submitted with Policy Management enabled.");

    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    console.log("Client verified in list.");

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.ENTITY_LEADER,
      APP_SCOPE.ENTITY_LEADER,
    );

    // No entity is created here, unlike the SubEntityLeader setup. An entity
    // leader is scoped to the whole client, so there is nothing to assign it to
    // and the Add New User modal shows no Sub Entity dropdown.
    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await setupEntityLeader.clickAddNewUserBtn();
    await setupEntityLeader.verifyAddNewUserModal();
    console.log("Add New User modal opened.");

    const elName = `EntityLeader_${Date.now()}`;
    const elEmailID = `${Date.now().toString().slice(-6)}`;
    const elEmail = `${elEmailID}@mailinator.com`;

    await setupEntityLeader.fillName(elName);
    await setupEntityLeader.fillEmail(elEmail);
    await setupEntityLeader.selectRole(USER_ROLES.Entity_Leader);
    console.log(
      `Filled Entity Leader details — Name: ${elName}, Email: ${elEmail}`,
    );

    await setupEntityLeader.clickSendInvitation();
    console.log("Send Invitation clicked.");

    await setupEntityLeader.waitForUserAddedToast();
    console.log("User added toast confirmed.");

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_USER_EMAIL,
      elEmail,
      TEST_DATA_FILE_ENUMS.ENTITY_LEADER,
      APP_SCOPE.ENTITY_LEADER,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_USER_EMAIL_ID,
      elEmailID,
      TEST_DATA_FILE_ENUMS.ENTITY_LEADER,
      APP_SCOPE.ENTITY_LEADER,
    );

    // Close admin context and open fresh context for Entity Leader registration
    await context.close();

    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);

    await loginPage2.navigate();

    // Get temp password from mailinator and complete registration
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      elEmailID,
    );
    console.log("Temp Password:", tempPassword);

    await loginPage2.login(elEmail, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Password reset complete.");

    // Login with new password and verify OTP
    await loginPage2.login(elEmail, process.env.ALPHA_USER_PASSWORD);
    const otp2 = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      elEmailID,
    );
    console.log("OTP2:", otp2);
    await page2.bringToFront();
    await loginPage2.verifyOTP(otp2);
    // An entity leader lands on the client's upperdeck, not on /multi-entity -
    // that is the routing difference from the sub entity leader.
    await loginPage2.waitForURL(
      /\/first-party\/[^/]+\/upperdeck/,
      TIMEOUTS.LONG,
    );
    console.log("Entity Leader landed on upperdeck.");

    const setupEntityLeader2 = new SetupEntityLeader(page2);
    await setupEntityLeader2.verifyClientNameDisplayed(clientName);
    console.log("Client name verified on the entity name label.");

    // Persist the ENTITY LEADER session, saved from context2 - context (the
    // admin session) is already closed by this point. Saved only after the
    // client scope has been verified, so a half-provisioned leader never leaves
    // a session file behind for the downstream specs to trust.
    //
    // The file name is EntityLeader-specific on purpose: Secure writes
    // storageState.json, Beacher storageState.beacher.json, Participant
    // storageState.participant.json and SubEntityLeader
    // storageState.subEntityLeader.json. Handing an entity-leader session to any
    // of those runs would silently drop them to entity-leader permissions
    // instead of failing loudly.
    //
    // Future EntityLeader specs reuse it with the standard opt-in block:
    //   const storageStatePath = path.join(
    //     process.cwd(),
    //     "storageState.entityLeader.json",
    //   );
    //   if (fs.existsSync(storageStatePath)) {
    //     test.use({ storageState: storageStatePath });
    //   }
    try {
      await StorageHelper.saveStorage(
        context2,
        "storageState.entityLeader.json",
      );
    } catch (err) {
      throw new Error(`Failed to save storage state: ${err.message}`);
    }
    console.log(
      "Entity Leader session saved to storageState.entityLeader.json.",
    );
  });
});
