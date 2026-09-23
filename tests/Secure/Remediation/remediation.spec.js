const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const RemediationPage = require("../../../pages/Secure/Remediation/RemediationPage");
const {
  REMEDIATION_ENUMS,
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
} = require("../../../constant/enums");
const TestData = require("../../../constant/testData");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Remediation Module Testing", () => {
  let remediationPage;
  let questionEngine;
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let selectedEntity = "";
  let entityID = "";
  let subEntity = null;
  let clientName = "";
  const REMEDIATION_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(1200000);
    remediationPage = new RemediationPage(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    questionEngine = new QuestionEngine(page);

    // This spec is self-contained: the "RMD - 00" setup test creates a dedicated
    // client + sub-entity and persists their ids/answers to
    // testData/<APP>/remediation.json. Every other test reads that data here.
    // The setup test builds this data itself, so it skips the navigation below
    // (which also avoids acting on any stale ids from a previous run).
    const isSetupTest = test.info().title.includes("RMD - 00");
    entityID = TestData.getKey(FILE_KEYS.ENTITY_ID, REMEDIATION_FILE);
    subEntity = TestData.getKey(FILE_KEYS.SUBENTITY, REMEDIATION_FILE);
    console.log("Entity Id", entityID, subEntity);
    if (!isSetupTest && entityID && subEntity?.[FILE_KEYS.SUBENTITY_NAME]) {
      selectedEntity = subEntity[FILE_KEYS.SUBENTITY_NAME];
      await remediationPage.goto(`/first-party/${entityID}/remediation`);
      await remediationPage.waitForLoad();
      await remediationPage.selectOnlyEntityInFilter(selectedEntity);
    }
  });

  // Setup test: creates a fresh client and sub-entity, answers all of its
  // questions and saves everything to remediation.json so the remaining tests run
  // against a clean, isolated data set that is independent of any other spec.
  test("RMD - 00 | Setup: create client, sub-entity and answer questions", async ({
    page,
  }) => {
    // 1) Create a new client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.addClient();
    clientName = TestData.getKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    TestData.setKey(FILE_KEYS.ROOT_ENTITY_NAME, clientName, REMEDIATION_FILE);
    console.log(`🏢 Client created: ${clientName}`);

    // 2) Open the client and capture its entity id
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    const data = fetchPageURL(page.url());
    entityID = data[0];
    TestData.setKey(FILE_KEYS.ENTITY_ID, entityID, REMEDIATION_FILE);
    console.log(`🆔 Entity id: ${entityID}`);

    // 3) Create a sub-entity with the Business Email Compromise risk framework
    await addEntityPage.goto(`/first-party/${entityID}/multi-entity`);
    await addEntityPage.waitForLoad();
    await addEntityPage.clickNewEntity();
    const subEntityName =
      await addEntityPage.createUniqueEntityName("RMDEntity");
    TestData.setKey(
      FILE_KEYS.SUBENTITY,
      { [FILE_KEYS.SUBENTITY_NAME]: subEntityName },
      REMEDIATION_FILE,
    );
    await addEntityPage.selectBusinessEmailCompromise();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(subEntityName);
    console.log(`🏷️ Sub-entity created: ${subEntityName}`);

    // 4) Answer all questions for the sub-entity and persist the answers
    await remediationPage.goto(`/first-party/${entityID}/collection`);
    await remediationPage.waitForSpinner();
    await addEntityPage.selectEntityAndNavigate(subEntityName);
    await remediationPage.clickFirstEntityOpen();
    const answers = await questionEngine.answerAllQuestionsResilient();
    TestData.setKey(FILE_KEYS.REMIDIATION_ANSWERS, answers, REMEDIATION_FILE);
    console.log(`✅ Setup complete: ${answers.length} questions answered`);
  });

  // Verify that the Risk Tasks count on the remediation screen matches the number
  // of Partial/No answers saved by the setup test.
  test("RMD - 01 | Verify that task count", async ({ page }) => {
    // beforeEach already navigated to remediation and filtered to the sub-entity.
    const count = await remediationPage.getRiskTasksCount();
    console.log("UI Risk Tasks count:", count);

    const answers = TestData.getKey(
      FILE_KEYS.REMIDIATION_ANSWERS,
      REMEDIATION_FILE,
    );
    if (!answers || answers.length === 0) {
      throw new Error(
        "No remediation answers found. Ensure the 'RMD - 00' setup test ran first.",
      );
    }
    // Filter items with answer = 'Partial' or 'No'
    const filterData = answers.filter(
      (d) => d.answer === "Partial" || d.answer === "No",
    );
    console.log("Filtered answers (Partial/No) length:", filterData.length);

    // Assert UI count matches filtered answers length
    expect(
      filterData.length,
      "Mismatch between UI count and saved answers",
    ).toBe(count);
  });

  //Test case to test accept task
  test("RMD - 02 | Accept task", async ({ page }) => {
    const { statusTextLocator, expectedText } =
      await remediationPage.updateTask(REMEDIATION_ENUMS.ACCEPT);
    await expect(statusTextLocator).toHaveText(expectedText, {
      timeout: 60000,
    });
  });

  //Test case to test ignore task
  test("RMD - 03 | Ignore task", async ({ page }) => {
    // findout selected entity
    let remediationObj = {
      selectedEntity: selectedEntity,
      taskData: null,
    };
    const { severityLocator, statusTextLocator, expectedText, taskData } =
      await remediationPage.updateTask(REMEDIATION_ENUMS.IGNORE);
    remediationObj = { ...remediationObj, taskData };
    console.log("remediationObj", remediationObj);
    // firstly check the status and severity updated on remediation screen
    await Promise.all([
      expect(statusTextLocator).toHaveText(expectedText, { timeout: 60000 }),
      expect(severityLocator).toHaveText("n/a", { timeout: 60000 }),
    ]);
    // first test check pass then go to collection and verify the things
    await remediationPage.goto(`/first-party/${entityID}/collection`);
    await remediationPage.waitForSpinner();
    const questionInfo =
      await remediationPage.searchForSelectedTaskQuestionInCollection(
        remediationObj.selectedEntity,
        remediationObj.taskData,
      );
    expect(questionInfo?.severity?.toLowerCase()).toBe("n/a", {
      timeout: 60000,
    });
  });

  //Test case to test Assign task
  test("RMD - 04 | Assign task", async ({ page }) => {
    const questionInfo = await remediationPage.updateTaskExactAssign(
      REMEDIATION_ENUMS.ASSIGN,
    );
    //TODO:: add userName dynamically
    // add the user name who's login
    expect(questionInfo.assignment).toContain("Tasmia");
    // const result = await remediationPage.extractParticularTask(REMEDIATION_ENUMS.MY_TASK, questionInfo)
    // expect(result).toBe(true)
  });

  test("RMD - 05 | Remediate task", async ({ page }) => {
    let remediationObj = {
      selectedEntity: selectedEntity,
      taskData: null,
    };
    const { statusTextLocator, expectedText, taskData } =
      await remediationPage.updateTask(REMEDIATION_ENUMS.REMEDIATE);
    await expect(statusTextLocator).toHaveText(expectedText, {
      timeout: 60000,
    });
    remediationObj = { ...remediationObj, taskData };
    console.log("remediationObj", remediationObj);

    // The collection can briefly lag after a remediation (answer propagation)
    // and the long-question "more..." expansion used by the search is
    // occasionally racy, which can make the lookup miss the card. Re-run the
    // full search a few times until the remediated answer shows as "Yes".
    let answerValue = "";
    for (let attempt = 1; attempt <= 4 && answerValue !== "yes"; attempt++) {
      await remediationPage.goto(`/first-party/${entityID}/collection`);
      await remediationPage.waitForSpinner();
      const questionInfo =
        await remediationPage.searchForSelectedTaskQuestionInCollection(
          remediationObj.selectedEntity,
          remediationObj.taskData,
        );
      answerValue = questionInfo?.answerValue?.toLowerCase() ?? "";
      console.log(`RMD05 attempt ${attempt} answerValue: "${answerValue}"`);
      if (answerValue !== "yes") {
        await page.waitForTimeout(3000);
      }
    }
    expect(
      answerValue,
      "Remediated answer did not reflect as 'Yes' in collection",
    ).toBe("yes");
  });
});
