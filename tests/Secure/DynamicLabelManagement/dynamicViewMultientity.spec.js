const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const DynamicViewMultiEntityPage = require("../../../pages/Secure/DynamicLabelManagement/DynamicViewMultiEntity");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  DEFAULT: 60000,
  MEDIUM: 300000,
  LONG: 600000,
};

test.describe("Dynamic View - Multi Entity", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let dynamicViewPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    dynamicViewPage = new DynamicViewMultiEntityPage(page);

    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("DVM - 01 | @regression Create group and verify tags - assign tags per entity", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Create a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("DVMClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log(`▶ Created client: ${clientName}`);

    // 2) Open the client and create the FIRST multi-entity (BEC)
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);
    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);
    const entity1Name = await addEntityPage.createUniqueEntityName("DVMEnt1");
    await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entity1Name);
    await page.waitForTimeout(2000);
    console.log(`▶ Created entity 1: ${entity1Name}`);

    // 3) Create the SECOND multi-entity (BEC)
    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);
    const entity2Name = await addEntityPage.createUniqueEntityName("DVMEnt2");
    await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entity2Name);
    await page.waitForTimeout(2000);
    console.log(`▶ Created entity 2: ${entity2Name}`);

    // 4) Persist client + entity names for downstream tests
    TestData.setKey(
      FILE_KEYS.DVM_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DVM_ENTITY_1_NAME,
      entity1Name,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DVM_ENTITY_2_NAME,
      entity2Name,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );

    // 5) Navigate to Collection then to Controls > Table so controls data populates
    await addEntityPage.navigateToCollection();
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("▶ Navigated to Collection.");

    await dynamicViewPage.navigateToControlsTable();
    await dynamicViewPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("▶ Navigated to Controls Table.");

    // 6) Select entity 1 from the Entity dropdown, assign a fresh tag to a
    //    random row, and persist the captured row data.
    await dynamicViewPage.selectEntityInDropdown(entity1Name);
    await page.waitForTimeout(2000);

    await dynamicViewPage.clickEditIcon();
    await page.waitForTimeout(2000);

    await dynamicViewPage.clickAddTagButton();
    await page.waitForTimeout(2000);
    const entity1Tag = `tg${Math.random().toString(36).slice(2, 8)}`;
    console.log(`▶ Entity 1 tag: "${entity1Tag}"`);
    await dynamicViewPage.fillTagName(entity1Tag);
    await page.waitForTimeout(2000);

    const entity1Row = await dynamicViewPage.dragTagToRandomRow(entity1Tag);
    await page.waitForTimeout(2000);

    await dynamicViewPage.clickSaveButton();
    await dynamicViewPage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(2000);

    TestData.setKey(
      FILE_KEYS.DVM_ENTITY_1_TAG,
      entity1Tag,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DVM_ENTITY_1_ROW,
      entity1Row,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `✔ Entity 1 tag "${entity1Tag}" assigned to row: ${JSON.stringify(entity1Row)}`,
    );

    // 7) Select entity 2 from the Entity dropdown, assign a fresh tag to a
    //    random row, and persist the captured row data.
    await dynamicViewPage.selectEntityInDropdown(entity2Name);
    await page.waitForTimeout(2000);

    await dynamicViewPage.clickEditIcon();
    await page.waitForTimeout(2000);

    await dynamicViewPage.clickAddTagButton();
    await page.waitForTimeout(2000);
    const entity2Tag = `tg${Math.random().toString(36).slice(2, 8)}`;
    console.log(`▶ Entity 2 tag: "${entity2Tag}"`);
    await dynamicViewPage.fillTagName(entity2Tag);
    await page.waitForTimeout(2000);

    const entity2Row = await dynamicViewPage.dragTagToRandomRow(entity2Tag);
    await page.waitForTimeout(2000);

    await dynamicViewPage.clickSaveButton();
    await dynamicViewPage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(2000);

    TestData.setKey(
      FILE_KEYS.DVM_ENTITY_2_TAG,
      entity2Tag,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DVM_ENTITY_2_ROW,
      entity2Row,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `✔ Entity 2 tag "${entity2Tag}" assigned to row: ${JSON.stringify(entity2Row)}`,
    );

    // 8) Go back to Multi Entity sidebar and switch to the Dynamic View tab
    await dynamicViewPage.clickDynamicViewSubMenu();
    await page.waitForTimeout(2000);

    // 9) Open the New Group modal
    await dynamicViewPage.clickNewGroupButton();
    await page.waitForTimeout(2000);

    // 10) Enter a unique group name and select the two tags created earlier
    const groupName = `Group_${Date.now()}`;
    console.log(`▶ Creating group: "${groupName}"`);
    await dynamicViewPage.fillGroupName(groupName);
    await page.waitForTimeout(1000);

    await dynamicViewPage.selectTagsInGroupModal([entity1Tag, entity2Tag]);
    await page.waitForTimeout(1000);

    // 11) Click ADD GROUP and wait for the modal to close / listing to refresh
    await dynamicViewPage.clickAddGroupButton();
    await page.waitForTimeout(2000);

    // 12) Verify the new group appears on the Dynamic View listing with both tags
    await dynamicViewPage.verifyGroupInListing(groupName, [
      entity1Tag,
      entity2Tag,
    ]);

    TestData.setKey(
      FILE_KEYS.DVM_GROUP_NAME,
      groupName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `✔ Group "${groupName}" created with tags "${entity1Tag}" and "${entity2Tag}".`,
    );

    // 12b) Guard against a create-vs-navigate race: reload the Dynamic View and
    //      wait for the group to be rendered from persisted data before opening
    //      its Group View, so "View Controls" does not open an empty table.
    await dynamicViewPage.reloadAndWaitForGroupPersisted(groupName);

    // 13) Click "View Controls" on the new group card. The click is unforced
    //     and retried until the Group View table is confirmed open - a forced
    //     click here silently fails to register on a still-settling card.
    await dynamicViewPage.clickViewControlsOnGroupAndWaitForTable(groupName);

    // 14) Log what the Group View table actually rendered, so a row mismatch
    //     below is diagnosable from the run log without a re-run.
    await dynamicViewPage.logGroupViewTableRows();

    // 15) Verify the Group View table contains the two rows we previously
    //     tagged on the Controls Table screen, each with its respective tag.
    await dynamicViewPage.verifyGroupViewTableContainsTaggedRows(groupName, [
      { rowData: entity1Row, tagName: entity1Tag },
      { rowData: entity2Row, tagName: entity2Tag },
    ]);
    console.log(
      `✔ Group View verified: rows for "${entity1Tag}" and "${entity2Tag}" are present with correct tags.`,
    );
  });
});
