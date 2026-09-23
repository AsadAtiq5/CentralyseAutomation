const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const ImportAssessmentVendor = require("../../../pages/Secure/ImportAssessment/ImportAssessmentVendor");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 180000,
  DEFAULT: 60000,
};

test.describe("Import Assessment Vendor Tests", () => {
  let managementPage;
  let addClientPage;
  let addVendorPage;
  let importAssessmentVendorPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addVendorPage = new AddVendorPage(page);
    importAssessmentVendorPage = new ImportAssessmentVendor(page);
  });

  test("IAV - 01 | @smoke Import Assessment Vendor - Create client, vendor and navigate to collection", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Step 1: Create a new client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("IAVendorClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    console.log(`Client created: ${clientName}`);
    await managementPage.waitForSpinner();

    // Step 2: Navigate to the vendor screen
    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();
    console.log("Navigated to vendor screen");

    // Step 3: Create new vendor (select AI Governance)
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName = await addVendorPage.createUniqueVendorNameShort("IAV");
    await addVendorPage.createUniquePOCName("POC");
    await addVendorPage.createUniquePOCEmail(vendorName);
    await addVendorPage.clickNextButton();
    await addVendorPage.selectAIGovernanceFramework();
    await addVendorPage.clickNextButton();
    await addVendorPage.clickAddDomainButton();
    await addVendorPage.createUniqueDomainName("domain");
    await addVendorPage.clickCompleteButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.waitForAddVendorPopupHidden();
    await addVendorPage.waitForInProgressVendorStatusHidden();
    console.log(`Vendor created: ${vendorName}`);

    // Save clientName and vendorName for subsequent test cases
    TestData.setKey(
      FILE_KEYS.IMPORT_ASSESSMENT_VENDOR_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );
    TestData.setKey(
      FILE_KEYS.IMPORT_ASSESSMENT_VENDOR_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );
    console.log(
      `Saved test data: clientName=${clientName}, vendorName=${vendorName}`,
    );

    // Step 4: Navigate to the vendor collection
    await addVendorPage.verifyVendorVisible(vendorName);
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();
    console.log(`Navigated to vendor collection for vendor: ${vendorName}`);

    // Step 5: Click edit button then click the AI Governance framework card
    await importAssessmentVendorPage.clickEditCollectionFrameworkButton();
    await importAssessmentVendorPage.clickFrameworkCard(
      "AI GOVERNANCE (VENDOR)",
    );

    // Step 6: Click Import Assessment
    await importAssessmentVendorPage.clickImportAssessmentButton();

    // Step 7: Wait for the Import Assessment modal and click Next
    await importAssessmentVendorPage.waitForImportAssessmentModal();
    await importAssessmentVendorPage.clickImportAssessmentNextButton();

    // Step 8: Upload the AIGovernanceYes.xlsx file
    const importFilePath = path.join(
      process.cwd(),
      "filesTest",
      "ImportAssessmentFiles",
      "AIGovernanceYes.xlsx",
    );
    await importAssessmentVendorPage.uploadImportAssessmentFile(importFilePath);

    // Step 9: Click the ADD button
    await importAssessmentVendorPage.clickImportAssessmentAddButton();

    // Step 10: Wait for the success modal and click OK
    await importAssessmentVendorPage.waitForImportSuccessModal();
    await importAssessmentVendorPage.clickImportSuccessOkButton();

    // Step 11: Verify score is 10.0 and click Open on the AI Governance framework card
    await importAssessmentVendorPage.verifyFrameworkScore(
      "AI GOVERNANCE (VENDOR)",
      "10",
    );
    await importAssessmentVendorPage.clickFrameworkOpenButton(
      "AI GOVERNANCE (VENDOR)",
    );

    // Step 12: Verify all questions are answered Yes
    await importAssessmentVendorPage.verifyAllQuestionsAnsweredYes();
  });
});
