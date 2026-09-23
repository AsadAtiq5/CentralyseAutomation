const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ScoreCalculationThirdParty = require("../../../pages/Secure/Collection 3rd Party/ScoreCalculationThirdParty");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const {
  getAnswerOptions,
} = require("../../../helpers/collection/answerOptionsHelper");
const {
  calculateScore,
} = require("../../../helpers/collection/calculateScoreHelper");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const TestData = require("../../../constant/testData");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Score Calculation Third Party", () => {
  let scoreCalculationThirdPartyPage;
  let collectionPage;
  let questionEngine;
  let managementPage;
  let addClientPage;
  let addVendorPage;

  test.beforeEach(async ({ page }) => {
    scoreCalculationThirdPartyPage = new ScoreCalculationThirdParty(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addVendorPage = new AddVendorPage(page);

    // This spec owns its data: SC3P - 00 creates the client and vendor, so every
    // test starts from the clients list and walks the UI instead of deep-linking
    // with entity/vendor IDs produced by other specs.
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("SC3P - 00 | @smoke Setup client and vendor for third party score calculation", async () => {
    test.setTimeout(600000);

    // Create a dedicated client for this spec
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("SC3PClient");
    TestData.setKey(
      FILE_KEYS.SC3P_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION_3RD_PARTY,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    // await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);

    // Open the client and move to its vendors screen
    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();

    // Create the vendor whose questionnaire SC3P - 01 scores. AI Governance is
    // deliberate: getAnswerOptions resolves the answer enum by framework key, so a
    // different framework changes the expected score calculation.
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    // The vendor name field caps at 20 characters, so use the short generator —
    // otherwise the stored name would not match what the app actually saved.
    const vendorName =
      await addVendorPage.createUniqueVendorNameShort("SC3PVendor");
    TestData.setKey(
      FILE_KEYS.SC3P_VENDOR_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION_3RD_PARTY,
    );
    await addVendorPage.createUniquePOCName("POC");
    await addVendorPage.createUniquePOCEmail(vendorName);
    await addVendorPage.clickNextButton();
    await addVendorPage.selectAIGovernanceFramework();
    await addVendorPage.clickNextButton();
    await addVendorPage.clickAddDomainButton();
    await addVendorPage.createUniqueDomainName("domain");
    await addVendorPage.clickCompleteButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.waitForAddVendorPopupHidden();

    // Vendor creation finishes asynchronously — wait out the In Progress status
    // before asserting the vendor is listed
    await addVendorPage.waitForInProgressVendorStatusHidden();
    await addVendorPage.verifyVendorVisible(vendorName);
  });

  test("SC3P - 01 | Score Calculation third party", async () => {
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

    // Open the vendor created in SC3P - 00, then its collection
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();

    // getFrameworkName also clicks OPEN on the card, so this both reads the
    // framework and enters the questionnaire
    const frameworkName = await collectionPage.getFrameworkName(0);
    const answerOption = await getAnswerOptions(frameworkName);

    const answers = await questionEngine.answerAllQuestions();

    // calculate expected score
    const totalScore = calculateScore(answers, answerOption);

    // get score from UI
    const score = await scoreCalculationThirdPartyPage.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    //round totalScore to 1 decimal and convert to number
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));
    // Assert that UI score matches calculated score
    TestData.setKey(
      FILE_KEYS.QUESTION_ANSWER_SET_3RD_PARTY,
      answers,
      TEST_DATA_FILE_ENUMS.SCORE_CALCULATION_3RD_PARTY,
    );
    expect(uiScore).toBe(roundedTotalScore);
  });
});
