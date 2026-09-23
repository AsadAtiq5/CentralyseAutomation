const { test } = require("@playwright/test");
const SelectPartialRepresentation = require("../../../pages/Secure/FrameworkSettings/selectPartialRepresentation");
const VerifyPartialReprestationType = require("../../../pages/Secure/Collection/VerifyPartialReprestationType");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const TestData = require("../../../constant/testData");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const path = require("path");
const fs = require("fs");

const {
  QUESTION_SETTING_PARTIAL_REPRESENTATION_TYPE,
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
} = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Select Partial Representation", () => {
  let selectPartialRepresentation;
  let verifyPartialReprestationType;
  let addEntityPage;

  async function addEntityOpenCollection(partialRepresentationType) {
    console.log("Partial Representation Type: ", partialRepresentationType);
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    console.log(`Entity Name generated: ${entityName}`);
    const riskName = await addEntityPage.selectBusinessEmailCompromise();
    console.log(`Risk Name selected: ${riskName}`);
    await selectPartialRepresentation.selectPartialRepresentation(
      partialRepresentationType,
    );
    console.log("Partial Representation selected");
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
    selectPartialRepresentation = new SelectPartialRepresentation(page);
    verifyPartialReprestationType = new VerifyPartialReprestationType(page);
    addEntityPage = new AddEntityPage(page);
    let rootEntityId = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    console.log("using client ID: ", rootEntityId);
    await page.goto(`/first-party/${rootEntityId}/multi-entity`);
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("SPR - 01 | Select Level Partial Representation", async ({ page }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      QUESTION_SETTING_PARTIAL_REPRESENTATION_TYPE.LEVEL,
    );
    const uuids = fetchPageURL(page.url());
    TestData.setKey(
      FILE_KEYS.SUBENTITY_PARTIAL_REPRESENTATION_LEVEL,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await verifyPartialReprestationType.clickFirstEntityOpen();
    await verifyPartialReprestationType.verifyPartialSelectionTypeSet(
      QUESTION_SETTING_PARTIAL_REPRESENTATION_TYPE.LEVEL,
    );
  });

  test("SPR - 02 | Select Percentage Partial Representation", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      QUESTION_SETTING_PARTIAL_REPRESENTATION_TYPE.PERCENTAGE,
    );
    const uuids = fetchPageURL(page.url());
    TestData.setKey(
      FILE_KEYS.SUBENTITY_PARTIAL_REPRESENTATION_PERCENTAGE,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await verifyPartialReprestationType.clickFirstEntityOpen();
    await verifyPartialReprestationType.verifyPartialSelectionTypeSet(
      QUESTION_SETTING_PARTIAL_REPRESENTATION_TYPE.PERCENTAGE,
    );
  });
});
