const { test } = require("@playwright/test");

const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const ScoreCalculationSingle = require("../../../pages/Secure/Collection/ScoreCalculationSingle");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const SelectQuestionType = require("../../../pages/Secure/FrameworkSettings/SelectQuestionType");
const SelectMandatoryOptions = require("../../../pages/Secure/FrameworkSettings/SelectMandatoryOptions");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const TestData = require("../../../constant/testData");

const {
  TEST_DATA_FILE_ENUMS,
  QUESTION_SETTINGS_QUESTION_TYPE_VALUE,
  MANDATORY_QUESTION_SETTINGS_NAME,
  MANDATORY_QUESTION_SETTINGS_VALUE,
  FILE_KEYS,
} = require("../../../constant/enums");
const {
  getAnswerOptions,
} = require("../../../helpers/collection/answerOptionsHelper");
const {
  calculateAverageAnswer,
} = require("../../../helpers/collection/calculateScoreHelper");

const TIMEOUTS = {
  LONG: 1200000,
};

test.describe("Single Answer and Calculation", () => {
  test("SCS - 01 | [@regression] Answer the Single Assessment and Verify score", async ({
    browser,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    /**********************************************************
     * ADMIN USER – CONTEXT 1
     **********************************************************/
    const context1 = await browser.newContext({ storageState: undefined });
    const page1 = await context1.newPage();

    const loginPage1 = new LoginPage(page1);
    const managementPage1 = new ManagementPage(page1);
    const addEntityPage1 = new AddEntityPage(page1);
    const collectionPage1 = new CollectionPage(page1);
    const scoreCalculationSinglePage1 = new ScoreCalculationSingle(page1);
    const selectQuestionType1 = new SelectQuestionType(page1);
    const suggested1 = new SelectMandatoryOptions(page1);

    await page1.goto("https://secure.cygovdev.com/");
    await loginPage1.login(
      process.env.ALPHA_USER_EMAIL,
      process.env.ALPHA_USER_PASSWORD,
    );

    const adminInbox = MailinatorHelper.extractMailinatorInput(
      process.env.MAILINATOR_ADDRESS,
    );

    const otp1 = await MailinatorHelper.getOTPFromMailinator(
      context1,
      adminInbox,
    );
    console.log("OTP1: ", otp1);
    await page1.bringToFront();
    await loginPage1.verifyOTP(otp1);
    await loginPage1.waitForURL(/\/clients/, 120000);
    console.log("Navigated to the clients screen");

    const EntityName = TestData.getKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    console.log("EntityName: ", EntityName);
    await managementPage1.searchAndClickClient(EntityName);

    await addEntityPage1.waitForSpinner();
    await addEntityPage1.clickMultiEntitySidebar();
    console.log("Clicked on the Multi Entity Sidebar");
    await addEntityPage1.clickNewEntity();

    const subEntityName = await addEntityPage1.createUniqueEntityName(
      FILE_KEYS.SUBENTITY_NAME,
    );
    console.log("SubEntityName: ", subEntityName);

    await addEntityPage1.selectRisk();
    console.log("Risk selected");
    await addEntityPage1.clickComplianceSubtab();
    console.log("Compliance selected");
    await addEntityPage1.selectCompliance();

    await suggested1.selectOptionFramework(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );
    console.log("Framework settings selected");

    await selectQuestionType1.setQuestionType(
      QUESTION_SETTINGS_QUESTION_TYPE_VALUE.Single,
    );

    await addEntityPage1.selectInitialCollectionMethod();
    await addEntityPage1.clickEntityAdd();
    await addEntityPage1.waitForToast();
    await addEntityPage1.verifyEntityInList(subEntityName);
    console.log("Entity added");

    await addEntityPage1.navigateToCollection();
    console.log("Navigated to the collection screen");
    await addEntityPage1.selectEntityAndNavigate(subEntityName);

    await collectionPage1.getFrameworkName(0);

    await scoreCalculationSinglePage1.clickEditIcon();
    await scoreCalculationSinglePage1.clickAddUser();
    console.log("User added");

    const newUserEmail =
      await scoreCalculationSinglePage1.generateRandomEmail(12);
    console.log("New User email: ", newUserEmail);
    const newUserName = await scoreCalculationSinglePage1.generateUniqueName();
    console.log("New User name: ", newUserName);
    const invitedUser = `${newUserEmail}@mailinator.com`;
    console.log("Invited User: ", invitedUser);

    await scoreCalculationSinglePage1.addUser({
      fullName: newUserName,
      email: invitedUser,
      role: "Participant",
    });

    console.log("User added to the collection");
    await scoreCalculationSinglePage1.enterSearchUser(newUserName);
    console.log("User searched");
    await scoreCalculationSinglePage1.dragAndDropUserToEntity1();
    console.log("User dragged to the entity");

    await scoreCalculationSinglePage1.clickEditIcon();
    await scoreCalculationSinglePage1.enterSearchUser(
      process.env.ALPHA_USER_NAME,
    );
    await scoreCalculationSinglePage1.dragAndDropUserToEntity1();
    console.log("Admin dragged to the entity");

    await context1.close();

    /**********************************************************
     * PARTICIPANT USER – CONTEXT 2
     **********************************************************/
    const context2 = await browser.newContext({ storageState: undefined });
    const page2 = await context2.newPage();

    const loginPage2 = new LoginPage(page2);
    const scoreCalculationSinglePage2 = new ScoreCalculationSingle(page2);
    const collectionPage2 = new CollectionPage(page2);

    await page2.goto("https://secure.cygovdev.com/");

    const tempPassword = await MailinatorHelper.getNewPasswordFromMailinator(
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

    await loginPage2.login(invitedUser, process.env.ALPHA_USER_PASSWORD);

    const otp2 = await MailinatorHelper.getOTPFromMailinator(
      context2,
      newUserEmail,
    );
    console.log("OTP2: ", otp2);
    await loginPage2.verifyOTP(otp2);

    await collectionPage2.getFrameworkName(0);
    console.log("Framework selected");

    const participantAnswers =
      await scoreCalculationSinglePage2.answerAllQuestionsParticipant();

    TestData.setKey(
      FILE_KEYS.SINGLE_SCORE_CALCULATION,
      participantAnswers,
      TEST_DATA_FILE_ENUMS.PARTICIPANTANSWERS,
    );

    await context2.close();

    /**********************************************************
     * ADMIN USER AGAIN – CONTEXT 3
     **********************************************************/
    const context3 = await browser.newContext({ storageState: undefined });
    const page3 = await context3.newPage();

    const loginPage3 = new LoginPage(page3);
    const scoreCalculationSinglePage3 = new ScoreCalculationSingle(page3);
    const collectionPage3 = new CollectionPage(page3);
    const managementPage3 = new ManagementPage(page3);
    const addEntityPage3 = new AddEntityPage(page3);

    await page3.goto("https://secure.cygovdev.com/");
    await loginPage3.login(
      process.env.ALPHA_USER_EMAIL,
      process.env.ALPHA_USER_PASSWORD,
    );

    const otp3 = await MailinatorHelper.getOTPFromMailinator(
      context3,
      adminInbox,
    );

    await loginPage3.verifyOTP(otp3);
    await loginPage3.waitForURL(/\/clients/, 120000);

    await managementPage3.searchAndClickClient(EntityName);

    await addEntityPage3.waitForSpinner();
    await addEntityPage3.clickMultiEntitySidebar();
    await addEntityPage3.navigateToCollection();
    await addEntityPage3.selectEntityAndNavigate(subEntityName);

    const frameworkName = await collectionPage3.getFrameworkName(0);
    const answerOption = await getAnswerOptions(frameworkName);

    const overallAnswers =
      await scoreCalculationSinglePage3.answerAllQuestionsWithUsers(
        "Automation Admin",
      );

    TestData.setKey(
      "questionAnswerSet",
      overallAnswers,
      TEST_DATA_FILE_ENUMS.ADMINANSWERS,
    );
    const totalScore = await calculateAverageAnswer(
      overallAnswers,
      answerOption,
    );
    // get score from UI
    const score = await scoreCalculationSinglePage3.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    //round totalScore to 1 decimal and convert to number
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));
    expect(uiScore).toBe(roundedTotalScore);
  });
});
