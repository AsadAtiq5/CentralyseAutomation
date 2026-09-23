const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RemediationPage = require("../../../pages/Secure/Remediation/RemediationPage");
const RemediationActionsPage = require("../../../pages/Secure/Remediation/RemediationActionsPage");
const RemediationFiltersPage = require("../../../pages/Secure/Remediation/RemediationFiltersPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  REMEDIATION_ENUMS,
  REMEDIATION_STATUS_ENUMS,
  REMEDIATION_FILTER_ENUMS,
} = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  // Creating a client and a sub-entity and then answering every question of the
  // framework is the slowest step in this suite by a wide margin.
  SETUP: 1200000,
  DEFAULT: 600000,
};

const ACTIONS_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_ACTIONS;
const ENTITY_PREFIX = "RMDAEntity";

test.describe("Remediation Task Actions", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let remediationPage;
  let actionsPage;
  let filtersPage;
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
    filtersPage = new RemediationFiltersPage(page);
    questionEngine = new QuestionEngine(page);

    // This suite owns a dedicated client and sub-entity created by "RMDA - 00",
    // so its task pool is never disturbed by the RMD suite. The setup test
    // builds that data itself and therefore skips the navigation below.
    const isSetupTest = test.info().title.includes("RMDA - 00");
    entityId = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ENTITY_ID,
      ACTIONS_FILE,
    );
    const subEntity = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_SUBENTITY,
      ACTIONS_FILE,
    );
    if (!isSetupTest && entityId && subEntity?.[FILE_KEYS.SUBENTITY_NAME]) {
      subEntityName = subEntity[FILE_KEYS.SUBENTITY_NAME];
      await actionsPage.openRemediationForEntity(entityId, subEntityName);
    }
  });

  // Creates an isolated client + sub-entity, answers every question so the
  // No/Partial answers generate a pool of open risk tasks, and records the
  // logged-in user's name for the assign tests.
  test("RMDA - 00 | Setup: create client, sub-entity and answer questions", async ({
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
      FILE_KEYS.REMEDIATION_ACTIONS_CLIENT_NAME,
      clientName,
      ACTIONS_FILE,
    );

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    entityId = fetchPageURL(page.url())[0];
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ENTITY_ID,
      entityId,
      ACTIONS_FILE,
    );

    await addEntityPage.goto(`/first-party/${entityId}/multi-entity`);
    await addEntityPage.waitForLoad();
    await addEntityPage.clickNewEntity();
    subEntityName = await addEntityPage.createUniqueEntityName(ENTITY_PREFIX);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_SUBENTITY,
      { [FILE_KEYS.SUBENTITY_NAME]: subEntityName },
      ACTIONS_FILE,
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
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ANSWERS,
      answers,
      ACTIONS_FILE,
    );

    // The assign tests need the logged-in user's real name; the header avatar
    // tooltip is the only place the app renders it in full.
    const userName = await actionsPage.getLoggedInUserName();
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ASSIGNED_USER,
      userName,
      ACTIONS_FILE,
    );
    console.log(
      `Setup complete: ${answers.length} question(s) answered as ${userName}.`,
    );
  });

  // Accepting writes an exception reason and flips the chip to "Accepted".
  test("RMDA - 01 | @regression Accept a task and verify its status", async () => {
    const card = await actionsPage.findCardByStatus(
      REMEDIATION_STATUS_ENUMS.OPEN,
    );
    const { statusTextLocator, expectedText, controlName } =
      await actionsPage.acceptTask(card, "Accepted by automation - RMDA 01");
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_REOPEN_TASK,
      controlName,
      ACTIONS_FILE,
    );
    await actionsPage.verifyCardStatus(statusTextLocator, expectedText);
  });

  // The default filter is status = Open, so an accepted task must be gone from
  // a freshly loaded list and only reappear under the Accepted status filter.
  test("RMDA - 02 | @regression Verify an accepted task leaves the default Open list", async () => {
    const controlName = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_REOPEN_TASK,
      ACTIONS_FILE,
    );
    if (!controlName) {
      throw new Error(
        "No accepted task recorded. Ensure 'RMDA - 01' ran before this test.",
      );
    }
    await actionsPage.verifyTaskInCurrentTab(controlName, false);
  });

  // Reopen only renders for an already accepted / ignored task, and the modal
  // echoes the status it is reopening from.
  test("RMDA - 03 | @regression Reopen an accepted task and verify it returns to Open", async () => {
    // The default filter hides everything that is not Open, so the accepted task
    // has to be filtered back into view before Reopen can be reached.
    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      REMEDIATION_FILTER_ENUMS.SECTIONS.STATUS,
      REMEDIATION_FILTER_ENUMS.STATUS.ACCEPTED,
    );
    await filtersPage.applyFilters();

    // Reopen the exact task RMDA - 01 accepted, not just any accepted task, so
    // a missing precondition names the producer test.
    const acceptedTask = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_REOPEN_TASK,
      ACTIONS_FILE,
    );
    if (!acceptedTask) {
      throw new Error(
        "No accepted task recorded. Ensure 'RMDA - 01' ran before this test.",
      );
    }
    const card = await actionsPage.findCardByNameAndStatus(
      acceptedTask,
      REMEDIATION_STATUS_ENUMS.ACCEPTED,
    );
    const { statusTextLocator, expectedText, previousStatus } =
      await actionsPage.reopenTask(card, "Reopened by automation - RMDA 03");
    console.log(
      `expected previous status ${REMEDIATION_STATUS_ENUMS.ACCEPTED} | actual ${previousStatus}`,
    );
    expect(previousStatus.toLowerCase()).toBe(
      REMEDIATION_STATUS_ENUMS.ACCEPTED.toLowerCase(),
    );
    await actionsPage.verifyCardStatus(statusTextLocator, expectedText);
  });

  // Ignoring a task drops its severity to n/a as well as flipping the status.
  test("RMDA - 04 | @regression Ignore a task and verify its status", async () => {
    const card = await actionsPage.findCardByStatus(
      REMEDIATION_STATUS_ENUMS.OPEN,
    );
    const { statusTextLocator, expectedText } = await actionsPage.ignoreTask(
      card,
      "Ignored by automation - RMDA 04",
    );
    await actionsPage.verifyCardStatus(statusTextLocator, expectedText);
  });

  // Selecting more than one task must hide Assign - the app renders it only
  // while exactly one task is selected - while Accept and Ignore stay available.
  test("RMDA - 05 | @regression Verify Assign is hidden for a multi-task selection", async () => {
    await actionsPage.selectOpenCards(2);
    await actionsPage.verifyActionButtonVisible(REMEDIATION_ENUMS.ACCEPT);
    await actionsPage.verifyActionButtonVisible(REMEDIATION_ENUMS.IGNORE);
    await actionsPage.verifyActionButtonNotVisible(REMEDIATION_ENUMS.ASSIGN);
  });

  // Bulk accept: two tasks selected, one confirm, both chips flip.
  test("RMDA - 06 | @regression Bulk accept two tasks in a single action", async () => {
    const selected = await actionsPage.selectOpenCards(2);
    await actionsPage.clickActionButton(REMEDIATION_ENUMS.ACCEPT);
    await actionsPage.confirmCommentModal(
      actionsPage.selectors.acceptModal,
      "Bulk accepted by automation - RMDA 06",
    );
    await actionsPage.page.waitForSelector(actionsPage.selectors.tasksUpdated, {
      state: "visible",
      timeout: 60000,
    });
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_BULK_TASKS,
      selected.map((card) => card.controlName),
      ACTIONS_FILE,
    );
    for (const card of selected) {
      await actionsPage.verifyCardStatus(
        card.card.locator(actionsPage.selectors.statusText),
        REMEDIATION_STATUS_ENUMS.ACCEPTED,
      );
    }
  });

  // Assigning shows the assignee's initials on the card. It deliberately does
  // NOT assert the status chip: the app has no "Assigned" status and the task
  // stays Open after an assignment.
  test("RMDA - 07 | @regression Assign a task and verify the assignee avatar", async () => {
    const userName = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ASSIGNED_USER,
      ACTIONS_FILE,
    );
    const card = await actionsPage.findCardByStatus(
      REMEDIATION_STATUS_ENUMS.OPEN,
    );
    await actionsPage.selectCard(card);
    const { assigneeLocator, expectedInitials } =
      await actionsPage.assignUserToSelectedCard(card, userName);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ASSIGNED_TASK,
      card.controlName,
      ACTIONS_FILE,
    );
    const actualInitials = (await assigneeLocator.innerText()).trim();
    console.log(
      `expected ${expectedInitials} | actual ${actualInitials} for ${userName}`,
    );
    await expect(assigneeLocator).toHaveText(expectedInitials, {
      timeout: 60000,
    });
    // The status must be untouched by the assignment.
    await actionsPage.verifyCardStatus(
      card.card.locator(actionsPage.selectors.statusText),
      REMEDIATION_STATUS_ENUMS.OPEN,
    );
  });

  // Assigning the task to the same user again is a no-op the app reports with
  // its own toast rather than the success toast.
  test("RMDA - 08 | @regression Re-assigning the same user reports it as already assigned", async () => {
    const userName = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ASSIGNED_USER,
      ACTIONS_FILE,
    );
    const controlName = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ASSIGNED_TASK,
      ACTIONS_FILE,
    );
    const cards = await actionsPage.readVisibleCards();
    const card = cards.find((c) => c.controlName === controlName);
    if (!card) {
      throw new Error(
        `Assigned task "${controlName}" is not on screen. Ensure 'RMDA - 07' ran first.`,
      );
    }
    await actionsPage.selectCard(card);
    const alreadyAssignedToast =
      await actionsPage.reassignSameUserToSelectedCard(userName);
    await expect(alreadyAssignedToast).toBeVisible({ timeout: 60000 });
  });

  // Assigning to the logged-in user puts the task in the My Tasks tab.
  test("RMDA - 09 | @regression Verify the assigned task appears in My Tasks", async () => {
    const controlName = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ASSIGNED_TASK,
      ACTIONS_FILE,
    );
    const before = await actionsPage.getTabCount(REMEDIATION_ENUMS.MY_TASK);
    await actionsPage.clickTab(REMEDIATION_ENUMS.MY_TASK);
    console.log(`My Tasks count: ${before} | looking for "${controlName}"`);
    expect(before).toBeGreaterThan(0);
    await actionsPage.verifyTaskInCurrentTab(controlName, true);
  });

  // Unassigning removes the task from My Tasks again.
  test("RMDA - 10 | @regression Unassign the user and verify the task leaves My Tasks", async () => {
    const controlName = TestData.getKey(
      FILE_KEYS.REMEDIATION_ACTIONS_ASSIGNED_TASK,
      ACTIONS_FILE,
    );
    const cards = await actionsPage.readVisibleCards();
    const card = cards.find((c) => c.controlName === controlName);
    if (!card) {
      throw new Error(
        `Assigned task "${controlName}" is not on screen. Ensure 'RMDA - 07' ran first.`,
      );
    }
    await actionsPage.selectCard(card);
    await actionsPage.unassignAllUsersFromSelectedCard();

    await actionsPage.clickTab(REMEDIATION_ENUMS.MY_TASK);
    await actionsPage.verifyTaskInCurrentTab(controlName, false);
  });
});
