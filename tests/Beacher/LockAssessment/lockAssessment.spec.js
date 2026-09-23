const { test, expect } = require("@playwright/test");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const LockAssessment = require("../../../pages/Beacher/LockAssessment/LockAssessment");
const LoginPage = require("../../../pages/Beacher/Login/LoginPage");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app (testData/Beacher/).
process.env.APP = "Beacher";

test.describe("Beacher Lock Assessment Tests", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let wizard;
  let scoreCalculation;
  let lockAssessment;

  test.beforeEach(async ({ page }) => {
    wizard = new Wizard(page);
    scoreCalculation = new ScoreCalculation(page);
    lockAssessment = new LockAssessment(page);
    // Auto-login (via storageState) lands us on the app; open the clients screen.
    await wizard.goto("/clients");
    await wizard.waitForSpinner();
  });

  test("LA - 01 | @regression Create, invite & lock an assessment while the invited user answers and finalize-signs it", async ({
    browser,
  }) => {
    test.setTimeout(600000);

    // --- Create a new entity via the New Entity wizard ---
    await wizard.clickNewButton();
    await wizard.waitForWizardModal();

    // Enter and save a unique client name.
    const clientName = await wizard.enterUniqueClientName("Beacher_Client");
    TestData.setKey(
      FILE_KEYS.WIZARD_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );

    // Step 1 - Organizational: mandatory fields to advance.
    await wizard.enterPrimaryRiskManagementContact("Risk Manager");
    await wizard.clickIndustryDropdown();
    await wizard.verifyIndustryListVisible();
    await wizard.selectIndustry("FINANCIAL SERVICES");
    await wizard.clickNextButton();

    // Step 2 - Financial.
    await wizard.waitForFinancialStep();
    await wizard.enterAnnualRevenue("1000000");
    await wizard.enterAnnualCostOfGoods("500000");
    await wizard.clickNextButton();

    // Step 3 - Frameworks.
    await wizard.waitForFrameworksStep();
    const riskAssessment = "Insurance Application";
    await wizard.selectRiskAssessment(riskAssessment);
    TestData.setKey(
      FILE_KEYS.WIZARD_RISK_ASSESSMENT,
      riskAssessment,
      TEST_DATA_FILE_ENUMS.BEACHER_WIZARD,
    );
    await wizard.clickNextButton();
    await wizard.clickNextButton();

    // Step 5 - Technical.
    await wizard.waitForTechnicalStep();
    await wizard.enterNumberOfServers("10");
    await wizard.enterNumberOfWorkstations("50");
    await wizard.clickNextButton();
    await wizard.clickNextButton();

    // Step 7 - Account Details.
    await wizard.waitForAccountDetailsStep();
    await wizard.clickRenewalDateCalendar();
    await wizard.verifyCalendarDisplayed();
    await wizard.selectCalendarToday();
    await wizard.clickNextButton();

    // Step 8 - Current/Previous Year: calculate and complete.
    await wizard.waitForCurrentPreviousYearStep();
    await wizard.clickCalculateButton();
    await wizard.clickCompleteButton();
    await wizard.verifyEntityCreatedToast();

    // --- Open the created entity (navigates to the application/questions screen) ---
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();
    await scoreCalculation.waitForQuestions();

    // --- Click the edit collection framework icon on the Collection Overview ---
    await lockAssessment.waitForCollectionOverview();
    await lockAssessment.clickEditCollectionFramework();

    // --- Import Assessment: open the popup, upload the template and confirm ---
    await lockAssessment.clickImportAssessment();
    await lockAssessment.verifyImportAssessmentPopup();

    // Proceed to the upload step.
    await lockAssessment.clickModalNextButton();

    // Upload the assessment template file and wait for it to finish.
    await lockAssessment.uploadAssessmentFile(
      "filesTest/ImportAssessmentBeacher/Insurance Application Template.xlsx",
    );
    await lockAssessment.waitForFileUploaded();

    // Add the uploaded assessment.
    await lockAssessment.clickModalAddButton();

    // Verify the success confirmation modal, then acknowledge it.
    await lockAssessment.verifyImportSuccessModal();
    await lockAssessment.clickImportSuccessOk();

    // --- Open the edit mode side menu and add a new user ---
    // Wait for the collection to finish loading, then open edit mode.
    await lockAssessment.waitForLoadingComplete();
    await lockAssessment.clickEditMarker();
    await lockAssessment.verifyEditModeSideMenu();

    // Open the Add User modal via the '+' icon.
    await lockAssessment.clickAddUserIcon();
    await lockAssessment.verifyAddUserModal();

    // Generate a unique user (mailinator inbox) and save it for later steps
    // (invitation email / OTP login, mirroring the single score-calculation flow).
    const userInbox = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const userEmail = `${userInbox}@mailinator.com`;
    const userName = `Automation User${Math.floor(Math.random() * 9999) + 1}`;
    TestData.setKey(
      FILE_KEYS.LOCK_ASSESSMENT_USER_INBOX,
      userInbox,
      TEST_DATA_FILE_ENUMS.LOCK_ASSESSMENT,
    );
    TestData.setKey(
      FILE_KEYS.LOCK_ASSESSMENT_USER_EMAIL,
      userEmail,
      TEST_DATA_FILE_ENUMS.LOCK_ASSESSMENT,
    );
    TestData.setKey(
      FILE_KEYS.LOCK_ASSESSMENT_USER_NAME,
      userName,
      TEST_DATA_FILE_ENUMS.LOCK_ASSESSMENT,
    );

    // Fill the Add User form and select the "entity leader" role.
    await lockAssessment.enterUserFullName(userName);
    await lockAssessment.enterUserEmail(userEmail);
    await lockAssessment.selectUserRole("entity leader");

    // Send the invitation and wait for the "User added" toast.
    await lockAssessment.clickSendInvitation();
    await lockAssessment.waitForUserAddedToast();

    // Search the created user in the side menu and drag it onto the collection.
    await lockAssessment.searchUserInSideMenu(userName);
    await lockAssessment.dragAndDropUserToCollection();

    // NOTE: the assessment is intentionally NOT locked yet. The invited user
    // must first be able to answer and finalize/sign the assessment. Locking
    // happens later (below), from this admin browser.

    // ------------------------------------------------------------------
    // Browser 2: the invited user signs up and finalize-signs the assessment.
    // ------------------------------------------------------------------
    const userContext = await browser.newContext({ storageState: undefined });
    const userPage = await userContext.newPage();
    const loginPage = new LoginPage(userPage);

    // Open the Beacher login screen and complete the first-login onboarding.
    await loginPage.navigate();
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      userContext,
      userInbox,
    );
    console.log("Temp Password:", tempPassword);
    await loginPage.login(userEmail, tempPassword);
    await loginPage.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );

    // Log in with the new password and verify the OTP.
    await loginPage.login(userEmail, process.env.ALPHA_USER_PASSWORD);
    const otp = await MailinatorHelper.getVendorOTPFromMailinator(
      userContext,
      userInbox,
    );
    console.log("OTP:", otp);
    await userPage.bringToFront();
    await loginPage.verifyOTP(otp);
    await loginPage.waitForLoad();

    const landedUrl = await loginPage.verifyNavigatedToUpperdeck();
    expect(landedUrl).toContain("/upperdeck");

    // Open the assessment (Application) and wait for the questions to render.
    const userLock = new LockAssessment(userPage);
    await userLock.clickApplicationSideMenu();
    await userLock.waitForQuestionCardsLoaded();

    // The invited user answers the single question (proves it is answerable).
    await userLock.answerSingleQuestion();

    // --- Finalize & Sign the assessment ---
    const signatureTitle = `Title${Date.now()}`;
    const printName = `Auto${Math.floor(Math.random() * 99999)}`;
    const signatureText = `Sign${Math.floor(Math.random() * 99999)}`;

    // Open the signature flow and fill the title/print-name modal.
    await userLock.clickFinalizeAndSign();
    await userLock.verifySignatureModal();
    await userLock.enterSignatureTitle(signatureTitle);
    await userLock.enterSignaturePrintName(printName);
    await userLock.clickSignatureOk();

    // Second signature modal: use the "Text" tab, type the signature, consent
    // and sign.
    await userLock.clickSignatureTextTab();
    await userLock.enterSignatureText(signatureText);
    await userLock.checkSignatureConsent();
    await userLock.clickSignButton();
    await userLock.waitForAssessmentFinalizedToast();

    // The signer's own session does not re-render after signing - isFinalized
    // is only computed in the tab bar's ngOnInit, so this page keeps showing
    // FINALIZE & SIGN until it is reloaded. Reload before asserting the signed
    // state, otherwise both the "Last Signed By" line and the Logs button
    // (which also needs isFinalized) stay absent.
    await userPage.reload({ waitUntil: "domcontentloaded" });
    await userLock.waitForSpinner();
    await userLock.waitForLoad();
    await userLock.clickApplicationSideMenu();
    await userLock.waitForQuestionCardsLoaded();

    // The assessment now shows the invited user as the last signer.
    await userLock.verifyLastSignedBy(userName);

    // Open the signature logs, verify the invited user's entry, then close.
    await userLock.clickLogsButton();
    await userLock.verifySignatureLog(userName);
    await userLock.closeSignatureLogsModal();

    // ------------------------------------------------------------------
    // Browser 1 (admin): lock the assessment now.
    // ------------------------------------------------------------------
    await lockAssessment.clickLockButton();
    await lockAssessment.waitForAssessmentLockedToast();

    // ------------------------------------------------------------------
    // Browser 2 (invited user): reload and verify the assessment is locked.
    // ------------------------------------------------------------------
    await userPage.reload({ waitUntil: "domcontentloaded" });
    await userLock.waitForSpinner();
    await userLock.waitForLoad();
    // The reload lands on the entity dashboard; re-open the Application screen
    // (the collection view) so the locked question cards render.
    await userLock.clickApplicationSideMenu();
    await userLock.waitForLockedAssessmentLoaded();
    await userLock.verifyLogsButtonVisible();
    await userLock.verifyRequestToUnlockButtonVisible();
    await userLock.verifyAllQuestionsDisabledAcrossPages();

    await userContext.close();
  });
});
