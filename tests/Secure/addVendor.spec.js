const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../pages/Secure/ManagementPage");
const AddVendorPage = require("../../pages/Secure/AddVendorPage");
const AddClientPage = require("../../pages/Secure/AddClientPage");
const TestData = require("../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../constant/enums");
const { fetchPageURL } = require("../../helpers/common/fetchPageURL");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Add Vendor Tests", () => {
  let managementPage;
  let addVendorPage;
  let addClientPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addVendorPage = new AddVendorPage(page);
    addClientPage = new AddClientPage(page);

    // If clientID is already saved, navigate directly to the vendors page.
    // This skips the full UI path (search client → click → sidemenu) for every test.
    const clientId = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    if (clientId) {
      await managementPage.goto(`/third-party/${clientId}/vendors`);
    } else {
      await managementPage.goto("/clients");
    }
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  // ─── SMOKE ─────────────────────────────────────────────────────────────────
  // This test is fully standalone: it creates its own client, creates a vendor,
  // navigates to the collection page, and saves both the clientID and vendorID
  // to testData/vendor.json for use by the regression tests below.
  test("VE - 01 | @smoke Add Vendor", async ({ page }) => {
    test.setTimeout(180000);

    // 1. Create a dedicated client for vendor tests
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("VendorClient");
    TestData.setKey(
      FILE_KEYS.CLIENT_NAME_FOR_VENDOR,
      clientName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();

    // 2. Navigate to the new client and then to vendors
    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();

    // 3. Create the vendor
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName = await addVendorPage.createUniqueVendorName("Vendor");
    TestData.setKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
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

    // 4. Click into the vendor and navigate to collection
    await addVendorPage.verifyVendorVisible(vendorName);
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();

    // 5. Extract both UUIDs from the collection URL and save them:
    //    uuids[0] = clientID, uuids[1] = vendorID
    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.VENDOR,
      );
    }
    if (uuids.length > 1) {
      TestData.setKey(
        FILE_KEYS.VENDOR_UUID,
        uuids[1],
        TEST_DATA_FILE_ENUMS.VENDOR,
      );
    }

    // 6. Verify collection has questions
    await addVendorPage.waitForLoad();
    await addVendorPage.clickOpenButton();
    const questionCount = await addVendorPage.getQuestionCount();
    expect(questionCount).toBeGreaterThan(0);
  });

  // ─── REGRESSION ────────────────────────────────────────────────────────────
  // beforeEach already navigates to /third-party/{clientID}/vendors,
  // so these tests only need to find the vendor and act on it.

  test("VE - 02 | @regression Update Vendor Information from vendor details", async ({
    page,
  }) => {
    test.setTimeout(180000);

    const vendorName = TestData.getKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();

    await addVendorPage.clickEditVendorIcon();
    const updatedVendorName =
      await addVendorPage.updateVendorName("UpdatedVendor");
    TestData.setKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      updatedVendorName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    await addVendorPage.clickSaveVendorButton();
    await addVendorPage.waitForVendorUpdatedToast(updatedVendorName);
  });

  test("VE - 03 | @regression Verify new requirement and certificates", async ({
    page,
  }) => {
    test.setTimeout(240000);

    // 1. Create a dedicated client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("ReqCertClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();

    // 2. Navigate to vendor screen
    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();

    // 3. Click Add Vendor and fill details
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName =
      await addVendorPage.createUniqueVendorNameShort("ReqVendor");
    await addVendorPage.createUniquePOCName("POC");
    await addVendorPage.createUniquePOCEmail(vendorName);

    // 4. Next → select AI Governance → Next
    await addVendorPage.clickNextButton();
    await addVendorPage.selectAIGovernanceFramework();
    await addVendorPage.clickNextButton();

    // 5. Click Add New in Requirements section
    await addVendorPage.clickAddNewRequirementButton();

    // 6. Fill requirement name
    const requirementName = await addVendorPage.fillRequirementName("TestReq");

    // 7. Upload a file from filesTest folder
    const filePath = path.join(process.cwd(), "filesTest/Files/testFile.pdf");
    await addVendorPage.uploadRequirementFile(filePath);

    // 8. Wait for "File uploaded !" toast
    await addVendorPage.waitForFileUploadedToast();

    // 9. Click COMPLETE in requirement popup
    await addVendorPage.clickRequirementCompleteButton();

    // 10. Select Default Settings radio and click UPLOAD
    await addVendorPage.selectDefaultSettingsRadio();
    await addVendorPage.clickModalUploadButton();
    await addVendorPage.waitForSpinner();

    // 11. Add domain
    await addVendorPage.clickAddDomainButton();
    await addVendorPage.createUniqueDomainName("domain");

    // 12. Complete vendor creation
    await addVendorPage.clickCompleteButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.waitForAddVendorPopupHidden();
    await addVendorPage.waitForInProgressVendorStatusHidden();

    // 13. Click on vendor → Artifacts sidemenu → verify requirement in list
    await addVendorPage.verifyVendorVisible(vendorName);
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickArtifactsTab();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyRequirementInArtifactsList(requirementName);
  });

  test("VE - 04 | @regression Delete Vendor", async ({ page }) => {
    test.setTimeout(180000);

    // 1. Create a new vendor to delete
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName =
      await addVendorPage.createUniqueVendorNameShort("DelVendor");
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

    // 2. Verify the created vendor is visible in the list
    await addVendorPage.verifyVendorVisible(vendorName);

    // 3. Select the vendor via checkbox
    await addVendorPage.checkVendorByName(vendorName);
    await addVendorPage.waitForSpinner();

    // 4. Click the delete icon
    await addVendorPage.clickDeleteIcon();

    // 5. Verify the delete modal is displayed
    await addVendorPage.verifyDeleteVendorModal();

    // 6. Type "confirm" in the input and click CONFIRM
    await addVendorPage.enterDeleteConfirmation();
    await addVendorPage.clickDeleteConfirmButton();

    // 7. Wait 5 seconds and click CONFIRM again
    await page.waitForTimeout(5000);
    await addVendorPage.clickDeleteConfirmButton();

    // 8. Wait for "Vendors deleted successfully" toast to appear and disappear
    await addVendorPage.waitForVendorDeletedToast();

    // 9. Verify the deleted vendor is no longer in the list
    await addVendorPage.verifyVendorNotVisible(vendorName);
  });

  test("VE - 05 | @regression Verify user can add questionnaire", async ({
    page,
  }) => {
    test.setTimeout(180000);

    const vendorName = TestData.getKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();

    await addVendorPage.clickQuestionnaireTab();
    await addVendorPage.verifyQuestionnaireHeader();

    await addVendorPage.clickAddNewFrameworkButton();
    await addVendorPage.waitForSpinner();

    const selectedFramework = await addVendorPage.selectRandomFramework();
    await addVendorPage.clickPopupNextButton(); // To Artifacts
    await addVendorPage.clickPopupNextButton(); // To Manager
    await addVendorPage.clickPopupNextButton(); // To Final
    await addVendorPage.clickPopupAddButton();

    await addVendorPage.waitForFrameworkCreatedToast();

    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyFrameworkVisibleInCollection(selectedFramework);
  });

  test("VE - 06 | @regression Download Vendor Report", async () => {
    test.setTimeout(300000);

    const vendorName = TestData.getKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    const generatedReportOptions = [
      "General Report (XLS)",
      "General Report (CSV)",
      "Current View (XLS)",
      "Current View (CSV)",
    ];

    // Options that show "Report is generated successfully" toast
    for (const option of generatedReportOptions) {
      await addVendorPage.clickDownloadButton();
      await addVendorPage.waitForDownloadDropdownVisible();
      await addVendorPage.clickDownloadOption(option);
      await addVendorPage.waitForReportGeneratedToast();
    }

    // Executive Summary shows "Report downloaded successfully" toast
    await addVendorPage.clickDownloadButton();
    await addVendorPage.waitForDownloadDropdownVisible();
    await addVendorPage.clickDownloadOption("Executive Summary");
    await addVendorPage.waitForReportDownloadedToast();

    // Single Vendor Report: select a vendor first, then download
    await addVendorPage.checkVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickDownloadButton();
    await addVendorPage.waitForDownloadDropdownVisible();
    await addVendorPage.clickDownloadOption("Single Vendor Report");
  });
});
