const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const RiskRegisterFiltersDLM = require("../../../pages/Secure/DynamicLabelManagement/RiskRegisterFiltersDLM");
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

test.describe("Risk Register - DLM Filters", () => {
  let managementPage;
  let addClientPage;
  let riskRegisterFiltersDLM;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    riskRegisterFiltersDLM = new RiskRegisterFiltersDLM(page);

    const clientName = TestData.getKey(
      FILE_KEYS.RRD_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    if (!clientName) {
      throw new Error(
        "RRD_CLIENT_NAME not found. Run the Risk Register DLM setup test first to create the client.",
      );
    }

    await addClientPage.goto("/clients");
    await page
      .waitForLoadState("networkidle", { timeout: TIMEOUTS.DEFAULT })
      .catch(() => {});
    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterFiltersDLM.navigateToRiskRegisterRisks();
    await riskRegisterFiltersDLM.assertRisksTitleVisible();
  });

  test("RRF - 01 | @smoke Verify Risk DLM filters", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Read the DLM-created tag / category and the per-test target risks
    //    persisted by the Risk Register DLM assignment spec.
    const riskTagName = TestData.getKey(
      FILE_KEYS.DLM_RISK_TAG_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    const taggedRiskName = TestData.getKey(
      FILE_KEYS.RRD_TAGGED_RISK_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    if (!riskTagName || !taggedRiskName) {
      throw new Error(
        "DLM_RISK_TAG_NAME or RRD_TAGGED_RISK_NAME not found. Run RRD - 01 (Add Risk tags) first.",
      );
    }

    const riskCategoryName = TestData.getKey(
      FILE_KEYS.DLM_RISK_CATEGORY_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    const categorizedRiskName = TestData.getKey(
      FILE_KEYS.RRD_CATEGORIZED_RISK_NAME,
      TEST_DATA_FILE_ENUMS.DYNAMIC_LABEL_MANAGEMENT,
    );
    if (!riskCategoryName || !categorizedRiskName) {
      throw new Error(
        "DLM_RISK_CATEGORY_NAME or RRD_CATEGORIZED_RISK_NAME not found. Run RRD - 02 (Add Risk categories) first.",
      );
    }

    // 2) Build the list of filter cases we want to verify - only Risk Tags
    //    and Risk Categories that were actually assigned to known risks.
    const filterCases = [
      {
        typeName: "Risk Tags",
        itemName: riskTagName,
        riskName: taggedRiskName,
        label: `Risk Tag (${riskTagName}) -> ${taggedRiskName}`,
      },
      {
        typeName: "Risk Categories",
        itemName: riskCategoryName,
        riskName: categorizedRiskName,
        label: `Risk Category (${riskCategoryName}) -> ${categorizedRiskName}`,
      },
    ];

    // 3) Open the filters modal once and verify it is visible.
    await riskRegisterFiltersDLM.clickFiltersBtn();
    await riskRegisterFiltersDLM.verifyFiltersPopupOpened();

    // 4) For each case: clear previous selection (after the first one),
    //    switch DLM type, check the item, apply, wait for the table to
    //    refresh, then verify the matching risk is displayed.
    for (let i = 0; i < filterCases.length; i += 1) {
      const { typeName, itemName, riskName, label } = filterCases[i];
      console.log(`\n— Filter case ${i + 1}/${filterCases.length}: ${label}`);

      await riskRegisterFiltersDLM.ensureFiltersPopupOpen();
      if (i > 0) {
        await riskRegisterFiltersDLM.clickClearFilterBtn();
        await riskRegisterFiltersDLM.ensureFiltersPopupOpen();
      }
      await riskRegisterFiltersDLM.selectDLMFilterType(typeName);
      await riskRegisterFiltersDLM.checkDLMFilterItem(itemName);
      await riskRegisterFiltersDLM.clickApplyFilterBtn();
      await riskRegisterFiltersDLM.verifyRiskVisible(riskName);
    }
  });
});
