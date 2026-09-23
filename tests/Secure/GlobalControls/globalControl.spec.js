const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const GlobalControl = require("../../../pages/Secure/GlobalControl/GlobalControl");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const RiskRegisterRisks = require("../../../pages/Secure/RiskRegister/RiskRegisterRisks");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  QUESTION_SETTINGS_GLOBAL_CONTROL,
} = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Global Controls Tests Happy Flow", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let globalControl;
  let collectionPage;
  let riskRegisterRisks;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    globalControl = new GlobalControl(page);
    collectionPage = new CollectionPage(page);
    riskRegisterRisks = new RiskRegisterRisks(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("GC - 01 | @smoke Setup For Answers Verification", async () => {
    test.setTimeout(600000);

    // Create new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("GCClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    TestData.setKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    await managementPage.waitForSpinner();
    console.log(`Created client: ${clientName}`);

    // Navigate into the new client
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // Create origin multientity (global controls: none, artifact: none, comment: none)
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const originName = await addEntityPage.createUniqueEntityName("Origin");
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectBusinessEmailCompromise();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.clickArtifactNone();
    await addEntityPage.clickCommentNone();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await globalControl.waitForMultiEntityCreatedToast();
    TestData.setKey(
      FILE_KEYS.SUBENTITY_GLOBAL_CONTROL_NONE,
      originName,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    await addEntityPage.verifyEntityInList(originName);
    console.log(
      `Created origin multientity (global controls none): ${originName}`,
    );

    // Create destination multientity (global controls: all)
    await addEntityPage.clickNewEntity();
    const destName = await addEntityPage.createUniqueEntityName("Dest");
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectBusinessEmailCompromise();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.setGlobalControl(QUESTION_SETTINGS_GLOBAL_CONTROL.All);
    await globalControl.waitForMultiEntityCreatedToast();
    TestData.setKey(
      FILE_KEYS.SUBENTITY_GLOBAL_CONTROL_ALL,
      destName,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    await addEntityPage.verifyEntityInList(destName);
    console.log(
      `Created destination multientity (global controls all): ${destName}`,
    );
  });

  test("GC - 02 | @regression Verify Global Control Relation", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    const originName = TestData.getKey(
      FILE_KEYS.SUBENTITY_GLOBAL_CONTROL_NONE,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    const destName = TestData.getKey(
      FILE_KEYS.SUBENTITY_GLOBAL_CONTROL_ALL,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );

    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // Navigate to the Origin entity's collection
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(originName);
    await collectionPage.getFrameworkName(0);

    // Answer all questions and save the answers for later assertions
    const answers = await riskRegisterRisks.answerAllQuestions();
    TestData.setKey(
      "originCollectionAnswers",
      answers,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );

    // Navigate to Management from the side menu
    await globalControl.clickManagementBtn();

    // Navigate to Settings from the side menu
    await globalControl.clickSettingsBtn();

    // Select the client in the Settings entity dropdown
    await globalControl.searchAndSelectClientInSettings(clientName);

    // Click on the 1st Party tab
    await globalControl.clickFirstPartyTab();

    // Scroll to the Global Controls section
    await globalControl.scrollToGlobalControlSection();

    // Select the Origin entity from the Origin dropdown
    await globalControl.selectOriginEntity(originName);

    // Select the Destination entity from the Destination dropdown
    await globalControl.selectDestinationEntity(destName);

    // Click the ADD button
    await globalControl.clickAddGlobalControlButton();

    // Wait for the success toast
    await globalControl.waitForGlobalControlConnectedToast();
  });

  test("GC - 03 | @regression Verify Destination Collection Answers Match Origin", async ({
    page,
  }) => {
    const { expect } = require("@playwright/test");
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    const destName = TestData.getKey(
      FILE_KEYS.SUBENTITY_GLOBAL_CONTROL_ALL,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    const originAnswers = TestData.getKey(
      "originCollectionAnswers",
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );

    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // Navigate to the Destination entity's collection
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(destName);
    await collectionPage.getFrameworkName(0);

    // Verify each answer in the destination collection matches the origin answers
    const mismatches =
      await globalControl.verifyCollectionAnswers(originAnswers);

    if (mismatches.length > 0) {
      console.log(
        "[GC-03] Mismatched answers:",
        JSON.stringify(mismatches, null, 2),
      );
    }

    expect(mismatches).toHaveLength(0);
  });
});

test.describe("Mandatory Settings", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let globalControl;
  let collectionPage;
  let riskRegisterRisks;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    globalControl = new GlobalControl(page);
    collectionPage = new CollectionPage(page);
    riskRegisterRisks = new RiskRegisterRisks(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("GC - 04 | @smoke Setup for Mandatory Artifact", async () => {
    test.setTimeout(600000);

    // Create new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("GCMAClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    TestData.setKey(
      "maClientName",
      clientName,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    await managementPage.waitForSpinner();
    console.log(`Created client: ${clientName}`);

    // Navigate into the new client
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // Create Origin sub-entity (mandatory comments: none, mandatory artifacts: none)
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const originName = await addEntityPage.createUniqueEntityName("MAOrigin");
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectBusinessEmailCompromise();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.clickArtifactNone();
    await addEntityPage.clickCommentNone();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await globalControl.waitForMultiEntityCreatedToast();
    TestData.setKey(
      "maOriginName",
      originName,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    await addEntityPage.verifyEntityInList(originName);
    console.log(
      `Created origin sub-entity (artifact: none, comment: none): ${originName}`,
    );

    // Create Destination sub-entity (global control: all, mandatory artifacts: all, mandatory comments: all)
    await addEntityPage.clickNewEntity();
    const destName = await addEntityPage.createUniqueEntityName("MADest");
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectBusinessEmailCompromise();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.clickArtifactAll();
    await addEntityPage.clickCommentAll();
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.setGlobalControl(QUESTION_SETTINGS_GLOBAL_CONTROL.All);
    await globalControl.waitForMultiEntityCreatedToast();
    TestData.setKey(
      "maDestName",
      destName,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    await addEntityPage.verifyEntityInList(destName);
    console.log(
      `Created destination sub-entity (global control: all, artifact: all, comment: all): ${destName}`,
    );
  });

  test("GC - 05 | @regression Verify Relation Between Origin and Destination", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      "maClientName",
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    const originName = TestData.getKey(
      "maOriginName",
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    const destName = TestData.getKey(
      "maDestName",
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );

    // Search and open the client
    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // Navigate to the Origin entity's collection and answer all questions
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(originName);
    await collectionPage.getFrameworkName(0);
    const answers = await riskRegisterRisks.answerAllQuestions();
    TestData.setKey(
      "maOriginCollectionAnswers",
      answers,
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );

    // Navigate to Management from the side menu
    await globalControl.clickManagementBtn();

    // Navigate to Settings from the side menu
    await globalControl.clickSettingsBtn();

    // Select the client in the Settings entity dropdown
    await globalControl.searchAndSelectClientInSettings(clientName);

    // Click on the 1st Party tab
    await globalControl.clickFirstPartyTab();

    // Scroll to the Global Controls section
    await globalControl.scrollToGlobalControlSection();

    // Select Origin and Destination entities
    await globalControl.selectOriginEntity(originName);
    await globalControl.selectDestinationEntity(destName);

    // Add the global control relation and wait for the success toast
    await globalControl.clickAddGlobalControlButton();
    await globalControl.waitForGlobalControlConnectedToast();
  });

  test("GC - 06 | @regression Verify No Answers on Destination Collection", async ({
    page,
  }) => {
    const { expect } = require("@playwright/test");
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      "maClientName",
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );
    const destName = TestData.getKey(
      "maDestName",
      TEST_DATA_FILE_ENUMS.GLOBAL_CONTROL,
    );

    await managementPage.searchAndClickClient(clientName);
    await managementPage.waitForSpinner();

    // Navigate to the Destination entity's collection
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(destName);
    await collectionPage.getFrameworkName(0);

    // Verify no question answers are marked on the destination collection
    const unexpectedAnswers = await globalControl.verifyNoAnswersSelected();

    if (unexpectedAnswers.length > 0) {
      console.log(
        "[GC-06] Questions with unexpected answers:",
        JSON.stringify(unexpectedAnswers, null, 2),
      );
    }

    expect(unexpectedAnswers).toHaveLength(0);
  });
});
