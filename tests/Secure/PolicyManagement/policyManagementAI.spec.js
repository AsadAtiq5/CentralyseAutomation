const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ManagementPage = require("../../../pages/Secure/ManagementPage");
const PolicyManagement = require("../../../pages/Secure/PolicyManagement/PolicyManagement");
const TestData = require("../../../constant/testData");
const {
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
  POLICY_MANAGEMENT,
} = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
  console.log("storageStatePath");
}

test.describe("AI Policy Management Tests", () => {
  let managementPage;
  let policyManagement;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    policyManagement = new PolicyManagement(page);
    await policyManagement.goto("/clients");
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
    await managementPage.searchClient(
      TestData.getKey(
        FILE_KEYS.ROOT_ENTITY_POLICY_MANAGEMENT,
        TEST_DATA_FILE_ENUMS.ENTITY,
      ),
    );
    await managementPage.clickClientCard(
      TestData.getKey(
        FILE_KEYS.ROOT_ENTITY_POLICY_MANAGEMENT,
        TEST_DATA_FILE_ENUMS.ENTITY,
      ),
    );
    await managementPage.waitForSpinner();
    await managementPage.clickPolicyManagementButton();
    await managementPage.waitForSpinner();
    await managementPage.verifyUrlContains("/policies", 60000);
  });

  test("PMA - 01 | @regression Verify no policies state", async () => {
    test.setTimeout(60000);
    await policyManagement.verifyNoPoliciesState();
  });

  test("PMA - 02 | @regression Verify the fields validations for AI Policy", async () => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    await policyManagement.verifyValidations();
    await policyManagement.enterPolicyName();
    await policyManagement.verifyValidations();
    await policyManagement.enterOrganizationName();
    await policyManagement.verifyValidations();
    await policyManagement.selectIndustry();
    await policyManagement.verifyValidations();
    await policyManagement.selectFrameworkOrientation();
    await policyManagement.verifyValidations();
    await policyManagement.enterEmployeeCount();
    await policyManagement.verifyValidations();
    await policyManagement.selectCategory();
    await policyManagement.expectToNotBeVisible(
      policyManagement.selectors.toastMessage,
    );
  });

  test("PMA - 03 | @smoke Verify the policy document is displayed", async () => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const { policyName } = await policyManagement.fillAIPolicyForm();

    // Include mandatory dropdown selections
    await policyManagement.selectIndustry();
    await policyManagement.selectFrameworkOrientation();
    await policyManagement.selectCategory();

    await policyManagement.clickNextButton();
    await policyManagement.clickGenerateButton();

    // Wait up to 3 minutes for the document and verify the policy name
    await policyManagement.verifyDocumentDisplayed(policyName);
  });

  test("PMA - 04 | @smoke Verify successfull creation of the AI Policy", async () => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const { policyName } = await policyManagement.fillAIPolicyForm();

    await policyManagement.selectIndustry();
    await policyManagement.selectFrameworkOrientation();
    await policyManagement.selectCategory();

    await policyManagement.clickNextButton();
    await policyManagement.clickGenerateButton();

    await policyManagement.verifyDocumentDisplayed(policyName);
    await policyManagement.clickFooterNextButton();
    await policyManagement.clickApproveAndCreateButton();
    await policyManagement.waitForUploadSuccess();

    await policyManagement.verifyPolicyInTable(policyName);
  });

  test("PMA - 05 | @smoke Verify that the created Framework is displayed for others in the list", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const policyName = await policyManagement.enterPolicyName();
    await policyManagement.enterOrganizationName();
    await policyManagement.selectIndustry();

    const frameworkName = `Framework_${Date.now()}`;
    await policyManagement.addNewFramework(frameworkName);
    await policyManagement.enterEmployeeCount();
    await policyManagement.selectCategory();

    await policyManagement.clickNextButton();
    await policyManagement.clickGenerateButton();

    await policyManagement.verifyDocumentDisplayed(policyName);
    await policyManagement.clickFooterNextButton();
    await policyManagement.clickApproveAndCreateButton();
    await policyManagement.waitForUploadSuccess();
    await page.waitForTimeout(5000);

    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();

    await policyManagement.searchFramework(frameworkName);
  });

  test("PMA - 06 | @smoke Verify that the created Category is displayed for others in the list", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const policyName = await policyManagement.enterPolicyName();
    await policyManagement.enterOrganizationName();
    await policyManagement.selectIndustry();

    const categoryName = `Category_${Date.now()}`;
    await policyManagement.addNewCategoryWhenSettled(
      categoryName,
      POLICY_MANAGEMENT.SECTIONS.SECURITY,
    );
    await policyManagement.enterEmployeeCount();
    await policyManagement.selectFrameworkOrientation();

    await policyManagement.clickNextButton();
    await policyManagement.clickGenerateButton();

    await policyManagement.verifyDocumentDisplayed(policyName);
    await policyManagement.clickFooterNextButton();
    await policyManagement.clickApproveAndCreateButton();
    await policyManagement.waitForUploadSuccess();
    await page.waitForTimeout(5000);

    // 2nd Part: Verify
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();

    await policyManagement.searchCategory(categoryName);
    await policyManagement.click(
      policyManagement.selectors.categoryCloseButton,
    );
  });

  test("PMA - 07 | @regression Verify Policy can be previewed successfully", async () => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const { policyName } = await policyManagement.fillAIPolicyForm();

    await policyManagement.selectIndustry();
    await policyManagement.selectFrameworkOrientation();
    await policyManagement.selectCategory();

    await policyManagement.clickNextButton();
    await policyManagement.clickGenerateButton();

    await policyManagement.verifyDocumentDisplayed(policyName, 300000);
    await policyManagement.clickFooterNextButton();
    await policyManagement.clickApproveAndCreateButton();
    await policyManagement.waitForUploadSuccess();

    await policyManagement.verifyPolicyInTable(policyName);
    await policyManagement.selectPolicyInTable(policyName);
    await policyManagement.clickPreviewIcon();

    // Verify the document is displayed in the previewer
    await policyManagement.verifyDocumentDisplayed(policyName);
  });

  test("PMA - 08 | @regression Verify Policy can be downloaded successfully", async () => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectAIPolicy();
    const { policyName } = await policyManagement.fillAIPolicyForm();

    await policyManagement.selectIndustry();
    await policyManagement.selectFrameworkOrientation();
    await policyManagement.selectCategory();

    await policyManagement.clickNextButton();
    await policyManagement.clickGenerateButton();

    await policyManagement.verifyDocumentDisplayed(policyName, 300000);
    await policyManagement.clickFooterNextButton();
    await policyManagement.clickApproveAndCreateButton();
    await policyManagement.waitForUploadSuccess();

    await policyManagement.verifyPolicyInTable(policyName);
    await policyManagement.selectPolicyInTable(policyName);
    await policyManagement.clickDownloadIcon();
    await policyManagement.verifyFileDownloadedToast();
  });
});
