const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const AddSubEntityLeader = require("../../../pages/Secure/Settings/AddSubEntityLeader");
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

test.describe("Add Sub Entity Leader Tests", () => {
  let loginPage;
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let globalControl;
  let addSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    globalControl = new GlobalControl(page);
    addSubEntityLeader = new AddSubEntityLeader(page);
    await loginPage.navigate();
  });

  test("ASEL - 01 | @smoke Add Sub Entity Leader and successful login", async ({
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

    const clientName = await addClientPage.createUniqueClientName("SELClient");
    console.log("Generated client name:", clientName);

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log("Add Client submitted.");

    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER,
    );

    // Navigate into client and create two multi-entities
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();

    await addEntityPage.clickNewEntity();
    const subEntity1 = await addEntityPage.createUniqueEntityName("SEL1");
    console.log("Sub-entity 1 created:", subEntity1);
    await addEntityPage.addEntityWithComplianceUserBased();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(subEntity1);

    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_ENTITY_1,
      subEntity1,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER,
    );

    await addEntityPage.clickNewEntity();
    const subEntity2 = await addEntityPage.createUniqueEntityName("SEL2");
    console.log("Sub-entity 2 created:", subEntity2);
    await addEntityPage.addEntityWithComplianceUserBased();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(subEntity2);

    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_ENTITY_2,
      subEntity2,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER,
    );

    console.log("Both sub-entities created.");

    // Navigate to Settings and add Sub Entity Leader user
    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await addSubEntityLeader.clickAddNewUserBtn();
    await addSubEntityLeader.verifyAddNewUserModal();
    console.log("Add New User modal opened.");

    const selName = `SELeader_${Date.now()}`;
    const selEmailID = `${Date.now().toString().slice(-6)}`;
    const selEmail = `${selEmailID}@mailinator.com`;

    await addSubEntityLeader.fillName(selName);
    await addSubEntityLeader.fillEmail(selEmail);
    await addSubEntityLeader.selectRole(USER_ROLES.Sub_Entity_Leader);
    console.log(
      `Filled Sub Entity Leader details — Name: ${selName}, Email: ${selEmail}`,
    );

    await addSubEntityLeader.verifySubEntityDropdownVisible();
    await addSubEntityLeader.verifyArtifactsDropdownVisible();
    console.log("Sub Entity and Artifacts dropdowns visible.");

    await addSubEntityLeader.openSubEntityDropdown();
    await addSubEntityLeader.selectSubEntityFromDropdown(subEntity1);
    console.log("Sub-entity selected from dropdown:", subEntity1);

    await addSubEntityLeader.clickSendInvitation();
    console.log("Send Invitation clicked.");

    await addSubEntityLeader.waitForUserAddedToast();
    console.log("User added toast confirmed.");

    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_USER_EMAIL,
      selEmail,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER,
    );
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_USER_EMAIL_ID,
      selEmailID,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER,
    );

    // Close admin context and open fresh context for Sub Entity Leader registration
    await context.close();

    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);

    await loginPage2.navigate();

    // Get temp password from mailinator and complete registration
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      selEmailID,
    );
    console.log("Temp Password:", tempPassword);

    await loginPage2.login(selEmail, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Password reset complete.");

    // Login with new password and verify OTP
    await loginPage2.login(selEmail, process.env.ALPHA_USER_PASSWORD);
    const otp2 = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      selEmailID,
    );
    console.log("OTP2:", otp2);
    await page2.bringToFront();
    await loginPage2.verifyOTP(otp2);
    await loginPage2.waitForURL(/multi-entity/, TIMEOUTS.LONG);
    console.log("Sub Entity Leader login complete.");

    const addSubEntityLeader2 = new AddSubEntityLeader(page2);
    await addSubEntityLeader2.verifyEntityCardVisible(subEntity1);
    console.log("Assigned sub-entity card verified:", subEntity1);
  });
});
