const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const RegulatoryWatch = require("../../../pages/Secure/RegulatoryWatch/RegulatoryWatch");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  DEFAULT: 60000,
  SHORT: 120000,
  // Used for tests that navigate to Monitoring and perform data operations.
  MEDIUM: 300000,
  // Used for tests that include long explicit waits (monitoring 60 s load,
  // Overview 60 s / 120 s load, History Insights 2-min Overview navigation).
  LONG: 420000,
};

const TEST_DATA = {
  CLIENT_PREFIX: "RW",
  DEFAULT_FIRST_PARTY_URL: "",
};

test.describe("Regulatory Watch Tests", () => {
  let managementPage;
  let addClientPage;
  let regulatoryWatch;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    regulatoryWatch = new RegulatoryWatch(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("RW-01 | Regulations limit", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // Open Add Client popup
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();

    // Enter client name (not more than 20 characters)
    const clientName = await addClientPage.createUniqueClientName(
      TEST_DATA.CLIENT_PREFIX,
    );
    TestData.setKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Select industry
    await addClientPage.selectIndustry();

    // Select Regulatory Watch from solutions (requires 1st Party Full to be selected first)
    await regulatoryWatch.selectRegulatoryWatch();

    // Add first party URL
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);

    // Set a random number of regulations and save
    const regulationsCount =
      await regulatoryWatch.setRandomNumberOfRegulations();
    console.log(`Selected regulations count: ${regulationsCount}`);
    TestData.setKey(
      FILE_KEYS.REGULATORY_WATCH_REGULATIONS_COUNT,
      regulationsCount,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Click Add Client button to save the client
    await addClientPage.clickAddClientButton();

    // Verify client appears in the list then open it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    // Allow Angular to finish hydrating the client page
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch from the side menu and allow the sub-menu
    // and initial page data to settle before proceeding
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(30000);

    // Click on Monitoring sub-menu item and wait for the table to load
    await regulatoryWatch.clickMonitoring();
    await regulatoryWatch.page.waitForTimeout(15000);

    // Click ADD REGULATIONS button and wait for the modal to open
    await regulatoryWatch.clickAddRegulationsButton();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Verify regulations limit in the modal matches the count set during client creation
    await regulatoryWatch.verifyRegulationsLimit(regulationsCount);

    // Select one more regulation than the limit to trigger the limit reached popup
    await regulatoryWatch.selectRegulationsFromTable(regulationsCount + 1);

    // Click ADD to attempt adding beyond the limit
    await regulatoryWatch.clickAddButton();

    // Verify "LIMIT REACHED" popup appears
    await regulatoryWatch.verifyLimitReachedPopup();
  });

  test("RW-02 | Searching regulation - Monitoring", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // Retrieve the client created in the previous test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch from the side menu
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(30000);

    // Click on Monitoring sub-menu item and wait for the table to load
    await regulatoryWatch.clickMonitoring();
    await regulatoryWatch.page.waitForTimeout(15000);

    // Click ADD REGULATIONS button and wait for the modal to open
    await regulatoryWatch.clickAddRegulationsButton();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Get all regulations data from the table before searching
    const tableData = await regulatoryWatch.getTableData();
    console.log(`Total regulations retrieved: ${tableData.length}`);

    // Pick the first word of the first regulation name as the search term
    const searchTerm = tableData[0].regulation.split(" ")[0];

    // Search for the regulation
    await regulatoryWatch.searchRegulation(searchTerm);
    await regulatoryWatch.page.waitForTimeout(8000);

    // Verify all visible results match the search term
    await regulatoryWatch.verifySearchResults(searchTerm);
  });

  test("RW-03 | Add Regulations", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // Retrieve the client created in the first test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch > Monitoring
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(30000);

    await regulatoryWatch.clickMonitoring();
    await regulatoryWatch.page.waitForTimeout(15000);

    // Open the regulations library modal and wait for it to fully load
    await regulatoryWatch.clickAddRegulationsButton();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Read the regulations count stored during client creation
    // const limit = TestData.getKey(
    //   FILE_KEYS.REGULATORY_WATCH_REGULATIONS_COUNT,
    //   TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    // );

    const limit = 25;
    console.log(`Regulations limit from stored test data: ${limit}`);

    await regulatoryWatch.selectRegulationsAndGetNames(limit);

    // Click ADD in the library modal
    await regulatoryWatch.clickAddButton();

    // Verify the "REGULATIONS ADDITION" confirmation modal shows the correct count
    await regulatoryWatch.verifyAddRegulationsModal(limit);

    // Confirm the addition and allow the server to process it
    await regulatoryWatch.clickConfirmAddButton();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Wait for toast "Regulations added successfully" to appear and disappear
    await regulatoryWatch.waitForRegulationsAddedToast();
    // Allow the Active tab count to refresh after the addition
    await regulatoryWatch.page.waitForTimeout(10000);

    // Verify the Active tab count equals the number of added regulations
    await regulatoryWatch.verifyActiveTabCount(limit);
  });

  test("RW-04 | Deactivate the selected Regulations - Monitoring", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Retrieve the client created in the first test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch > Monitoring
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(30000);

    await regulatoryWatch.clickMonitoring();
    await regulatoryWatch.page.waitForTimeout(15000);

    // Wait for the monitoring page to fully load before reading the count
    await regulatoryWatch.page.waitForTimeout(60000);

    // Get the initial total count of regulations
    const initialCount = await regulatoryWatch.getMonitoringTotalCount();

    // Select the first regulation from the monitoring table
    await regulatoryWatch.selectFirstRegulationInMonitoring();

    // Click the delete (deactivate) button
    await regulatoryWatch.clickDeleteButton();

    // Verify the "DEACTIVATE REGULATION" modal appears
    await regulatoryWatch.verifyDeactivateRegulationModal();

    // Click the DEACTIVATE confirm button
    await regulatoryWatch.clickDeactivateButton();

    // Wait for "Deactivated successfully" toast to appear and disappear
    await regulatoryWatch.waitForDeactivatedSuccessfullyToast();
    // Allow the total count to refresh after deactivation
    await regulatoryWatch.page.waitForTimeout(10000);

    // Verify the total count has decreased by 1
    await regulatoryWatch.verifyMonitoringTotalCount(initialCount - 1);

    // Open the Add Regulation library modal and wait for it to load
    await regulatoryWatch.clickAddRegulationButton();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Switch to the Active tab inside the modal
    await regulatoryWatch.clickActiveTab();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Capture the current Active tab count before deactivating
    const activeCountBefore = await regulatoryWatch.getActiveTabCount();

    // Select a random regulation from the Active tab table
    await regulatoryWatch.selectRandomRegulationInActiveTab();

    // Click the Deactivate action button on the Active tab
    await regulatoryWatch.clickActiveTabDeactivateButton();

    // Verify the "DEACTIVATE REGULATION" confirmation modal appears
    await regulatoryWatch.verifyDeactivateRegulationModal();

    // Click the DEACTIVATE confirm button
    await regulatoryWatch.clickDeactivateButton();

    // Wait for "Deactivated successfully" toast to appear and disappear
    await regulatoryWatch.waitForDeactivatedSuccessfullyToast();
    // Allow the Active tab count to refresh after deactivation
    await regulatoryWatch.page.waitForTimeout(10000);

    // Verify the Active tab count has decreased by 1
    await regulatoryWatch.verifyActiveTabCount(activeCountBefore - 1);
  });

  test("RW-05 | Reactivate the deactivated Regulations - Monitoring", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // Retrieve the client created in the first test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch > Monitoring
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(30000);

    await regulatoryWatch.clickMonitoring();
    await regulatoryWatch.page.waitForTimeout(15000);

    // Open the Add Regulation library modal and wait for it to load
    await regulatoryWatch.clickAddRegulationButton();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Capture Active tab count before reactivation
    const activeCountBefore = await regulatoryWatch.getActiveTabCount();

    // Switch to the Removed tab and capture its count
    await regulatoryWatch.clickRemovedTab();
    await regulatoryWatch.page.waitForTimeout(5000);
    const removedCountBefore = await regulatoryWatch.getRemovedTabCount();

    // Select a random regulation from the Removed tab table
    await regulatoryWatch.selectRandomRegulationInRemovedTab();

    // Click the Reactivate action button
    await regulatoryWatch.clickReactivateButton();

    // Verify the "REACTIVATE REGULATION" confirmation modal appears
    await regulatoryWatch.verifyReactivateRegulationModal();

    // Click the REACTIVATE confirm button
    await regulatoryWatch.clickReactivateConfirmButton();

    // Wait for "Reactivated successfully" toast to appear and disappear
    await regulatoryWatch.waitForReactivatedSuccessfullyToast();
    // Allow the tab counts to refresh after reactivation
    await regulatoryWatch.page.waitForTimeout(10000);

    // Verify Removed tab count decreased by 1
    await regulatoryWatch.verifyRemovedTabCount(removedCountBefore - 1);

    // Verify Active tab count increased by 1
    await regulatoryWatch.verifyActiveTabCount(activeCountBefore + 1);
  });

  test("RW-06 | Regulation Comments - Monitoring", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // Retrieve the client created in the first test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch > Monitoring
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(30000);

    await regulatoryWatch.clickMonitoring();
    await regulatoryWatch.page.waitForTimeout(15000);

    // Click on the first regulation to expand its details and wait for the
    // sidebar panel to fully render
    await regulatoryWatch.clickFirstMonitoringRegulationRow();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Add a random comment
    const randomComment = `Test comment ${Date.now()}`;
    await regulatoryWatch.addComment(randomComment);

    // Wait for "Comment added successfully" toast to appear and disappear
    await regulatoryWatch.waitForCommentAddedToast();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Verify the comment is visible in the comments list
    await regulatoryWatch.verifyCommentVisible(randomComment);
  });

  test("RW-07 | Download document overview - Monitoring", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // Retrieve the client created in the first test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch > Monitoring
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(30000);

    await regulatoryWatch.clickMonitoring();
    await regulatoryWatch.page.waitForTimeout(15000);

    // Click on the first regulation to expand its details and wait for the
    // sidebar panel to fully render
    await regulatoryWatch.clickFirstMonitoringRegulationRow();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Click on the Overview tab in the sidebar and wait for content to load
    await regulatoryWatch.clickOverviewSidebarTab();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Click the download button
    await regulatoryWatch.clickDocxDownloadButton();

    // Wait for "File Downloaded" toast to appear and disappear
    await regulatoryWatch.waitForFileDownloadedToast();
  });

  // test("RW-08 | All Flag Insights display verification", async () => {
  //   test.setTimeout(TIMEOUTS.LONG);

  //   // Retrieve the client created in the first test
  //   const clientName = TestData.getKey(
  //     FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
  //     TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
  //   );

  //   // Search for the client and click on it
  //   await managementPage.searchClient(clientName);
  //   await managementPage.verifyClientInList(clientName);
  //   await managementPage.clickClientCard(clientName);
  //   await managementPage.waitForSpinner();
  //   await regulatoryWatch.page.waitForTimeout(5000);

  //   // Navigate to Regulatory Watch (lands on Overview) and wait for the
  //   // Overview page metrics and charts to fully load
  //   await regulatoryWatch.clickRegulatoryWatchMenu();
  //   await regulatoryWatch.page.waitForTimeout(60000);

  //   // Get the flagged count from the Overview metrics section
  //   const flaggedCount = await regulatoryWatch.getFlaggedCount();
  //   console.log(`Flagged count from Overview: ${flaggedCount}`);

  //   // Click on History Insights and wait for insight data to load
  //   await regulatoryWatch.clickHistoryInsights();
  //   await regulatoryWatch.page.waitForTimeout(15000);

  //   // Click on the date range dropdown (currently showing "Last 14 days")
  //   await regulatoryWatch.clickDateRangeButton();

  //   // Verify the dropdown is visible
  //   await regulatoryWatch.verifyDateRangeDropdownVisible();

  //   // Click on "Last 30 days" and wait for the insight cards to reload
  //   await regulatoryWatch.selectDateRangeOption("Last 30 days");
  //   await regulatoryWatch.page.waitForTimeout(15000);

  //   // Verify insight cards are displayed on the screen
  //   await regulatoryWatch.verifyInsightCardsDisplayed();

  //   // Click the flag icon on every insight card and capture how many were flagged
  //   const flaggedCardsCount = await regulatoryWatch.clickFlagIconOnAllCards();
  //   console.log(`Total cards flagged: ${flaggedCardsCount}`);

  //   // Navigate back to Overview (clickOverview includes a 2-minute wait
  //   // internally for the Overview page to render its metrics)
  //   await regulatoryWatch.clickOverview();

  //   // Verify the Flagged metric on Overview equals the number of cards we flagged
  //   await regulatoryWatch.verifyFlaggedCount(flaggedCardsCount);

  //   // Verify the New Insights section shows the same number of cards
  //   await regulatoryWatch.verifyOverviewNewInsightsCount(flaggedCardsCount);
  // });

  test("RW-09 | Regulation Domains - Overview", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Retrieve the client created in the first test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch (lands on Overview) and wait 1 minute for
    // the Overview page and its charts to fully load before interacting.
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(60000);

    // Click the chart settings icon on the Overview page
    await regulatoryWatch.clickChartSettingsIcon();

    // Verify the domain list is visible
    await regulatoryWatch.verifyDomainListVisible();

    // Uncheck previously selected domains and select up to 4 random ones
    const selectedDomains = await regulatoryWatch.selectRandomDomains(4);
    console.log(`Selected domains: ${selectedDomains.join(", ")}`);

    // Click the SAVE button
    await regulatoryWatch.clickDomainSaveButton();

    // Wait 2 minutes for the chart to update
    await regulatoryWatch.page.waitForTimeout(90000);

    // Verify the chart is rendered with the updated domain selection
    await regulatoryWatch.verifyOverviewChart();
  });

  test("RW-10 | Update status - Overview", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // Retrieve the client created in the first test
    const clientName = TestData.getKey(
      FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
    );

    // Search for the client and click on it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await regulatoryWatch.page.waitForTimeout(5000);

    // Navigate to Regulatory Watch (lands on Overview) and wait 1 minute
    // for the page and metrics to fully load before interacting.
    await regulatoryWatch.clickRegulatoryWatchMenu();
    await regulatoryWatch.page.waitForTimeout(60000);

    // Capture the current Critical count from the metrics section
    const initialCriticalCount = await regulatoryWatch.getCriticalCount();
    console.log(`Initial critical count: ${initialCriticalCount}`);

    // Click the edit icon on the first insight card
    await regulatoryWatch.clickFirstInsightCardEditIcon();

    // Open the status dropdown on the card now in edit mode
    await regulatoryWatch.clickInsightStatusDropdown();

    // Select "Critical" from the dropdown options
    await regulatoryWatch.selectStatusOption("Critical");

    // Save the change
    await regulatoryWatch.clickInsightSaveButton();

    // Wait for "Changes saved" toast to appear and disappear
    await regulatoryWatch.waitForChangesSavedToast();
    // Allow the Critical metric counter to refresh after the save
    await regulatoryWatch.page.waitForTimeout(10000);

    // Verify the Critical metric count has incremented by 1
    await regulatoryWatch.verifyCriticalCount(initialCriticalCount + 1);
  });

  // test("RW-11 | Filters - History Insight", async () => {
  //   test.setTimeout(TIMEOUTS.MEDIUM);

  //   // Retrieve the client created in the first test
  //   const clientName = TestData.getKey(
  //     FILE_KEYS.REGULATORY_WATCH_CLIENT_NAME,
  //     TEST_DATA_FILE_ENUMS.REGULATORY_WATCH,
  //   );

  //   // Search for the client and click on it
  //   await managementPage.searchClient(clientName);
  //   await managementPage.verifyClientInList(clientName);
  //   await managementPage.clickClientCard(clientName);
  //   await managementPage.waitForSpinner();
  //   await regulatoryWatch.page.waitForTimeout(5000);

  //   // Navigate to Regulatory Watch (lands on Overview) and wait for the page
  //   // to fully load before navigating further
  //   await regulatoryWatch.clickRegulatoryWatchMenu();
  //   await regulatoryWatch.page.waitForTimeout(60000);

  //   // Navigate to History Insights and wait for the insight cards to render
  //   await regulatoryWatch.clickHistoryInsights();
  //   await regulatoryWatch.page.waitForTimeout(15000);

  //   // Read card data before applying any filter so we have a baseline
  //   const initialCardsData = await regulatoryWatch.getHistoryInsightCardsData();
  //   console.log(`Cards before filtering: ${initialCardsData.length}`);

  //   // Open the filter panel
  //   await regulatoryWatch.clickHistoryInsightsFilterButton();

  //   // Verify the filter panel is visible
  //   await regulatoryWatch.verifyHistoryInsightsFilterPanelVisible();

  //   // Select random filters (up to 3 sections, one option each)
  //   const selectedFilters =
  //     await regulatoryWatch.selectRandomHistoryInsightsFilters();
  //   console.log(`Applied filters: ${JSON.stringify(selectedFilters)}`);

  //   // Click the FILTER apply button in the panel footer to apply the selection
  //   // and close the panel
  //   await regulatoryWatch.clickHistoryInsightsFilterApplyButton();
  //   await regulatoryWatch.page.waitForTimeout(3000);

  //   // Verify results — either filtered cards are shown or the no-data message
  //   // is displayed; both outcomes are valid depending on available data
  //   await regulatoryWatch.verifyHistoryInsightsFilteredResults();
  // });
});
