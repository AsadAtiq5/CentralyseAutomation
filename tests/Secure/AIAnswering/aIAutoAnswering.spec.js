const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const TestData = require("../../../constant/testData");
const AIAutoAnswering = require("../../../pages/Secure/AIAnswering/aIAutoAnswering");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const { findRandomIndex } = require("../../../helpers/common/helper");
const {
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
  AI_AUTO_ANSWERING_ENUMS,
} = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const AI_UPLOAD_FILE_NAME = "Centraleyes - Application Security.pdf";
const AI_UPLOAD_FILE_PATH = path.join(
  process.cwd(),
  "filesTest/Files",
  AI_UPLOAD_FILE_NAME,
);

test.describe("AI Auto Answering", () => {
  let aiAutoAnswering;
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let collectionPage;
  let questionEngine;

  test.beforeEach(async ({ page }) => {
    aiAutoAnswering = new AIAutoAnswering(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);

    const rootEntityID = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.AI_AUTO_ANSWERING,
    );

    // Only navigate once the setup test has produced an entity ID.
    if (rootEntityID) {
      console.log("using entity ID ", rootEntityID);
      await aiAutoAnswering.goto(`/first-party/${rootEntityID}/collection`);
      await page
        .waitForLoadState("networkidle", { timeout: 60000 })
        .catch(() => {});
    }
  });

  // The standard 600000 timeout is not enough here: this single flow creates a client
  // and entity, activates AI, then waits out a real backend AI analysis before the
  // review and collection verifications.
  test("AIA - 00 | @regression Activate the AI Assessment Agent and finalize AI answers", async ({
    page,
  }) => {
    test.setTimeout(2400000);

    // STEP 1: Create a new client
    console.log("Creating a new client...");
    await addClientPage.goto("/clients");
    await managementPage.clickAddClientButton();
    const clientName = await addClientPage.createUniqueClientName("AIA");

    TestData.setKey(
      FILE_KEYS.AI_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.AI_AUTO_ANSWERING,
    );

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl();
    await addClientPage.clickAddClientButton();
    await addEntityPage.waitForSpinner();

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();

    // STEP 2: Create a multi-entity with AI Agent (not User Based) so Collection
    // auto-opens the AI Assessment Agent wizard on the first framework open.
    console.log("Creating a new multi-entity with the AI Agent method...");
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();

    const subEntityName = await addEntityPage.createUniqueEntityName("AIA");
    await addEntityPage.addEntityWithBusinessEmailCompromiseAiAgent();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(subEntityName);

    TestData.setKey(
      FILE_KEYS.AI_SUBENTITY_NAME,
      subEntityName,
      TEST_DATA_FILE_ENUMS.AI_AUTO_ANSWERING,
    );

    // STEP 3: Open the collection of the new entity and store its entity ID
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(subEntityName);

    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.AI_AUTO_ANSWERING,
      );
    }

    // STEP 4: Open the framework - the AI modal opens by itself
    const frameworkName = await collectionPage.getFrameworkName(0);
    console.log(`Opened framework: ${frameworkName}`);
    TestData.setKey(
      FILE_KEYS.AI_FRAMEWORK_NAME,
      frameworkName,
      TEST_DATA_FILE_ENUMS.AI_AUTO_ANSWERING,
    );

    await aiAutoAnswering.waitForWizardModal();
    await aiAutoAnswering.verifyActivationPromptDisplayed();

    // STEP 5: Activate Artificial Intelligence from the settings screen
    await aiAutoAnswering.clickActivationLink();
    await aiAutoAnswering.verifyArtificialIntelligenceSectionDisplayed();
    await aiAutoAnswering.clickArtificialIntelligenceToggle();
    await aiAutoAnswering.confirmAiActivationModal();
    await aiAutoAnswering.verifyAiActivatedToast();
    await aiAutoAnswering.verifyAiToggleIsOn();

    // STEP 6: Back to the collection and run the wizard
    await addEntityPage.clickCollectionSidemenu();
    await addEntityPage.waitForSpinner();
    await collectionPage.getFrameworkName(0);

    await aiAutoAnswering.waitForWizardModal();
    await aiAutoAnswering.clickGetStarted();
    await aiAutoAnswering.uploadDocument(
      AI_UPLOAD_FILE_PATH,
      AI_UPLOAD_FILE_NAME,
    );
    await aiAutoAnswering.clickUploadButtonAndWaitForUpload();
    await aiAutoAnswering.clickGenerateButton();

    // STEP 7: Leave the wizard, then open AI Tasks from the side menu
    await aiAutoAnswering.closeWizardViaGoToAiTasks();
    await aiAutoAnswering.navigateToAiTasksFromSideMenu();
    await aiAutoAnswering.verifyTaskDisplayedInTable(
      AI_AUTO_ANSWERING_ENUMS.TASK_NAME,
    );

    // STEP 8: Wait out the analysis, then open the review screen
    await aiAutoAnswering.waitForTaskPendingReview();
    await aiAutoAnswering.clickFinalizeReviewButton();
    await aiAutoAnswering.verifyReviewTableDisplayed();

    // STEP 9: Capture every question the AI answered
    const answeredQuestions = await aiAutoAnswering.getAiAnsweredQuestions();
    TestData.setKey(
      FILE_KEYS.AI_ANSWERED_QUESTIONS,
      answeredQuestions,
      TEST_DATA_FILE_ENUMS.AI_AUTO_ANSWERING,
    );

    const suggestedAnswersCount =
      await aiAutoAnswering.getSuggestedAnswersCount();
    console.log(
      `expected answered questions ${suggestedAnswersCount} | actual answered questions ${answeredQuestions.length}`,
    );
    expect(answeredQuestions.length).toBe(suggestedAnswersCount);

    if (answeredQuestions.length === 0) {
      throw new Error(
        "The AI analysis returned no answered questions, so there is nothing to finalize. Re-run the agent with evidence that matches the framework.",
      );
    }

    // STEP 10: Pick one AI answered question, accept only that one
    const selectedQuestion =
      answeredQuestions[findRandomIndex(answeredQuestions.length)];
    console.log(
      `Selected question: ${selectedQuestion.questionText} | AI answer: ${selectedQuestion.aiAnswer}`,
    );
    TestData.setKey(
      FILE_KEYS.AI_SELECTED_QUESTION,
      selectedQuestion,
      TEST_DATA_FILE_ENUMS.AI_AUTO_ANSWERING,
    );

    await aiAutoAnswering.selectQuestionRowByText(
      selectedQuestion.questionText,
    );
    await aiAutoAnswering.clickCompleteButton();
    await aiAutoAnswering.verifyFinalizeConfirmationModal();
    await aiAutoAnswering.confirmFinalizeModal();

    // STEP 11: Finalizing lands on the questions screen - only the accepted
    // question may carry an answer. The import runs in the background, so give it
    // a moment and reload before reading the answers.
    await aiAutoAnswering.waitForCollectionQuestionsScreen();
    await page.waitForTimeout(20000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await aiAutoAnswering.ensureFrameworkQuestionsOpen();

    await questionEngine.verifyOnlyExpectedQuestionAnswered(
      selectedQuestion.questionText,
      selectedQuestion.aiAnswer,
    );
  });
});
