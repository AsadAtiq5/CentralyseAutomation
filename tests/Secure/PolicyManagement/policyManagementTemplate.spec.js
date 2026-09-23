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

test.describe("Template Policy Management", () => {
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

  test("PMT - 01 | @smoke Verify Policy Creation from Template", async () => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectTemplateCreation();

    const [selectedTemplate] = await policyManagement.selectRandomTemplate();
    const { name } = selectedTemplate;
    await policyManagement.clickTemplateNextButton();

    await policyManagement.waitForDocumentVisibility();
    await policyManagement.clickFooterNextButton();

    await policyManagement.verifyFormPolicyName(name);
    // The category in the form is often the name without " Template" or fixed for certain templates
    const expectedCategory = name.replace(" Template", "");
    await policyManagement.verifyFormCategory(expectedCategory);

    await policyManagement.clickImportNextButton();
    await policyManagement.clickApproveAndCreateButton();
    await policyManagement.waitForProcessedSuccess();

    await policyManagement.verifyPolicyInTable(expectedCategory);
  });

  test("PMT - 02 | @regression Upload a new template", async ({ page }) => {
    test.setTimeout(600000);
    await policyManagement.clickAddNewPolicy();
    await policyManagement.selectTemplateCreation();

    await policyManagement.clickAddTemplateButton();
    await policyManagement.uploadTemplateFile("filesTest/Files/testFile.pdf");
    await policyManagement.verifyUploadSuccess();
    await policyManagement.clickNextAfterUpload();

    await policyManagement.waitForDocumentVisibility();
    await policyManagement.clickFooterNextButton();

    const categoryName = await policyManagement.selectRandomCategory();
    const frameworkName =
      await policyManagement.selectRandomFrameworkOrientation();

    await policyManagement.clickNextAfterUpload();
    await policyManagement.waitForTemplateCreatedSuccess();

    await policyManagement.verifyTemplateInList("testFile.pdf");
  });
});
