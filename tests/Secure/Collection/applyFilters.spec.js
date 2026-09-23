const { test, expect } = require("@playwright/test");
const Filters = require("../../../pages/Secure/Collection/Filters");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");
const TestData = require("../../../constant/testData");
const path = require("path");
const fs = require("fs");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Apply Filters Tests", () => {
  let filters;
  let managementPage;
  let addEntityPage;

  // This spec depends on scoreCalculation.spec.js: SC - 00 creates the ScoreCalc client
  // and its sub-entity, SC - 01 answers the assessment and stores the answer set used
  // here as the expected result. The hook only lands on /clients - AF - 01 walks the UI
  // from there so the filters always run against the sub-entity SC - 01 answered.
  test.beforeEach(async ({ page }) => {
    filters = new Filters(page);
    managementPage = new ManagementPage(page);
    addEntityPage = new AddEntityPage(page);

    await managementPage.navigate();
  });

  test("AF - 01 | @smoke Verify filters", async () => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.SCORE_CALCULATION_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
    );
    const questionData = TestData.getKey(
      FILE_KEYS.SCORE_CALCULATION_ANSWERS,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION,
    );

    // Name the producer instead of letting a search or locator time out further down -
    // a missing key here means the score calculation spec has not run, not a filter bug.
    if (!clientName || !questionData || questionData.length === 0) {
      throw new Error(
        "Missing score calculation test data. Run tests/Secure/Collection/scoreCalculation.spec.js (SC - 00, then SC - 01) before this spec.",
      );
    }
    console.log("question data set: ", questionData);

    // Search the same client SC - 00 created and open its collection. The ScoreCalc
    // client owns a single sub-entity, so /collection lands on it directly and no
    // sub-entity dropdown selection is needed.
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.navigateToCollection();
    await filters.waitForLoad();
    await filters.waitForSpinner();

    await filters.clickFiltersButton();
    const finalSelection = await filters.randomFilterSelector();
    await filters.clickApplyFilterButton();
    const answerFiltered = await filters.filterQuestions(
      questionData,
      finalSelection,
    );
    console.log("Filtered Questions:", answerFiltered);
    const filterCount = answerFiltered.length;
    if (filterCount === 0) {
      console.log("No Data Found");
    }
    if (filterCount > 0) {
      const questionCount = await filters.getQuestionCount();
      console.log(
        `Question count - expected ${filterCount} | actual ${questionCount}`,
      );
      expect(questionCount).toBe(filterCount);
      await filters.verifyFilteredQuestionsSet(finalSelection);
    }
  });
});
