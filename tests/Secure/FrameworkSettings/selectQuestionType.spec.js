const { test } = require("@playwright/test");
const SelectQuestionType = require("../../../pages/Secure/FrameworkSettings/SelectQuestionType");
const VerifyQuestionType = require("../../../pages/Secure/Collection/VerifyQuestionType");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const path = require("path");
const fs = require("fs");

const {
  QUESTION_SETTINGS_QUESTION_TYPE_VALUE,
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
} = require("../../../constant/enums");
const TestData = require("../../../constant/testData");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Select Question Type Tests", () => {
  let addEntityPage;
  let selectQuestionType;
  let verifyQuestionType;

  async function addEntityOpenCollection(questionType) {
    console.log(`Starting entity creation for question type: ${questionType}`);
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    console.log(`Entity Name generated: ${entityName}`);
    const riskName = await addEntityPage.selectBusinessEmailCompromise();
    console.log(`Risk Name selected: ${riskName}`);
    await selectQuestionType.setQuestionType(questionType);
    console.log("Question type set.");
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    console.log("Entity addition toast verified.");
    await addEntityPage.verifyEntityInList(entityName);
    console.log("Entity verified in list.");
    await addEntityPage.clickControlsSidemenu();
    console.log("Controls sidemenu clicked.");
    await addEntityPage.navigateToCollection();
    console.log("Navigated to Collection.");
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(`Navigated into entity: ${entityName}`);
    return { entityName, riskName };
  }

  test.beforeEach(async ({ page }) => {
    addEntityPage = new AddEntityPage(page);
    selectQuestionType = new SelectQuestionType(page);
    verifyQuestionType = new VerifyQuestionType(page);
    let rootEntityID = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await page.goto(`/first-party/${rootEntityID}/multi-entity`, {
      waitUntil: "load",
    });
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("SQT - 01 | [@regression] Verify collaborative question type", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      QUESTION_SETTINGS_QUESTION_TYPE_VALUE.Collaborative,
    );
    const uuids = fetchPageURL(page.url());
    TestData.setKey(
      FILE_KEYS.SUBENTITY_COLLABORATIVE,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await verifyQuestionType.clickFirstEntityOpen();
    await verifyQuestionType.verifyCollectionQuestionTypeSet(
      QUESTION_SETTINGS_QUESTION_TYPE_VALUE.Collaborative,
      true,
    );
  });

  test("SQT - 02 | [@regression] Verify single question type", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(QUESTION_SETTINGS_QUESTION_TYPE_VALUE.Single);
    await verifyQuestionType.clickFirstEntityOpen();
    await verifyQuestionType.verifyCollectionQuestionTypeSet(
      QUESTION_SETTINGS_QUESTION_TYPE_VALUE.Single,
      true,
    );
  });
});
