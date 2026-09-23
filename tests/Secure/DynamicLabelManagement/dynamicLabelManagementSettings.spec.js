const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const DynamicLabelManagementSettings = require("../../../pages/Secure/DynamicLabelManagement/DynamicLabelManagementSettings");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  DEFAULT: 60000,
  SHORT: 120000,
  MEDIUM: 300000,
  LONG: 600000,
};

const TEST_DATA = {
  CLIENT_PREFIX: "DLM",
  DEFAULT_FIRST_PARTY_URL: "",
};

test.describe("Dynamic Label Management - Settings", () => {
  let managementPage;
  let addClientPage;
  let dlmSettings;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    dlmSettings = new DynamicLabelManagementSettings(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("DLM-SETTINGS-01 | @regression Add Tags - create client with Policy Management and open Dynamic Label Manager", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // 1) Create a new client with Policy Management selected
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName(
      TEST_DATA.CLIENT_PREFIX,
    );
    TestData.setKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`✔ Created client name: ${clientName}`);
    await addClientPage.selectIndustry();
    await addClientPage.selectPolicyManagement();
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    await addClientPage.waitForToast();
    await addClientPage.waitForSpinner();
    await page.waitForTimeout(3000);

    // 2) Verify the client is visible in the listings
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    console.log("✔ Client verified in list");

    // 3) Click on Settings from the side menu
    await dlmSettings.clickSettingsBtn();
    console.log("✔ Navigated to Settings");

    // 4) Search and select the client in Settings
    await dlmSettings.searchAndSelectClientInSettings(clientName);
    console.log("✔ Client selected in Settings");

    // 5) Click on the 1st Party sub-screen tab
    await dlmSettings.clickFirstPartyTab();
    await page.waitForTimeout(2000);
    console.log("✔ 1st Party tab opened");

    // 6) Verify Dynamic Label Manager section is visible
    await dlmSettings.verifyDynamicLabelManagerSectionVisible();
  });

  test("DLM-SETTINGS-02 | @regression Add General Tag and General Category under General Tags sub-tab", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    // 1) Open Settings and select the client
    await dlmSettings.clickSettingsBtn();
    await dlmSettings.searchAndSelectClientInSettings(clientName);

    // 2) Open the 1st Party sub-screen and verify DLM section
    await dlmSettings.clickFirstPartyTab();
    await page.waitForTimeout(2000);
    await dlmSettings.verifyDynamicLabelManagerSectionVisible();

    // 3) Make sure we are on the General Tags sub-tab
    await dlmSettings.clickGeneralTagsSubTab();

    // 4) Add a General Tag
    const tagName = `Tag_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.DLM_GENERAL_TAG_NAME,
      tagName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    await dlmSettings.addItemToContainer("General Tags", tagName);
    await dlmSettings.verifyItemInContainer("General Tags", tagName);

    // 5) Add a General Category
    const categoryName = `Category_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.DLM_GENERAL_CATEGORY_NAME,
      categoryName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    await dlmSettings.addItemToContainer("General Categories", categoryName);
    await dlmSettings.verifyItemInContainer("General Categories", categoryName);
  });

  test("DLM-SETTINGS-03 | @regression Add Risk Tag and Risk Category under Risk Register sub-tab", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    // 1) Open Settings and select the client
    await dlmSettings.clickSettingsBtn();
    await dlmSettings.searchAndSelectClientInSettings(clientName);

    // 2) Open the 1st Party sub-screen and verify DLM section
    await dlmSettings.clickFirstPartyTab();
    await page.waitForTimeout(2000);
    await dlmSettings.verifyDynamicLabelManagerSectionVisible();

    // 3) Switch to the Risk Register sub-tab
    await dlmSettings.clickRiskRegisterSubTab();

    // 4) Add a Risk Tag
    const riskTagName = `RiskTag_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.DLM_RISK_TAG_NAME,
      riskTagName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    await dlmSettings.addItemToContainer("Risk Tags", riskTagName);
    await dlmSettings.verifyItemInContainer("Risk Tags", riskTagName);

    // 5) Add a Risk Category
    const riskCategoryName = `RiskCategory_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.DLM_RISK_CATEGORY_NAME,
      riskCategoryName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    await dlmSettings.addItemToContainer("Risk Categories", riskCategoryName);
    await dlmSettings.verifyItemInContainer(
      "Risk Categories",
      riskCategoryName,
    );
  });

  test("DLM-SETTINGS-04 | @regression Add Policy Tag, Policy Category and Sub-Category under Policy Management sub-tab", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    // 1) Open Settings and select the client
    await dlmSettings.clickSettingsBtn();
    await dlmSettings.searchAndSelectClientInSettings(clientName);

    // 2) Open the 1st Party sub-screen and verify DLM section
    await dlmSettings.clickFirstPartyTab();
    await page.waitForTimeout(2000);
    await dlmSettings.verifyDynamicLabelManagerSectionVisible();

    // 3) Switch to the Policy Management sub-tab
    await dlmSettings.clickPolicyManagementSubTab();

    // 4) Add a Policy Tag (same flow as General/Risk Tags)
    const policyTagName = `PolicyTag_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.DLM_POLICY_TAG_NAME,
      policyTagName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    await dlmSettings.addItemToContainer("Policy Tags", policyTagName);
    await dlmSettings.verifyItemInContainer("Policy Tags", policyTagName);

    // 5) Add a parent Policy Category
    const parentCategoryName = `PolicyParent_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.DLM_POLICY_CATEGORY_PARENT_NAME,
      parentCategoryName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    await dlmSettings.addPolicyCategoryParent(parentCategoryName);
    await dlmSettings.verifyPolicyCategoryParent(parentCategoryName);

    // 6) Add a sub-category under the newly created parent
    const subCategoryName = `PolicySub_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.DLM_POLICY_CATEGORY_SUB_NAME,
      subCategoryName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    await dlmSettings.addPolicySubCategoryUnder(
      parentCategoryName,
      subCategoryName,
    );
    await dlmSettings.verifyPolicySubCategoryUnder(
      parentCategoryName,
      subCategoryName,
    );
  });

  test("DLM-SETTINGS-05 | @regression Bulk upload General Tags and General Categories via template file", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    const filePath = "filesTest/GenralTags/GeneralTags.xlsx";
    const expectedTags = [
      "GeneralTag1",
      "GeneralTag2",
      "GeneralTag3",
      "GeneralTag4",
      "GeneralTag5",
    ];
    const expectedCategories = [
      "GeneralCategory1",
      "GeneralCategory2",
      "GeneralCategory3",
      "GeneralCategory4",
      "GeneralCategory5",
    ];

    // 1) Open Settings, select client, go to 1st Party → General Tags
    await dlmSettings.clickSettingsBtn();
    await dlmSettings.searchAndSelectClientInSettings(clientName);
    await dlmSettings.clickFirstPartyTab();
    await page.waitForTimeout(2000);
    await dlmSettings.verifyDynamicLabelManagerSectionVisible();
    await dlmSettings.clickGeneralTagsSubTab();

    // 2) Open Bulk Upload modal and proceed to upload step
    await dlmSettings.clickBulkUploadBtn();
    await dlmSettings.verifyBulkUploadModalVisible();
    await dlmSettings.clickBulkUploadNextBtn();

    // 3) Upload the template file
    await dlmSettings.uploadBulkUploadFile(filePath);

    // 4) On Results step verify items under General Categories sub-tab
    await dlmSettings.switchBulkUploadResultsSubTab("General Categories");
    for (const cat of expectedCategories) {
      await dlmSettings.verifyBulkUploadResultItem(cat);
    }

    // 5) Switch to General Tags sub-tab and verify items
    await dlmSettings.switchBulkUploadResultsSubTab("General Tags");
    for (const tag of expectedTags) {
      await dlmSettings.verifyBulkUploadResultItem(tag);
    }

    // 6) Click ADD and wait for the success toast (visible then hidden)
    await dlmSettings.clickBulkUploadAddBtn();
    await dlmSettings.waitForBulkUploadSuccessToast();

    // 7) Verify uploaded tags/categories now appear in the live containers
    await page.waitForTimeout(2000);
    for (const tag of expectedTags) {
      await dlmSettings.verifyItemInContainer("General Tags", tag);
    }
    for (const cat of expectedCategories) {
      await dlmSettings.verifyItemInContainer("General Categories", cat);
    }
  });

  test("DLM-SETTINGS-06 | @regression Bulk upload Risk Tags and Risk Categories via template file", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    const filePath = "filesTest/RiskTags/RiskTags.xlsx";
    const expectedTags = [
      "RiskTag1",
      "RiskTag2",
      "RiskTag3",
      "RiskTag4",
      "RiskTag5",
    ];
    const expectedCategories = [
      "RiskCategory1",
      "RiskCategory2",
      "RiskCategory3",
      "RiskCategory4",
      "RiskCategory5",
    ];

    await dlmSettings.clickSettingsBtn();
    await dlmSettings.searchAndSelectClientInSettings(clientName);
    await dlmSettings.clickFirstPartyTab();
    await page.waitForTimeout(2000);
    await dlmSettings.verifyDynamicLabelManagerSectionVisible();
    await dlmSettings.clickRiskRegisterSubTab();

    await dlmSettings.clickBulkUploadBtn();
    await dlmSettings.verifyBulkUploadModalVisible();
    await dlmSettings.clickBulkUploadNextBtn();

    await dlmSettings.uploadBulkUploadFile(filePath);

    await dlmSettings.switchBulkUploadResultsSubTab("Risk Categories");
    for (const cat of expectedCategories) {
      await dlmSettings.verifyBulkUploadResultItem(cat);
    }

    await dlmSettings.switchBulkUploadResultsSubTab("Risk Tags");
    for (const tag of expectedTags) {
      await dlmSettings.verifyBulkUploadResultItem(tag);
    }

    await dlmSettings.clickBulkUploadAddBtn();
    await dlmSettings.waitForBulkUploadSuccessToast();

    await page.waitForTimeout(2000);
    for (const tag of expectedTags) {
      await dlmSettings.verifyItemInContainer("Risk Tags", tag);
    }
    for (const cat of expectedCategories) {
      await dlmSettings.verifyItemInContainer("Risk Categories", cat);
    }
  });

  test("DLM-SETTINGS-07 | @regression Bulk upload Policy Tags and Policy Categories (parent + sub) via template file", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(`▶ Using client: ${clientName}`);

    const filePath = "filesTest/PolicyTags/PolicyManagementTags.xlsx";
    const expectedTags = [
      "PolicyTag1",
      "PolicyTag2",
      "PolicyTag3",
      "PolicyTag4",
      "PolicyTag5",
    ];
    // Parent → list of sub-categories
    const expectedCategoryHierarchy = {
      Security: [
        "SecuritySubCategory1",
        "SecuritySubCategory2",
        "SecuritySubCategory3",
        "SecuritySubCategory4",
      ],
      Privacy: [
        "PrivacySubCategory1",
        "PrivacySubCategory2",
        "PrivacySubCategory3",
        "PrivacySubCategory4",
        "PrivacySubCategory5",
      ],
    };
    const allSubCategories = Object.values(expectedCategoryHierarchy).flat();

    await dlmSettings.clickSettingsBtn();
    await dlmSettings.searchAndSelectClientInSettings(clientName);
    await dlmSettings.clickFirstPartyTab();
    await page.waitForTimeout(2000);
    await dlmSettings.verifyDynamicLabelManagerSectionVisible();
    await dlmSettings.clickPolicyManagementSubTab();

    await dlmSettings.clickBulkUploadBtn();
    await dlmSettings.verifyBulkUploadModalVisible();
    await dlmSettings.clickBulkUploadNextBtn();

    await dlmSettings.uploadBulkUploadFile(filePath);

    // Verify sub-categories in results table (under Policy Categories sub-tab)
    await dlmSettings.switchBulkUploadResultsSubTab("Policy Categories");
    for (const sub of allSubCategories) {
      await dlmSettings.verifyBulkUploadResultItem(sub);
    }

    // Verify tags in results table (under Policy Tags sub-tab)
    await dlmSettings.switchBulkUploadResultsSubTab("Policy Tags");
    for (const tag of expectedTags) {
      await dlmSettings.verifyBulkUploadResultItem(tag);
    }

    await dlmSettings.clickBulkUploadAddBtn();
    await dlmSettings.waitForBulkUploadSuccessToast();

    await page.waitForTimeout(2000);

    // Verify Policy Tags appear in live Policy Tags container
    for (const tag of expectedTags) {
      await dlmSettings.verifyItemInContainer("Policy Tags", tag);
    }

    // Verify parent categories and their sub-categories appear in Policy Categories
    for (const [parent, subs] of Object.entries(expectedCategoryHierarchy)) {
      await dlmSettings.verifyPolicyCategoryParent(parent);
      for (const sub of subs) {
        await dlmSettings.verifyPolicySubCategoryUnder(parent, sub);
      }
    }
  });
});
