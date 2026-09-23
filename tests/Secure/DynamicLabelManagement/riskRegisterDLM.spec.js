const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RiskRegisterDLM = require("../../../pages/Secure/DynamicLabelManagement/RiskRegisterDLM");
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

const TEST_DATA = {
  CLIENT_PREFIX: "RRD",
  DEFAULT_FIRST_PARTY_URL: "",
};

test.describe("Risk Register - Dynamic Label Management", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let riskRegisterDLM;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    riskRegisterDLM = new RiskRegisterDLM(page);

    await addClientPage.goto("/clients");
  });

  test("RRD - 00 | Setup - Create client for Risk Register DLM", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Reuse the client created in the DLM Settings spec
    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    if (!clientName) {
      throw new Error(
        "DLM_CLIENT_NAME not found. Run the DLM Settings setup test first to create the client.",
      );
    }
    // Persist the same client name under the RRD key so downstream tests can use it
    TestData.setKey(
      FILE_KEYS.RRD_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Reusing DLM client: ${clientName}`);

    // 2) Search and open the existing client
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // 3) Create a multi-entity (sub-entity) inside the client
    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);

    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);

    const subEntityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA.CLIENT_PREFIX,
    );
    const selectedRisk = await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);

    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await riskRegisterDLM.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(subEntityName);
    await page.waitForTimeout(2000);

    TestData.setKey(
      FILE_KEYS.RRD_SUBENTITY_NAME,
      subEntityName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.RRD_SELECTED_RISK,
      selectedRisk,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `✔ Sub-entity created: ${subEntityName} | risk: ${selectedRisk}`,
    );
  });

  test("RRD - 01 | @regression Add Risk tags", async ({ page }) => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = TestData.getKey(
      FILE_KEYS.RRD_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    // 1) Open the client and navigate to the Risk Register screen
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterDLM.navigateToRiskRegisterRisks();
    await riskRegisterDLM.assertRisksTitleVisible();

    // 2) Open the Dynamic Labels panel (button next to delete)
    await riskRegisterDLM.clickDynamicLabelsButton();

    // 3) Capture a random risk row as the target risk and persist it so
    //    later tests / assertions can reference the same risk.
    const targetRisk = await riskRegisterDLM.captureRandomRiskAsTarget();
    TestData.setKey(
      FILE_KEYS.RRD_TARGET_RISK_ID,
      targetRisk.id,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.RRD_TARGET_RISK_NAME,
      targetRisk.name,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    // Also persist under tag-specific keys so downstream tests (e.g. the
    // DLM filters spec) can map "Risk Tags" -> this risk reliably even
    // when later tests overwrite the generic RRD_TARGET_RISK_* keys.
    TestData.setKey(
      FILE_KEYS.RRD_TAGGED_RISK_ID,
      targetRisk.id,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.RRD_TAGGED_RISK_NAME,
      targetRisk.name,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `▶ Target risk for label assignment: ${targetRisk.id} - ${targetRisk.name}`,
    );

    // 4) Switch the side-panel type selector to "Risk Tags" and drag the
    //    DLM-created risk tag onto the target risk's Dynamic Labels cell.
    const riskTagName = TestData.getKey(
      FILE_KEYS.DLM_RISK_TAG_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    if (!riskTagName) {
      throw new Error(
        "DLM_RISK_TAG_NAME not found. Run the DLM Settings setup test first to create the risk tag.",
      );
    }
    await riskRegisterDLM.selectDlmPanelType("Risk Tags");
    await page.waitForTimeout(2000);
    await riskRegisterDLM.dragLabelToRiskById(riskTagName, targetRisk.id);

    // 5) Persist the assignment by clicking SAVE on the DLM action bar.
    await riskRegisterDLM.clickDlmModeSaveButton();

    // 6) Open the risk we just tagged and confirm the tag is rendered on
    //    the risk detail screen under the "Risk Tags" group.
    await riskRegisterDLM.clickSearchedRisk(targetRisk.name);
    await page.waitForTimeout(2000);

    await riskRegisterDLM.clickRiskDetailDynamicLabelsButton();
    await riskRegisterDLM.verifyDynamicLabelChipVisible(
      "Risk Tags",
      riskTagName,
    );
  });

  test("RRD - 02 | @regression Add Risk categories", async ({ page }) => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = TestData.getKey(
      FILE_KEYS.RRD_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    // 1) Open the client and navigate to the Risk Register screen
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterDLM.navigateToRiskRegisterRisks();
    await riskRegisterDLM.assertRisksTitleVisible();

    // 2) Open the Dynamic Labels panel (button next to delete)
    await riskRegisterDLM.clickDynamicLabelsButton();

    // 3) Capture a random risk row as the target risk and persist it so
    //    later tests / assertions can reference the same risk.
    const targetRisk = await riskRegisterDLM.captureRandomRiskAsTarget();
    TestData.setKey(
      FILE_KEYS.RRD_TARGET_RISK_ID,
      targetRisk.id,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.RRD_TARGET_RISK_NAME,
      targetRisk.name,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    // Also persist under category-specific keys so the DLM filters spec
    // can map "Risk Categories" -> this risk reliably.
    TestData.setKey(
      FILE_KEYS.RRD_CATEGORIZED_RISK_ID,
      targetRisk.id,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.RRD_CATEGORIZED_RISK_NAME,
      targetRisk.name,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `▶ Target risk for category assignment: ${targetRisk.id} - ${targetRisk.name}`,
    );

    // 4) Switch the side-panel type selector to "Risk Categories" and drag
    //    the DLM-created risk category onto the target risk's Dynamic
    //    Labels cell.
    const riskCategoryName = TestData.getKey(
      FILE_KEYS.DLM_RISK_CATEGORY_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    if (!riskCategoryName) {
      throw new Error(
        "DLM_RISK_CATEGORY_NAME not found. Run the DLM Settings setup test first to create the risk category.",
      );
    }
    await riskRegisterDLM.selectDlmPanelType("Risk Categories");
    await page.waitForTimeout(2000);
    await riskRegisterDLM.dragLabelToRiskById(riskCategoryName, targetRisk.id);

    // 5) Persist the assignment by clicking SAVE on the DLM action bar.
    await riskRegisterDLM.clickDlmModeSaveButton();

    // 6) Open the risk we just tagged and confirm the category is rendered
    //    on the risk detail screen under the "Risk Categories" group.
    await riskRegisterDLM.clickSearchedRisk(targetRisk.name);
    await page.waitForTimeout(2000);

    await riskRegisterDLM.clickRiskDetailDynamicLabelsButton();
    await riskRegisterDLM.verifyDynamicLabelChipVisible(
      "Risk Categories",
      riskCategoryName,
    );
  });
});
