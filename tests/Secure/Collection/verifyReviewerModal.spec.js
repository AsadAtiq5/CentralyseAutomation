const { test } = require("@playwright/test");
const VerifyReviewModal = require("../../../pages/Secure/Collection/VerifyReviewModal");
const SelectMandatoryOptions = require("../../../pages/Secure/FrameworkSettings/SelectMandatoryOptions");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const path = require("path");
const fs = require("fs");

const {
  MANDATORY_QUESTION_SETTINGS_NAME,
  MANDATORY_QUESTION_SETTINGS_VALUE,
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
} = require("../../../constant/enums");
const TestData = require("../../../constant/testData");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Verify Reviewer Modal Tests", () => {
  let addEntityPage;
  let verifyReviewModal;
  let selectMandatoryOptions;

  test.beforeEach(async ({ page }) => {
    addEntityPage = new AddEntityPage(page);
    verifyReviewModal = new VerifyReviewModal(page);
    selectMandatoryOptions = new SelectMandatoryOptions(page);
    let entityID = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await page.goto(`/first-party/${entityID}/multi-entity`);
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("VRM - 01 | [@smoke] Verify reviewer modal", async () => {
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName("Entity");
    // await addEntityPage.clickNextButton();
    await addEntityPage.selectBusinessEmailCompromise();
    // await addEntityPage.clickComplianceSubtab();
    // await addEntityPage.selectCompliance();
    // await addEntityPage.clickNextButton();
    // await addEntityPage.clickNextButton();
    await selectMandatoryOptions.selectMandatoryReviewerByName(
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
    await verifyReviewModal.clickAssignReviewerCheckbox();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await verifyReviewModal.clickFirstEntityOpen();
    await verifyReviewModal.verifyReviewerQuestionSet();
  });
});
