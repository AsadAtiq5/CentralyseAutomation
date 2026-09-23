const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const ControlsFilterPage = require("../../../pages/Secure/Controls/Filter");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUT = 600000;

test.describe("Controls Filter Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let controlsFilterPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    controlsFilterPage = new ControlsFilterPage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  // ─── Setup ──────────────────────────────────────────────────────────────────

  test("CF - 01 | @smoke Controls Filter - Setup: create client and entities", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUT);

    // 1. Create a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("FilterClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log(`Created client: ${clientName}`);

    // 2. Navigate into the client
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // 3. Create entity
    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);
    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);
    const entity1 = await addEntityPage.createUniqueEntityName("FilterEntity");
    await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForMultiEntityCreatedToast();
    console.log(`Created entity: ${entity1}`);
    await addEntityPage.verifyEntityInList(entity1);
    await page.waitForTimeout(2000);
    console.log(`Entity created: ${entity1}`);

    // 4. Visit the collection screen so controls data is populated
    await addEntityPage.navigateToCollection();
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Collection.");

    // 5. Navigate to Controls > Table to confirm data is visible
    await controlsFilterPage.navigateToControlsTable();
    await controlsFilterPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Controls Table.");

    // 7. Save client name for the 15 filter tests
    TestData.setKey(
      FILE_KEYS.CONTROL_FILTER_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    console.log(`Saved filter client: "${clientName}"`);
  });

  // ─── Filter verification ────────────────────────────────────────────────────

  test("CF - 02 | @smoke Controls Filter - Random Filter Verification", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUT);

    const clientName = TestData.getKey(
      FILE_KEYS.CONTROL_FILTER_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    console.log(`Using client: "${clientName}"`);

    // 1. Navigate to the client
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // 2. Navigate to Controls > Table
    await controlsFilterPage.navigateToControlsTable();
    await controlsFilterPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Controls Table.");

    // 3. Snapshot all rows before applying any filter
    const allRowsSnapshot = await controlsFilterPage.getAllTableRowData();
    console.log(`Pre-filter snapshot: ${allRowsSnapshot.length} row(s).`);

    // 4. Open the filter panel and apply one random filter
    await controlsFilterPage.clickFilterButton();
    await page.waitForTimeout(2000);
    const selectedFilters =
      await controlsFilterPage.selectOneRandomFilterCategory();
    await page.waitForTimeout(2000);
    await controlsFilterPage.clickApplyFilterButton();
    await page.waitForTimeout(2000);

    // 5. Verify every displayed row satisfies the applied filter
    await controlsFilterPage.verifyFilteredRows(
      allRowsSnapshot,
      selectedFilters,
    );
    console.log("✔ Random filter verification passed.");
  });
});
