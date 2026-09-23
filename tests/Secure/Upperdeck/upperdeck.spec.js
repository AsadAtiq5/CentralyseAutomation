const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const Upperdeck = require("../../../pages/Secure/Upperdeck/Upperdeck");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const {
  getAssociatedRiskCount,
} = require("../../../helpers/riskRegister/riskGroupHelper");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  DEFAULT: 60000,
  SHORT: 120000,
  MEDIUM: 300000,
  LONG: 600000,
  EXTRA_LONG: 1200000,
};

const TEST_DATA = {
  CLIENT_PREFIX: "UD",
  DEFAULT_FIRST_PARTY_URL: "",
};

test.describe("Upperdeck Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let collectionPage;
  let questionEngine;
  let upperdeck;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);
    upperdeck = new Upperdeck(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("UD-01 | @smoke Verify the score", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Create a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();

    const clientName = await addClientPage.createUniqueClientName(
      TEST_DATA.CLIENT_PREFIX,
    );
    TestData.setKey(
      FILE_KEYS.UPPERDECK_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.UPPERDECK,
    );

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();

    // Navigate to the Multi Entity screen
    await upperdeck.clickMultiEntitySidebar();

    // Add a new multi entity with Business Email Compromise
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName("UD_Entity");
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);

    // Navigate to Collection and fill all answers
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await collectionPage.getFrameworkName(0);
    await questionEngine.answerAllQuestions();

    // Go back to the Multi Entity screen
    await upperdeck.clickMultiEntitySidebar();

    // Reload the page
    await upperdeck.page.reload();
    await upperdeck.waitForLoad();
    await upperdeck.waitForSpinner();

    // Wait 1 minute after reload before proceeding
    await upperdeck.page.waitForTimeout(60000);

    // Create a second multi entity with Business Email Compromise
    await addEntityPage.clickNewEntity();
    const secondEntityName =
      await addEntityPage.createUniqueEntityName("UD_Entity");
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(secondEntityName);

    // Create a third multi entity with Business Email Compromise
    await addEntityPage.clickNewEntity();
    const thirdEntityName =
      await addEntityPage.createUniqueEntityName("UD_Entity");
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(thirdEntityName);

    // Create a fourth multi entity with Business Email Compromise
    await addEntityPage.clickNewEntity();
    const fourthEntityName =
      await addEntityPage.createUniqueEntityName("UD_Entity");
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(fourthEntityName);

    // Wait 2 minutes for the score to process
    await upperdeck.page.waitForTimeout(120000);

    // Get the score of each multi entity listed on the screen
    const entityScores = await upperdeck.getMultiEntityScores();
    console.log("Multi entity scores:", JSON.stringify(entityScores));

    // Calculate the weighted average score: each entity contributes 25%
    const averageScore =
      (entityScores[0].score * 25) / 100 +
      (entityScores[1].score * 25) / 100 +
      (entityScores[2].score * 25) / 100 +
      (entityScores[3].score * 25) / 100;
    console.log(`Calculated average score: ${averageScore}`);

    // Click on the Upperdeck menu
    await upperdeck.clickUpperdeckMenu();

    // Get the score displayed on the Upperdeck page
    const upperdeckScore = await upperdeck.getUpperdeckScore();
    const roundedAverage = Math.floor(averageScore * 10) / 10;
    console.log(
      `Expected (average): ${roundedAverage} | Actual (upperdeck): ${upperdeckScore}`,
    );

    // Verify the Upperdeck score matches the calculated average
    expect(upperdeckScore).toBe(roundedAverage);
  });

  test("UD-02 | @regression Download Master Report", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    // Read the client name saved from a previous test run
    const clientName = TestData.getKey(
      FILE_KEYS.UPPERDECK_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.UPPERDECK,
    );

    // Search the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();

    // Click the download button, select Download Master Report, and wait for toast
    await upperdeck.downloadMasterReport();
  });

  test("UD-03 | @regression Risk count", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    // Read the client name saved from a previous test run
    const clientName = TestData.getKey(
      FILE_KEYS.UPPERDECK_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.UPPERDECK,
    );

    // Search the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();

    // Get the total count from the UI filters
    const uiTotalCount = await upperdeck.getTotalRiskCount();
    console.log(`UI total risk count: ${uiTotalCount}`);

    // Get the count from the backend
    const backendRiskCount = await getAssociatedRiskCount([
      "Business Email Compromise",
    ]);
    console.log(`Backend risk count: ${backendRiskCount}`);

    // Verify both counts match
    expect(uiTotalCount).toBe(backendRiskCount * 4);
  });
});
