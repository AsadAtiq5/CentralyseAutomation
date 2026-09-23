const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ApplyFiltersEntityLeader = require("../../../pages/EntityLeader/Collection/applyFiltersEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 600000,
};

// This suite READS the score calculation suite's data file for everything it
// needs - the sub-entity UUIDs AND the answer set. Nothing is produced here, so
// there is no file of its own.
const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_SCORE_CALCULATION;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key the score calculation suite stored, naming the producer when it
// is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Collection/scoreCalculationEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Apply Filters Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // WHAT THIS ASSERTS AGAINST, and why it needs the score calculation suite for
  // BOTH halves of the comparison.
  //
  // The Secure AF - 01 depends on scoreCalculation.spec.js twice over: SC - 00
  // for the client it walks into, and SC - 01 for the answer set that becomes
  // the expected result. This spec has the same two dependencies, both on the
  // EntityLeader side - SCEL - 00 for the sub-entity UUIDs and SCEL - 01 for
  // the 21-odd answers it recorded.
  //
  // That second one is the point of the test: the filters are checked against
  // what was actually answered, derived from stored data, never read back off
  // the screen the assertion is checking.
  //
  // DEPENDENCY - SCEL - 00 and SCEL - 01 must both have completed, in the SAME
  // run: ELS - 01 provisions a brand new client on every invocation, so data
  // left over from a previous run describes an assessment this session's leader
  // cannot reach. The runner orders this file after the score calculation spec,
  // and required() names the producer if the keys are missing.
  let applyFiltersEntityLeader;

  test.beforeEach(async ({ page }) => {
    applyFiltersEntityLeader = new ApplyFiltersEntityLeader(page);
    // Armed before navigating: this assessment is fully answered, so the
    // chapter completion modal surfaces on the framework open and would
    // intercept the click on the filters popup. openFiltersPanel() does both in
    // one delegated call, so a handler is the only way to catch it.
    await applyFiltersEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await applyFiltersEntityLeader.goto("/");
    await applyFiltersEntityLeader.waitForLoad();
  });

  test("AFEL - 01 | @smoke Verify collection filters as the entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const entityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_ID,
      "SCEL - 00",
    );
    const subEntityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_SUBENTITY_ID,
      "SCEL - 00",
    );
    const questionData = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ANSWERS,
      "SCEL - 01",
    );

    // required() catches a missing key, but not a key holding an empty array -
    // an answer set with nothing in it would make every filter trivially match
    // and the assertion below meaningless.
    if (!Array.isArray(questionData) || questionData.length === 0) {
      throw new Error(
        "Missing entity leader answer data. Run tests/EntityLeader/Collection/scoreCalculationEntityLeader.spec.js (SCEL - 00, then SCEL - 01) before this spec.",
      );
    }
    console.log(
      `Question data set: ${questionData.length} answered question(s).`,
    );

    // 1) Arrival, not navigation - the session puts this role on the upperdeck.
    await applyFiltersEntityLeader.ensureOnUpperdeck();

    // 2) Straight onto the SCEL sub-entity's collection card list. This
    //    replaces the Secure spec's /clients search and click-into-client, and
    //    the framework card is deliberately left CLOSED - step 3 opens it.
    await applyFiltersEntityLeader.openSubEntityCollection(
      entityID,
      subEntityID,
    );

    // 3) Opening the panel also opens the framework card, so the assessment is
    //    deliberately not opened before this call.
    await applyFiltersEntityLeader.openFiltersPanel();

    const finalSelection = await applyFiltersEntityLeader.selectRandomFilters();
    await applyFiltersEntityLeader.applyFilters();

    const answerFiltered =
      await applyFiltersEntityLeader.getExpectedFilteredQuestions(
        questionData,
        finalSelection,
      );
    console.log("Filtered Questions:", answerFiltered);

    const filterCount = answerFiltered.length;
    if (filterCount === 0) {
      // A random selection can legitimately match nothing; there is no question
      // list to assert against in that case.
      console.log("No Data Found");
    }
    if (filterCount > 0) {
      const questionCount = await applyFiltersEntityLeader.getQuestionCount();
      console.log(
        `Question count - expected ${filterCount} | actual ${questionCount}`,
      );
      expect(questionCount).toBe(filterCount);
      await applyFiltersEntityLeader.verifyFilteredQuestionsSet(finalSelection);
    }
  });
});
