const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const CustomRole = require("../../../pages/Secure/Settings/CustomRole");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 3000000,
};

const DEFAULT_FIRST_PARTY_URL = "";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Custom Role Tests", () => {
  let loginPage;
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let globalControl;
  let customRole;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    globalControl = new GlobalControl(page);
    customRole = new CustomRole(page);
    await loginPage.navigate();
  });

  test("CR - 01 | @smoke Successful custom role creation", async ({
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

    const clientName = await addClientPage.createUniqueClientName("CR");
    console.log("Generated client name:", clientName);

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log("Add Client submitted.");

    TestData.setKey(
      FILE_KEYS.CUSTOM_ROLE_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    // Navigate into client and create 2 multi-entities
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    console.log("Multi Entity sidebar opened.");

    await addEntityPage.clickNewEntity();
    const entityName1 = await addEntityPage.createUniqueEntityName("CREntity1");
    console.log("Entity 1 name:", entityName1);
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(entityName1);
    console.log("Entity 1 created and verified.");

    TestData.setKey(
      FILE_KEYS.CUSTOM_ROLE_ENTITY_1,
      entityName1,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    await addEntityPage.clickNewEntity();
    const entityName2 = await addEntityPage.createUniqueEntityName("CREntity2");
    console.log("Entity 2 name:", entityName2);
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(entityName2);
    console.log("Entity 2 created and verified.");

    TestData.setKey(
      FILE_KEYS.CUSTOM_ROLE_ENTITY_2,
      entityName2,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    await globalControl.clickManagementBtn();
    console.log("Navigated back to Management.");

    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await customRole.clickRolePermissionsTab();
    console.log("Role Permissions tab clicked.");

    await customRole.verifyPermissionContentVisible();
    console.log("Permission content visible.");

    await customRole.clickNewRoleGroupBtn();
    console.log("New Role Group button clicked.");

    await customRole.verifyRolePermissionPopup();
    console.log("Role permission popup displayed.");

    const roleName = customRole.createUniqueRoleName("CR");
    await customRole.fillRoleGroupName(roleName);
    console.log("Role group name filled:", roleName);

    TestData.setKey(
      FILE_KEYS.CUSTOM_ROLE_NAME,
      roleName,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    await customRole.selectFirstEntity();
    console.log("Entity selected.");

    const selectedPermissions =
      await customRole.selectRandomScreenPermissions(2);
    console.log("Screen permissions selected:", selectedPermissions);

    TestData.setKey(
      FILE_KEYS.CUSTOM_ROLE_SELECTED_PERMISSIONS,
      selectedPermissions,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    await customRole.clickSaveRoleGroup();
    console.log("Save button clicked.");

    await customRole.waitForRoleCreatedToast();
    console.log("Role created toast confirmed.");
  });

  test("CR - 02 | @smoke Verify custom role on the listing", async ({
    page,
    context,
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

    const clientName = TestData.getKey(
      FILE_KEYS.CUSTOM_ROLE_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );
    const roleName = TestData.getKey(
      FILE_KEYS.CUSTOM_ROLE_NAME,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await customRole.clickAddNewUserBtn();
    console.log("Add New User modal opened.");

    await customRole.verifyRoleInDropdown(roleName);
    console.log("Custom role verified in role dropdown:", roleName);

    await customRole.closeAddUserModal();
    console.log("Add New User modal closed.");

    await customRole.clickRolePermissionsTab();
    console.log("Role Permissions tab clicked.");

    await customRole.verifyPermissionContentVisible();
    await customRole.verifyCustomRoleInListing(roleName);
    console.log("Custom role verified in listing:", roleName);
  });

  test("CR - 03 | @smoke Add user with the custom role and verify permissions by signing in", async ({
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

    const clientName = TestData.getKey(
      FILE_KEYS.CUSTOM_ROLE_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );
    const roleName = TestData.getKey(
      FILE_KEYS.CUSTOM_ROLE_NAME,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );
    const selectedPermissions = TestData.getKey(
      FILE_KEYS.CUSTOM_ROLE_SELECTED_PERMISSIONS,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await customRole.clickAddNewUserBtn();
    console.log("Add New User modal opened.");

    const customUserName = `CRUser_${Date.now()}`;
    const customUserEmailID = `${Date.now().toString().slice(-6)}`;
    const customUserEmail = `${customUserEmailID}@mailinator.com`;

    await customRole.fillName(customUserName);
    await customRole.fillEmail(customUserEmail);
    await customRole.selectCustomRole(roleName);
    console.log(
      `Filled user details — Name: ${customUserName}, Email: ${customUserEmail}`,
    );

    await customRole.clickSendInvitation();
    console.log("Send Invitation clicked.");

    await customRole.waitForUserAddedToast();
    console.log("User added toast confirmed.");

    TestData.setKey(
      FILE_KEYS.CUSTOM_ROLE_USER_EMAIL,
      customUserEmail,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );
    TestData.setKey(
      FILE_KEYS.CUSTOM_ROLE_USER_EMAIL_ID,
      customUserEmailID,
      TEST_DATA_FILE_ENUMS.CUSTOM_ROLE,
    );

    await context.close();

    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);
    const customRole2 = new CustomRole(page2);

    await loginPage2.navigate();

    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      customUserEmailID,
    );
    console.log("Temp password received.");

    await loginPage2.login(customUserEmail, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Password reset complete.");

    await loginPage2.login(customUserEmail, process.env.ALPHA_USER_PASSWORD);
    const otp2 = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      customUserEmailID,
    );
    console.log("OTP2:", otp2);

    await page2.bringToFront();
    await loginPage2.verifyOTP(otp2);
    await loginPage2.waitForURL(/\/first-party/, TIMEOUTS.LONG);
    console.log("Custom role user login successful.");

    await customRole2.verifySideMenuPermissions(selectedPermissions);
    console.log("Sidebar permissions verified:", selectedPermissions);
  });
});
