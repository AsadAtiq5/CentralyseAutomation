const { test } = require("@playwright/test");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const AddArtifact = require("../../../pages/Secure/Collection/AddArtifact");
const fs = require("fs");
const path = require("path");
const TestData = require("../../../constant/testData");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Add Artifact Tests", () => {
  let addEntityPage;
  let collectionPage;
  let collectionArtifact;

  test.beforeEach(async ({ page }) => {
    addEntityPage = new AddEntityPage(page);
    collectionPage = new CollectionPage(page);
    collectionArtifact = new AddArtifact(page);
    let entityID = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    let subEntity = TestData.getKey(
      FILE_KEYS.SUBENTITY_COLLABORATIVE,
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await page.goto(
      `/first-party/${entityID}/collection/${subEntity?.subEntityId}`,
    );
    await addEntityPage.waitForLoad();
  });

  test("AA - 01 | [@smoke] Verify user can successfully upload the artifact file", async () => {
    test.setTimeout(600000);
    await collectionPage.clickFirstEntityOpen();
    await collectionArtifact.uploadFile();
    await collectionArtifact.verifyFileInDownloadPopup("testFile.csv");
  });
});
