const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ManagementPage = require("../../../pages/Secure/ManagementPage");
const PolicyManagementDLM = require("../../../pages/Secure/DynamicLabelManagement/PolicyManagementDLM");
const PolicyManagementPolicies = require("../../../pages/Secure/PolicyManagement/PolicyManagementPolicies");
const TestData = require("../../../constant/testData");
const {
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
  POLICY_MANAGEMENT,
} = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  DEFAULT: 60000,
  LONG: 600000,
};

// Policy Categories and Policy Tags expected to be configured via
// the Dynamic Label Manager Settings test suite (DLM-SETTINGS-07).
const POLICY_CATEGORY_HIERARCHY = {
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
const POLICY_TAGS = [
  "PolicyTag1",
  "PolicyTag2",
  "PolicyTag3",
  "PolicyTag4",
  "PolicyTag5",
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

test.describe("Policy Management - Dynamic Label Management", () => {
  let managementPage;
  let policyManagement;
  // The Policies screen and its approver-assignment flow live on the
  // PolicyManagementPolicies page object (proven by PMMA - 04 / PMMA - 05);
  // PolicyManagementDLM only owns the Dynamic Labels popup.
  let policies;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    policyManagement = new PolicyManagementDLM(page);
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

    // Navigate to Policies submenu to access policy creation
    await policies.clickPoliciesSubMenu();
    await policies.verifyPoliciesUrl();
  });

  test("PMD - 01 | @smoke Add AI Policy with Policy Categories and tags", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Start the AI policy flow and fill the main form.
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const { policyName } = await policyManagement.fillAIPolicyForm();

    await policyManagement.selectIndustry();
    await policyManagement.selectFrameworkOrientation();
    await policyManagement.enterEmployeeCount();

    // 2) Select a sub-category from one of the configured Policy
    //    Categories (e.g. Security / Privacy added via DLM Settings).
    const parentCategory = pickRandom(Object.keys(POLICY_CATEGORY_HIERARCHY));
    const subCategory = pickRandom(POLICY_CATEGORY_HIERARCHY[parentCategory]);
    console.log(`Using Policy Category: ${parentCategory} -> ${subCategory}`);
    await policyManagement.selectCategory(subCategory);

    // 3) Generate the AI policy document.
    await policyManagement.clickNextButton();
    const selectedTag = pickRandom(POLICY_TAGS);
    const selectedTags = [selectedTag];
    console.log(`Selecting Dynamic Label (policy tag): ${selectedTag}`);
    await policyManagement.addDynamicLabels(selectedTags);
    await policyManagement.clickGenerateButton();
    await policyManagement.verifyDocumentDisplayed(policyName, 300000); // 5-minute timeout for AI generation

    // 4) Move to the summary form and assign an approver with a deadline. The
    //    dropdown needs search -> checkbox -> deadline -> SAVE; picking the name
    //    alone leaves the form incomplete and the Create button disabled.
    await policyManagement.clickFooterNextButton();
    await policies.assignPolicyApprover(
      POLICY_MANAGEMENT.APPROVER.DEFAULT_USER,
    );

    // 5) Create and verify the policy lands in the table.
    await policies.clickCreateButton();
    await policyManagement.waitForProcessedSuccess(120000);

    await policyManagement.verifyPolicyInTable(policyName);

    // 6) Persist the policy name, assigned category and labels so that
    //    later filter tests can verify this policy is returned by the
    //    matching filters.
    TestData.setKey(
      FILE_KEYS.DLM_AI_POLICY_NAME,
      policyName,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DLM_AI_POLICY_CATEGORY_PARENT,
      parentCategory,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DLM_AI_POLICY_CATEGORY_SUB,
      subCategory,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DLM_AI_POLICY_TAGS,
      selectedTags,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `✔ Persisted AI policy data → name="${policyName}", category="${parentCategory} / ${subCategory}", tags=${JSON.stringify(selectedTags)}`,
    );
  });

  test("PMD - 02 | @smoke Add Template Policy with Policy Categories and tags", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Start the Template policy flow and pick a random template.
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectTemplateCreation();

    const [selectedTemplate] = await policyManagement.selectRandomTemplate();
    const { name } = selectedTemplate;
    await policyManagement.clickTemplateNextButton();

    // 2) Wait for the document preview and move to the details form.
    await policyManagement.waitForDocumentVisibility();
    await policyManagement.clickFooterNextButton();

    // 3) The form's Policy Name should be pre-filled with the template name;
    //    the table row will use the default expected category (template name
    //    minus the " Template" suffix).
    await policyManagement.verifyFormPolicyName(name);
    const expectedCategory = name.replace(" Template", "");

    // 4) Override the auto-selected Category with one of the DLM
    //    Policy Categories (Security / Privacy sub-categories).
    const parentCategory = pickRandom(Object.keys(POLICY_CATEGORY_HIERARCHY));
    const subCategory = pickRandom(POLICY_CATEGORY_HIERARCHY[parentCategory]);
    console.log(
      `Overriding template Category with: ${parentCategory} -> ${subCategory}`,
    );
    await policyManagement.selectCategory(subCategory);

    // 5) Open the Dynamic Labels popup and pick a policy tag.
    const selectedTag = pickRandom(POLICY_TAGS);
    const selectedTags = [selectedTag];
    console.log(`Selecting Dynamic Label (policy tag): ${selectedTag}`);
    await policyManagement.addDynamicLabels(selectedTags);

    // 6) Continue through Import, then assign an approver and create.
    await policyManagement.clickImportNextButton();
    await policies.assignPolicyApprover(
      POLICY_MANAGEMENT.APPROVER.DEFAULT_USER,
    );
    await policies.clickCreateButton();
    await policyManagement.waitForProcessedSuccess(120000);

    await policyManagement.verifyPolicyInTable(expectedCategory);

    // 7) Persist the template-policy name, assigned category and labels
    //    so that later filter tests can verify this policy is returned
    //    by the matching filters.
    TestData.setKey(
      FILE_KEYS.DLM_TEMPLATE_POLICY_NAME,
      expectedCategory,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DLM_TEMPLATE_POLICY_CATEGORY_PARENT,
      parentCategory,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DLM_TEMPLATE_POLICY_CATEGORY_SUB,
      subCategory,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    TestData.setKey(
      FILE_KEYS.DLM_TEMPLATE_POLICY_TAGS,
      selectedTags,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    console.log(
      `✔ Persisted Template policy data → name="${expectedCategory}", category="${parentCategory} / ${subCategory}", tags=${JSON.stringify(selectedTags)}`,
    );
  });
});
