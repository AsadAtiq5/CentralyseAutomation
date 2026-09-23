const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const BulkUploadPage = require("../../../pages/Secure/Vendor/BulkUpload");
const VendorFilters = require("../../../pages/Secure/Vendor/VendorFilters");
const {
  generateUniqueVendorCsv,
  deleteVendorCsv,
  readVendorDataFromCsv,
} = require("../../../helpers/vendor/vendorCsvHelper");

const VENDOR_CSV_TEMPLATE = path.join(
  process.cwd(),
  "filesTest/Vendor/vendors.csv",
);

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Vendor Filters Tests", () => {
  let managementPage;
  let addClientPage;
  let bulkUploadPage;
  let vendorFiltersPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    bulkUploadPage = new BulkUploadPage(page);
    vendorFiltersPage = new VendorFilters(page);

    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("VF - 01 | @smoke Vendor Filters - Bulk Upload and Apply Filters", async () => {
    test.setTimeout(240000);

    // 1. Create a dedicated client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("FilterClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();

    // 2. Navigate to the vendors screen
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();
    await bulkUploadPage.clickThirdPartySidemenu();
    await bulkUploadPage.waitForSpinner();
    await bulkUploadPage.clickVendorSidemenu();
    await bulkUploadPage.waitForSpinner();

    // 3. Generate the unique CSV and read its data before upload so we have
    //    ground-truth impact values for every vendor name.
    const tempCsvPath = generateUniqueVendorCsv(VENDOR_CSV_TEMPLATE);
    const csvVendors = readVendorDataFromCsv(tempCsvPath);
    console.log(`\n=== CSV VENDOR DATA (${csvVendors.length} vendors) ===`);
    csvVendors.forEach((v, i) =>
      console.log(`  [${i + 1}] name: "${v.name}" | impact: "${v.impact}"`),
    );

    // 4. Bulk upload vendors
    try {
      await bulkUploadPage.clickAddVendorButton();
      await bulkUploadPage.waitForSpinner();
      await bulkUploadPage.clickBulkUploadButton();
      await bulkUploadPage.clickNextButton();
      await bulkUploadPage.uploadVendorFile(tempCsvPath);
      await bulkUploadPage.waitForNextButtonEnabled();
      await bulkUploadPage.verifyPreviewTableHasRows();
      await bulkUploadPage.clickNextButton();
      await bulkUploadPage.clickNextButton();
      await bulkUploadPage.waitForResultsScreen();
      await bulkUploadPage.clickDoneButton();
      await bulkUploadPage.waitForBulkUploadSuccessToast();
      await vendorFiltersPage.page.waitForTimeout(60000);
    } finally {
      deleteVendorCsv(tempCsvPath);
    }

    // 5. Wait for vendor rows to render, then scroll to load all of them and
    //    snapshot the full UI dataset (name, risk, impact, probability).
    //    This is the source of truth for correctness + completeness verification later.
    await vendorFiltersPage.waitForSpinner();
    const allVendors = await vendorFiltersPage.getAllVendorRowData();
    console.log(
      `\n=== UI SNAPSHOT — ALL VENDORS (${allVendors.length} rows) ===`,
    );
    allVendors.forEach((v, i) =>
      console.log(
        `  [${i + 1}] name: "${v.name}" | risk: "${v.risk}" | impact: "${v.impact}" | probability: "${v.probability}"`,
      ),
    );

    // 6. Open the filter popup
    await vendorFiltersPage.clickFilterButton();
    await vendorFiltersPage.verifyFilterModal();

    // 7. Select random filters from Risk, Impact, and Probability (excluding "All")
    const selectedRisks =
      await vendorFiltersPage.selectRandomFiltersFromSection("Risk");
    const selectedImpacts =
      await vendorFiltersPage.selectRandomFiltersFromSection("Impact");
    const selectedProbabilities =
      await vendorFiltersPage.selectRandomFiltersFromSection("Probability");

    console.log(`\n=== SELECTED FILTERS ===`);
    console.log(`  Risk        : [${selectedRisks.join(", ") || "none"}]`);
    console.log(`  Impact      : [${selectedImpacts.join(", ") || "none"}]`);
    console.log(
      `  Probability : [${selectedProbabilities.join(", ") || "none"}]`,
    );

    // 8. Apply the filters
    await vendorFiltersPage.clickApplyFilterButton();
    await vendorFiltersPage.waitForSpinner();

    // 9. Verify the displayed vendors against:
    //    - the UI snapshot (allVendors) for correctness + completeness
    //    - the CSV data (csvVendors) for impact cross-check
    await vendorFiltersPage.verifyFilteredVendors(allVendors, csvVendors, {
      risk: selectedRisks,
      impact: selectedImpacts,
      probability: selectedProbabilities,
    });
  });
});
