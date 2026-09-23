const { test } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const SetupParticipant = require("../../../pages/Participant/Setup/setupParticipant");
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

// Every key this suite stores is pinned to APP_SCOPE.PARTICIPANT so the data
// lands in testData/Participant/ even when the run is launched without APP set
// (TestData would otherwise default to the Secure folder).
//
// The suite also builds its own client as the admin user, so it has to start
// unauthenticated - any saved storageState is ignored on purpose.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Participant Setup Tests", () => {
  let loginPage;
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let globalControl;
  let setupParticipant;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    globalControl = new GlobalControl(page);
    setupParticipant = new SetupParticipant(page);
    await loginPage.navigate();
  });

  test("SP - 01 | @smoke Add Participant User and open collection", async ({
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

    // Create a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();

    const clientName = await addClientPage.createUniqueClientName("PC");
    console.log("Generated client name:", clientName);

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log("Add Client submitted.");

    TestData.setKey(
      FILE_KEYS.PARTICIPANT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.PARTICIPANT,
      APP_SCOPE.PARTICIPANT,
    );

    // Navigate into client and create a multi-entity with Business Email Compromise risk
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();

    await addEntityPage.clickNewEntity();
    const entityName =
      await addEntityPage.createUniqueEntityName("ParticipantEntity");
    console.log("Entity created:", entityName);
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(entityName);

    TestData.setKey(
      FILE_KEYS.PARTICIPANT_ENTITY_NAME,
      entityName,
      TEST_DATA_FILE_ENUMS.PARTICIPANT,
      APP_SCOPE.PARTICIPANT,
    );

    // Navigate to Management, then to Settings and add Participant user
    await globalControl.clickManagementBtn();
    console.log("Navigated to Management.");

    await globalControl.clickSettingsBtn();
    console.log("Navigated to Settings.");

    await globalControl.searchAndSelectClientInSettings(clientName);
    console.log("Client selected in Settings.");

    await setupParticipant.clickAddNewUserBtn();
    await setupParticipant.verifyAddNewUserModal();
    console.log("Add New User modal opened.");

    const participantName = `Participant_${Date.now()}`;
    const participantEmailID = `${Date.now().toString().slice(-6)}`;
    const participantEmail = `${participantEmailID}@mailinator.com`;

    await setupParticipant.fillName(participantName);
    await setupParticipant.fillEmail(participantEmail);
    await setupParticipant.selectRole(USER_ROLES.Participant);
    console.log(
      `Filled Participant details — Name: ${participantName}, Email: ${participantEmail}`,
    );

    // Select sub-entity for the participant
    await setupParticipant.verifySubEntityDropdownVisible();
    console.log("Sub Entity dropdown visible.");

    await setupParticipant.openSubEntityDropdown();
    await setupParticipant.selectSubEntityFromDropdown(entityName);
    console.log("Sub-entity selected from dropdown:", entityName);

    await setupParticipant.clickSendInvitation();
    console.log("Send Invitation clicked.");

    await setupParticipant.waitForUserAddedToast();
    console.log("User added toast confirmed.");

    TestData.setKey(
      FILE_KEYS.PARTICIPANT_USER_EMAIL,
      participantEmail,
      TEST_DATA_FILE_ENUMS.PARTICIPANT,
      APP_SCOPE.PARTICIPANT,
    );
    TestData.setKey(
      FILE_KEYS.PARTICIPANT_USER_EMAIL_ID,
      participantEmailID,
      TEST_DATA_FILE_ENUMS.PARTICIPANT,
      APP_SCOPE.PARTICIPANT,
    );

    // Navigate back to Management and open the collection
    await globalControl.clickManagementBtn();
    console.log("Navigated back to Management.");

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    console.log("Client opened.");

    await addEntityPage.navigateToCollection();
    console.log("Navigated to Collection.");

    await addEntityPage.clickOpenCollectionBtn();
    console.log("Collection opened.");

    // Click edit icon to open assignment panel
    await setupParticipant.clickEditIcon();
    console.log("Edit icon clicked.");

    // Search for the created participant user
    await setupParticipant.enterSearchUser(participantName);
    console.log("Searched for participant user:", participantName);

    // Drag and drop user to assign to the entity
    await setupParticipant.dragAndDropUserToEntity1();
    console.log("User dragged and dropped to the entity.");

    // Close current context and open a fresh browser context for participant login
    await context.close();

    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);

    await loginPage2.navigate();
    console.log("New browser opened for participant login.");

    // Get temporary password from mailinator invitation email
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      participantEmailID,
    );
    console.log("Participant temp password received:", tempPassword);

    // Complete participant account registration
    await loginPage2.login(participantEmail, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Participant password reset complete.");

    // Login with new password and verify OTP
    await loginPage2.login(participantEmail, process.env.ALPHA_USER_PASSWORD);
    const participantOtp = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      participantEmailID,
    );
    console.log("Participant OTP received:", participantOtp);

    await page2.bringToFront();
    await loginPage2.verifyOTP(participantOtp);
    await loginPage2.waitForURL(/\/collection/, TIMEOUTS.LONG);
    console.log("Participant login successful.");

    // Persist the PARTICIPANT session, saved from context2 - context (the admin
    // session) is already closed by this point. The file name is
    // Participant-specific on purpose: Secure writes storageState.json and
    // Beacher storageState.beacher.json, and handing a participant session to
    // either of those runs would silently drop them to participant permissions.
    //
    // Future Participant specs reuse it with the standard opt-in block:
    //   const storageStatePath = path.join(
    //     process.cwd(),
    //     "storageState.participant.json",
    //   );
    //   if (fs.existsSync(storageStatePath)) {
    //     test.use({ storageState: storageStatePath });
    //   }
    try {
      await StorageHelper.saveStorage(
        context2,
        "storageState.participant.json",
      );
    } catch (err) {
      throw new Error(`Failed to save storage state: ${err.message}`);
    }
    console.log("Participant session saved to storageState.participant.json.");
  });
});
