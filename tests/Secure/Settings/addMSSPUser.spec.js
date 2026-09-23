const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const AddMSSPUser = require("../../../pages/Secure/Settings/AddMSSPUser");
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

test.describe("Add MSSP User Tests", () => {
  let loginPage;
  let managementPage;
  let addClientPage;
  let globalControl;
  let addMSSPUser;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    globalControl = new GlobalControl(page);
    addMSSPUser = new AddMSSPUser(page);
    await loginPage.navigate();
  });

  test("AMU - 01 | @smoke Add MSSP User and successful login", async ({
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

    const clientName = await addClientPage.createUniqueClientName("MSSPClient");
    console.log("Generated client name:", clientName);

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log("Add Client submitted.");

    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    console.log("Client verified in list.");

    TestData.setKey(
      FILE_KEYS.MSSP_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.MSSP,
    );

    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await addMSSPUser.clickAddNewUserBtn();
    await addMSSPUser.verifyAddNewUserModal();
    console.log("Add New User modal opened.");

    const msspName = `MSSP_${Date.now()}`;
    const msspEmailID = `${Date.now().toString().slice(-6)}`;
    const msspEmail = `${msspEmailID}@mailinator.com`;

    await addMSSPUser.fillName(msspName);
    await addMSSPUser.fillEmail(msspEmail);
    await addMSSPUser.selectRole(USER_ROLES.Mssp);
    console.log(
      `Filled MSSP user details — Name: ${msspName}, Email: ${msspEmail}`,
    );

    await addMSSPUser.clickSendInvitation();
    console.log("Send Invitation clicked.");

    await addMSSPUser.waitForUserAddedToast();
    console.log("User added toast confirmed.");

    TestData.setKey(
      FILE_KEYS.MSSP_USER_EMAIL,
      msspEmail,
      TEST_DATA_FILE_ENUMS.MSSP,
    );
    TestData.setKey(
      FILE_KEYS.MSSP_USER_EMAIL_ID,
      msspEmailID,
      TEST_DATA_FILE_ENUMS.MSSP,
    );

    // Close admin context and open fresh context for invited MSSP user registration
    await context.close();

    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);
    const managementPage2 = new ManagementPage(page2);
    const addMSSPUser2 = new AddMSSPUser(page2);

    await loginPage2.navigate();

    // Get temp password from mailinator and complete registration
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      msspEmailID,
    );
    console.log("Temp Password:", tempPassword);

    await loginPage2.login(msspEmail, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Password reset complete.");

    // Login with new password and verify OTP
    await loginPage2.login(msspEmail, process.env.ALPHA_USER_PASSWORD);
    const otp2 = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      msspEmailID,
    );
    console.log("OTP2:", otp2);
    await page2.bringToFront();
    await loginPage2.verifyOTP(otp2);
    await loginPage2.waitForURL(/\/clients/, TIMEOUTS.LONG);
    console.log("MSSP user registration complete.");

    await managementPage2.clickProfileIcon();
    await addMSSPUser2.verifyInstanceSettingsNotVisible();
    console.log("Instance Settings not visible for MSSP user — verified.");
  });
});
