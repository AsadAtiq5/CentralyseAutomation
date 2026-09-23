const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ManagementPage = require("../../../pages/Secure/ManagementPage");
const PolicyManagementFiltersDLM = require("../../../pages/Secure/DynamicLabelManagement/PolicyManagementFIltersDLM");
const PolicyManagementPolicies = require("../../../pages/Secure/PolicyManagement/PolicyManagementPolicies");
const TestData = require("../../../constant/testData");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  DEFAULT: 60000,
  LONG: 600000,
};

test.describe("Policy Management - DLM Filters", () => {
  let managementPage;
  let policyManagement;
  // The Policies screen sub-menu lives on the PolicyManagementPolicies page
  // object; PolicyManagementFiltersDLM only owns the FILTERS panel.
  let policies;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    policyManagement = new PolicyManagementFiltersDLM(page);
    policies = new PolicyManagementPolicies(page);

    const clientName = TestData.getKey(
      FILE_KEYS.DLM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );

    await policyManagement.goto("/clients");
    await page
      .waitForLoadState("networkidle", { timeout: TIMEOUTS.DEFAULT })
      .catch(() => {});
    await managementPage.searchClient(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await managementPage.clickPolicyManagementButton();
    await managementPage.waitForSpinner();

    // Policy Management now lands on the Overview dashboard, so the Policies
    // sub-menu has to be clicked before the FILTERS button exists.
    await policies.clickPoliciesSubMenu();
    await policies.verifyPoliciesUrl();
  });

  test("PMF - 01 | @smoke Verify DLM filters", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Read persisted policy data (name + sub-category + tags) for both
    //    the AI and Template policies created by the DLM creation tests.
    const aiName = TestData.getKey(
      FILE_KEYS.DLM_AI_POLICY_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    const aiSubCategory = TestData.getKey(
      FILE_KEYS.DLM_AI_POLICY_CATEGORY_SUB,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    const aiTags =
      TestData.getKey(
        FILE_KEYS.DLM_AI_POLICY_TAGS,
        TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
      ) || [];

    const templateName = TestData.getKey(
      FILE_KEYS.DLM_TEMPLATE_POLICY_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    const templateSubCategory = TestData.getKey(
      FILE_KEYS.DLM_TEMPLATE_POLICY_CATEGORY_SUB,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    const templateTags =
      TestData.getKey(
        FILE_KEYS.DLM_TEMPLATE_POLICY_TAGS,
        TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
      ) || [];

    // 2) Build the list of filter cases we want to verify - only the
    //    categories and tags actually assigned during policy creation.
    const filterCases = [
      {
        typeName: "Policy Categories",
        itemName: aiSubCategory,
        policyName: aiName,
        label: "AI policy sub-category",
      },
      {
        typeName: "Policy Categories",
        itemName: templateSubCategory,
        policyName: templateName,
        label: "Template policy sub-category",
      },
      ...aiTags.map((tag) => ({
        typeName: "Policy Tags",
        itemName: tag,
        policyName: aiName,
        label: `AI policy tag (${tag})`,
      })),
      ...templateTags.map((tag) => ({
        typeName: "Policy Tags",
        itemName: tag,
        policyName: templateName,
        label: `Template policy tag (${tag})`,
      })),
    ];

    // 3) Open filters once and verify the popup is visible.
    await policyManagement.clickFiltersBtn();
    await policyManagement.verifyFiltersPopupOpened();

    // 4) For each case: CLEAR previous selection, switch DLM type, check the
    //    item, apply, wait for the table to refresh, then verify the matching
    //    policy is displayed.
    for (let i = 0; i < filterCases.length; i += 1) {
      const { typeName, itemName, policyName, label } = filterCases[i];
      console.log(
        `\n— Filter case ${i + 1}/${filterCases.length}: ${label} → expect policy "${policyName}"`,
      );

      await policyManagement.ensureFiltersPopupOpen();
      if (i > 0) {
        await policyManagement.clickClearFilterBtn();
        await policyManagement.waitForSpinner();
        await policyManagement.ensureFiltersPopupOpen();
      }
      await policyManagement.selectDLMFilterType(typeName);
      await policyManagement.checkDLMFilterItem(itemName);
      await policyManagement.clickApplyFilterBtn();
      await policyManagement.waitForSpinner();
      await policyManagement.verifyPolicyInTable(policyName);
    }
  });
});
