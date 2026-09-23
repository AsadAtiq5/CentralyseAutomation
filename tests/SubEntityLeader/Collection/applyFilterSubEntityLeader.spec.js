const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ApplyFilterSubEntityLeader = require("../../../pages/SubEntityLeader/Collection/applyFilterSubEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 600000,
};

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Apply Filters Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  let applyFilterSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    applyFilterSubEntityLeader = new ApplyFilterSubEntityLeader(page);
    // Armed before navigating: this assessment is fully answered, so the
    // chapter completion modal surfaces part-way through and intercepts every
    // click underneath it.
    await applyFilterSubEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await applyFilterSubEntityLeader.goto("/");
    await applyFilterSubEntityLeader.waitForLoad();
  });

  test("AFSEL - 01 | @smoke Verify collection filters as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // The expected result comes from the answer set SCSEL - 01 stored, so the
    // filters are checked against what was actually answered rather than
    // against the screen being asserted.
    const questionData = TestData.getKey(
      FILE_KEYS.SUB_ENTITY_LEADER_SCORE_ANSWERS,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_ANSWERS,
      APP_SCOPE.SUB_ENTITY_LEADER,
    );

    // Name the producer instead of letting a locator time out further down - a
    // missing key here means SCSEL - 01 has not run, not a filter bug.
    if (!questionData || questionData.length === 0) {
      throw new Error(
        "Missing sub entity leader answer data. Run tests/SubEntityLeader/Collection/scoreCalculationSubEntityLeader.spec.js (SCSEL - 01) before this spec.",
      );
    }
    console.log(
      `Question data set: ${questionData.length} answered question(s).`,
    );

    // 1) The leader lands on multi entity, not the collection, so the screen is
    //    confirmed before navigating on from it.
    await applyFilterSubEntityLeader.verifyOnMultiEntityScreen();

    // 2) Side menu is the only route to the collection for this role - there is
    //    no client/entity picker to go through first.
    await applyFilterSubEntityLeader.navigateToCollectionFromSideMenu();
    await applyFilterSubEntityLeader.waitForLoad();
    await applyFilterSubEntityLeader.waitForSpinner();

    // 3) Opening the panel also opens the framework card, so the assessment is
    //    deliberately not opened before this call.
    await applyFilterSubEntityLeader.openFiltersPanel();

    const finalSelection =
      await applyFilterSubEntityLeader.selectRandomFilters();
    await applyFilterSubEntityLeader.applyFilters();

    const answerFiltered =
      await applyFilterSubEntityLeader.getExpectedFilteredQuestions(
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
      const questionCount = await applyFilterSubEntityLeader.getQuestionCount();
      console.log(
        `Question count - expected ${filterCount} | actual ${questionCount}`,
      );
      expect(questionCount).toBe(filterCount);
      await applyFilterSubEntityLeader.verifyFilteredQuestionsSet(
        finalSelection,
      );
    }
  });
});
