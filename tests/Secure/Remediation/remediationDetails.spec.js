const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RemediationPage = require("../../../pages/Secure/Remediation/RemediationPage");
const RemediationActionsPage = require("../../../pages/Secure/Remediation/RemediationActionsPage");
const RemediationDetailsPage = require("../../../pages/Secure/Remediation/RemediationDetailsPage");
const RemediationFiltersPage = require("../../../pages/Secure/Remediation/RemediationFiltersPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  REMEDIATION_STATUS_ENUMS,
  REMEDIATION_FILTER_ENUMS,
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

const DETAILS_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_DETAILS;
const ENTITY_PREFIX = "RMDDEntity";
const EXCEPTION_REASON = "Exception reason recorded by automation - RMDD";
const PANEL_COMMENT = "Panel comment added by automation - RMDD";

test.describe("Remediation Task Details", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let remediationPage;
  let actionsPage;
  let detailsPage;
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
    detailsPage = new RemediationDetailsPage(page);
    filtersPage = new RemediationFiltersPage(page);
    questionEngine = new QuestionEngine(page);

    const isSetupTest = test.info().title.includes("RMDD - 00");
    entityId = TestData.getKey(
      FILE_KEYS.REMEDIATION_DETAILS_ENTITY_ID,
      DETAILS_FILE,
    );
    const subEntity = TestData.getKey(
      FILE_KEYS.REMEDIATION_DETAILS_SUBENTITY,
      DETAILS_FILE,
    );
    if (!isSetupTest && entityId && subEntity?.[FILE_KEYS.SUBENTITY_NAME]) {
      subEntityName = subEntity[FILE_KEYS.SUBENTITY_NAME];
      await actionsPage.openRemediationForEntity(entityId, subEntityName);
    }
  });

  test("RMDD - 00 | Setup: create client, sub-entity and answer questions", async ({
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
      FILE_KEYS.REMEDIATION_DETAILS_CLIENT_NAME,
      clientName,
      DETAILS_FILE,
    );

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    entityId = fetchPageURL(page.url())[0];
    TestData.setKey(
      FILE_KEYS.REMEDIATION_DETAILS_ENTITY_ID,
      entityId,
      DETAILS_FILE,
    );

    await addEntityPage.goto(`/first-party/${entityId}/multi-entity`);
    await addEntityPage.waitForLoad();
    await addEntityPage.clickNewEntity();
    subEntityName = await addEntityPage.createUniqueEntityName(ENTITY_PREFIX);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_DETAILS_SUBENTITY,
      { [FILE_KEYS.SUBENTITY_NAME]: subEntityName },
      DETAILS_FILE,
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
      FILE_KEYS.REMEDIATION_DETAILS_ANSWERS,
      answers,
      DETAILS_FILE,
    );
    console.log(`Setup complete: ${answers.length} question(s) answered.`);
  });

  // With nothing selected the panel shows its placeholder.
  test("RMDD - 01 | @regression Verify the panel placeholder when no task is selected", async () => {
    await detailsPage.verifyNoTaskPlaceholder();
  });

  // One selected task fills the panel with that task's own details.
  test("RMDD - 02 | @regression Verify the details panel for a single selected task", async () => {
    const card = await detailsPage.selectCardByIndex(0);
    await detailsPage.verifyDetailsPanelForTask(card.controlName);
    const status = await detailsPage.getPanelStatus();
    console.log(`expected ${REMEDIATION_STATUS_ENUMS.OPEN} | actual ${status}`);
    expect(status.toLowerCase()).toBe(
      REMEDIATION_STATUS_ENUMS.OPEN.toLowerCase(),
    );
  });

  // Two or more selected tasks switch the panel to a summary list.
  test("RMDD - 03 | @regression Verify the summary list for a multi-task selection", async () => {
    const first = await detailsPage.selectCardByIndex(0);
    const second = await detailsPage.selectCardByIndex(1);
    await detailsPage.verifyMultiSelectionSummary([
      first.controlName,
      second.controlName,
    ]);
    await detailsPage.verifySummaryRowsHaveStatusAndSeverity();
  });

  // A comment added in the panel must persist and be listed back.
  test("RMDD - 04 | @regression Add a comment from the details panel", async () => {
    await detailsPage.selectCardByIndex(0);
    await detailsPage.openCommentsPanel();
    const comment = `${PANEL_COMMENT} ${Date.now()}`;
    await detailsPage.addComment(comment);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_DETAILS_COMMENT,
      comment,
      DETAILS_FILE,
    );
    await detailsPage.verifyCommentPresent(comment);
  });

  // The comment must still be there after the panel is reopened.
  test("RMDD - 05 | @regression Verify the added comment persists", async () => {
    const comment = TestData.getKey(
      FILE_KEYS.REMEDIATION_DETAILS_COMMENT,
      DETAILS_FILE,
    );
    if (!comment) {
      throw new Error(
        "No comment recorded. Ensure 'RMDD - 04' ran before this test.",
      );
    }
    await detailsPage.selectCardByIndex(0);
    await detailsPage.openCommentsPanel();
    await detailsPage.verifyCommentPresent(comment);
  });

  // The exception reason typed into the Accept modal is stored as a comment on
  // the task, so it has to surface in the panel afterwards.
  test("RMDD - 06 | @regression Verify an accept exception reason is stored as a comment", async () => {
    const card = await actionsPage.findCardByStatus(
      REMEDIATION_STATUS_ENUMS.OPEN,
    );
    const reason = `${EXCEPTION_REASON} ${Date.now()}`;
    const { controlName } = await actionsPage.acceptTask(card, reason);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_DETAILS_EXCEPTION_REASON,
      reason,
      DETAILS_FILE,
    );

    // The accepted task is no longer in the default Open list.
    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      REMEDIATION_FILTER_ENUMS.SECTIONS.STATUS,
      REMEDIATION_FILTER_ENUMS.STATUS.ACCEPTED,
    );
    await filtersPage.applyFilters();

    const cards = await detailsPage.readVisibleCards();
    const index = cards.findIndex((c) => c.controlName === controlName);
    expect(index, `Accepted task "${controlName}" not found`).toBeGreaterThan(
      -1,
    );
    await detailsPage.selectCardByIndex(index);
    await detailsPage.openCommentsPanel();
    await detailsPage.verifyCommentPresent(reason);
  });

  // Setting a due date writes it onto the card.
  test("RMDD - 07 | @regression Set a due date on a task", async () => {
    const cards = await detailsPage.readVisibleCards();
    const card = cards[0];
    await detailsPage.openDueDatePicker(card);
    await detailsPage.selectFirstAvailableDueDate();
    const dueDate = await detailsPage.verifyCardHasDueDate(card);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_DETAILS_DUE_DATE_TASK,
      { controlName: card.controlName, dueDate },
      DETAILS_FILE,
    );
  });

  // The due date has to survive a reload, not just the optimistic UI update.
  test("RMDD - 08 | @regression Verify the due date persists after a reload", async () => {
    const stored = TestData.getKey(
      FILE_KEYS.REMEDIATION_DETAILS_DUE_DATE_TASK,
      DETAILS_FILE,
    );
    if (!stored?.controlName) {
      throw new Error(
        "No due-date task recorded. Ensure 'RMDD - 07' ran before this test.",
      );
    }
    const cards = await detailsPage.readVisibleCards();
    const card = cards.find((c) => c.controlName === stored.controlName);
    expect(card, `Task "${stored.controlName}" not on screen`).toBeTruthy();
    const dueDate = await detailsPage.getCardDueDate(card);
    console.log(`expected "${stored.dueDate}" | actual "${dueDate}"`);
    expect(dueDate).toBe(stored.dueDate);
  });

  // "Remove Date" clears it again.
  test("RMDD - 09 | @regression Remove the due date from a task", async () => {
    const stored = TestData.getKey(
      FILE_KEYS.REMEDIATION_DETAILS_DUE_DATE_TASK,
      DETAILS_FILE,
    );
    const cards = await detailsPage.readVisibleCards();
    const card = cards.find((c) => c.controlName === stored?.controlName);
    expect(card, `Task "${stored?.controlName}" not on screen`).toBeTruthy();
    await detailsPage.removeDueDate(card);
    await detailsPage.verifyCardHasNoDueDate(card);
  });
});
