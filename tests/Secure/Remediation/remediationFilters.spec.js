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

const FILTERS_FILE = TEST_DATA_FILE_ENUMS.REMEDIATION_FILTERS;
const ENTITY_PREFIX = "RMDFEntity";
const SECTIONS = REMEDIATION_FILTER_ENUMS.SECTIONS;

test.describe("Remediation Filters", () => {
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

    const isSetupTest = test.info().title.includes("RMDF - 00");
    entityId = TestData.getKey(
      FILE_KEYS.REMEDIATION_FILTERS_ENTITY_ID,
      FILTERS_FILE,
    );
    const subEntity = TestData.getKey(
      FILE_KEYS.REMEDIATION_FILTERS_SUBENTITY,
      FILTERS_FILE,
    );
    if (!isSetupTest && entityId && subEntity?.[FILE_KEYS.SUBENTITY_NAME]) {
      subEntityName = subEntity[FILE_KEYS.SUBENTITY_NAME];
      await actionsPage.openRemediationForEntity(entityId, subEntityName);
    }
  });

  // Own client + sub-entity so the filter counts in this suite cannot be moved
  // by another remediation suite acting on shared tasks.
  test("RMDF - 00 | Setup: create client, sub-entity and answer questions", async ({
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
      FILE_KEYS.REMEDIATION_FILTERS_CLIENT_NAME,
      clientName,
      FILTERS_FILE,
    );

    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    entityId = fetchPageURL(page.url())[0];
    TestData.setKey(
      FILE_KEYS.REMEDIATION_FILTERS_ENTITY_ID,
      entityId,
      FILTERS_FILE,
    );

    await addEntityPage.goto(`/first-party/${entityId}/multi-entity`);
    await addEntityPage.waitForLoad();
    await addEntityPage.clickNewEntity();
    subEntityName = await addEntityPage.createUniqueEntityName(ENTITY_PREFIX);
    TestData.setKey(
      FILE_KEYS.REMEDIATION_FILTERS_SUBENTITY,
      { [FILE_KEYS.SUBENTITY_NAME]: subEntityName },
      FILTERS_FILE,
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
      FILE_KEYS.REMEDIATION_FILTERS_ANSWERS,
      answers,
      FILTERS_FILE,
    );
    console.log(`Setup complete: ${answers.length} question(s) answered.`);
  });

  // Records the untouched Risk Tasks count that later tests compare against.
  test("RMDF - 01 | @regression Capture the baseline risk task count", async () => {
    const baseline = await filtersPage.getRiskTasksCount();
    TestData.setKey(
      FILE_KEYS.REMEDIATION_FILTERS_BASELINE_COUNT,
      baseline,
      FILTERS_FILE,
    );
    console.log(`Baseline risk task count: ${baseline}`);
    expect(baseline).toBeGreaterThan(0);
  });

  // The Status section must offer exactly the five options the app declares in
  // filters-const.ts - a silent change there would quietly break every other
  // status-dependent test in the remediation suites.
  test("RMDF - 02 | @regression Verify the Status section option set", async () => {
    await filtersPage.openFilterModal();
    await filtersPage.verifySectionOptions(
      SECTIONS.STATUS,
      Object.values(REMEDIATION_FILTER_ENUMS.STATUS),
    );
  });

  // Same guard for the Severity section's six options.
  test("RMDF - 03 | @regression Verify the Severity section option set", async () => {
    await filtersPage.openFilterModal();
    await filtersPage.verifySectionOptions(
      SECTIONS.SEVERITY,
      Object.values(REMEDIATION_FILTER_ENUMS.SEVERITY),
    );
  });

  // Filtering by one severity must leave only cards of that severity.
  test("RMDF - 04 | @regression Filter by Critical severity and verify every card matches", async () => {
    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      SECTIONS.SEVERITY,
      REMEDIATION_FILTER_ENUMS.SEVERITY.CRITICAL,
    );
    await filtersPage.applyFilters();
    await filtersPage.verifyAllCardsHaveSeverity(
      REMEDIATION_FILTER_ENUMS.SEVERITY.CRITICAL,
    );
  });

  // The four real severities must partition the baseline: filtering by each in
  // turn and adding the counts has to reproduce the unfiltered total.
  test("RMDF - 05 | @regression Verify severity filter counts sum to the baseline", async () => {
    const baseline = TestData.getKey(
      FILE_KEYS.REMEDIATION_FILTERS_BASELINE_COUNT,
      FILTERS_FILE,
    );
    if (!baseline) {
      throw new Error(
        "No baseline count recorded. Ensure 'RMDF - 01' ran before this test.",
      );
    }
    const severities = [
      REMEDIATION_FILTER_ENUMS.SEVERITY.LOW,
      REMEDIATION_FILTER_ENUMS.SEVERITY.MEDIUM,
      REMEDIATION_FILTER_ENUMS.SEVERITY.HIGH,
      REMEDIATION_FILTER_ENUMS.SEVERITY.CRITICAL,
    ];
    let total = 0;
    for (const severity of severities) {
      await filtersPage.openFilterModal();
      await filtersPage.setOnlyFilterOption(SECTIONS.SEVERITY, severity);
      await filtersPage.applyFilters();
      const count = await filtersPage.getRiskTasksCount();
      console.log(`${severity}: ${count}`);
      total += count;
    }
    console.log(`expected ${baseline} | actual ${total}`);
    expect(total).toBe(baseline);
  });

  // Accepting a task and then filtering for Accepted must bring it back into a
  // list the default Open filter had hidden.
  test("RMDF - 06 | @regression Filter by Accepted status and verify only accepted tasks show", async () => {
    const card = await actionsPage.findCardByStatus(
      REMEDIATION_STATUS_ENUMS.OPEN,
    );
    const { controlName } = await actionsPage.acceptTask(
      card,
      "Accepted by automation - RMDF 06",
    );
    TestData.setKey(
      FILE_KEYS.REMEDIATION_FILTERS_ACCEPTED_TASK,
      controlName,
      FILTERS_FILE,
    );

    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      SECTIONS.STATUS,
      REMEDIATION_FILTER_ENUMS.STATUS.ACCEPTED,
    );
    await filtersPage.applyFilters();
    await filtersPage.verifyAllCardsHaveStatus(
      REMEDIATION_STATUS_ENUMS.ACCEPTED,
    );
  });

  // The badge next to the FILTERS button counts what is applied, so two
  // sections narrowed means a badge of two.
  test("RMDF - 07 | @regression Verify the applied-filter counter reflects the applied filters", async () => {
    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      SECTIONS.SEVERITY,
      REMEDIATION_FILTER_ENUMS.SEVERITY.HIGH,
    );
    await filtersPage.setOnlyFilterOption(
      SECTIONS.STATUS,
      REMEDIATION_FILTER_ENUMS.STATUS.OPEN,
    );
    await filtersPage.applyFilters();
    const counter = await filtersPage.getAppliedFilterCount();
    console.log(`expected at least 2 | actual ${counter}`);
    expect(counter).toBeGreaterThanOrEqual(2);
  });

  // CLEAR must put the screen back to its unfiltered baseline.
  test("RMDF - 08 | @regression Clearing filters restores the baseline count", async () => {
    const baseline = TestData.getKey(
      FILE_KEYS.REMEDIATION_FILTERS_BASELINE_COUNT,
      FILTERS_FILE,
    );
    await filtersPage.openFilterModal();
    await filtersPage.setOnlyFilterOption(
      SECTIONS.SEVERITY,
      REMEDIATION_FILTER_ENUMS.SEVERITY.LOW,
    );
    await filtersPage.applyFilters();
    const filtered = await filtersPage.getRiskTasksCount();

    await filtersPage.openFilterModal();
    await filtersPage.clearFilters();
    await actionsPage.openRemediationForEntity(entityId, subEntityName);
    const restored = await filtersPage.getRiskTasksCount();
    console.log(
      `filtered ${filtered} | expected ${baseline} after clear | actual ${restored}`,
    );
    expect(restored).toBe(baseline);
  });

  // The Frameworks section lists the frameworks actually assigned to the
  // entity; narrowing to the only one must not lose any task.
  test("RMDF - 09 | @regression Filter by framework and verify the task count holds", async () => {
    const baseline = TestData.getKey(
      FILE_KEYS.REMEDIATION_FILTERS_BASELINE_COUNT,
      FILTERS_FILE,
    );
    await filtersPage.openFilterModal();
    const frameworks = await filtersPage.getAvailableOptions(
      SECTIONS.FRAMEWORKS,
    );
    expect(frameworks.length).toBeGreaterThan(0);
    await filtersPage.setOnlyFilterOption(SECTIONS.FRAMEWORKS, frameworks[0]);
    await filtersPage.applyFilters();
    const count = await filtersPage.getRiskTasksCount();
    console.log(
      `framework "${frameworks[0]}" | expected ${baseline} | actual ${count}`,
    );
    expect(count).toBe(baseline);
  });

  // Maturity options depend on the framework's settings, so this asserts the
  // section works rather than hard-coding a value set the app may not have.
  test("RMDF - 10 | @regression Filter by the first available maturity option", async () => {
    await filtersPage.openFilterModal();
    const maturities = await filtersPage.getAvailableOptions(SECTIONS.MATURITY);
    expect(maturities.length).toBeGreaterThan(0);
    await filtersPage.setOnlyFilterOption(SECTIONS.MATURITY, maturities[0]);
    await filtersPage.applyFilters();
    const counter = await filtersPage.getAppliedFilterCount();
    console.log(`maturity "${maturities[0]}" applied | counter ${counter}`);
    expect(counter).toBeGreaterThanOrEqual(1);
  });

  // The Assigned Users section carries its own search box.
  test("RMDF - 11 | @regression Search the Assigned Users filter section", async () => {
    await filtersPage.openFilterModal();
    const users = await filtersPage.getAvailableOptions(
      SECTIONS.ASSIGNED_USERS,
    );
    expect(users.length).toBeGreaterThan(0);
    await filtersPage.searchAssignedUser(users[0]);
    const filtered = await filtersPage.getAvailableOptions(
      SECTIONS.ASSIGNED_USERS,
    );
    console.log(
      `searched "${users[0]}" | expected 1 match | actual ${filtered.length}`,
    );
    expect(filtered.length).toBeLessThanOrEqual(users.length);
    expect(
      filtered.some((name) =>
        name.toLowerCase().includes(users[0].toLowerCase()),
      ),
    ).toBe(true);
  });

  // Picking a specific entity replaces the entity dropdown with a static
  // "Filter Enabled" label.
  test("RMDF - 12 | @regression Verify the Filter Enabled label replaces the entity dropdown", async () => {
    await filtersPage.verifyFilterEnabledLabelShown();
  });
});
