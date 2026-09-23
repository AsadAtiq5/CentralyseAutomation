const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const AddEntityLeader = require("../../../pages/Secure/Settings/AddEntityLeader");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  USER_ROLES,
} = require("../../../constant/enums");

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 3000000,
};

const DEFAULT_FIRST_PARTY_URL = "";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Add Entity Leader Tests", () => {
  let loginPage;
  let managementPage;
  let addClientPage;
  let globalControl;
  let addEntityLeader;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    globalControl = new GlobalControl(page);
    addEntityLeader = new AddEntityLeader(page);
    await loginPage.navigate();
  });

  test("AEL - 01 | @smoke Add Entity Leader and successful login", async ({
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
    await addClientPage.enterFirstPartyUrl(DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log("Add Client submitted.");

    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    console.log("Client verified in list.");

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.ENTITY_LEADER,
    );

    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await addEntityLeader.clickAddNewUserBtn();
    await addEntityLeader.verifyAddNewUserModal();
    console.log("Add New User modal opened.");

    const entityLeaderName = `EntityLeader_${Date.now()}`;
    const entityLeaderEmailID = `${Date.now().toString().slice(-6)}`;
    const entityLeaderEmail = `${entityLeaderEmailID}@mailinator.com`;

    await addEntityLeader.fillName(entityLeaderName);
    await addEntityLeader.fillEmail(entityLeaderEmail);
    await addEntityLeader.selectRole(USER_ROLES.Entity_Leader);
    console.log(
      `Filled Entity Leader details — Name: ${entityLeaderName}, Email: ${entityLeaderEmail}`,
    );

    await addEntityLeader.clickSendInvitation();
    console.log("Send Invitation clicked.");

    await addEntityLeader.waitForUserAddedToast();
    console.log("User added toast confirmed.");

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_USER_EMAIL,
      entityLeaderEmail,
      TEST_DATA_FILE_ENUMS.ENTITY_LEADER,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_USER_EMAIL_ID,
      entityLeaderEmailID,
      TEST_DATA_FILE_ENUMS.ENTITY_LEADER,
    );

    // Close admin context and open fresh context for invited Entity Leader registration
    await context.close();

    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);
    const addEntityLeader2 = new AddEntityLeader(page2);

    await loginPage2.navigate();

    // Get temp password from mailinator and complete registration
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      entityLeaderEmailID,
    );
    console.log("Temp Password:", tempPassword);

    await loginPage2.login(entityLeaderEmail, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Password reset complete.");

    // Login with new password and verify OTP
    await loginPage2.login(entityLeaderEmail, process.env.ALPHA_USER_PASSWORD);
    const otp2 = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      entityLeaderEmailID,
    );
    console.log("OTP2:", otp2);
    await page2.bringToFront();
    await loginPage2.verifyOTP(otp2);
    await loginPage2.waitForURL(
      /\/first-party\/[^/]+\/upperdeck/,
      TIMEOUTS.LONG,
    );
    console.log("Entity Leader landed on upperdeck.");

    await addEntityLeader2.verifyClientNameDisplayed(clientName);
    console.log("Client name verified on entity name label.");
  });
});
