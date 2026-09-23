const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const PolicyManagementPoliciesEntityLeader = require("../../../pages/EntityLeader/PolicyManagement/policyManagementPoliciesEntityLeader");
const TestData = require("../../../constant/testData");
const {
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
  POLICY_MANAGEMENT,
  APP_SCOPE,
} = require("../../../constant/enums");

const FILE = TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// The client ELS - 01 provisioned for THIS run. Everything this suite stores is
// scoped to it.
const currentClient = () =>
  TestData.getKey(
    FILE_KEYS.ENTITY_LEADER_CLIENT_NAME,
    TEST_DATA_FILE_ENUMS.ENTITY_LEADER,
    SCOPE,
  );

// Records which client the stored policy data belongs to. Called by the two
// producers so the readers below can tell fresh data from last run's.
const stampClient = () =>
  TestData.setKey(
    FILE_KEYS.ENTITY_LEADER_POLICY_CLIENT,
    currentClient(),
    FILE,
    SCOPE,
  );

// The approver this role assigns policies to.
//
// The Secure suite assigns POLICY_MANAGEMENT.APPROVER.DEFAULT_USER
// ("Automation Admin"), which exists on the clients that suite builds. An
// entity leader works inside the client ELS - 01 created, where that user is
// not in the approver list - the dropdown is keyed on the client itself - so
// the search finds nothing and the Summary step cannot be completed.
const requireApprover = () => {
  const client = currentClient();
  if (!client) {
    throw new Error(
      `Missing "${FILE_KEYS.ENTITY_LEADER_CLIENT_NAME}" in ${TEST_DATA_FILE_ENUMS.ENTITY_LEADER}. Run ELS - 01 in tests/EntityLeader/Setup/setupEntityLeader.spec.js before this spec.`,
    );
  }
  return client;
};

// Reads a key this suite stored, naming the producer when it is unusable.
//
// Two failure modes, not one. MISSING is the obvious case. STALE is the one
// that actually bites: testData/ persists between local runs while ELS - 01
// provisions a NEW client on every invocation, so if PMEL - 04 fails, the
// readers below would otherwise pick up the PREVIOUS run's policy name and hunt
// for a policy that does not exist on this client - surfacing as an opaque 60s
// locator timeout rather than as "the producer did not run". The client stamp
// makes that case say what it is.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/PolicyManagement/policyManagementPoliciesEntityLeader.spec.js before this spec.`,
    );
  }

  const storedFor = TestData.getKey(
    FILE_KEYS.ENTITY_LEADER_POLICY_CLIENT,
    FILE,
    SCOPE,
  );
  const client = currentClient();
  if (client && storedFor && storedFor !== client) {
    throw new Error(
      `Stale "${key}" in ${FILE}: it was stored against client "${storedFor}" but this run is on "${client}". ${producer} has not run against the current client.`,
    );
  }
  return value;
};

test.describe("Entity Leader Policy Management - Policies", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // PMMA - 00 HAS NO COUNTERPART HERE, which is why the numbering starts at 01.
  //
  // That test exists purely to create a client with the Policy Management
  // solution enabled, so the empty-state cases below run against zero policies.
  // ELS - 01 now does exactly that - it selects the solution at client creation
  // and hands the session forward - so a separate setup test would be creating a
  // second client this role has no way to reach.
  //
  // WHAT THAT DEPENDS ON: the empty-state cases (PMEL - 02 and PMEL - 03) are
  // only meaningful on a client with no policies. That holds for a full
  // `npm run regression:entity-leader`, because the runner executes ELS - 01 as
  // this app's login step on every invocation and it provisions a brand new
  // client each time. Running THIS FILE alone against a client that already has
  // policies will fail those two - correctly, since the state they assert is
  // genuinely gone.
  //
  // ORDERING - the remaining tests form one chain. PMEL - 04 creates the AI
  // policy and its category; PMEL - 05 the Template policy. Between them they
  // feed 07, 08, 10, 11 and 12. workers: 1 and fullyParallel: false preserve
  // declaration order.
  let el;
  let policyManagement;
  let myActions;

  test.beforeEach(async ({ page }) => {
    el = new PolicyManagementPoliciesEntityLeader(page);
    // The two Secure page objects are driven directly, exactly as the Secure
    // spec drives them - none of their selectors is role-specific.
    policyManagement = el.policyManagement;
    myActions = el.policies;

    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck. This
    // replaces the Secure spec's goto("/clients") -> search -> click card.
    await el.goto("/");
    await el.waitForLoad();
    await el.ensureOnUpperdeck();
    await el.openPolicyManagement();
  });

  test("PMEL - 01 | @smoke Verify Policy Management opens the Overview screen", async () => {
    test.setTimeout(120000);
    await myActions.verifyOverviewScreen();
  });

  test("PMEL - 02 | @regression Verify Overview empty state for a fresh client", async () => {
    test.setTimeout(120000);
    await myActions.verifyOverviewScreen();
    await myActions.verifyOverviewEmptyState();
  });

  test("PMEL - 03 | @regression Verify Policies screen empty state and My Actions tab", async () => {
    test.setTimeout(120000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    // Count card + status bar empty state.
    await myActions.verifyPoliciesCount("0");
    await myActions.verifySourceCounts("0", "0", "0");
    await myActions.verifyStatusProcessAllZero();

    // All Policies tab is active with its column schema and no data.
    await myActions.verifyTabActive(POLICY_MANAGEMENT.TABS.ALL_POLICIES);
    await myActions.verifyTabCount(POLICY_MANAGEMENT.TABS.ALL_POLICIES, 0);
    await myActions.verifyTableColumns(POLICY_MANAGEMENT.ALL_POLICIES_COLUMNS);
    await myActions.verifyNoDataAvailable();

    // My Actions tab is empty with its own column schema.
    await myActions.clickMyActionsTab();
    await myActions.verifyTabActive(POLICY_MANAGEMENT.TABS.MY_ACTIONS);
    await myActions.verifyTableColumns(POLICY_MANAGEMENT.MY_ACTIONS_COLUMNS);
    await myActions.verifyNoDataAvailable();
  });

  test("PMEL - 04 | @smoke Verify adding an AI policy populates My Actions", async () => {
    test.setTimeout(600000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    // Capture the current counts so we can assert the AI + total increment.
    const aiCountBefore = await myActions.getSourceCount(
      POLICY_MANAGEMENT.POLICY_TYPES.AI,
    );
    const totalCountBefore = await myActions.getPoliciesCount();

    // Start the AI policy creation flow.
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();

    const policyName = await policyManagement.enterPolicyName(
      `AI_MyActions_${Date.now()}`,
    );
    await policyManagement.enterOrganizationName();
    await policyManagement.selectIndustry();
    await policyManagement.selectFrameworkOrientation();
    await policyManagement.enterEmployeeCount();

    // Fresh client has no categories yet - create one (section -> sub-category).
    const categorySection = `Section_${Date.now()}`;
    // el.addPolicyCategory, not myActions.addPolicyCategory - the shared one
    // fails on the sub-category confirm click. See the page object for why.
    await el.addPolicyCategory(categorySection, `Category_${Date.now()}`);

    // Generate the document.
    await policyManagement.clickNextButton();
    await policyManagement.clickGenerateButton();
    await policyManagement.verifyDocumentDisplayed(policyName, 300000);

    // Move to the Summary step and assign an approver with a deadline.
    await policyManagement.clickFooterNextButton();
    await myActions.assignPolicyApprover(requireApprover());
    await myActions.clickCreateButton();
    await policyManagement.waitForProcessedSuccess(120000);

    // The created policy appears in All Policies.
    await myActions.clickAllPoliciesTab();
    await myActions.verifyPolicyRowVisible(policyName);

    // Persist for the later cross-screen checks.
    TestData.setKey(
      FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
      policyName,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.POLICY_MANAGEMENT_CATEGORY,
      categorySection,
      FILE,
      SCOPE,
    );
    stampClient();

    // The AI source count and the total count each increase by one.
    await myActions.verifySourceCountEquals(
      POLICY_MANAGEMENT.POLICY_TYPES.AI,
      aiCountBefore + 1,
    );
    await myActions.verifyPoliciesCountEquals(totalCountBefore + 1);

    await myActions.clickMyActionsTab();
    await myActions.verifyPolicyRowVisible(policyName);
    await myActions.verifyMyActionsRole(
      policyName,
      POLICY_MANAGEMENT.POLICY_ROLES.CREATOR,
    );
  });

  test("PMEL - 05 | @smoke Verify adding a Template policy populates My Actions", async () => {
    test.setTimeout(600000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    // Capture the current counts so we can assert the Template + total increment.
    const templateCountBefore = await myActions.getSourceCount(
      POLICY_MANAGEMENT.POLICY_TYPES.TEMPLATE,
    );
    const totalCountBefore = await myActions.getPoliciesCount();

    // Start the Template policy creation flow.
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectTemplateCreation();

    const [selectedTemplate] = await policyManagement.selectRandomTemplate();
    // The created policy name mirrors the template name (without any trailing
    // " Template" label), matching the existing template flow.
    const policyName = selectedTemplate.name.replace(" Template", "");
    await policyManagement.clickTemplateNextButton();

    // Load the template document, then advance through the Details step.
    await policyManagement.waitForDocumentVisibility();
    await policyManagement.clickFooterNextButton();
    await policyManagement.clickImportNextButton();

    // Summary step: assign an approver with a deadline and create.
    await myActions.assignPolicyApprover(requireApprover());
    await myActions.clickCreateButton();
    await policyManagement.waitForProcessedSuccess(120000);

    await myActions.clickAllPoliciesTab();
    await myActions.verifyPolicyRowVisible(policyName);

    TestData.setKey(
      FILE_KEYS.POLICY_MANAGEMENT_TEMPLATE_POLICY,
      policyName,
      FILE,
      SCOPE,
    );
    stampClient();

    // The Template source count and the total count each increase by one.
    await myActions.verifySourceCountEquals(
      POLICY_MANAGEMENT.POLICY_TYPES.TEMPLATE,
      templateCountBefore + 1,
    );
    await myActions.verifyPoliciesCountEquals(totalCountBefore + 1);

    await myActions.clickMyActionsTab();
    await myActions.verifyPolicyRowVisible(policyName);
    await myActions.verifyMyActionsRole(
      policyName,
      POLICY_MANAGEMENT.POLICY_ROLES.CREATOR,
    );
  });

  test("PMEL - 06 | @smoke Verify a policy can be saved as a draft", async () => {
    test.setTimeout(300000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    // Start an AI policy, enter partial data, then save it as a draft.
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const policyName = await policyManagement.enterPolicyName(
      `Draft_${Date.now()}`,
    );
    const orgName = await policyManagement.enterOrganizationName(
      `Org_${Date.now()}`,
    );
    const employeeCount = await policyManagement.enterEmployeeCount(250);
    await myActions.clickSaveDraft();

    // All Policies: the draft is listed with the "Draft" status.
    await myActions.clickAllPoliciesTab();
    await myActions.verifyPolicyRowVisible(policyName);
    await myActions.verifyPolicyStatus(
      policyName,
      POLICY_MANAGEMENT.STATUS.DRAFT,
    );

    // My Actions: the draft is listed with the draft "Last Action" text.
    await myActions.clickMyActionsTab();
    await myActions.verifyPolicyRowVisible(policyName);
    await myActions.verifyMyActionsLastAction(
      policyName,
      POLICY_MANAGEMENT.LAST_ACTION.DRAFT,
    );

    // Reopen the draft from All Policies and verify the entered data persisted.
    await myActions.clickAllPoliciesTab();
    await myActions.openDraftForEditing(policyName);
    await myActions.verifyDraftData({
      policyName,
      organizationName: orgName,
      employeeCount,
    });
  });

  test("PMEL - 07 | @regression Verify created policies list under Upcoming Expiring Policies (Year)", async () => {
    test.setTimeout(120000);
    // The beforeEach lands on the Overview screen.
    await myActions.verifyOverviewScreen();

    // Select the "Year" range so expiring policies within a year are listed.
    await myActions.selectUpcomingExpiringRange("Year");

    const aiPolicyName = required(
      FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
      "PMEL - 04",
    );
    const templatePolicyName = required(
      FILE_KEYS.POLICY_MANAGEMENT_TEMPLATE_POLICY,
      "PMEL - 05",
    );

    await myActions.verifyPolicyInUpcomingExpiring(aiPolicyName);
    await myActions.verifyPolicyInUpcomingExpiring(templatePolicyName);
  });

  test("PMEL - 08 | @regression Verify assigned category name is listed on the Overview", async () => {
    test.setTimeout(120000);
    // The beforeEach lands on the Overview screen.
    await myActions.verifyOverviewScreen();

    const categoryName = required(
      FILE_KEYS.POLICY_MANAGEMENT_CATEGORY,
      "PMEL - 04",
    );
    await myActions.verifyCategoryInOverview(categoryName);
  });

  test("PMEL - 09 | @regression Verify a created policy can be deleted", async () => {
    test.setTimeout(180000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    // Create a policy (saved as a draft) so it is listed in both tabs.
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const policyName = await policyManagement.enterPolicyName(
      `Delete_${Date.now()}`,
    );
    await myActions.clickSaveDraft();

    await myActions.clickAllPoliciesTab();
    await myActions.verifyPolicyRowVisible(policyName);

    // Select the policy, delete it (with confirmation) and verify the toast.
    await myActions.deletePolicy(policyName);

    // The policy is no longer listed in either tab.
    await myActions.clickAllPoliciesTab();
    await myActions.verifyPolicyNotInTable(policyName);
    await myActions.clickMyActionsTab();
    await myActions.verifyPolicyNotInTable(policyName);
  });

  test("PMEL - 10 | @regression Verify a policy can be copied to the Artifacts Registry", async () => {
    test.setTimeout(240000);

    // 1) Create a destination sub-entity. This is the capability that separates
    //    this role from the sub entity leader, which cannot create entities.
    await el.entities.clickMultiEntitySidebar();
    await el.entities.clickNewEntity();
    const subEntityName =
      await el.entities.createUniqueEntityName("PolicySubEL");
    await el.entities.clickEntityAdd();
    await el.entities.waitForMultiEntityCreatedToast();
    await el.entities.verifyEntityInList(subEntityName);

    // 2) Back into Policy Management and copy the AI policy to that entity.
    await el.openPolicyManagement();
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    const aiPolicyName = required(
      FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
      "PMEL - 04",
    );
    await myActions.copyPolicyToArtifactsRegistry(aiPolicyName, subEntityName);

    // 3) Open the destination entity and verify the policy is listed in its
    //    Artifacts Registry, copied as "<policy name>.docx".
    await el.entities.clickMultiEntitySidebar();
    await myActions.openSubEntity(subEntityName);
    await el.artifactRegistry.navigateToArtifactRegistryFromSideMenu();
    await el.artifactRegistry.verifyUploadedFile(`${aiPolicyName}.docx`);
  });

  test("PMEL - 11 | @regression Verify user can upload a policy revision", async () => {
    test.setTimeout(180000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    const aiPolicyName = required(
      FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
      "PMEL - 04",
    );

    // Capture the current version so we can assert the +1 increment. Guarded:
    // an unreadable cell would otherwise make expectedVersion "NaN.0", which
    // polls for the full timeout and reports a version mismatch instead of the
    // real problem.
    const versionBefore = await myActions.getPolicyVersion(aiPolicyName);
    const majorBefore = parseInt(versionBefore, 10);
    if (Number.isNaN(majorBefore)) {
      throw new Error(
        `Could not read a version for "${aiPolicyName}" - the cell read "${versionBefore}".`,
      );
    }
    const expectedVersion = `${majorBefore + 1}.0`;

    // Upload a new revision (confirm -> upload PDF -> success).
    await myActions.uploadPolicyRevision(
      aiPolicyName,
      "filesTest/Files/testFile.pdf",
    );

    // The table version increments by one major version (e.g. 1.0 -> 2.0).
    await myActions.verifyPolicyVersion(aiPolicyName, expectedVersion);

    // The All Versions popup lists the new version tagged as "Current".
    await myActions.openAllVersions(aiPolicyName);
    await myActions.verifyCurrentVersionInAllVersions(expectedVersion);
  });

  test("PMEL - 12 | @regression Verify user can preview multiple documents", async () => {
    test.setTimeout(180000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    const aiPolicyName = required(
      FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
      "PMEL - 04",
    );
    const templatePolicyName = required(
      FILE_KEYS.POLICY_MANAGEMENT_TEMPLATE_POLICY,
      "PMEL - 05",
    );

    // Select both policies and open the multi-document preview.
    await myActions.selectPolicyRow(aiPolicyName);
    await myActions.selectPolicyRow(templatePolicyName);
    await myActions.clickPreviewIcon();

    // Both documents are listed and switching changes the rendered document.
    await myActions.verifyPreviewDocumentsListed([
      aiPolicyName,
      templatePolicyName,
    ]);
    await myActions.verifyPreviewDocumentChanges(
      aiPolicyName,
      templatePolicyName,
    );
  });

  test("PMEL - 13 | @regression Verify the total counter matches the listed policies", async () => {
    test.setTimeout(120000);
    await myActions.clickPoliciesSubMenu();
    await myActions.verifyPoliciesUrl();

    // The total policies counter equals the number of rows in All Policies.
    await myActions.clickAllPoliciesTab();
    await myActions.verifyTotalCountMatchesTableRows();
  });
});
