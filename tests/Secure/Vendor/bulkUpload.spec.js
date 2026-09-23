const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const BulkUploadPage = require("../../../pages/Secure/Vendor/BulkUpload");
const {
  updateVendorTemplate,
} = require("../../../helpers/vendor/vendorCsvHelper");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const VENDOR_TEMPLATE = path.join(
  process.cwd(),
  "filesTest/Vendor/bulk-vendors-template (6).xlsm",
);

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Bulk Upload Vendor Tests", () => {
  let managementPage;
  let addClientPage;
  let addVendorPage;
  let bulkUploadPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addVendorPage = new AddVendorPage(page);
    bulkUploadPage = new BulkUploadPage(page);

    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("BUV - 01 | @smoke Bulk Upload Vendors", async ({ page }) => {
    test.setTimeout(180000);

    // 1. Create a dedicated client for this test
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("BulVClient");
    TestData.setKey(
      FILE_KEYS.BULK_VENDOR_CLIENT,
      clientName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");

    // 2. Interact with the Number of Vendors counter
    const initialVendorCount = await addClientPage.getNumberOfVendors();
    console.log(`Initial Number of Vendors: ${initialVendorCount}`);

    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();

    // 3. Search and click the new client
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // 4. Navigate to Vendors via the side menu
    await bulkUploadPage.clickThirdPartySidemenu();
    await bulkUploadPage.waitForSpinner();
    await bulkUploadPage.clickVendorSidemenu();
    await bulkUploadPage.waitForSpinner();

    // 5. Populate the committed template with unique data for this run
    updateVendorTemplate(VENDOR_TEMPLATE);

    // Open the Add Vendor popup and switch to Bulk Upload mode
    await bulkUploadPage.clickAddVendorButton();
    await bulkUploadPage.waitForSpinner();
    await bulkUploadPage.clickBulkUploadButton();
    // Wait for bulk upload popup to fully render
    await bulkUploadPage.waitForSpinner();

    // Step 1 → Step 2 (file upload)
    await bulkUploadPage.clickNextButton();
    // Wait for file upload step to render before setting input files
    await page.waitForTimeout(3000);

    // Upload the template file and give Angular time to process it before checking button state
    await bulkUploadPage.uploadVendorFile(VENDOR_TEMPLATE);
    await page.waitForTimeout(3000);
    await bulkUploadPage.waitForNextButtonEnabled();

    // Step 2 → Step 3 (preview)
    // await bulkUploadPage.clickNextButton();
    // Wait for preview table to load
    await page.waitForTimeout(3000);

    // Verify the preview table has data rows
    await bulkUploadPage.verifyPreviewTableHasRows();

    // Step 3 → Step 4
    await bulkUploadPage.clickNextButton();
    await page.waitForTimeout(3000);

    // Step 4 → results screen
    await bulkUploadPage.clickNextButton();

    // Wait up to 2 min for the results screen, then read counts and click Done
    await bulkUploadPage.waitForResultsScreen();
    const { uploaded, failed } = await bulkUploadPage.getUploadResults();
    console.log(`Upload results — Uploaded: ${uploaded}, Failed: ${failed}`);
    await bulkUploadPage.clickDoneButton();
    await page.waitForTimeout(3000);

    // Wait for the completion toast
    await bulkUploadPage.waitForBulkUploadSuccessToast();
  });

  test("BUV - 02 | @regression Add Single Vendor After Package Limit - Verify Pending Status", async ({
    page,
  }) => {
    test.setTimeout(180000);

    const clientName = TestData.getKey(
      FILE_KEYS.BULK_VENDOR_CLIENT,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // 1. Search and open the client created in the smoke test
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // 2. Navigate to Vendors via the side menu
    await bulkUploadPage.clickThirdPartySidemenu();
    await bulkUploadPage.waitForSpinner();
    await bulkUploadPage.clickVendorSidemenu();
    await bulkUploadPage.waitForSpinner();

    // 3. Add a new single vendor (this exceeds the package limit)
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName = await addVendorPage.createUniqueVendorNameShort("PV");
    await addVendorPage.createUniquePOCName("POC");
    await addVendorPage.createUniquePOCEmail(vendorName);
    await addVendorPage.clickNextButton();
    await addVendorPage.selectAIGovernanceFramework();
    await addVendorPage.clickNextButton();
    await addVendorPage.clickAddDomainButton();
    await addVendorPage.createUniqueDomainName("domain");

    // 4. Click Complete — vendor package exceeded popup should appear
    await addVendorPage.clickCompleteButton();
    await bulkUploadPage.verifyVendorPackagePopup();

    // 5. Click GO to proceed and wait for the add-vendor popup to close
    await bulkUploadPage.clickGoButton();
    await addVendorPage.waitForAddVendorPopupHidden();
    await bulkUploadPage.waitForSpinner();

    // 6. Verify the new vendor appears in the table with "pending" status
    await bulkUploadPage.verifyVendorStatusByName(vendorName, "pending");
  });
});
