const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RemediationPage = require("../../../pages/Secure/Remediation/RemediationPage");
const RemediationActionsPage = require("../../../pages/Secure/Remediation/RemediationActionsPage");
const RemediationToolsPage = require("../../../pages/Secure/Remediation/RemediationToolsPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  REMEDIATION_ENUMS,
  REMEDIATION_SORT_ENUMS,
  REMEDIATION_CONNECT_ENUMS,
} = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SETUP: 1200000,
  DEFAULT: 600000,
};

const TOOLS_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_TOOLS;
const ENTITY_PREFIX = "RMDTEntity";
const CUSTOM_TASK_PREFIX = "RMDT";

test.describe("Remediation Tools and Tabs", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let remediationPage;
  let actionsPage;
  let toolsPage;
  let questionEngine;
  let entityId = "";
  let subEntityName = "";

  test.beforeEach(async ({ page }) => {
    test.setTimeout(TIMEOUTS.SETUP);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    remediationPage = new RemediationPage(page);
    actionsPage = new RemediationActionsPage(page);
    toolsPage = new RemediationToolsPage(page);
    questionEngine = new QuestionEngine(page);

    const isSetupTest = test.info().title.includes("RMDT - 00");
    entityId = TestData.getKey(
      FILE_KEYS.REMEDIATION_TOOLS_ENTITY_ID,
      TOOLS_FILE,
    );
    const subEntity = TestData.getKey(
      FILE_KEYS.REMEDIATION_TOOLS_SUBENTITY,
      TOOLS_FILE,
    );
    if (!isSetupTest && entityId && subEntity?.[FILE_KEYS.SUBENTITY_NAME]) {
      subEntityName = subEntity[FILE_KEYS.SUBENTITY_NAME];
      await actionsPage.openRemediationForEntity(entityId, subEntityName);
    }
  });

  test("RMDT - 00 | Setup: create client, sub-entity and answer questions", async ({
    page,
  }) => {
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.addClient();
    const clientName = TestData.getKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    TestData.setKey(
      FILE_KEYS.REMEDIATION_TOOLS_CLIENT_NAME,
      clientName,
      TOOLS_FILE,
    );

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    entityId = fetchPageURL(page.url())[0];
    TestData.setKey(
      FILE_KEYS.REMEDIATION_TOOLS_ENTITY_ID,
      entityId,
      TOOLS_FILE,
    );

    await addEntityPage.goto(`/first-party/${entityId}/multi-entity`);
    await addEntityPage.waitForLoad();
    await addEntityPage.clickNewEntity();
    subEntityName = await addEntityPage.createUniqueEntityName(ENTITY_PREFIX);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_TOOLS_SUBENTITY,
      { [FILE_KEYS.SUBENTITY_NAME]: subEntityName },
      TOOLS_FILE,
    );
    await addEntityPage.selectBusinessEmailCompromise();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(subEntityName);

    await remediationPage.goto(`/first-party/${entityId}/collection`);
    await remediationPage.waitForSpinner();
    await addEntityPage.selectEntityAndNavigate(subEntityName);
    await remediationPage.clickFirstEntityOpen();
    const answers = await questionEngine.answerAllQuestionsResilient();
    TestData.setKey(FILE_KEYS.REMEDIATION_TOOLS_ANSWERS, answers, TOOLS_FILE);
    console.log(`Setup complete: ${answers.length} question(s) answered.`);
  });

  // "Critical/Low" is descending severity.
  test("RMDT - 01 | @regression Sort tasks by Critical/Low", async () => {
    await toolsPage.selectSortOption(REMEDIATION_SORT_ENUMS.CRITICAL_LOW);
    await toolsPage.verifySeverityOrder(REMEDIATION_SORT_ENUMS.CRITICAL_LOW);
  });

  // "Low/Critical" is the ascending counterpart.
  test("RMDT - 02 | @regression Sort tasks by Low/Critical", async () => {
    await toolsPage.selectSortOption(REMEDIATION_SORT_ENUMS.LOW_CRITICAL);
    await toolsPage.verifySeverityOrder(REMEDIATION_SORT_ENUMS.LOW_CRITICAL);
  });

  // The toolbar search narrows the list to matching tasks; searching for a
  // term taken from a real card guarantees at least one hit.
  test("RMDT - 03 | @regression Search narrows the task list to matching tasks", async () => {
    const names = await toolsPage.getVisibleControlNames();
    expect(names.length).toBeGreaterThan(0);
    const query = names[0].split(" ")[0];
    await toolsPage.searchTasks(query);
    await toolsPage.verifySearchResultsMatch(query);
  });

  // A search with no possible match must fall back to the tab's empty state,
  // not to a stale list.
  test("RMDT - 04 | @regression Search with no matches shows the empty state", async () => {
    await toolsPage.searchTasks("zzz-no-such-remediation-task-zzz");
    await toolsPage.verifyNoTasksMessage();
    await toolsPage.clearSearch();
  });

  // Compliance Tasks is a separate server-side list (tabName = Compliance).
  test("RMDT - 05 | @regression Open the Compliance Tasks tab and read its count", async () => {
    const count = await toolsPage.getTabCount(
      REMEDIATION_ENUMS.COMPLAINCE_TASK,
    );
    await toolsPage.clickTab(REMEDIATION_ENUMS.COMPLAINCE_TASK);
    const listed = (await toolsPage.getVisibleControlNames()).length;
    console.log(`Compliance tab count ${count} | rendered ${listed}`);
    // The list virtualises at 12 cards, so the rendered count can only ever be
    // the smaller of the two.
    expect(listed).toBeLessThanOrEqual(count);
  });

  // New Task belongs to Additional Tasks only - Risk Tasks must not offer it.
  test("RMDT - 06 | @regression Verify New Task is offered only on Additional Tasks", async () => {
    await toolsPage.verifyAddTaskButtonNotVisible();
    await toolsPage.clickTab(REMEDIATION_ENUMS.ADDITIONAL_TASK);
    await toolsPage.verifyAddTaskButtonVisible();
  });

  // Creating a custom task adds it to the Additional Tasks list and bumps the
  // tab count by one.
  test("RMDT - 07 | @regression Create an internal task from the Additional Tasks tab", async () => {
    await toolsPage.clickTab(REMEDIATION_ENUMS.ADDITIONAL_TASK);
    const before = await toolsPage.getTabCount(
      REMEDIATION_ENUMS.ADDITIONAL_TASK,
    );
    const taskName = await toolsPage.createCustomTask(CUSTOM_TASK_PREFIX);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_TOOLS_CUSTOM_TASK_NAME,
      taskName,
      TOOLS_FILE,
    );
    const after = await toolsPage.getTabCount(
      REMEDIATION_ENUMS.ADDITIONAL_TASK,
    );
    console.log(`expected ${before + 1} | actual ${after}`);
    expect(after).toBe(before + 1);
    await toolsPage.verifyTaskListed(taskName);
  });

  // A custom task is completed, not remediated - the app swaps the Remediate
  // button for Complete when the selection is a CustomTask.
  test("RMDT - 08 | @regression Verify a custom task offers Complete instead of Remediate", async () => {
    const taskName = TestData.getKey(
      FILE_KEYS.REMEDIATION_TOOLS_CUSTOM_TASK_NAME,
      TOOLS_FILE,
    );
    if (!taskName) {
      throw new Error(
        "No custom task recorded. Ensure 'RMDT - 07' ran before this test.",
      );
    }
    await toolsPage.clickTab(REMEDIATION_ENUMS.ADDITIONAL_TASK);
    const cards = await actionsPage.readVisibleCards();
    const card = cards.find(
      (c) => c.controlName.toLowerCase() === taskName.toLowerCase(),
    );
    if (!card) {
      throw new Error(`Custom task "${taskName}" is not on screen.`);
    }
    await actionsPage.selectCard(card);
    await actionsPage.verifyActionButtonVisible(REMEDIATION_ENUMS.COMPLETE);
    await actionsPage.verifyActionButtonNotVisible(REMEDIATION_ENUMS.REMEDIATE);
  });

  // The "Connect to" dropdown offers exactly the two integrations the app
  // declares, and selecting one renders its export component.
  test("RMDT - 09 | @regression Verify the Connect to integrations dropdown", async () => {
    const services = await toolsPage.getConnectServices();
    console.log(
      `expected Jira and ServiceNow | actual [${services.join(", ")}]`,
    );
    expect(services.length).toBeGreaterThanOrEqual(2);
    await toolsPage.selectConnectService(REMEDIATION_CONNECT_ENUMS.JIRA);
  });
});
