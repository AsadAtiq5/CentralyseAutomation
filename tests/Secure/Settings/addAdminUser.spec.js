const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const AddAdminUser = require("../../../pages/Secure/Settings/AddAdminUser");
const InstanceSettingsPage = require("../../../pages/Secure/InstanceSettingsPage");
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

test.describe("Add Admin User Tests", () => {
  let loginPage;
  let managementPage;
  let addClientPage;
  let globalControl;
  let addAdminUser;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    globalControl = new GlobalControl(page);
    addAdminUser = new AddAdminUser(page);
    await loginPage.navigate();
  });

  test("AAU - 01 | @smoke Add New admin and verify successfull login", async ({
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

    const clientName =
      await addClientPage.createUniqueClientName("AdminClient");
    console.log("Generated client name:", clientName);

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log("Add Client submitted.");

    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    console.log("Client verified in list.");

    TestData.setKey(
      FILE_KEYS.ADMIN_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.ADMIN,
    );

    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await addAdminUser.clickAddNewUserBtn();
    await addAdminUser.verifyAddNewUserModal();
    console.log("Add New User modal opened.");

    const adminName = `Admin_${Date.now()}`;
    const adminEmailID = `${Date.now().toString().slice(-6)}`;
    const adminEmail = `${adminEmailID}@mailinator.com`;

    await addAdminUser.fillName(adminName);
    await addAdminUser.fillEmail(adminEmail);
    await addAdminUser.selectRole(USER_ROLES.ADMIN);
    console.log(
      `Filled admin user details — Name: ${adminName}, Email: ${adminEmail}`,
    );

    await addAdminUser.clickSendInvitation();
    console.log("Send Invitation clicked.");

    await addAdminUser.waitForUserAddedToast();
    console.log("User added toast confirmed.");

    TestData.setKey(
      FILE_KEYS.ADMIN_USER_EMAIL,
      adminEmail,
      TEST_DATA_FILE_ENUMS.ADMIN,
    );
    TestData.setKey(
      FILE_KEYS.ADMIN_USER_EMAIL_ID,
      adminEmailID,
      TEST_DATA_FILE_ENUMS.ADMIN,
    );

    // Close admin context and open fresh context for invited admin user registration
    await context.close();

    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);
    const managementPage2 = new ManagementPage(page2);
    const instanceSettingsPage = new InstanceSettingsPage(page2);

    await loginPage2.navigate();

    // Get temp password from mailinator and complete registration
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      adminEmailID,
    );
    console.log("Temp Password:", tempPassword);

    await loginPage2.login(adminEmail, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Password reset complete.");

    // Login with new password and verify OTP
    await loginPage2.login(adminEmail, process.env.ALPHA_USER_PASSWORD);
    const otp2 = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      adminEmailID,
    );
    console.log("OTP2:", otp2);
    await page2.bringToFront();
    await loginPage2.verifyOTP(otp2);
    await loginPage2.waitForURL(/\/clients/, TIMEOUTS.LONG);
    console.log("Admin user registration complete.");

    await managementPage2.clickProfileIcon();
    await instanceSettingsPage.clickInstanceSettings();
    await instanceSettingsPage.verifyInstancePopup();
    console.log("Instance settings popup verified.");
  });
});
