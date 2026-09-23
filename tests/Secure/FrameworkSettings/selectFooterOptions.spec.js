const { test } = require("@playwright/test");
const SelectFooterOptions = require("../../../pages/Secure/FrameworkSettings/SelectFooterOptions");
const VerifyFooterQuestions = require("../../../pages/Secure/Collection/VerifyFooterQuestions");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const TestData = require("../../../constant/testData");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const path = require("path");
const fs = require("fs");

const {
  QUESTION_SETTINGS_GLOBAL_CONTROL,
  QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE,
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
} = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Select Footer Options Tests", () => {
  let selectFooterOptions;
  let addEntityPage;
  let verifyFooterQuestions;

  async function addEntityOpenCollection(Option, Value) {
    console.log(
      `Starting entity creation for option: ${Option}, value: ${Value}`,
    );
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    console.log(`Entity Name generated: ${entityName}`);
    const riskName = await addEntityPage.selectBusinessEmailCompromise();
    console.log(`Risk Name selected: ${riskName}`);
    if (Option === QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.GlobalControl) {
      await selectFooterOptions.selectGlobalControl(Value);
    } else if (Option === QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.Integration) {
      await selectFooterOptions.setToggleState(
        QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.Integration,
        Value,
      );
    } else if (
      Option === QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.SmartMapping
    ) {
      await selectFooterOptions.setToggleState(
        QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.SmartMapping,
        Value,
      );
    }
    console.log("Footer option selected.");
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
    selectFooterOptions = new SelectFooterOptions(page);
    verifyFooterQuestions = new VerifyFooterQuestions(page);
    let rootEntityId = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await page.goto(`first-party/${rootEntityId}/multi-entity`);
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("SFO - 01 | @regression Verify all options for global control", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.GlobalControl,
      QUESTION_SETTINGS_GLOBAL_CONTROL.All,
    );
    console.log("Verifying @regression: All options for global control...");
    await verifyFooterQuestions.clickFirstEntityOpen();
    const uuids = fetchPageURL(page.url());
    console.log(`Generated UUIDs: ${uuids}`);
    TestData.setKey(
      FILE_KEYS.SUBENTITY_GLOBAL_CONTROL_ALL,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await verifyFooterQuestions.VerifyFooterQuestionsSet(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.GlobalControl,
      true,
    );
    console.log("✔ Global Control 'All' verified successfully.");
  });

  test("SFO - 02 | @regression Verify none option for global control", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const { entityName, riskName } = await addEntityOpenCollection(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.GlobalControl,
      QUESTION_SETTINGS_GLOBAL_CONTROL.None,
    );
    console.log("Verifying @regression: None option for global control...");
    await verifyFooterQuestions.clickFirstEntityOpen();
    const uuids = fetchPageURL(page.url());
    console.log(`Generated UUIDs: ${uuids}`);
    TestData.setKey(
      FILE_KEYS.SUBENTITY_GLOBAL_CONTROL_NONE,
      { subEntityId: uuids[1], subEntityName: entityName, riskName: riskName },
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    await verifyFooterQuestions.VerifyFooterQuestionsSet(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.GlobalControl,
      false,
    );
    console.log("✔ Global Control 'None' verified successfully.");
  });

  test("SFO - 03 | @regression Verify turn off Integration toggle option", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.Integration,
      false,
    );
    console.log("Verifying @regression: Integration toggle OFF...");
    await verifyFooterQuestions.clickFirstEntityOpen();
    await verifyFooterQuestions.VerifyFooterQuestionsSet(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.Integration,
      false,
    );
    console.log("✔ Integration toggle OFF verified.");
  });

  test("SFO - 04 | @regression Verify turn on Integration toggle option", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.Integration,
      true,
    );
    console.log("Verifying @regression: Integration toggle ON...");
    await verifyFooterQuestions.clickFirstEntityOpen();
    await verifyFooterQuestions.VerifyFooterQuestionsSet(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.Integration,
      true,
    );
    console.log("✔ Integration toggle ON verified.");
  });

  test("SFO - 05 | @regression Verify turn off Smart Mapping toggle option", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.SmartMapping,
      false,
    );
    console.log("Verifying @regression: Smart Mapping toggle OFF...");
    await verifyFooterQuestions.clickFirstEntityOpen();
    await verifyFooterQuestions.VerifyFooterQuestionsSet(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.SmartMapping,
      false,
    );
    console.log("✔ Smart Mapping toggle OFF verified.");
  });

  test("SFO - 06 | @regression Verify turn on Smart Mapping toggle option", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await addEntityOpenCollection(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.SmartMapping,
      true,
    );
    console.log("Verifying @regression: Smart Mapping toggle ON...");
    await verifyFooterQuestions.clickFirstEntityOpen();
    await verifyFooterQuestions.VerifyFooterQuestionsSet(
      QUESTION_SETTINGS_FOOTER_SETTINGS_VALUE.SmartMapping,
      true,
    );
    console.log("✔ Smart Mapping toggle ON verified.");
  });
});
