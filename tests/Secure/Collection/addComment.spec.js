const { test } = require("@playwright/test");
const AddComment = require("../../../pages/Secure/Collection/AddComment");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const path = require("path");
const fs = require("fs");
const TestData = require("../../../constant/testData");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Add Comment Tests", () => {
  let addComment;
  let collectionPage;

  test.beforeEach(async ({ page }) => {
    addComment = new AddComment(page);
    collectionPage = new CollectionPage(page);
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
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("ACM - 01 | [@smoke] Add comment", async () => {
    await collectionPage.clickFirstEntityOpen();
    await addComment.addCommentForAllQuestionsSets("Test comment verify");
  });
});
