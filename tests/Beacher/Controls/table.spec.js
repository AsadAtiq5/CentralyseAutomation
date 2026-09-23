const { test } = require("@playwright/test");
const Table = require("../../../pages/Beacher/Controls/Table");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app (testData/Beacher/control.json).
process.env.APP = "Beacher";

const TIMEOUTS = {
  SHORT: 600000,
};

// Creates a brand-new Beacher entity via the New Entity wizard. Beacher has no
// Add Client + Multi Entity flow - the wizard is the only way in - so this
// replaces steps 1-3 of the Secure CT-01 / CT-03 flows.
async function createBeacherClient(page) {
  const wizard = new Wizard(page);

  await wizard.goto("/clients");
  await wizard.waitForSpinner();

  // Step 1 - Organizational/General.
  await wizard.clickNewButton();
  await wizard.waitForWizardModal();
  const clientName = await wizard.enterUniqueClientName("Beacher_Tag");
  await wizard.enterPrimaryRiskManagementContact("Risk Manager");
  await wizard.clickIndustryDropdown();
  await wizard.verifyIndustryListVisible();
  await wizard.selectIndustry("FINANCIAL SERVICES");
  await wizard.clickNextButton();

  // Step 2 - Financial.
  await wizard.waitForFinancialStep();
  await wizard.enterAnnualRevenue("1000000");
  await wizard.enterAnnualCostOfGoods("500000");
  await wizard.clickNextButton();

  // Step 3 - Frameworks.
  await wizard.waitForFrameworksStep();
  await wizard.selectRiskAssessment("Insurance Application");
  await wizard.clickNextButton();
  await wizard.clickNextButton();

  // Step 5 - Technical.
  await wizard.waitForTechnicalStep();
  await wizard.enterNumberOfServers("10");
  await wizard.enterNumberOfWorkstations("50");
  await wizard.clickNextButton();
  await wizard.clickNextButton();

  // Step 7 - Account Details.
  await wizard.waitForAccountDetailsStep();
  await wizard.clickRenewalDateCalendar();
  await wizard.verifyCalendarDisplayed();
  await wizard.selectCalendarToday();
  await wizard.clickNextButton();

  // Step 8 - Current/Previous Year: calculate and complete.
  await wizard.waitForCurrentPreviousYearStep();
  await wizard.clickCalculateButton();
  await wizard.clickCompleteButton();
  await wizard.verifyEntityCreatedToast();

  return clientName;
}

// Labels are capped at 10 characters in the panel, same generator as Secure.
function createTagName() {
  return `tg${Math.random().toString(36).slice(2, 8)}`;
}

test.describe.serial("Beacher Controls Table", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let controlsTablePage;
  let scoreCalculation;

  test.beforeEach(async ({ page }) => {
    controlsTablePage = new Table(page);
    scoreCalculation = new ScoreCalculation(page);
  });

  // Opens an existing Beacher client from the clients screen.
  async function openClient(page, clientName) {
    await scoreCalculation.goto("/clients");
    await scoreCalculation.waitForSpinner();
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();
    await page.waitForTimeout(2000);
  }

  test("BCT - 01 | @smoke Controls Table - Add tag and verify assigned tag", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Create a new Beacher client through the New Entity wizard
    const clientName = await createBeacherClient(page);
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client
    await openClient(page, clientName);

    // 3. Navigate to Controls > Table from the side menu
    await controlsTablePage.navigateToControlsTable();
    await controlsTablePage.waitForControlsTableLoaded();
    console.log("Navigated to Controls Table.");

    // 4. Click the edit icon to open the tags panel
    await controlsTablePage.clickEditIcon();
    await page.waitForTimeout(2000);

    // 5. Click the add (+) button to create a new tag
    await controlsTablePage.clickAddTagButton();
    await page.waitForTimeout(2000);

    // 6. Enter a random tag name (max 10 characters)
    const tagName = createTagName();
    console.log(`Tag name to add: "${tagName}"`);
    await controlsTablePage.fillTagName(tagName);
    await page.waitForTimeout(2000);
    await controlsTablePage.verifyTagInLabelsPanel(tagName);

    // 7. Drag the tag to the tag column of the first table row
    await controlsTablePage.dragTagToTableRow(tagName);
    await page.waitForTimeout(2000);

    // 8. Click Save and wait for the "Question updated successfully" toast
    await controlsTablePage.clickSaveButton();
    await controlsTablePage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(2000);

    // 9. Verify the tag is visible in the first row's tag column
    await controlsTablePage.verifyTagInFirstRow(tagName);

    // 10. Save client and tag names so BCT - 02 can reuse them
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
      `Saved to control.json - client: "${clientName}", tag: "${tagName}"`,
    );
  });

  test("BCT - 02 | @smoke Controls Table - Delete tag from question", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    const clientName = TestData.getKey(
      FILE_KEYS.CONTROL_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    const tagName = TestData.getKey(
      FILE_KEYS.CONTROL_TAG_NAME,
      TEST_DATA_FILE_ENUMS.CONTROL,
    );
    console.log(`Using client: "${clientName}", tag: "${tagName}"`);

    // 1. Search and navigate to the client created in BCT - 01
    await openClient(page, clientName);

    // 2. Navigate to Controls > Table
    await controlsTablePage.navigateToControlsTable();
    await controlsTablePage.waitForControlsTableLoaded();
    console.log("Navigated to Controls Table.");

    // 3. Click the edit icon to open the tags panel
    await controlsTablePage.clickEditIcon();
    await page.waitForTimeout(2000);

    // 4. Click the cross (x) button on the assigned tag in the first row
    await controlsTablePage.clickTagCrossInFirstRow(tagName);
    await page.waitForTimeout(2000);

    // 5. Click Save and wait for the toast
    await controlsTablePage.clickSaveButton();
    await controlsTablePage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(2000);

    // 6. Verify the tag is no longer displayed in the first row's tag column
    await controlsTablePage.verifyTagNotInFirstRow(tagName);
    console.log(`Tag "${tagName}" successfully deleted from the first row.`);
  });

  test("BCT - 03 | @smoke Controls Table - Assign tag to all controls and verify", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Create a dedicated client so the assign-to-all does not disturb the
    // client BCT - 01 and BCT - 02 work against
    const clientName = await createBeacherClient(page);
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client
    await openClient(page, clientName);

    // 3. Navigate to Controls > Table
    await controlsTablePage.navigateToControlsTable();
    await controlsTablePage.waitForControlsTableLoaded();
    console.log("Navigated to Controls Table.");

    // 4. Click the edit icon to open the tags panel
    await controlsTablePage.clickEditIcon();
    await page.waitForTimeout(2000);

    // 5. Create a new tag
    await controlsTablePage.clickAddTagButton();
    await page.waitForTimeout(2000);
    const tagName = createTagName();
    console.log(`Tag name: "${tagName}"`);
    await controlsTablePage.fillTagName(tagName);
    await page.waitForTimeout(2000);

    // 6. Drag and drop the tag onto the "Assign To All The Controls" area
    await controlsTablePage.dragTagToAllControls(tagName);
    await page.waitForTimeout(2000);

    // 7. Click Save and wait for the toast
    await controlsTablePage.clickSaveButton();
    await controlsTablePage.waitForQuestionUpdatedToast();
    await page.waitForTimeout(3000);

    // 8. Verify the tag reached every control. Secure checks this by opening each
    // question's Settings panel in the collection, but the Beacher collection
    // renders no per-question settings icon - the table's Dynamic Labels column
    // carries the same evidence for every row.
    const rowCount = await controlsTablePage.verifyTagOnAllTableRows(tagName);
    console.log(`Tag "${tagName}" verified on all ${rowCount} control rows.`);
  });
});
