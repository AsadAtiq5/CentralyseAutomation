const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const AddArtifact = require("../../../pages/Secure/Collection 3rd Party/AddArtifact");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Collection 3rd Party Add Artifact", () => {
  let managementPage;
  let addClientPage;
  let addVendorPage;
  let collectionPage;
  let addArtifact;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addVendorPage = new AddVendorPage(page);
    collectionPage = new CollectionPage(page);
    addArtifact = new AddArtifact(page);

    // Retrieve saved vendor UUID from previous setup test
    let rootEntityId = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
    );
    let vendorId = TestData.getKey(
      FILE_KEYS.VENDOR_UUID,
      TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
    );

    // Only navigate if both IDs exist (skip for AA3P-00 setup test on first run)
    if (rootEntityId && vendorId) {
      await page.goto(`third-party/${rootEntityId}/collection/${vendorId}`);
      await page
        .waitForLoadState("networkidle", { timeout: 60000 })
        .catch(() => {});
    }
  });

  test("AA3P - 00 | @smoke Setup: Create Client and Vendor for 3rd Party Collection Tests", async ({
    page,
  }) => {
    test.setTimeout(600000);

    // STEP 1: Create a new client
    console.log("📝 Creating new client for 3rd party collection tests...");
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("AA3P");
    TestData.setKey(
      FILE_KEYS.CLIENT_NAME_FOR_VENDOR,
      clientName,
      TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await page.waitForTimeout(3000);

    // STEP 2: Navigate to vendors section
    console.log("📝 Navigating to vendors section...");
    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();

    // STEP 3: Create the vendor
    console.log("📝 Creating new vendor...");
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName = await addVendorPage.createUniqueVendorName("Vendor");
    TestData.setKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
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

    // STEP 4: Navigate to collection
    console.log("📝 Navigating to vendor collection...");
    await addVendorPage.verifyVendorVisible(vendorName);
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();

    // STEP 5: Extract UUIDs from collection URL and save
    //   uuids[0] = clientID, uuids[1] = vendorID
    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
      );
    }
    if (uuids.length > 1) {
      TestData.setKey(
        FILE_KEYS.VENDOR_UUID,
        uuids[1],
        TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
      );
    }

    console.log(`✓ Setup complete: Client=${clientName}, Vendor=${vendorName}`);
  });

  test("AA3P - 01 | Verify add artifact", async () => {
    test.setTimeout(180000);
    await collectionPage.clickFirstEntityOpen();
    await addArtifact.uploadFile();
    await addArtifact.verifyFileInDownloadPopup("testFile.csv");
  });
});
