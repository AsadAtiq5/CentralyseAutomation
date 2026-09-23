const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ScoreCalculationSubEntityLeader = require("../../../pages/SubEntityLeader/Collection/scoreCalculationSubEntityLeader");
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
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Score Calculation Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  let scoreCalculationSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    scoreCalculationSubEntityLeader = new ScoreCalculationSubEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await scoreCalculationSubEntityLeader.goto("/");
    await scoreCalculationSubEntityLeader.waitForLoad();
  });

  test("SCSEL - 01 | @regression Answer the assessment as the sub entity leader and verify the score", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) The leader lands on multi entity, not the collection, so the screen is
    //    confirmed before navigating on from it.
    await scoreCalculationSubEntityLeader.verifyOnMultiEntityScreen();

    // 2) Side menu is the only route to the collection for this role - there is
    //    no client/entity picker to go through first.
    await scoreCalculationSubEntityLeader.navigateToCollectionFromSideMenu();

    // 3) The framework name resolves this framework's answer options, which
    //    carry the per-answer scores the expected total is built from.
    const frameworkName =
      await scoreCalculationSubEntityLeader.getFrameworkNameAndOpen(0);
    const answerOption = await getAnswerOptions(frameworkName);

    // 4) Answer every question across every page of the assessment.
    const answers =
      await scoreCalculationSubEntityLeader.questionEngine.answerAllQuestions();

    // 5) The card score is rendered from the saved answers, so the screen has
    //    to be reloaded before it is read.
    await scoreCalculationSubEntityLeader.reloadForScore();

    // 6) Expected score is derived from the answers just given, never read back
    //    off the screen the assertion is checking.
    const totalScore = calculateScore(answers, answerOption, false);

    const score = await scoreCalculationSubEntityLeader.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    // The UI renders one decimal place, so the calculated score is rounded to
    // match before comparing.
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));

    // Stored for any follow-up spec that has to re-verify this same score as
    // the admin: the answers were random and cannot be re-derived later.
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_SCORE_ANSWERS,
      answers,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_ANSWERS,
      APP_SCOPE.SUB_ENTITY_LEADER,
    );
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_FRAMEWORK_NAME,
      frameworkName,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_ANSWERS,
      APP_SCOPE.SUB_ENTITY_LEADER,
    );

    console.log(`Framework: ${frameworkName}`);
    console.log(`Questions answered: ${answers.length}`);
    console.log(`expected ${roundedTotalScore} | actual ${uiScore}`);
    expect(uiScore).toBe(roundedTotalScore);
  });
});
