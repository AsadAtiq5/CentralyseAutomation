const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const BulkUploadPage = require("../../../pages/Secure/Vendor/BulkUpload");
const VendorArtifactsPage = require("../../../pages/Secure/Vendor/VendorArtifacts");
const TestData = require("../../../constant/testData");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SHORT: 600000,
};

test.describe("Vendor Artifacts Tests", () => {
  let managementPage;
  let addClientPage;
  let addVendorPage;
  let bulkUploadPage;
  let vendorArtifactsPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addVendorPage = new AddVendorPage(page);
    bulkUploadPage = new BulkUploadPage(page);
    vendorArtifactsPage = new VendorArtifactsPage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("VA - 01 | @smoke Vendor Artifacts - Add new artifact", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Add a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("ArtifactClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    TestData.setKey(
      FILE_KEYS.CLIENT_NAME_FOR_VENDOR,
      clientName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // 3. Navigate to 3rd Party > Vendors
    await bulkUploadPage.clickThirdPartySidemenu();
    await bulkUploadPage.waitForSpinner();
    await bulkUploadPage.clickVendorSidemenu();
    await bulkUploadPage.waitForSpinner();

    // 4. Add a new vendor
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName = await addVendorPage.createUniqueVendorNameShort("ArtV");
    await addVendorPage.createUniquePOCName("ArtPOC");
    await addVendorPage.createUniquePOCEmail(vendorName);
    await addVendorPage.clickNextButton();
    await addVendorPage.selectAIGovernanceFramework();
    await addVendorPage.clickNextButton();
    await addVendorPage.clickAddDomainButton();
    await addVendorPage.createUniqueDomainName("artifact-domain");
    await addVendorPage.clickCompleteButton();
    await addVendorPage.waitForAddVendorPopupHidden();
    await bulkUploadPage.waitForSpinner();
    TestData.setKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    console.log(`Created vendor: ${vendorName}`);

    // 5. Wait for the vendor to finish processing then open its detail page
    await addVendorPage.waitForInProgressVendorStatusHidden();
    await addVendorPage.clickVendorByName(vendorName);
    await managementPage.waitForSpinner();
    console.log(`Opened vendor: ${vendorName}`);

    // 6. Select "Artifacts" from the sidenav tabs
    await vendorArtifactsPage.clickArtifactsTab();
    console.log("Selected Artifacts tab.");

    // 7. Click on the Documents section
    await vendorArtifactsPage.clickDocumentsSection();
    console.log("Clicked Documents section.");

    // 8. Record document count before upload
    const countBefore = await vendorArtifactsPage.getDocumentsCount();
    console.log(`Documents count before upload: ${countBefore}`);

    // 9. Click "Add New" button
    await vendorArtifactsPage.clickAddNewButton();
    console.log("Clicked Add New.");

    // 10. Fill in artifact name
    const artifactName =
      await vendorArtifactsPage.fillArtifactName("TestDocument");

    // 11. Upload the file
    await vendorArtifactsPage.uploadFile("filesTest/Files/testFile.pdf");

    // 12. Click COMPLETE button
    await vendorArtifactsPage.clickCompleteButton();

    // 13. Wait for "Assignments are created successfully" toast to appear and disappear
    await vendorArtifactsPage.waitForAssignmentsToast();
    console.log("Artifact created successfully.");

    // 14. Verify the artifact appears in the table
    await vendorArtifactsPage.verifyArtifactInList(artifactName);
    console.log(`Artifact "${artifactName}" verified in list.`);
  });

  test("VA - 02 | @regression Vendor Artifacts - Verify the artifact gap status", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    const clientName = TestData.getKey(
      FILE_KEYS.CLIENT_NAME_FOR_VENDOR,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    const vendorName = TestData.getKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // 1. Search the client and navigate to vendor artifacts
    await vendorArtifactsPage.navigateToVendorArtifacts(
      clientName,
      vendorName,
      {
        managementPage,
        bulkUploadPage,
        addVendorPage,
      },
    );

    // 2. Click the Documents section to load the artifact table
    await vendorArtifactsPage.clickDocumentsSection();

    // 3. Select the first artifact row
    await vendorArtifactsPage.selectFirstArtifact();
    console.log("Selected first artifact.");

    // 4. Click the Gap button in the action bar
    await vendorArtifactsPage.clickGapButton();
    console.log("Clicked Gap button.");

    // 5. Fill the mandatory comment in the gap modal
    await vendorArtifactsPage.fillGapComment("Automated gap comment");

    // 6. Click CONFIRM
    await vendorArtifactsPage.clickGapConfirmButton();

    // 7. Verify the artifact status is now "Excluded"
    await vendorArtifactsPage.verifyFirstArtifactStatus("Excluded");
    console.log('Artifact status verified as "Excluded".');
  });

  test.skip("VA - 03 | @regression Vendor Artifacts - Verify the artifact approve status", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    const clientName = TestData.getKey(
      FILE_KEYS.CLIENT_NAME_FOR_VENDOR,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    const vendorName = TestData.getKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // 1. Search the client and navigate to vendor artifacts
    await vendorArtifactsPage.navigateToVendorArtifacts(
      clientName,
      vendorName,
      {
        managementPage,
        bulkUploadPage,
        addVendorPage,
      },
    );

    // 2. Click the Documents section to load the artifact table
    await vendorArtifactsPage.clickDocumentsSection();

    // 3. Add a new artifact to approve
    await vendorArtifactsPage.clickAddNewButton();
    const artifactName =
      await vendorArtifactsPage.fillArtifactName("ApproveDocument");
    await vendorArtifactsPage.uploadFile("filesTest/Files/testFile.pdf");
    await vendorArtifactsPage.clickCompleteButton();
    await vendorArtifactsPage.waitForAssignmentsToast();
    await vendorArtifactsPage.verifyArtifactInList(artifactName);
    console.log(`Added new artifact: ${artifactName}`);

    // 4. Select the first artifact row
    await vendorArtifactsPage.selectFirstArtifact();
    console.log("Selected first artifact.");

    // 5. Click the Approve button in the action bar
    await vendorArtifactsPage.clickApproveButton();
    console.log("Clicked Approve button.");

    // 6. Click CONFIRM (immediately enabled — no comment required)
    await vendorArtifactsPage.clickApproveConfirmButton();

    // 7. Wait for "Saved Successfully" toast to appear and disappear
    await vendorArtifactsPage.waitForSavedSuccessfullyToast();
    console.log("Artifact approved successfully.");

    // 8. Verify the artifact status is now "Approved"
    await vendorArtifactsPage.verifyFirstArtifactStatus("Approved");
    console.log('Artifact status verified as "Approved".');
  });

  test("VA - 04 | @regression Vendor Artifacts - Verify the artifact deny status", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    const clientName = TestData.getKey(
      FILE_KEYS.CLIENT_NAME_FOR_VENDOR,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    const vendorName = TestData.getKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // 1. Search the client and navigate to vendor artifacts
    await vendorArtifactsPage.navigateToVendorArtifacts(
      clientName,
      vendorName,
      {
        managementPage,
        bulkUploadPage,
        addVendorPage,
      },
    );

    // 2. Click the Documents section to load the artifact table
    await vendorArtifactsPage.clickDocumentsSection();

    // 3. Select the first artifact row
    await vendorArtifactsPage.selectFirstArtifact();
    console.log("Selected first artifact.");

    // 4. Click the Deny button in the action bar
    await vendorArtifactsPage.clickDenyButton();
    console.log("Clicked Deny button.");

    // 5. Fill the mandatory comment in the deny modal
    await vendorArtifactsPage.fillDenyComment("Automated deny comment");

    // 6. Click CONFIRM (enabled after comment is typed)
    await vendorArtifactsPage.clickDenyConfirmButton();

    // 7. Wait for "Saved Successfully" toast to appear and disappear
    await vendorArtifactsPage.waitForSavedSuccessfullyToast();
    console.log("Artifact denied successfully.");

    // 8. Verify the artifact status is now "Excluded"
    await vendorArtifactsPage.verifyFirstArtifactStatus("Excluded");
    console.log('Artifact status verified as "Excluded".');
  });

  test("VA - 05 | @smoke Vendor Artifacts - Upload Artifact", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Add a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("UploadArtClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    TestData.setKey(
      FILE_KEYS.UPLOAD_ARTIFACT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // 3. Navigate to 3rd Party > Vendors
    await bulkUploadPage.clickThirdPartySidemenu();
    await bulkUploadPage.waitForSpinner();
    await bulkUploadPage.clickVendorSidemenu();
    await bulkUploadPage.waitForSpinner();

    // 4. Add a new vendor
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName =
      await addVendorPage.createUniqueVendorNameShort("UpArtV");
    await addVendorPage.createUniquePOCName("UpPOC");
    await addVendorPage.createUniquePOCEmail(vendorName);
    await addVendorPage.clickNextButton();
    await addVendorPage.selectAIGovernanceFramework();
    await addVendorPage.clickNextButton();
    await addVendorPage.clickAddDomainButton();
    await addVendorPage.createUniqueDomainName("upload-art-domain");
    await addVendorPage.clickCompleteButton();
    await addVendorPage.waitForAddVendorPopupHidden();
    await bulkUploadPage.waitForSpinner();
    TestData.setKey(
      FILE_KEYS.UPLOAD_ARTIFACT_VENDOR_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    console.log(`Created vendor: ${vendorName}`);

    // 5. Wait for vendor processing then open its detail page
    await addVendorPage.waitForInProgressVendorStatusHidden();
    await addVendorPage.clickVendorByName(vendorName);
    await managementPage.waitForSpinner();
    console.log(`Opened vendor: ${vendorName}`);

    // 6. Select "Artifacts" from the sidenav tabs
    await vendorArtifactsPage.clickArtifactsTab();
    console.log("Selected Artifacts tab.");

    // 7. Click the Documents section
    await vendorArtifactsPage.clickDocumentsSection();
    console.log("Clicked Documents section.");

    // 8. Click the "Upload Artifact" button
    await vendorArtifactsPage.clickUploadArtifactButton();

    // 9. Fill in the artifact name
    await vendorArtifactsPage.fillUploadArtifactName("UploadArt");

    // 10. Upload the file
    await vendorArtifactsPage.uploadArtifactFile(
      "filesTest/Files/testFile.pdf",
    );
    await vendorArtifactsPage.page.waitForTimeout(30000);

    // 11. Click COMPLETE
    await vendorArtifactsPage.clickUploadCompleteButton();

    // 12. Wait for "Manual Artifact Added" toast to appear and disappear
    await vendorArtifactsPage.waitForManualArtifactToast();
    console.log("Manual artifact added successfully.");

    // 13. Verify the artifact appears in the table with "Manually uploaded" status
    await vendorArtifactsPage.verifyManuallyUploadedArtifact();
    console.log('Artifact verified as "Manually uploaded" in table.');
  });

  test("VA - 06 | @regression Vendor Artifacts - Delete uploaded artifact", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    const clientName = TestData.getKey(
      FILE_KEYS.UPLOAD_ARTIFACT_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    const vendorName = TestData.getKey(
      FILE_KEYS.UPLOAD_ARTIFACT_VENDOR_NAME,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // 1. Search the client and navigate to vendor artifacts
    await vendorArtifactsPage.navigateToVendorArtifacts(
      clientName,
      vendorName,
      {
        managementPage,
        bulkUploadPage,
        addVendorPage,
      },
    );

    // 2. Click the Documents section
    await vendorArtifactsPage.clickDocumentsSection();
    console.log("Clicked Documents section.");

    // 3. Select the manually uploaded artifact row
    await vendorArtifactsPage.selectManuallyUploadedArtifact();
    console.log("Selected manually uploaded artifact.");

    // 4. Click the Delete button
    await vendorArtifactsPage.clickDeleteButton();
    console.log("Clicked Delete button.");

    // 5. Type "confirm" in the delete modal input
    await vendorArtifactsPage.fillDeleteConfirm();

    // 6. Click CONFIRM
    await vendorArtifactsPage.clickDeleteConfirmButton();

    // 7. Wait for "Manual Artifacts deleted successfully..." toast to appear and disappear
    await vendorArtifactsPage.waitForManualArtifactDeletedToast();
    console.log("Artifact deleted successfully.");

    // 8. Verify no "Manually uploaded" artifact remains in the table
    await vendorArtifactsPage.verifyManuallyUploadedArtifactGone();
    console.log(
      "Verified: manually uploaded artifact is no longer in the table.",
    );
  });
});
