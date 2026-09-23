const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RemediationPage = require("../../../pages/Secure/Remediation/RemediationPage");
const RemediationActionsPage = require("../../../pages/Secure/Remediation/RemediationActionsPage");
const RemediationFiltersPage = require("../../../pages/Secure/Remediation/RemediationFiltersPage");
const RemediationExportPage = require("../../../pages/Secure/Remediation/RemediationExportPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  REMEDIATION_EXPORT_ENUMS,
  REMEDIATION_FILTER_ENUMS,
} = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SETUP: 1200000,
  // Report generation pulls every tab's data before building the file, so the
  // export tests need noticeably more room than a plain UI assertion.
  EXPORT: 900000,
};

const EXPORT_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_EXPORT;
const ENTITY_PREFIX = "RMDEEntity";

test.describe("Remediation Export", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let remediationPage;
  let actionsPage;
  let filtersPage;
  let exportPage;
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
    exportPage = new RemediationExportPage(page);
    questionEngine = new QuestionEngine(page);

    const isSetupTest = test.info().title.includes("RMDE - 00");
    entityId = TestData.getKey(
      FILE_KEYS.REMEDIATION_EXPORT_ENTITY_ID,
      EXPORT_FILE,
    );
    const subEntity = TestData.getKey(
      FILE_KEYS.REMEDIATION_EXPORT_SUBENTITY,
      EXPORT_FILE,
    );
    if (!isSetupTest && entityId && subEntity?.[FILE_KEYS.SUBENTITY_NAME]) {
      subEntityName = subEntity[FILE_KEYS.SUBENTITY_NAME];
      await actionsPage.openRemediationForEntity(entityId, subEntityName);
    }
  });

  test("RMDE - 00 | Setup: create client, sub-entity and answer questions", async ({
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
      FILE_KEYS.REMEDIATION_EXPORT_CLIENT_NAME,
      clientName,
      EXPORT_FILE,
    );

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    entityId = fetchPageURL(page.url())[0];
    TestData.setKey(
      FILE_KEYS.REMEDIATION_EXPORT_ENTITY_ID,
      entityId,
      EXPORT_FILE,
    );

    await addEntityPage.goto(`/first-party/${entityId}/multi-entity`);
    await addEntityPage.waitForLoad();
    await addEntityPage.clickNewEntity();
    subEntityName = await addEntityPage.createUniqueEntityName(ENTITY_PREFIX);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_EXPORT_SUBENTITY,
      { [FILE_KEYS.SUBENTITY_NAME]: subEntityName },
      EXPORT_FILE,
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
    TestData.setKey(FILE_KEYS.REMEDIATION_EXPORT_ANSWERS, answers, EXPORT_FILE);
    console.log(`Setup complete: ${answers.length} question(s) answered.`);
  });

  // The menu must offer exactly the four options the app declares.
  test("RMDE - 01 | @regression Verify the export menu offers all four options", async () => {
    await exportPage.verifyExportOptions();
  });

  // General Report (XLS): a real .xlsx download with parseable rows.
  test("RMDE - 02 | @regression Export the General Report as XLS", async () => {
    test.setTimeout(TIMEOUTS.EXPORT);
    const { savedPath } = await exportPage.downloadExport(
      REMEDIATION_EXPORT_ENUMS.GENERAL_XLS,
    );
    const rows = await exportPage.verifyExportFileIsUsable(savedPath, ".xlsx");
    console.log(`General XLS rows: ${rows.length}`);
  });

  // General Report (CSV): same content, comma-separated.
  test("RMDE - 03 | @regression Export the General Report as CSV", async () => {
    test.setTimeout(TIMEOUTS.EXPORT);
    const { savedPath } = await exportPage.downloadExport(
      REMEDIATION_EXPORT_ENUMS.GENERAL_CSV,
    );
    const rows = await exportPage.verifyExportFileIsUsable(savedPath, ".csv");
    console.log(`General CSV rows: ${rows.length}`);
  });

  // Current View (XLS) must carry the tasks actually on screen - this is the
  // option where the export and the filtered list have to agree.
  test("RMDE - 04 | @regression Export the Current View as XLS and match it to the visible tasks", async () => {
    test.setTimeout(TIMEOUTS.EXPORT);
    const visible = await exportPage.getVisibleControlNames();
    TestData.setKey(
      FILE_KEYS.REMEDIATION_EXPORT_VISIBLE_COUNT,
      visible.length,
      EXPORT_FILE,
    );
    const { savedPath } = await exportPage.downloadExport(
      REMEDIATION_EXPORT_ENUMS.CURRENT_XLS,
    );
    const rows = await exportPage.verifyExportFileIsUsable(savedPath, ".xlsx");
    await exportPage.verifyCurrentViewMatchesVisibleTasks(rows, visible);
  });

  // Current View (CSV) with a severity filter applied: the export has to honour
  // the filter, not fall back to the whole list.
  test("RMDE - 05 | @regression Export the filtered Current View as CSV", async () => {
    test.setTimeout(TIMEOUTS.EXPORT);
    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      REMEDIATION_FILTER_ENUMS.SECTIONS.SEVERITY,
      REMEDIATION_FILTER_ENUMS.SEVERITY.CRITICAL,
    );
    await filtersPage.applyFilters();

    const visible = await exportPage.getVisibleControlNames();
    const { savedPath } = await exportPage.downloadExport(
      REMEDIATION_EXPORT_ENUMS.CURRENT_CSV,
    );
    const rows = await exportPage.verifyExportFileIsUsable(savedPath, ".csv");
    await exportPage.verifyCurrentViewMatchesVisibleTasks(rows, visible);
    console.log(
      `filtered visible ${visible.length} | exported rows ${rows.length}`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });
});
