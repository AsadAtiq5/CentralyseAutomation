const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RiskRegisterGroup = require("../../../pages/Secure/RiskRegister/RiskRegisterGroup");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const {
  getFilteredGroupCount,
} = require("../../../helpers/riskRegister/riskGroupHelper");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Risk Register Groups", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let riskRegisterGroup;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    riskRegisterGroup = new RiskRegisterGroup(page);

    await addClientPage.goto("/clients");
  });

  test("RRG - 01 | @regression Verify when no subentity risk register screen navigates to Multientity screen", async ({
    page,
  }) => {
    test.setTimeout(600000);

    // Create a new client with no sub-entity
    await managementPage.clickAddClientButton();
    const clientName = await addClientPage.createUniqueClientName("RRG");

    TestData.setKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl();
    await addClientPage.clickAddClientButton();
    await page.waitForTimeout(3000);

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Register toast listener BEFORE clicking so it isn't missed during navigation
    const toastPromise = riskRegisterGroup.prepareNoSubentityToastListener();

    // Click risk register from the side menu
    await riskRegisterGroup.navigateToRiskRegister();

    // Verify toast notification is displayed (promise was pre-registered before click)
    await riskRegisterGroup.assertNoSubentityToastVisible(toastPromise);

    // Verify navigation redirects to the multi-entity screen
    await riskRegisterGroup.assertMultiEntityScreenVisible();
  });

  test("RRG - 02 | @smoke verify risk groups should be visible after creating sub entity", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the multi-entity screen and create a new sub-entity
    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);

    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);

    const subEntityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    const selectedRisk = await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);

    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await riskRegisterGroup.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(subEntityName);
    await page.waitForTimeout(180000);

    // Save risk name for future tests
    TestData.setKey(
      "riskName",
      selectedRisk,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();

    // Verify the Risk Groups title is displayed
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    await riskRegisterGroup.assertRiskGroupsVisible();
  });

  test("RRG - 03 | @regression Severity Count From Backend Risk Groups", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );
    const riskName = TestData.getKey(
      "riskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    // Get severity counts from the UI filter badges
    const uiTotal = await riskRegisterGroup.getSeverityCount("Total");
    const uiCritical = await riskRegisterGroup.getSeverityCount("Critical");
    const uiHigh = await riskRegisterGroup.getSeverityCount("High");
    const uiMedium = await riskRegisterGroup.getSeverityCount("Medium");
    const uiLow = await riskRegisterGroup.getSeverityCount("Low");

    // Get severity counts calculated from backend (S3 data)
    const backendCounts = await getFilteredGroupCount([riskName]);
    console.log("UI Counts:", { uiTotal, uiCritical, uiHigh, uiMedium, uiLow });

    // Verify UI counts match backend counts
    expect(uiTotal).toBe(backendCounts.total);
    expect(uiCritical).toBe(backendCounts.critical);
    expect(uiHigh).toBe(backendCounts.high);
    expect(uiMedium).toBe(backendCounts.medium);
    expect(uiLow).toBe(backendCounts.low);
  });

  test("RRG - 04 | @smoke Add new risk group", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    // Click the New Group button and verify the popup appears
    await riskRegisterGroup.clickNewGroupButton();
    await riskRegisterGroup.verifyNewGroupPopup();

    // Enter a unique group name (max 15 characters) and save it
    const riskGroupName = await riskRegisterGroup.createUniqueGroupName("RG");
    TestData.setKey(
      "riskGroupName",
      riskGroupName,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Select random risks from the table and capture their names
    const selectedRiskNames =
      await riskRegisterGroup.selectRandomRisksFromPopup();
    await page.waitForTimeout(2000);

    // Click Create and wait for the success toast
    await riskRegisterGroup.clickCreateGroupButton();
    await riskRegisterGroup.waitForGroupCreatedToast();

    // Search for the created group and verify it is visible in the table
    await riskRegisterGroup.searchGroup(riskGroupName);
    await riskRegisterGroup.verifyGroupVisible(riskGroupName);

    // Click on the searched group row
    await riskRegisterGroup.clickSearchedGroup(riskGroupName);

    // Click on the Risks box
    await riskRegisterGroup.clickRisksBox();

    // Verify the selected risks are displayed in the detail table
    await riskRegisterGroup.assertRisksDetailTableVisible(selectedRiskNames);
  });

  test("RRG - 05 | @smoke Update group status", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    // Search for the previously created group and open it
    const riskGroupName = TestData.getKey(
      "riskGroupName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );
    await riskRegisterGroup.searchGroup(riskGroupName);
    await riskRegisterGroup.clickSearchedGroup(riskGroupName);
    await page.waitForTimeout(2000);

    // Click edit icon and select a random risk status
    await riskRegisterGroup.clickEditIcon();
    const selectedStatus = await riskRegisterGroup.selectRandomRiskStatus();
    await page.waitForTimeout(2000);

    // Save and verify the status is updated
    await riskRegisterGroup.clickSaveButton();
    const actualStatus = await riskRegisterGroup.getRiskStatusText();
    const { expect } = require("@playwright/test");
    expect(actualStatus).toBe(selectedStatus);
  });

  test("RRG - 06 | @regression Add Comment to Risk Group", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    // Search for the previously created group and open it
    const riskGroupName = TestData.getKey(
      "riskGroupName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );
    await riskRegisterGroup.searchGroup(riskGroupName);
    await riskRegisterGroup.clickSearchedGroup(riskGroupName);
    await page.waitForTimeout(2000);

    // Click on the Comments section
    await riskRegisterGroup.clickCommentsSection();
    await page.waitForTimeout(1000);

    // Add a comment and verify it appears
    const testComment = "This is an automated test comment for risk group.";
    await riskRegisterGroup.addComment(testComment);
    await page.waitForTimeout(2000);
    await riskRegisterGroup.verifyComment(testComment);
  });

  test("RRG - 07 | @regression Severity Count Risk Groups", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    // Total
    await riskRegisterGroup.clickTotal();
    const totalCount = await riskRegisterGroup.getSeverityCount("Total");
    const totalRows = await riskRegisterGroup.emptyStateCheck();
    expect(totalRows).toBe(totalCount);

    // Critical
    await riskRegisterGroup.clickCritical();
    const criticalCount = await riskRegisterGroup.getSeverityCount("Critical");
    const criticalRows = await riskRegisterGroup.emptyStateCheck();
    expect(criticalRows).toBe(criticalCount);

    // High
    await riskRegisterGroup.clickHigh();
    const highCount = await riskRegisterGroup.getSeverityCount("High");
    const highRows = await riskRegisterGroup.emptyStateCheck();
    expect(highRows).toBe(highCount);

    // Medium
    await riskRegisterGroup.clickMedium();
    const mediumCount = await riskRegisterGroup.getSeverityCount("Medium");
    const mediumRows = await riskRegisterGroup.emptyStateCheck();
    expect(mediumRows).toBe(mediumCount);

    // Low
    await riskRegisterGroup.clickLow();
    const lowCount = await riskRegisterGroup.getSeverityCount("Low");
    const lowRows = await riskRegisterGroup.emptyStateCheck();
    expect(lowRows).toBe(lowCount);
  });

  test("RRG - 08 | @regression Automatic group deletion", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    // Click a random group from the table (no search)
    await riskRegisterGroup.clickRandomGroupFromTable();

    // Click the delete button on the selected group
    await riskRegisterGroup.clickDeleteButton();

    // Verify the DELETE GROUP popup appears
    await riskRegisterGroup.verifyDeleteGroupPopup();

    // Type "confirm" and click CONFIRM
    await riskRegisterGroup.typeDeleteConfirmation();
    await riskRegisterGroup.clickDeleteConfirmButton();

    // Verify the toast "Automatic groups cannot be deleted."
    await riskRegisterGroup.waitForAutomaticGroupDeleteToast();
  });

  test("RRG - 09 | @regression Archive group", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_GROUPS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_GROUPS,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the Risk Groups screen via side menu
    await riskRegisterGroup.navigateToRiskRegisterGroups();
    await riskRegisterGroup.assertRiskGroupsTitleVisible();

    // Select any group from the list and capture its name
    const archivedGroupName =
      await riskRegisterGroup.clickRandomGroupFromTableAndGetName();

    // Click the Archive button
    await riskRegisterGroup.clickArchiveButton();

    // Verify the ARCHIVE GROUP popup appears
    await riskRegisterGroup.verifyArchiveGroupPopup();

    // Click CONFIRM to archive the group
    await riskRegisterGroup.clickArchiveConfirmButton();

    // Wait for the success toast
    await riskRegisterGroup.waitForGroupArchivedToast();

    // Navigate to the Archive section via side menu
    await riskRegisterGroup.navigateToArchiveSection();

    // Select Risk Groups from the dropdown to view archived groups
    await riskRegisterGroup.selectAllRiskGroupsFromDropdown();

    // Verify the archived group is displayed in the archive table
    await riskRegisterGroup.assertArchivedGroupInTable(archivedGroupName);
  });
});
