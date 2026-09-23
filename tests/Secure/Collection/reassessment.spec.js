const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const Reassessment = require("../../../pages/Secure/Collection/Reassessment");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 180000,
  DEFAULT: 60000,
  // Heavy reassessment flow: creates a client + multi-entity and answers all
  // questions twice (initial pass + full re-answer), so it needs a much larger
  // budget than the smoke test which never answers questions.
  EXTRA_LONG: 720000,
};

test.describe("Reassessment Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let reassessmentPage;
  let collectionPage;
  let questionEngine;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    reassessmentPage = new Reassessment(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);
  });

  test("RA - 01 | @smoke Verify reassessment icon on the card", async () => {
    // Creating a fresh client + multi-entity, then waiting for the framework's
    // initial assessment to become ready (the Start Reassessment button appears
    // only once the backend finishes initializing) needs more than the LONG
    // budget, so allow the reopen-and-retry loop enough time.
    test.setTimeout(420000);

    // Step 1: Create a new client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    console.log(`Client created: ${clientName}`);
    await managementPage.waitForSpinner();

    // Step 2: Create a new multi-entity
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName("Entity");
    console.log(`Entity created: ${entityName}`);
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);

    // Save for subsequent test
    TestData.setKey(
      FILE_KEYS.REASSESSMENT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.REASSESSMENT,
    );
    TestData.setKey(
      FILE_KEYS.REASSESSMENT_ENTITY_NAME,
      entityName,
      TEST_DATA_FILE_ENUMS.REASSESSMENT,
    );
    console.log(
      `Saved test data: clientName=${clientName}, entityName=${entityName}`,
    );

    // Step 3: Navigate to the collection screen
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(`Navigated to collection screen for entity: ${entityName}`);

    // Step 4: Click the edit button
    await reassessmentPage.clickEditCollectionFrameworkButton();

    // Step 5: Click the Business Email Compromise card
    await reassessmentPage.clickBusinessEmailCompromiseCard();

    // Step 6: Click the Start Reassessment button (icon button on the card).
    // A freshly-created framework's initial assessment is not ready on the
    // backend immediately, so the edit panel first renders only "Start Fresh" /
    // "Import Assessment" and does not live-refresh. Reopen the panel and retry
    // until the Start Reassessment button becomes available.
    await reassessmentPage.clickStartReassessmentWhenReady(async () => {
      await reassessmentPage.page.reload();
      await addEntityPage.waitForLoad();
      await addEntityPage.selectEntityAndNavigate(entityName);
      await reassessmentPage.clickEditCollectionFrameworkButton();
      await reassessmentPage.clickBusinessEmailCompromiseCard();
    });

    // Step 7: Confirm Start Reassessment in the footer dialog
    await reassessmentPage.clickStartReassessmentConfirmButton();
    console.log("Start Reassessment confirmed");

    // Step 8: Wait for Business Email Compromise card and verify reassessment label
    await reassessmentPage.verifyReassessmentLabelVisible();
  });

  test("RA - 02 | @regression Verify the archive information remain the same before reassessment", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Step 1: Create a new client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    console.log(`Client created: ${clientName}`);
    await managementPage.waitForSpinner();

    // Step 2: Create a new multi-entity
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName("Entity");
    console.log(`Entity created: ${entityName}`);
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);

    // Step 3: Navigate to the collection screen
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(`Navigated to collection screen for entity: ${entityName}`);

    // Step 4: Open the Business Email Compromise card
    await collectionPage.getFrameworkName(0);
    console.log("Business Email Compromise card opened");

    // Step 5: Answer all questions
    await questionEngine.answerAllQuestions();
    console.log("All questions answered");

    // Step 6: Navigate back to the multi-entity
    await addEntityPage.clickMultiEntitySidebar();
    console.log("Navigated back to multi-entity");

    // Step 7: Navigate to the collection screen again
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(`Navigated to collection screen for entity: ${entityName}`);

    // Step 7a: Get the score from the card
    const card = await collectionPage.fetchFrameworkCard(0);
    const score = await collectionPage.fetchScoreByCard(card);
    console.log(`Score from the card: ${score}`);

    // Step 7b: Get the collection percentage from the card
    const collectionPercentage =
      await collectionPage.fetchCollectionPercentageByCard(card);
    console.log(`Collection percentage: ${collectionPercentage}`);

    // Step 7c: Get the remediation percentage from the card
    const remediationPercentage =
      await collectionPage.fetchRemediationPercentageByCard(card);
    console.log(`Remediation percentage: ${remediationPercentage}`);

    // Step 8: Click the edit collection framework button
    await reassessmentPage.clickEditCollectionFrameworkButton();

    // Step 9: Click the Business Email Compromise card
    await reassessmentPage.clickBusinessEmailCompromiseCard();

    // Step 10: Click the Start Reassessment button
    await reassessmentPage.clickStartReassessmentButton();

    // Step 11: Confirm Start Reassessment
    await reassessmentPage.clickStartReassessmentConfirmButton();
    console.log("Start Reassessment confirmed");

    // Step 12: Click the Open button on the card
    await collectionPage.getFrameworkName(0);
    console.log("Opened the Business Email Compromise card");

    // Step 13: Re-answer all questions (force new selection even if already answered)
    await reassessmentPage.reAnswerAllQuestions();
    console.log("All questions re-answered");

    // Step 14: Click the Archive side menu item
    await reassessmentPage.clickArchiveSideMenuItem();
    console.log("Archive side menu item clicked");

    // Step 15: Verify archived card data matches pre-reassessment values
    await reassessmentPage.verifyArchivedCardData(
      score,
      collectionPercentage,
      remediationPercentage,
    );
    console.log("Archived card data verified successfully");
  });
});
