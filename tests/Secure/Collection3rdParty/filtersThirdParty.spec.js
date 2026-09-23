const { test, expect } = require("@playwright/test");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const FiltersThirdParty = require("../../../pages/Secure/Collection 3rd Party/FiltersThirdParty");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const TestData = require("../../../constant/testData");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");
const path = require("path");
const fs = require("fs");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Collection 3rd Party Filters", () => {
  let collectionPage;
  let filtersThirdParty;
  let managementPage;
  let addVendorPage;

  test.beforeEach(async ({ page }) => {
    collectionPage = new CollectionPage(page);
    filtersThirdParty = new FiltersThirdParty(page);
    managementPage = new ManagementPage(page);
    addVendorPage = new AddVendorPage(page);

    // Start from the clients list and walk the UI instead of deep-linking with
    // entity/vendor IDs owned by other specs. The client and vendor come from
    // SC3P - 00, so this spec runs after the score calculation spec.
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("FT3P - 01 | Verify filters", async () => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.SC3P_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION_3RD_PARTY,
    );
    const vendorName = TestData.getKey(
      FILE_KEYS.SC3P_VENDOR_NAME,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION_3RD_PARTY,
    );

    // Search the client created in SC3P - 00 and open its vendors screen
    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();

    // Open the vendor answered by SC3P - 01, then its collection
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();

    // Open the questions on the first framework card, then the filters popup.
    // getFrameworkName already clicks OPEN, so clickFiltersPopupButton is used
    // instead of clickFiltersButton, which would try to open the card again.
    const frameworkName = await collectionPage.getFrameworkName(0);
    console.log(`Framework under test: ${frameworkName}`);
    await filtersThirdParty.clickFiltersPopupButton();
    const finalSelection = await filtersThirdParty.randomFilterSelector();
    console.log("Selected Filters:", finalSelection);
    await filtersThirdParty.clickApplyFilterButton();
    const questionData = TestData.getKey(
      FILE_KEYS.QUESTION_ANSWER_SET_3RD_PARTY,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION_3RD_PARTY,
    );
    console.log("question data set:", questionData);
    if (questionData.length === 0) {
      console.log("Run the scorecalculation test first");
      expect(true).toBe(false);
    }
    const answerFiltered = await filtersThirdParty.filterQuestions(
      questionData,
      finalSelection,
    );
    const filterCount = answerFiltered.length;
    if (filterCount === 0) {
      console.log("No Data Found");
    }
    if (filterCount > 0) {
      const questionCount = await filtersThirdParty.getQuestionCount();
      expect(questionCount).toBe(filterCount);
      await filtersThirdParty.verifyFilteredQuestionsSet(finalSelection);
    }
  });
});
