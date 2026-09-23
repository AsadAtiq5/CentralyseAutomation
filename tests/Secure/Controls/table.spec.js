const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const ControlsTablePage = require("../../../pages/Secure/Controls/Table");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SHORT: 300000,
  DEFAULT: 60000,
};

test.describe("Controls Table Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let controlsTablePage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    controlsTablePage = new ControlsTablePage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("CT - 01 | @smoke Controls Table - Add tag and verify assigned tag", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Add a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("TagClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // 3. Add a new MultiEntity with BusinessCompliance
    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);
    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);
    const entityName = await addEntityPage.createUniqueEntityName("TagEntity");
    console.log(`Created entity: ${entityName}`);
    await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);
    await page.waitForTimeout(2000);
    console.log(`Entity "${entityName}" verified in list.`);

    // 4. Navigate to Collection first, then Controls > Table from the side menu
    await addEntityPage.navigateToCollection();
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Collection.");
    await controlsTablePage.navigateToControlsTable();
    await controlsTablePage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Controls Table.");

    // 5. Click the edit icon to open the tags panel
    await controlsTablePage.clickEditIcon();
    await page.waitForTimeout(2000);

    // 6. Click the add (+) button to create a new tag
    await controlsTablePage.clickAddTagButton();
    await page.waitForTimeout(2000);

    // 7. Enter a random tag name (max 10 characters)
    const tagName = `tg${Math.random().toString(36).slice(2, 8)}`;
    console.log(`Tag name to add: "${tagName}"`);
    await controlsTablePage.fillTagName(tagName);
    await page.waitForTimeout(2000);

    // 8. Drag the tag to the tag column of the first table row
    await controlsTablePage.dragTagToTableRow(tagName);
    await page.waitForTimeout(2000);

    // 9. Click Save
    await controlsTablePage.clickSaveButton();

    // 10. Wait for "Question updated successfully" toast
    await controlsTablePage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(2000);

    // 11. Verify the tag is visible in the first row's tag column
    await controlsTablePage.verifyTagInFirstRow(tagName);

    // 12. Save client name and tag name to control.json for use in subsequent tests
    TestData.setKey(
      FILE_KEYS.CONTROL_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    TestData.setKey(
      FILE_KEYS.CONTROL_TAG_NAME,
      tagName,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    console.log(
      `Saved to control.json — client: "${clientName}", tag: "${tagName}"`,
    );

    console.log(
      `✔ Tag "${tagName}" added and successfully assigned to a table row.`,
    );
  });

  // test("@smoke Controls Table - Duplicate tag assignment on same question", async () => {
  //   test.setTimeout(TIMEOUTS.SHORT);

  //   // Read saved client and tag from control.json
  //   const clientName = TestData.getKey(FILE_KEYS.CONTROL_CLIENT_NAME, TEST_DATA_FILE_ENUMS.CONTROL);
  //   const tagName = TestData.getKey(FILE_KEYS.CONTROL_TAG_NAME, TEST_DATA_FILE_ENUMS.CONTROL);
  //   console.log(`Using client: "${clientName}", tag: "${tagName}"`);

  //   // 1. Search and navigate to the client
  //   await managementPage.searchAndClickClient(clientName);
  //   await addEntityPage.waitForSpinner();

  //   // 2. Navigate to Controls > Table
  //   await controlsTablePage.navigateToControlsTable();
  //   await controlsTablePage.waitForSpinner();
  //   console.log("Navigated to Controls Table.");

  //   // 3. Click the edit icon to open the tags panel
  //   await controlsTablePage.clickEditIcon();

  //   // 4. Drag the same tag to the same question and verify the duplicate toast
  //   await controlsTablePage.dragTagAndVerifyDuplicateToast(tagName);

  //   console.log(`✔ Duplicate tag assignment correctly rejected with toast for "${tagName}".`);
  // });

  test("CT - 02 | @smoke Controls Table - Delete tag from question", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    // Read saved client and tag from control.json
    const clientName = TestData.getKey(
      FILE_KEYS.CONTROL_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    const tagName = TestData.getKey(
      FILE_KEYS.CONTROL_TAG_NAME,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    console.log(`Using client: "${clientName}", tag: "${tagName}"`);

    // 1. Search and navigate to the client
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // 2. Navigate to Controls > Table
    await controlsTablePage.navigateToControlsTable();
    await controlsTablePage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Controls Table.");

    // 3. Click the edit icon to open the tags panel
    await controlsTablePage.clickEditIcon();
    await page.waitForTimeout(2000);

    // 4. Click the cross (×) button on the assigned tag in the first row
    await controlsTablePage.clickTagCrossInFirstRow(tagName);
    await page.waitForTimeout(2000);

    // 5. Click Save and wait for the toast
    await controlsTablePage.clickSaveButton();
    await controlsTablePage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(2000);

    // 6. Verify the tag is no longer displayed in the first row's tag column
    await controlsTablePage.verifyTagNotInFirstRow(tagName);

    console.log(`✔ Tag "${tagName}" successfully deleted from the first row.`);
  });

  test("CT - 03 | @smoke Controls Table - Assign tag to all questions and verify in collection", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Create a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("CtrlAl");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client and create a new entity with BusinessEmailCompromise
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);
    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);
    const entityName = await addEntityPage.createUniqueEntityName("CtrlAl");
    console.log(`Created entity: ${entityName}`);
    await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);
    await page.waitForTimeout(2000);

    // 3. Go to the collection screen
    await addEntityPage.navigateToCollection();
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Collection.");

    // 4. Go to the controls screen (Controls > Table)
    await controlsTablePage.navigateToControlsTable();
    await controlsTablePage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Controls Table.");

    // 5. Click the edit icon to open the tags panel
    await controlsTablePage.clickEditIcon();
    await page.waitForTimeout(2000);

    // 6. Create a new tag
    await controlsTablePage.clickAddTagButton();
    await page.waitForTimeout(2000);
    const tagName = `tg${Math.random().toString(36).slice(2, 8)}`;
    console.log(`Tag name: "${tagName}"`);
    await controlsTablePage.fillTagName(tagName);
    await page.waitForTimeout(2000);

    // 7. Drag and drop the tag to the "Assign To All The Controls" area
    await controlsTablePage.dragTagToAllControls(tagName);
    await page.waitForTimeout(2000);

    // 8. Click Save and wait for the toast
    await controlsTablePage.clickSaveButton();
    await controlsTablePage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(2000);

    // 9. Go to the collection screen
    await addEntityPage.navigateToCollection();
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // 10. Select entity and navigate into the framework
    await addEntityPage.selectEntityAndNavigate(entityName);
    await page.waitForTimeout(2000);

    // 11. Open the first framework card
    await controlsTablePage.getFrameworkName(0);
    await page.waitForTimeout(2000);

    // 12. Verify the tag is displayed in the question settings for all questions
    await controlsTablePage.verifyTagInAllQuestionsSettings(tagName);

    console.log(`✔ Tag "${tagName}" verified in all question settings.`);
  });
});
