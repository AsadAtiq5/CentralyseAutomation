const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const Reassessment = require("../../../pages/Secure/Collection/Reassessment");
const StartFresh = require("../../../pages/Secure/Collection/StartFresh");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  DEFAULT: 60000,
  SHORT: 120000,
  LONG: 180000,
  // Heavy flow: creates a client + multi-entity and answers all questions.
  EXTRA_LONG: 720000,
};

const TEST_DATA = {
  CLIENT_PREFIX: "SF",
  ENTITY_PREFIX: "SF_Entity",
  DEFAULT_FIRST_PARTY_URL: "",
};

test.describe("Start Fresh Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let reassessmentPage;
  let startFreshPage;
  let collectionPage;
  let questionEngine;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    reassessmentPage = new Reassessment(page);
    startFreshPage = new StartFresh(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);
  });

  test("SF - 01 | @smoke Start Fresh - answer collection and edit collection framework", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // Step 1: Create a new client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName(
      TEST_DATA.CLIENT_PREFIX,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    console.log(`Client created: ${clientName}`);
    await managementPage.waitForSpinner();

    // Step 2: Open the client
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();

    // Step 3: Create a new multi-entity with Business Email Compromise
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA.ENTITY_PREFIX,
    );
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);
    console.log(`Entity created: ${entityName}`);

    // Step 4: Open the Collection
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(`Navigated to collection screen for entity: ${entityName}`);

    // Step 5: Answer the questions
    await collectionPage.getFrameworkName(0);
    await questionEngine.answerAllQuestions();
    console.log("All questions answered");

    // Step 6: Open the Multi Entity screen from the side menu
    await addEntityPage.clickMultiEntitySidebar();
    console.log("Navigated back to multi-entity");

    // Step 7: Open the Collection again
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(
      `Navigated to collection screen again for entity: ${entityName}`,
    );

    // Step 7a: Save the framework score before editing the framework
    const card = await collectionPage.fetchFrameworkCard(0);
    const frameworkScore = await collectionPage.fetchScoreByCard(card);
    console.log(`Saved framework score: ${frameworkScore}`);

    // Step 8: Click the edit collection framework button
    await reassessmentPage.clickEditCollectionFrameworkButton();
    console.log("Clicked edit collection framework button");

    // Step 9: Select the Business Email Compromise card
    await reassessmentPage.clickBusinessEmailCompromiseCard();

    // Step 10: Click the Start Fresh button to open the Start Fresh modal
    await startFreshPage.clickStartFreshButton();
    console.log("Start Fresh modal opened");

    // Step 11: Confirm Start Fresh from the modal footer
    await startFreshPage.clickStartFreshConfirmButton();

    // Step 12: Wait for the loader to finish
    await startFreshPage.waitForSpinner();
    console.log("Start Fresh confirmed");

    // Step 13: Open the collection card and verify all answers were removed
    await collectionPage.getFrameworkName(0);
    await startFreshPage.verifyAllAnswersRemoved();

    // Step 14: Open the Archive side menu item
    await reassessmentPage.clickArchiveSideMenuItem();
    console.log("Archive side menu item clicked");

    // Step 15: Verify the archived card score matches the saved framework score
    await startFreshPage.verifyArchivedCardScore(frameworkScore);
  });
});
