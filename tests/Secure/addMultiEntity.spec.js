const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AddClientPage = require("../../pages/Secure/AddClientPage");
const ManagementPage = require("../../pages/Secure/ManagementPage");
const AddEntityPage = require("../../pages/Secure/AddEntityPage");
const TestData = require("../../constant/testData");
const EnvHelper = require("../../helpers/common/envHelper");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../constant/enums");
const { fetchPageURL } = require("../../helpers/common/fetchPageURL");

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 180000,
  DEFAULT: 60000,
};

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Add Multi Entity Tests", () => {
  let managementPage;
  let addEntityPage;
  let addClientPage;
  let clientName = "";

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addEntityPage = new AddEntityPage(page);
    addClientPage = new AddClientPage(page);
    clientName = TestData.getKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    console.log(`Using client name from test data: ${clientName}`);
    if (!clientName) {
      await managementPage.goto("/clients");
      await page
        .waitForLoadState("networkidle", { timeout: 60000 })
        .catch(() => {});
      await managementPage.clickAddClientButton();
      await addClientPage.addClient();
      clientName = TestData.getKey(
        FILE_KEYS.ROOT_ENTITY_NAME,
        TEST_DATA_FILE_ENUMS.ENTITY,
      );
      console.log(`Using client name from test data: ${clientName}`);
    } else {
      await managementPage.goto("/");
      await page
        .waitForLoadState("networkidle", { timeout: 60000 })
        .catch(() => {});
    }
  });

  test("AME - 01 | @smoke Add subEntity with compliance framework", async ({
    page,
  }) => {
    test.setTimeout(120000);
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.SUBENTITY,
    );
    EnvHelper.saveToEnv("SUBENTITY_NAME", entityName);
    await addEntityPage.addEntityWithComplianceUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);
    console.log(`✔️ Entity "${entityName}" verified successfully`);
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    //set entity and subEntityId
    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.ENTITY,
      );
      if (uuids.length > 1) {
        TestData.setKey(
          FILE_KEYS.SUBENTITY_OBJECT,
          { subEntityId: uuids[1], subEntityName: entityName },
          TEST_DATA_FILE_ENUMS.SUBENTITY,
        );
      }
    }
    // await addEntityPage.clickOpenCollectionBtn();
    // await addEntityPage.getQuestionCount();
  });
});

test.describe("Delete and Update", () => {
  let managementPage;
  let addEntityPage;
  let addClientPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addEntityPage = new AddEntityPage(page);
    addClientPage = new AddClientPage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("AME - 02 | @regression Delete MultiEntity", async ({ page }) => {
    test.setTimeout(600000);
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("http://example.com");
    await addClientPage.clickAddClientButton();
    await addClientPage.waitForToast();
    await addClientPage.waitForSpinner();
    await page.waitForTimeout(2000);
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName("Entity");
    await addEntityPage.addEntityWithComplianceUserBased();
    await addEntityPage.waitForMultiEntityCreatedToast();
    await page.waitForTimeout(2000);
    await addEntityPage.verifyEntityInList(entityName);
    await addEntityPage.clickEditEntityButton();
    await addEntityPage.clickDeleteButton();
    await addEntityPage.enterDeleteConfirmText("confirm");
    await addEntityPage.clickConfirmButton();
    await addEntityPage.clickConfirmButton();
    await addEntityPage.waitForToast();
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    await addEntityPage.verifyNoEntitiesFound();
  });
});
