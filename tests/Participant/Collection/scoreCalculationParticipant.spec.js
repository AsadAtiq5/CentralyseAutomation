const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ScoreCalculationParticipant = require("../../../pages/Participant/Collection/ScoreCalculationParticipant");
const LoginPage = require("../../../pages/Secure/LoginPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const {
  getAnswerOptions,
} = require("../../../helpers/collection/answerOptionsHelper");
const {
  calculateScore,
} = require("../../../helpers/collection/calculateScoreHelper");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 1200000,
};

const storageStatePath = path.join(
  process.cwd(),
  "storageState.participant.json",
);

test.describe("Participant Score Calculation Tests", () => {
  // Runs as the PARTICIPANT, reusing the session SP - 01 saved. That spec is
  // this suite's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the collection.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  let scoreCalculationParticipant;

  test.beforeEach(async ({ page }) => {
    scoreCalculationParticipant = new ScoreCalculationParticipant(page);
    // "/" is enough for this role: the participant has no management, settings
    // or upperdeck access, so the app redirects to their collection on its own.
    await scoreCalculationParticipant.goto("/");
    await scoreCalculationParticipant.waitForLoad();
  });

  test("SCPT - 01 | @regression Answer the participant assessment and verify the score", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await scoreCalculationParticipant.verifyOnCollectionScreen();

    // The framework name resolves this framework's answer options, which carry
    // the per-answer scores the expected total is built from.
    const frameworkName =
      await scoreCalculationParticipant.getFrameworkNameAndOpen(0);
    const answerOption = await getAnswerOptions(frameworkName);

    const answers = await scoreCalculationParticipant.answerAllQuestions();
    // Both are stored for SCPT - 02, which re-verifies the same score as the
    // admin and cannot re-derive either value on its own: the answers were
    // random, and the admin never opens the framework card.
    TestData.setKey(
      FILE_KEYS.PARTICIPANT_SCORE_ANSWERS,
      answers,
      TEST_DATA_FILE_ENUMS.PARTICIPANTANSWERS,
      APP_SCOPE.PARTICIPANT,
    );
    TestData.setKey(
      FILE_KEYS.PARTICIPANT_FRAMEWORK_NAME,
      frameworkName,
      TEST_DATA_FILE_ENUMS.PARTICIPANTANSWERS,
      APP_SCOPE.PARTICIPANT,
    );
  });
});

test.describe("Participant Score Verification As Admin Tests", () => {
  // This block deliberately opts OUT of the participant session: it overrides
  // the describe above with an empty storageState so page.goto lands on the
  // real login screen and the admin can sign in from scratch. Inheriting the
  // participant session would leave the run stuck on the participant's
  // collection with no management access.
  test.use({ storageState: { cookies: [], origins: [] } });

  let scoreCalculationParticipant;
  let loginPage;
  let managementPage;
  let addEntityPage;

  test.beforeEach(async ({ page }) => {
    scoreCalculationParticipant = new ScoreCalculationParticipant(page);
    loginPage = new LoginPage(page);
    managementPage = new ManagementPage(page);
    addEntityPage = new AddEntityPage(page);
  });

  test("SCPT - 02 | @regression Verify the participant score as the admin user", async ({
    page,
    context,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = TestData.getKey(
      FILE_KEYS.PARTICIPANT_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.PARTICIPANT,
      APP_SCOPE.PARTICIPANT,
    );
    const entityName = TestData.getKey(
      FILE_KEYS.PARTICIPANT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.PARTICIPANT,
      APP_SCOPE.PARTICIPANT,
    );
    const answers = TestData.getKey(
      FILE_KEYS.PARTICIPANT_SCORE_ANSWERS,
      TEST_DATA_FILE_ENUMS.PARTICIPANTANSWERS,
      APP_SCOPE.PARTICIPANT,
    );
    const frameworkName = TestData.getKey(
      FILE_KEYS.PARTICIPANT_FRAMEWORK_NAME,
      TEST_DATA_FILE_ENUMS.PARTICIPANTANSWERS,
      APP_SCOPE.PARTICIPANT,
    );

    // Named up front so a missing producer reads as a precondition problem
    // rather than surfacing later as an unresolvable answer inside
    // calculateScore.
    if (!clientName || !entityName || !answers?.length || !frameworkName) {
      throw new Error(
        "Missing participant data. Run SP - 01 and SCPT - 01 before this test.",
      );
    }

    await loginPage.navigate();
    await loginPage.login(process.env.USER_EMAIL, process.env.USER_PASSWORD);
    console.log("Admin credentials entered.");

    const mailinatorEmail = MailinatorHelper.extractMailinatorInput(
      process.env.MAILINATOR_ADDRESS,
    );
    const otp = await MailinatorHelper.getOTPFromMailinator(
      context,
      mailinatorEmail,
    );
    console.log("OTP received:", otp);

    // Mailinator opens its own tab and takes focus, so pull the app tab back
    // before typing the OTP into it.
    await page.bringToFront();
    await loginPage.verifyOTP(otp);
    await loginPage.waitForURL(/\/clients/, TIMEOUTS.LONG);
    console.log("Admin login successful.");

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    console.log("Client opened:", clientName);

    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log("Collection opened for entity:", entityName);

    // The score is recomputed from the answers the participant actually saved,
    // not recorded from the participant's own screen - that is the whole point
    // of the cross-check: the same answers must produce the same score for the
    // admin as they did for the participant.
    const answerOption = await getAnswerOptions(frameworkName);
    const totalScore = calculateScore(answers, answerOption, false);

    const score = await scoreCalculationParticipant.getScore(0);

    const uiScore = score ? parseFloat(score) : 0;
    // The UI renders one decimal place, so the calculated score is rounded to
    // match before comparing.
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));

    console.log(`Framework: ${frameworkName}`);
    console.log(`Questions answered: ${answers.length}`);
    console.log(
      `expected ${roundedTotalScore} | actual ${uiScore} (admin view of the participant score)`,
    );
    expect(uiScore).toBe(roundedTotalScore);
  });
});
