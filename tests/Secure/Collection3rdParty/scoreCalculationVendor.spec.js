const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/Secure/LoginPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const ScoreCalculationThirdParty = require("../../../pages/Secure/Collection 3rd Party/ScoreCalculationThirdParty");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const ScoreCalculationVendor = require("../../../pages/Secure/Collection 3rd Party/ScoreCalculationVendor");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const TestData = require("../../../constant/testData");

test.describe("Score Calculation Vendor", () => {
  test("SCV - 01 | Score Calculation Vendor", async ({ browser }) => {
    test.setTimeout(1200000);

    /***********************************************************
     * CONTEXT 1 – Admin: Create vendor with invited user email
     ***********************************************************/
    const context1 = await browser.newContext({ storageState: undefined });
    const page1 = await context1.newPage();

    const loginPage1 = new LoginPage(page1);
    const addVendorPage1 = new AddVendorPage(page1);
    const scoreCalcHelper = new ScoreCalculationVendor(page1);

    await loginPage1.navigate();
    await loginPage1.login(process.env.USER_EMAIL, process.env.USER_PASSWORD);

    const adminInbox = MailinatorHelper.extractMailinatorInput(
      process.env.MAILINATOR_ADDRESS,
    );
    const otp1 = await MailinatorHelper.getOTPFromMailinator(
      context1,
      adminInbox,
    );
    console.log("Admin OTP: ", otp1);
    await page1.bringToFront();
    await loginPage1.verifyOTP(otp1);
    await loginPage1.waitForURL(/\/clients/, 180000);
    console.log("Admin logged in");

    // Navigate to vendors page
    const clientId = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await addVendorPage1.goto(`/third-party/${clientId}/vendors`);
    await addVendorPage1.waitForLoad();
    await addVendorPage1.waitForSpinner();

    // Open Add Vendor popup
    await addVendorPage1.clickAddVendorButton();
    await addVendorPage1.waitForSpinner();
    await addVendorPage1.verifyAddVendorPopup();

    // Enter Vendor Name (max 20 chars) and save as vendorScoreCalculation in vendor.json
    const vendorName = await addVendorPage1.createUniqueVendorNameShort("VS");
    console.log("Vendor Name: ", vendorName);
    TestData.setKey(
      FILE_KEYS.VENDOR_SCORE_CALCULATION_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // Enter unique POC name
    await addVendorPage1.createUniquePOCName("POC");

    // Generate random email and save in variable for POC email field
    const newUserEmail = scoreCalcHelper.generateRandomEmail(12);
    console.log("New User email: ", newUserEmail);
    const invitedUser = `${newUserEmail}@mailinator.com`;
    console.log("Invited User: ", invitedUser);
    await addVendorPage1.fill(
      addVendorPage1.selectors.inputPOCEmail,
      invitedUser,
    );

    // Click Next → Select AI Governance Framework → Click Next
    await addVendorPage1.clickNextButton();
    await addVendorPage1.waitForSpinner();
    await addVendorPage1.selectAIGovernanceFramework();
    await addVendorPage1.clickNextButton();
    await addVendorPage1.waitForSpinner();

    // Select random requirements and save
    const selectedRequirements =
      await addVendorPage1.selectRandomRequirements();
    console.log("Selected Requirements: ", selectedRequirements);
    TestData.setKey(
      FILE_KEYS.VENDOR_REQUIREMENTS,
      selectedRequirements,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // Select random certifications and save
    const selectedCertifications =
      await addVendorPage1.selectRandomCertifications();
    console.log("Selected Certifications: ", selectedCertifications);
    TestData.setKey(
      FILE_KEYS.VENDOR_CERTIFICATIONS,
      selectedCertifications,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // Turn off the 3rd Party external scan toggle before completing
    await addVendorPage1.turnOffThirdPartyToggle();

    // Complete vendor creation
    await addVendorPage1.clickCompleteButton();
    await addVendorPage1.waitForSpinner();
    await addVendorPage1.waitForAddVendorPopupHidden();
    await addVendorPage1.waitForInProgressVendorStatusHidden();
    console.log("Vendor created successfully");

    // Navigate into vendor collection and extract UUIDs from URL
    await addVendorPage1.verifyVendorVisible(vendorName);
    await addVendorPage1.clickVendorByName(vendorName);
    await addVendorPage1.waitForSpinner();
    await addVendorPage1.clickCollectionSidemenu();
    await addVendorPage1.waitForSpinner();

    const uuids = fetchPageURL(page1.url());
    const vendorClientId = uuids[0] || clientId;
    const vendorId = uuids[1];
    console.log(
      "Vendor Client ID: ",
      vendorClientId,
      " | Vendor ID: ",
      vendorId,
    );
    TestData.setKey(
      FILE_KEYS.VENDOR_SCORE_CALCULATION_CLIENT_ID,
      vendorClientId,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    TestData.setKey(
      FILE_KEYS.VENDOR_SCORE_CALCULATION_UUID,
      vendorId,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    await context1.close();

    /***********************************************************
     * CONTEXT 2 – Invited vendor user: Register, login & score
     ***********************************************************/
    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);
    const scoreCalculationPage2 = new ScoreCalculationThirdParty(page2);
    const questionEngine2 = new QuestionEngine(page2);

    await loginPage2.navigate();

    // Get temp password from mailinator and complete registration
    const tempPassword = await MailinatorHelper.getVendorPasswordFromMailinator(
      context2,
      newUserEmail,
    );
    console.log("Temp Password: ", tempPassword);

    await loginPage2.login(invitedUser, tempPassword);
    await loginPage2.completePasswordReset(
      process.env.ALPHA_USER_PASSWORD,
      "United States",
      "2512594474",
    );
    console.log("Password reset complete");

    // Login with new password and verify OTP
    await loginPage2.login(invitedUser, process.env.ALPHA_USER_PASSWORD);
    const otp2 = await MailinatorHelper.getVendorOTPFromMailinator(
      context2,
      newUserEmail,
    );
    console.log("OTP2: ", otp2);
    await page2.bringToFront();
    await loginPage2.verifyOTP(otp2);

    // Wait for auto-redirect to the vendor collection page after OTP verification
    await loginPage2.waitForURL(/\/collection/, 180000);
    console.log("Vendor user logged in and redirected to collection");
    await page2
      .waitForLoadState("networkidle", { timeout: 180000 })
      .catch(() => {});

    // Wait for the first question container to be visible before answering
    await page2.waitForSelector(
      "cygov-collection-question-card .question-container",
      {
        state: "visible",
        timeout: 180000,
      },
    );

    // Reload the page before answering the questions
    await page2.reload();
    await loginPage2.waitForLoad();
    await loginPage2.waitForSpinner();
    await page2.waitForTimeout(3000);

    // Answer all questions
    const answers = await questionEngine2.answerAllQuestions();

    // Save answers to collection3rdParty.json
    TestData.setKey(
      FILE_KEYS.VENDOR_QUESTION_ANSWER,
      answers,
      TEST_DATA_FILE_ENUMS.COLLECTION_3RD_PARTY,
    );

    // Reload so the collection overview re-renders the freshly computed score.
    // The overview intermittently stalls on "Loading Collection Overview" and the
    // score card is not rendered; a reload reliably re-triggers rendering.
    await page2.reload();
    await loginPage2.waitForLoad();
    await loginPage2.waitForSpinner();
    await page2.waitForSelector(".entity-card-box span.total-score", {
      state: "visible",
      timeout: 180000,
    });

    // Calculate expected score and compare with UI score
    const totalScore = ScoreCalculationVendor.calculateVendorScore(answers);
    const score = await scoreCalculationPage2.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));
    console.log(
      "Calculated Score: ",
      roundedTotalScore,
      " | UI Score: ",
      uiScore,
    );

    expect(uiScore).toBe(roundedTotalScore);

    await context2.close();
  });
});
