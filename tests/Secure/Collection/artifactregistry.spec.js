const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const TestData = require("../../../constant/testData");
const ArtifactRegistry = require("../../../pages/Secure/Collection/ArtifactRegistry");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Artifact Registry", () => {
  let artifactRegistry;
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let collectionPage;

  test.beforeEach(async ({ page }) => {
    artifactRegistry = new ArtifactRegistry(page);
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    collectionPage = new CollectionPage(page);

    let rootEntityID = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
    );

    // Only navigate if entity ID exists (skip for SETUP test on first run)
    if (rootEntityID) {
      console.log("using entity ID ", rootEntityID);
      await artifactRegistry.goto(
        `/first-party/${rootEntityID}/collection/artifacts-registry`,
      );
      await page
        .waitForLoadState("networkidle", { timeout: 60000 })
        .catch(() => {});
    }
  });

  test("SETUP 00 | Create Client and Entity for Artifact Registry Tests", async ({
    page,
  }) => {
    test.setTimeout(600000);

    // STEP 1: Create a new client
    console.log("📝 Creating new client...");
    await addClientPage.goto("/clients");

    await managementPage.clickAddClientButton();
    const clientName = await addClientPage.createUniqueClientName("AR");

    TestData.setKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
    );

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl();
    await addClientPage.clickAddClientButton();
    await page.waitForTimeout(3000);

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // STEP 2: Create a new multi-entity
    console.log("📝 Creating new multi-entity...");
    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);

    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);

    const subEntityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
    );
    const selectedRisk = await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);

    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(subEntityName);
    await page.waitForTimeout(2000);

    TestData.setKey(
      "subEntityName",
      subEntityName,
      TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
    );

    TestData.setKey(
      "selectedRisk",
      selectedRisk,
      TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
    );

    // STEP 3: Save to test data
    TestData.setKey(
      FILE_KEYS.ENTITY_ID,
      subEntityName,
      TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_NAME,
      subEntityName,
      TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
    );

    // STEP 4: Navigate to collection and answer questions
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(subEntityName);

    // STEP 5: Fetch page URL and extract UUIDs
    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.ARTIFACT_REGISTRY_SETUP,
      );
    }

    console.log(
      `✓ Setup complete: Client=${clientName}, Entity=${subEntityName}`,
    );
  });

  test("AR - 01 | @regression Verify No Artifact Found text on the screen", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await artifactRegistry.verifyNoArtifactsFound();
  });

  test("AR - 02 | @regression Upload artifact from filesTest folder", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const filePath = path.join(process.cwd(), "filesTest/Files/testFile.pdf");
    await artifactRegistry.uploadArtifact(filePath);
    await artifactRegistry.verifyUploadedFile("testFile.pdf");
  });

  test("AR - 03 | @regression Verify delete artifact", async ({ page }) => {
    test.setTimeout(600000);
    await artifactRegistry.deleteFirstArtifact();
  });

  test("AR - 04 | @regression Verify uploaded artifact in linked artifact on question", async ({
    page,
  }) => {
    test.setTimeout(600000);

    // 1. Upload an artifact first to ensure we have data
    const filePath = path.join(process.cwd(), "filesTest/Files/testFile.pdf");
    await artifactRegistry.uploadArtifact(filePath);
    await artifactRegistry.verifyUploadedFile("testFile.pdf");

    // 2. Get artifact names from Registry
    const artifactNames = await artifactRegistry.getArtifactNames();
    console.log("Artifact Names from Registry:", artifactNames);

    // 3. Open collection and navigate to question upload
    await artifactRegistry.openCollection();
    await artifactRegistry.clickFirstQuestionUploadIcon();

    // 4. Get artifact names from Side Registry
    const sideArtifactNames =
      await artifactRegistry.getSideRegistryArtifactNames();
    console.log("Artifact Names from Side Registry:", sideArtifactNames);

    // 5. Verification: Check if uploaded artifact is present in side registry
    expect(sideArtifactNames).toContain("testFile.pdf");
  });

  test("AR - 05 | @regression Verify artifact selection from question", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await artifactRegistry.openCollection();
    const questionDetails = await artifactRegistry.getQuestionDetails();

    TestData.setKey(
      FILE_KEYS.QUESTION_DETAILS_DATA,
      questionDetails,
      TEST_DATA_FILE_ENUMS.ARTIFACT_QUESTION,
    );
    console.log("Saved question details using TestData helper");

    const linkedArtifactName = await artifactRegistry.linkRandomArtifact();

    await artifactRegistry.navigateToArtifactRegistryFromSideMenu();
    await artifactRegistry.clickArtifactByName(linkedArtifactName);
    await artifactRegistry.verifyLinkedQuestionDetails(questionDetails);
  });
});
