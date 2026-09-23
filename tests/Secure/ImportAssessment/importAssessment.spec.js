const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const ImportAssessment = require("../../../pages/Secure/ImportAssessment/ImportAssessment");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 180000,
  DEFAULT: 60000,
};

test.describe("Import Assessment Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let importAssessmentPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    importAssessmentPage = new ImportAssessment(page);
  });

  test("IA1 - 01 | @smoke Import Assessment and verify answers on collection", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Step 1: Create a new client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    console.log(`Client created: ${clientName}`);
    await managementPage.waitForSpinner();

    // Step 2: Create a new multi-entity
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName("Entity");
    console.log(`Entity created: ${entityName}`);
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);

    // Save clientName and entityName for subsequent test cases
    TestData.setKey(
      FILE_KEYS.IMPORT_ASSESSMENT_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );
    TestData.setKey(
      FILE_KEYS.IMPORT_ASSESSMENT_ENTITY_NAME,
      entityName,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );
    console.log(
      `Saved test data: clientName=${clientName}, entityName=${entityName}`,
    );

    // Step 3: Navigate to the collection screen
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(`Navigated to collection screen for entity: ${entityName}`);

    // Step 4: Click the edit button
    await addEntityPage.clickEditEntityButton();

    // Step 5: Click the Business Email Compromise card
    await importAssessmentPage.clickBusinessEmailCompromiseCard();

    // Step 6: Click Import Assessment
    await importAssessmentPage.clickImportAssessmentButton();

    // Step 7: Wait for the Import Assessment modal and click Next
    await importAssessmentPage.waitForImportAssessmentModal();
    await importAssessmentPage.clickImportAssessmentNextButton();

    // Step 8: Upload the BusinessEmailComplianceYes.xlsx file
    const importFilePath = path.join(
      process.cwd(),
      "filesTest",
      "ImportAssessmentFiles",
      "BusinessEmailComplianceYes.xlsx",
    );
    await importAssessmentPage.uploadImportAssessmentFile(importFilePath);

    // Step 9: Click the ADD button
    await importAssessmentPage.clickImportAssessmentAddButton();

    // Step 10: Wait for the success modal and click OK
    await importAssessmentPage.waitForImportSuccessModal();
    await importAssessmentPage.clickImportSuccessOkButton();

    // Step 11: Verify score is 10 and click Open on the Business Email Compromise card
    await importAssessmentPage.verifyBusinessEmailCompromiseScore("10");
    await importAssessmentPage.clickBusinessEmailCompromiseOpenButton();

    // Step 12: Verify all questions are answered Yes
    await importAssessmentPage.verifyAllQuestionsAnsweredYes();
  });

  test("IA1 - 02 | @smoke Import Assessment Update answers flow", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Load client and entity saved from the first test
    const clientName = TestData.getKey(
      FILE_KEYS.IMPORT_ASSESSMENT_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );
    const entityName = TestData.getKey(
      FILE_KEYS.IMPORT_ASSESSMENT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.IMPORT_ASSESSMENT,
    );
    console.log(
      `Loaded test data: clientName=${clientName}, entityName=${entityName}`,
    );

    // Step 1: Search and click the client
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.searchAndClickClient(clientName);

    // Step 2: Navigate to the collection screen
    await addEntityPage.waitForSpinner();
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    console.log(`Navigated to collection screen for entity: ${entityName}`);

    // Step 3: Click the edit button
    await addEntityPage.clickEditEntityButton();

    // Step 4: Click the Business Email Compromise card
    await importAssessmentPage.clickBusinessEmailCompromiseCard();

    // Step 5: Click Import Assessment
    await importAssessmentPage.clickImportAssessmentButton();

    // Step 6: Wait for the Import Assessment modal and click Next
    await importAssessmentPage.waitForImportAssessmentModal();
    await importAssessmentPage.clickImportAssessmentNextButton();

    // Step 7: Upload the BusinessEmailComplianceNO.xlsx file
    const importFilePath = path.join(
      process.cwd(),
      "filesTest",
      "ImportAssessmentFiles",
      "BusinessEmailComplianceNo.xlsx",
    );
    await importAssessmentPage.uploadImportAssessmentFile(importFilePath);

    // Step 8: Verify error border is displayed on the first question (Not Applicable answer)
    await importAssessmentPage.verifyImportErrorBorderVisible();

    // Step 9: Click the ADD button
    await importAssessmentPage.clickImportAssessmentAddButton();

    // Step 10: Wait for the success modal and click OK
    await importAssessmentPage.waitForImportSuccessModal();
    await importAssessmentPage.clickImportSuccessOkButton();

    // Step 11: Verify score is 0.4
    await importAssessmentPage.verifyBusinessEmailCompromiseScore("0.4");

    // Step 12: Click Open on the Business Email Compromise card
    await importAssessmentPage.clickBusinessEmailCompromiseOpenButton();

    // Step 13: Verify first question is Yes and all remaining questions are No
    await importAssessmentPage.verifyFirstQuestionYesRestNo();
  });
});
