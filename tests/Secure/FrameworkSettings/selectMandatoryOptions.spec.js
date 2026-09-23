const { test } = require("@playwright/test");
const SelectMandatoryOptions = require("../../../pages/Secure/FrameworkSettings/SelectMandatoryOptions");
const VerifyMandatoryOptions = require("../../../pages/Secure/Collection/VerifyMandatoryOptions");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const path = require("path");
const fs = require("fs");

const {
  MANDATORY_QUESTION_SETTINGS_NAME,
  MANDATORY_QUESTION_SETTINGS_VALUE,
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
} = require("../../../constant/enums");
const TestData = require("../../../constant/testData");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Select Artifact Reviewer Comment Tests", () => {
  let addEntityPage;
  let suggested;
  let selection;

  async function addEntityOpenCollection(frameworkName, frameworkValue) {
    console.log(
      `Starting entity creation for framework: ${frameworkName}, value: ${frameworkValue}`,
    );
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    console.log(`Entity Name generated: ${entityName}`);
    const riskName = await addEntityPage.selectBusinessEmailCompromise();
    console.log(`Risk Name selected: ${riskName}`);
    await suggested.selectOptionFramework(frameworkName, frameworkValue);
    console.log("Framework option selected.");
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
    test.setTimeout(600000);
    addEntityPage = new AddEntityPage(page);
    suggested = new SelectMandatoryOptions(page);
    selection = new VerifyMandatoryOptions(page);
    let rootEntityID = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    console.log("using client ID: ", rootEntityID);
    await page.goto(`/first-party/${rootEntityID}/multi-entity`);
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("SMO - 01 | @regression Verify all selection on framework settings for artifact", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    const uuids = fetchPageURL(page.url());
    TestData.setKey(
      FILE_KEYS.SUBENTITY_MANDATORY_ARTIFACT_ALL,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
  });

  test("SMO - 02 | @regression Verify none selection on framework settings for artifact", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );
    const uuids = fetchPageURL(page.url());
    TestData.setKey(
      FILE_KEYS.SUBENTITY_MANDATORY_ARTIFACT_NONE,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );
  });

  test("SMO - 03 | @regression Verify suggested selection on framework settings for artifact", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      MANDATORY_QUESTION_SETTINGS_VALUE.Suggested,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Artifact,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.Suggested,
    );
  });

  test("SMO - 04 | @regression Verify all selection on framework settings for comment", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Comment,
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Comment,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
  });

  test("SMO - 05 | @regression Verify none selection on framework settings for comment", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Comment,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Comment,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );
  });

  test("SMO - 06 | @regression Verify suggested selection on framework settings for comment", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Comment,
      MANDATORY_QUESTION_SETTINGS_VALUE.Suggested,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Comment,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.Suggested,
    );
  });

  test("SMO - 07 | @regression Verify all selection on framework settings for reviewer", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Reviewer,
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    const uuids = fetchPageURL(page.url());
    TestData.setKey(
      FILE_KEYS.SUBENTITY_MANDATORY_REVIEWER_ALL,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Reviewer,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.All,
    );
  });

  test("SMO - 08 | @regression Verify none selection on framework settings for reviewer", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      MANDATORY_QUESTION_SETTINGS_NAME.Reviewer,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );
    const frameworkName = await selection.clickFirstEntityOpen();
    const uuids = fetchPageURL(page.url());
    TestData.setKey(
      FILE_KEYS.SUBENTITY_MANDATORY_REVIEWER_NONE,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await selection.verifyCollectionQuestion(
      MANDATORY_QUESTION_SETTINGS_NAME.Reviewer,
      frameworkName,
      MANDATORY_QUESTION_SETTINGS_VALUE.None,
    );
  });
});
