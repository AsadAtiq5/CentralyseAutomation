const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ScoreCalculationEntityLeader = require("../../../pages/EntityLeader/Collection/scoreCalculationEntityLeader");
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

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_SCORE_CALCULATION;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

// Prefix for the sub-entity SCEL - 00 builds, so it is identifiable in a client
// that also carries the upperdeck suite's UDEL_Entity set.
const ENTITY_PREFIX = "SCEL_Entity";

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Collection/scoreCalculationEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Score Calculation Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // SC - 00 HAS A COUNTERPART HERE, but it does a different job.
  //
  // The Secure SC - 00 creates a dedicated CLIENT for this flow, then a
  // sub-entity inside it, so the assessment it answers is the only one on the
  // client. An entity leader cannot create a client - it has no /clients screen
  // - but it is scoped to the whole client ELS - 01 provisioned and CAN add
  // entities to it. So SCEL - 00 creates the multi entity instead, which gives
  // the same isolation at the level this role actually owns: a brand new
  // sub-entity whose only assessment is the one SCEL - 01 answers, making the
  // card score attributable to those answers alone.
  //
  // ORDERING - SCEL - 01 depends on SCEL - 00 for the two collection UUIDs.
  // Those are not rendered anywhere on screen, so they can only be read off the
  // URL the setup test lands on. workers: 1 and fullyParallel: false preserve
  // declaration order.
  let scoreCalculationEntityLeader;

  test.beforeEach(async ({ page }) => {
    scoreCalculationEntityLeader = new ScoreCalculationEntityLeader(page);
    // Armed before any navigation: the chapter-completion modal surfaces
    // part-way through the question work, not at a point a spec could probe for.
    await scoreCalculationEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck. Each test
    // navigates on from there itself - SCEL - 01 deep links straight into the
    // collection using the UUIDs SCEL - 00 stored.
    await scoreCalculationEntityLeader.goto("/");
    await scoreCalculationEntityLeader.waitForLoad();
  });

  test("SCEL - 00 | @smoke Setup: create a multi entity for the score calculation flow", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Arrival, not navigation - the session puts this role on the upperdeck.
    //    This replaces the whole of the Secure spec's /clients navigation,
    //    client creation and client-card click.
    await scoreCalculationEntityLeader.ensureOnUpperdeck();

    // 2) Build the dedicated sub-entity. Business Email Compromise with
    //    user-based collection, matching what the Secure SC - 00 picks.
    await scoreCalculationEntityLeader.navigateToMultiEntity();
    const entityName =
      await scoreCalculationEntityLeader.createEntityForScoreCalculation(
        ENTITY_PREFIX,
      );

    // 3) Open its collection through the side menu and the entity dropdown.
    //    This is the only route available before the UUIDs are known.
    await scoreCalculationEntityLeader.openCollectionForEntity(entityName);

    // 4) The two UUIDs come off the collection URL - the only place they are
    //    exposed - and let SCEL - 01 deep link in without walking the dropdown
    //    again.
    const uuids = await scoreCalculationEntityLeader.getCollectionIds();
    if (uuids.length < 2) {
      throw new Error(
        `Expected an entity and a sub-entity UUID in the collection URL, got ${uuids.length}: ${uuids.join(", ")}`,
      );
    }

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_ID,
      uuids[0],
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_SUBENTITY_ID,
      uuids[1],
      FILE,
      SCOPE,
    );
    console.log(
      `Setup complete - entity "${entityName}" with entity ID ${uuids[0]} and sub-entity ID ${uuids[1]} saved.`,
    );
  });

  test("SCEL - 01 | @regression Answer the Assessment and verify score", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const entityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_ID,
      "SCEL - 00",
    );
    const subEntityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_SUBENTITY_ID,
      "SCEL - 00",
    );

    // 1) Straight into the sub-entity SCEL - 00 built. The Secure spec spends
    //    its beforeEach doing exactly this; this role can deep link the same
    //    way because it is scoped to the whole client.
    await scoreCalculationEntityLeader.openCollectionByIds(
      entityID,
      subEntityID,
    );

    // 2) The framework name resolves this framework's answer options, which
    //    carry the per-answer scores the expected total is built from.
    const frameworkName =
      await scoreCalculationEntityLeader.getFrameworkNameAndOpen(0);
    const answerOption = await getAnswerOptions(frameworkName);

    // 3) Answer every question across every page of the assessment.
    const answers =
      await scoreCalculationEntityLeader.questionEngine.answerAllQuestions();

    // 4) The card score is rendered from the saved answers, so the collection
    //    has to be reopened before it is read.
    await scoreCalculationEntityLeader.refreshCollectionForScore(
      entityID,
      subEntityID,
    );

    // 5) Expected score is derived from the answers just given, never read back
    //    off the screen the assertion is checking.
    const totalScore = calculateScore(answers, answerOption, false);

    const score = await scoreCalculationEntityLeader.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    // The UI renders one decimal place, so the calculated score is rounded to
    // match before comparing.
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));

    // Stored for any follow-up spec that has to re-verify this same score: the
    // answers were random and cannot be re-derived later.
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ANSWERS,
      answers,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_FRAMEWORK_NAME,
      frameworkName,
      FILE,
      SCOPE,
    );

    console.log(`Framework: ${frameworkName}`);
    console.log(`Questions answered: ${answers.length}`);
    console.log(`Score - expected ${roundedTotalScore} | actual ${uiScore}`);
    expect(uiScore).toBe(roundedTotalScore);
  });
});
