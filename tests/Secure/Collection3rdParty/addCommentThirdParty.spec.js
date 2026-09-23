const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AddCommentThirdParty = require("../../../pages/Secure/Collection 3rd Party/AddCommentThirdParty");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Add Comment Third Party", () => {
  let addCommentThirdPartyPage;
  let collectionPage;

  test.beforeEach(async ({ page }) => {
    addCommentThirdPartyPage = new AddCommentThirdParty(page);
    collectionPage = new CollectionPage(page);
    let rootEntityId = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
    );
    let vendorId = TestData.getKey(
      FILE_KEYS.VENDOR_UUID,
      TEST_DATA_FILE_ENUMS.ARTIFACT_THIRD_PARTY,
    );
    await addCommentThirdPartyPage.goto(
      `third-party/${rootEntityId}/collection/${vendorId}`,
    );
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("ACM3P - 01 | Add Comment third party", async () => {
    test.setTimeout(180000);
    await collectionPage.clickFirstEntityOpen();
    await addCommentThirdPartyPage.addCommentForAllQuestions(1, "test comment");
  });
});
