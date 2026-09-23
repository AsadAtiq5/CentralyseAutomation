const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../pages/Secure/ManagementPage");
const AddClientPage = require("../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../pages/Secure/AddEntityPage");
const TestData = require("../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  SCORE_BASE,
} = require("../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
  console.log("storageStatePath");
}

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 180000,
  DEFAULT: 60000,
};

const TEST_DATA = {
  CLIENT_PREFIX: "Client",
  ENTITY_PREFIX: "Entity",
  UPDATED_CLIENT_PREFIX: "UpdatedClient",
  DEFAULT_FIRST_PARTY_URL: "",
};

test.describe("Add Client Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  async function createAndSaveClientName(prefix = TEST_DATA.CLIENT_PREFIX) {
    const clientName = await addClientPage.createUniqueClientName(prefix);
    TestData.setKey(
      FILE_KEYS.ROOT_ENTITY_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    return clientName;
  }

  async function openAddClientPopup() {
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
  }

  async function fillBasicClientInfo(
    firstPartyUrl = TEST_DATA.DEFAULT_FIRST_PARTY_URL,
  ) {
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(firstPartyUrl);
  }

  async function searchAndClickClient(clientName) {
    await managementPage.searchClient(clientName);
    await managementPage.clickClientCard(clientName);
  }

  async function createEntityAndVerifyRisks(
    selectedRisks,
    selectedCustomRisks,
  ) {
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA.ENTITY_PREFIX,
    );
    await addEntityPage.clickNextButtonIfVisible();
    await addEntityPage.verifyMultiEntityRisks(
      selectedRisks,
      selectedCustomRisks,
      TIMEOUTS.DEFAULT,
    );
  }

  test("AC - 01 | @smoke Add Client with all risks and compliance frameworks", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    console.log("Opening Add Client popup...");
    await openAddClientPopup();
    const clientName = await createAndSaveClientName();
    console.log(`Generated Client Name: ${clientName}`);
    await fillBasicClientInfo();
    console.log("Filling basic client info...");
    await addClientPage.clickAddClientButton();
    console.log("Clicked Add Client button. Verifying in list...");
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    console.log("Client successfully verified in list.");
  });

  test("AC - 02 | @smoke Add Client with all risks and compliance framework and 0-5 score base", async () => {
    test.setTimeout(6000000);
    console.log("Opening Add Client popup...");
    await openAddClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("ClientScore");
    console.log(`Generated Client Name: ${clientName}`);
    await fillBasicClientInfo();
    console.log("Filling basic client info...");
    await addClientPage.selectScoringBase(SCORE_BASE.ONE_TO_FIVE);
    await addClientPage.clickAddClientButton();
    console.log("Clicked Add Client button. Verifying in list...");
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    console.log("Client successfully verified in list.");
  });

  test("AC - 03 | @regression Verify selected risks and compliances display on the client displays on the multientity", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await openAddClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await fillBasicClientInfo();
    await addClientPage.unselectAllRisksInClientPopup();
    const selectedRisks = await addClientPage.randomSelectRisksInAddClient(
      TIMEOUTS.DEFAULT,
    );
    console.log("Selected Risks:", selectedRisks);
    await addClientPage.clickComplianceTab();
    await addClientPage.unselectAllRisksInClientPopup();
    const selectedCompliances =
      await addClientPage.randomSelectRisksInAddClient(TIMEOUTS.DEFAULT);
    console.log("Selected Compliances:", selectedCompliances);
    await addClientPage.clickAddClientButton();
    await page.waitForTimeout(2000);
    await searchAndClickClient(clientName);
    await managementPage.waitForSpinner();
    await page.waitForTimeout(2000);
    await createEntityAndVerifyRisks(selectedRisks, []);
    await addEntityPage.clickComplianceSubtab();
    await addEntityPage.verifyMultiEntityCompliances(
      selectedCompliances,
      [],
      TIMEOUTS.DEFAULT,
    );
  });

  test.skip("AC - 04 | @regression Add client wiht 1st party only", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await openAddClientPopup();
    const clientName = await createAndSaveClientName();
    await addClientPage.selectIndustry();
    await addClientPage.selectThirdParty();
    await addClientPage.selectBroadview();
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await managementPage.verifyThirdPartyMenuButtonIsDisabled(TIMEOUTS.DEFAULT);
    await managementPage.verifyBoardviewMenuButtonIsDisabled(TIMEOUTS.DEFAULT);
  });

  test.skip("AC - 04 | @regression Add client wiht 3rd party only", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await addClientPage.selectIndustry();
    await addClientPage.selectFirstPartyFull();
    await addClientPage.clickAddClientButton();
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await managementPage.verifyFirstPartyMenuButtonIsDisabled(TIMEOUTS.DEFAULT);
    await managementPage.verifyBoardviewMenuButtonIsDisabled(TIMEOUTS.DEFAULT);
  });

  test.skip("AC - 05 | @regression Add client with broadview only", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await addClientPage.selectIndustry();
    await addClientPage.selectThirdParty();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    await managementPage.verifyThirdPartyMenuButtonIsDisabled(TIMEOUTS.DEFAULT);
  });

  test("AC - 06 | @regression Add client wiht Policy Managementsolutions", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await openAddClientPopup();
    const clientName = await addClientPage.createUniqueClientName("Client");
    await addClientPage.selectIndustry();
    await addClientPage.selectPolicyManagement();
    await addClientPage.selectThirdParty();
    await addClientPage.selectBroadview();
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    TestData.setKey(
      FILE_KEYS.ROOT_ENTITY_POLICY_MANAGEMENT,
      clientName,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
    await managementPage.clickClientCard(clientName);
    await managementPage.waitForSpinner();
    // await managementPage.verifyThirdPartyMenuButtonIsDisabled(TIMEOUTS.DEFAULT);
    // await managementPage.verifyBoardviewMenuButtonIsDisabled(TIMEOUTS.DEFAULT);
    await managementPage.clickPolicyManagementButton();
    await managementPage.waitForSpinner();
    await managementPage.verifyUrlContains("/policies", TIMEOUTS.DEFAULT);
  });

  test("AC - 10 | @regression Required fields validation blocks client creation", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await openAddClientPopup();
    // Attempt to create without entering Client Name or Industry
    await addClientPage.clickAddClientButton();
    // App shows validation toasts and keeps the popup open
    await addClientPage.verifyRequiredFieldValidation(TIMEOUTS.DEFAULT);
    await addClientPage.verifyClientPopup();
  });

  test("AC - 11 | @regression Add client selecting a specific industry", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await openAddClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("IndustryClient");
    await addClientPage.selectIndustryByName("FINANCIAL SERVICES");
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);
  });

  test("AC - 12 | @regression Creating a client without a Risk framework is blocked", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await openAddClientPopup();
    await addClientPage.createUniqueClientName("NoRiskClient");
    await fillBasicClientInfo();
    // Deselect every Risk framework, then attempt to create the client
    await addClientPage.unselectAllRisksInClientPopup();
    await addClientPage.clickAddClientButton();
    // App requires at least one Risk framework and keeps the popup open
    await addClientPage.verifyRiskFrameworkRequiredValidation(TIMEOUTS.DEFAULT);
    await addClientPage.verifyClientPopup();
  });

  test("AC - 13 | @regression Cancel discards the new client without creating it", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await openAddClientPopup();
    const clientName =
      await addClientPage.createUniqueClientName("CancelClient");
    // Close the popup instead of saving
    await addClientPage.clickModalCloseButton();
    await addClientPage.verifyClientPopupClosed(TIMEOUTS.DEFAULT);
    // The client should not exist in the list
    await managementPage.searchClient(clientName);
    await managementPage.verifyNoEntitiesFoundText(TIMEOUTS.DEFAULT);
  });

  test("AC - 14 | @regression Logo client displays the logo on its client card", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);
    const logoPath = path.join(process.cwd(), "filesTest/Images/testImage.png");
    await openAddClientPopup();
    const clientName = await addClientPage.createUniqueClientName("LogoClient");
    await addClientPage.selectIndustry();
    // Upload the logo and confirm the preview renders in the popup
    await addClientPage.uploadClientLogo(logoPath);
    await addClientPage.verifyLogoPreviewVisible(TIMEOUTS.DEFAULT);
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    // Create the client
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await page.waitForTimeout(3000);
    // Logo clients render the logo image on the card instead of the name text, and
    // the search results can take time to appear, so verifyClientCardLogo polls for it
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientCardLogo(clientName, TIMEOUTS.LONG);
  });

  test("AC - 15 | @regression Duplicate client names are allowed", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);
    // Create the first client and capture its name
    await openAddClientPopup();
    const clientName = await addClientPage.createUniqueClientName("DupClient");
    await fillBasicClientInfo();
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await managementPage.searchClient(clientName);
    await managementPage.verifyClientInList(clientName);

    // Create a second client using the exact same name
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await openAddClientPopup();
    await addClientPage.enterClientName(clientName);
    await fillBasicClientInfo();
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // Both clients with the same name should be present
    await managementPage.searchClient(clientName);
    const cardCount = await managementPage.getClientCardCount(
      clientName,
      TIMEOUTS.DEFAULT,
    );
    expect(cardCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe("Update Client Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;

  async function openEditClientPopup(clientName) {
    await managementPage.searchClient(clientName);
    await managementPage.clickEditIcon(clientName);
    await managementPage.clickClientCard(clientName);
    await addClientPage.verifyEditClientPopup();
  }

  async function saveAndCloseEditPopup() {
    await addClientPage.clickSaveButton();
    await managementPage.waitForHidden(
      "#toast-container .toast-message",
      TIMEOUTS.DEFAULT,
    );
    await addClientPage.clickCrossButton();
  }

  async function searchAndClickClient(clientName) {
    await managementPage.searchClient(clientName);
    await managementPage.clickClientCard(clientName);
  }

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("AC - 07 | @regression Verify edit client screen is visible", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await managementPage.waitForSpinner();

    // Create a dedicated client for all edit/delete tests and save under EDIT_CLIENT_NAME
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const editClientName =
      await addClientPage.createUniqueClientName("EditClient");
    TestData.setKey(
      FILE_KEYS.EDIT_CLIENT_NAME,
      editClientName,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();

    await openEditClientPopup(editClientName);
  });

  test("AC - 08 | @regression Edit client Name", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await managementPage.waitForSpinner();

    const editClientName = TestData.getKey(
      FILE_KEYS.EDIT_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await openEditClientPopup(editClientName);
    const updatedClientName = await addClientPage.createUniqueClientName(
      TEST_DATA.UPDATED_CLIENT_PREFIX,
    );
    // Save the updated name back under EDIT_CLIENT_NAME so the delete test can find it
    TestData.setKey(
      FILE_KEYS.EDIT_CLIENT_NAME,
      updatedClientName,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await addClientPage.updateClientName(updatedClientName);
    await addClientPage.changeSolutionSelection();
    const expectedStatus = await addClientPage.checkSolutionStatus();
    await saveAndCloseEditPopup();
    await searchAndClickClient(updatedClientName);
    // await managementPage.waitForSpinner();
    // await addClientPage.verifySolutionSelectionOnClientDetailPage(managementPage, expectedStatus, TIMEOUTS.DEFAULT);
  });

  test("AC - 09 | @regression Verify client is sucessfully deleted", async () => {
    test.setTimeout(TIMEOUTS.SHORT);
    await managementPage.waitForSpinner();

    const editClientName = TestData.getKey(
      FILE_KEYS.EDIT_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.ENTITY,
    );
    await managementPage.searchClient(editClientName);
    await managementPage.clickEditIcon(editClientName);
    await managementPage.clickClientCard(editClientName);
    await addClientPage.clickDeleteClientButton();
    await addClientPage.enterDeleteConfirmation();
    await addClientPage.clickConfirmButton();
    await managementPage.waitForSpinner();
    await managementPage.searchClient(editClientName);
    await managementPage.verifyNoEntitiesFoundText(TIMEOUTS.DEFAULT);
  });
});
