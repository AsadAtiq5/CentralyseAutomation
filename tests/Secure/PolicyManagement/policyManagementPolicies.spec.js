const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const ArtifactRegistry = require("../../../pages/Secure/Collection/ArtifactRegistry");
const PolicyManagement = require("../../../pages/Secure/PolicyManagement/PolicyManagement");
const PolicyManagementPolicies = require("../../../pages/Secure/PolicyManagement/PolicyManagementPolicies");
const TestData = require("../../../constant/testData");
const {
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
  POLICY_MANAGEMENT,
} = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
  console.log("storageStatePath");
}

const getClientName = () =>
  TestData.getKey(
    FILE_KEYS.ROOT_ENTITY_POLICY_MANAGEMENT_MY_ACTIONS,
    TEST_DATA_FILE_ENUMS.ENTITY,
  );

test.describe("Policy Management - My Actions", () => {
  // ---------------------------------------------------------------------------
  // Setup: create a fresh client with the Policy Management solution enabled so
  // the empty-state cases (PMMA-01..03) run against 0 policies. The client name
  // is stored and reused by the cases below.
  // ---------------------------------------------------------------------------
  test("PMMA - 00 | @regression Setup: create client with Policy Management solution", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const managementPage = new ManagementPage(page);
    const addClientPage = new AddClientPage(page);

    await managementPage.navigate();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();

    const clientName = await addClientPage.createUniqueClientName("PolicyMA");
    await addClientPage.selectIndustry();
    await addClientPage.selectPolicyManagement();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();

    TestData.setKey(
      FILE_KEYS.ROOT_ENTITY_POLICY_MANAGEMENT_MY_ACTIONS,
      clientName,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );

    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
  });

  // ---------------------------------------------------------------------------
  // Cases: navigate into the setup client and open Policy Management (lands on
  // the Overview screen) before each test.
  // ---------------------------------------------------------------------------
  test.describe("Cases", () => {
    let managementPage;
    let policyManagement;
    let myActions;

    test.beforeEach(async ({ page }) => {
      managementPage = new ManagementPage(page);
      policyManagement = new PolicyManagement(page);
      myActions = new PolicyManagementPolicies(page);

      await policyManagement.goto("/clients");
      await page
        .waitForLoadState("networkidle", { timeout: 60000 })
        .catch(() => {});

      const clientName = getClientName();
      await managementPage.searchClient(clientName);
      await managementPage.clickClientCard(clientName);
      await managementPage.waitForSpinner();
      await managementPage.clickPolicyManagementButton();
      await managementPage.waitForSpinner();
    });

    test("PMMA - 01 | @smoke Verify Policy Management opens the Overview screen", async () => {
      test.setTimeout(120000);
      await myActions.verifyOverviewScreen();
    });

    test("PMMA - 02 | @regression Verify Overview empty state for a fresh client", async () => {
      test.setTimeout(120000);
      await myActions.verifyOverviewScreen();
      await myActions.verifyOverviewEmptyState();
    });

    test("PMMA - 03 | @regression Verify Policies screen empty state and My Actions tab", async () => {
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
      await myActions.verifyTableColumns(
        POLICY_MANAGEMENT.ALL_POLICIES_COLUMNS,
      );
      await myActions.verifyNoDataAvailable();

      // My Actions tab is empty with its own column schema.
      await myActions.clickMyActionsTab();
      await myActions.verifyTabActive(POLICY_MANAGEMENT.TABS.MY_ACTIONS);
      await myActions.verifyTableColumns(POLICY_MANAGEMENT.MY_ACTIONS_COLUMNS);
      await myActions.verifyNoDataAvailable();
    });

    test("PMMA - 04 | @smoke Verify adding an AI policy populates My Actions", async ({
      page,
    }) => {
      test.setTimeout(600000);
      await myActions.clickPoliciesSubMenu();
      await myActions.verifyPoliciesUrl();

      // Capture the current counts so we can assert the AI + total increment.
      const aiCountBefore = await myActions.getSourceCount("AI");
      const totalCountBefore = await myActions.getPoliciesCount();

      // Start the AI policy creation flow (form entry reused from PolicyManagement).
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
      await myActions.addPolicyCategoryWhenSettled(
        categorySection,
        `Category_${Date.now()}`,
      );

      // Generate the document.
      await policyManagement.clickNextButton();
      await policyManagement.clickGenerateButton();
      await policyManagement.verifyDocumentDisplayed(policyName, 300000);

      // Move to the Summary step and assign an approver with a deadline.
      await policyManagement.clickFooterNextButton();
      await myActions.assignPolicyApprover(
        POLICY_MANAGEMENT.APPROVER.DEFAULT_USER,
      );
      await myActions.clickCreateButton();
      await policyManagement.waitForProcessedSuccess(120000);

      // The created policy appears in both All Policies and My Actions.
      await myActions.clickAllPoliciesTab();
      await myActions.verifyPolicyRowVisible(policyName);

      // Persist the created AI policy name for later cross-screen verification.
      TestData.setKey(
        FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
        policyName,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );
      // Persist the category (section) assigned to this policy for the Overview check.
      TestData.setKey(
        FILE_KEYS.POLICY_MANAGEMENT_CATEGORY,
        categorySection,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );

      // The AI source count and the total count each increase by one.
      await myActions.verifySourceCountEquals("AI", aiCountBefore + 1);
      await myActions.verifyPoliciesCountEquals(totalCountBefore + 1);

      await myActions.clickMyActionsTab();
      await myActions.verifyPolicyRowVisible(policyName);
      await myActions.verifyMyActionsRole(policyName, "Creator");
    });

    test("PMMA - 05 | @smoke Verify adding a Template policy populates My Actions", async () => {
      test.setTimeout(600000);
      await myActions.clickPoliciesSubMenu();
      await myActions.verifyPoliciesUrl();

      // Capture the current counts so we can assert the Template + total increment.
      const templateCountBefore = await myActions.getSourceCount("Template");
      const totalCountBefore = await myActions.getPoliciesCount();

      // Start the Template policy creation flow.
      await policyManagement.clickAddNewPolicy();
      await policyManagement.selectTemplateCreation();

      const [selectedTemplate] = await policyManagement.selectRandomTemplate();
      // The created policy name mirrors the template name (without any
      // trailing " Template" label), matching the existing template flow.
      const policyName = selectedTemplate.name.replace(" Template", "");
      await policyManagement.clickTemplateNextButton();

      // Load the template document, then advance through the Details step.
      await policyManagement.waitForDocumentVisibility();
      await policyManagement.clickFooterNextButton();
      await policyManagement.clickImportNextButton();

      // Summary step: assign an approver with a deadline and create.
      await myActions.assignPolicyApprover(
        POLICY_MANAGEMENT.APPROVER.DEFAULT_USER,
      );
      await myActions.clickCreateButton();
      await policyManagement.waitForProcessedSuccess(120000);

      // The created policy appears in both All Policies and My Actions.
      await myActions.clickAllPoliciesTab();
      await myActions.verifyPolicyRowVisible(policyName);

      // Persist the created Template policy name for later cross-screen verification.
      TestData.setKey(
        FILE_KEYS.POLICY_MANAGEMENT_TEMPLATE_POLICY,
        policyName,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );

      // The Template source count and the total count each increase by one.
      await myActions.verifySourceCountEquals(
        "Template",
        templateCountBefore + 1,
      );
      await myActions.verifyPoliciesCountEquals(totalCountBefore + 1);

      await myActions.clickMyActionsTab();
      await myActions.verifyPolicyRowVisible(policyName);
      await myActions.verifyMyActionsRole(policyName, "Creator");
    });

    test("PMMA - 06 | @smoke Verify a policy can be saved as a draft", async () => {
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

    test("PMMA - 07 | @regression Verify created policies list under Upcoming Expiring Policies (Year)", async () => {
      test.setTimeout(120000);
      // The beforeEach lands on the Overview screen.
      await myActions.verifyOverviewScreen();

      // Select the "Year" range so expiring policies within a year are listed.
      await myActions.selectUpcomingExpiringRange("Year");

      // The AI and Template policies created earlier (PMMA-04 / PMMA-05) appear.
      const aiPolicyName = TestData.getKey(
        FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );
      const templatePolicyName = TestData.getKey(
        FILE_KEYS.POLICY_MANAGEMENT_TEMPLATE_POLICY,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );

      await myActions.verifyPolicyInUpcomingExpiring(aiPolicyName);
      await myActions.verifyPolicyInUpcomingExpiring(templatePolicyName);
    });

    test("PMMA - 08 | @regression Verify assigned category name is listed on the Overview", async () => {
      test.setTimeout(120000);
      // The beforeEach lands on the Overview screen.
      await myActions.verifyOverviewScreen();

      // The category assigned to the AI policy (PMMA-04) is listed under
      // CATEGORIES NAMES on the Overview.
      const categoryName = TestData.getKey(
        FILE_KEYS.POLICY_MANAGEMENT_CATEGORY,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );
      await myActions.verifyCategoryInOverview(categoryName);
    });

    test("PMMA - 09 | @regression Verify a created policy can be deleted", async () => {
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

      // The policy is present in All Policies and My Actions before deletion.
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

    test("PMMA - 10 | @regression Verify a policy can be copied to the Artifacts Registry", async ({
      page,
    }) => {
      test.setTimeout(240000);
      const addEntityPage = new AddEntityPage(page);
      const artifactRegistry = new ArtifactRegistry(page);

      // 1) Create a destination multi-entity.
      await addEntityPage.clickMultiEntitySidebar();
      await addEntityPage.clickNewEntity();
      const subEntityName =
        await addEntityPage.createUniqueEntityName("PolicySub");
      await addEntityPage.clickEntityAdd();
      await addEntityPage.waitForMultiEntityCreatedToast();
      await addEntityPage.verifyEntityInList(subEntityName);

      // 2) Open Policies and copy the AI policy (created in PMMA-04) to the entity.
      await managementPage.clickPolicyManagementButton();
      await managementPage.waitForSpinner();
      await myActions.clickPoliciesSubMenu();
      await myActions.verifyPoliciesUrl();

      const aiPolicyName = TestData.getKey(
        FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );
      await myActions.copyPolicyToArtifactsRegistry(
        aiPolicyName,
        subEntityName,
      );

      // 3) Open the destination entity and verify the policy is in its
      // Artifacts Registry (copied as "<policy name>.docx").
      // 3) Open the destination entity and verify the policy is listed in its
      // Artifacts Registry, copied as "<policy name>.docx".
      await addEntityPage.clickMultiEntitySidebar();
      await myActions.openSubEntity(subEntityName);
      await artifactRegistry.navigateToArtifactRegistryFromSideMenu();
      await artifactRegistry.verifyUploadedFile(`${aiPolicyName}.docx`);
    });

    test("PMMA - 11 | @regression Verify user can upload a policy revision", async () => {
      test.setTimeout(180000);
      await myActions.clickPoliciesSubMenu();
      await myActions.verifyPoliciesUrl();

      // Use the AI policy created in PMMA-04.
      const aiPolicyName = TestData.getKey(
        FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );

      // Capture the current version so we can assert the +1 increment.
      const versionBefore = await myActions.getPolicyVersion(aiPolicyName);
      const majorBefore = parseInt(versionBefore, 10);
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

    test("PMMA - 12 | @regression Verify user can preview multiple documents", async () => {
      test.setTimeout(180000);
      await myActions.clickPoliciesSubMenu();
      await myActions.verifyPoliciesUrl();

      // Preview the AI and Template policies created earlier (PMMA-04 / PMMA-05).
      const aiPolicyName = TestData.getKey(
        FILE_KEYS.POLICY_MANAGEMENT_AI_POLICY,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
      );
      const templatePolicyName = TestData.getKey(
        FILE_KEYS.POLICY_MANAGEMENT_TEMPLATE_POLICY,
        TEST_DATA_FILE_ENUMS.POLICY_MANAGEMENT,
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

    test("PMMA - 13 | @regression Verify the total counter matches the listed policies", async () => {
      test.setTimeout(120000);
      await myActions.clickPoliciesSubMenu();
      await myActions.verifyPoliciesUrl();

      // The total policies counter equals the number of rows in All Policies.
      await myActions.clickAllPoliciesTab();
      await myActions.verifyTotalCountMatchesTableRows();
    });
  });
});
