const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RemediationPage = require("../../../pages/Secure/RemediationPage");
const RemediationSimulationPage = require("../../../pages/Secure/RemediationSimulation/RemediationSimulationPage");
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
  CLIENT_PREFIX: "RS",
  ENTITY_PREFIX: "RSEntity",
  DEFAULT_FIRST_PARTY_URL: "",
};

test.describe("Remediation Simulation Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let remediationPage;
  let remediationSimulationPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    remediationPage = new RemediationPage(page);
    remediationSimulationPage = new RemediationSimulationPage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
  });

  test("RS-01 | @regression Setup - create client, add BEC entity, answer No, capture framework score", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Create a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName(
      TEST_DATA.CLIENT_PREFIX,
    );
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SIM_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.REMEDIATION_SIMULATION,
    );
    console.log(`✔ Created client name: ${clientName}`);
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl(TEST_DATA.DEFAULT_FIRST_PARTY_URL);
    await addClientPage.clickAddClientButton();
    await addClientPage.waitForToast();
    await addClientPage.waitForSpinner();
    await page.waitForTimeout(3000);

    // 2) Search for client and open it
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(3000);

    // 3) Navigate to Multi Entity and add a new entity with Business Email Compromise risk framework
    await addEntityPage.clickMultiEntitySidebar();
    await addEntityPage.clickNewEntity();
    const entityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA.ENTITY_PREFIX,
    );
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SIM_ENTITY_NAME,
      entityName,
      TEST_DATA_FILE_ENUMS.REMEDIATION_SIMULATION,
    );
    console.log(`✔ Created entity name: ${entityName}`);
    await addEntityPage.addEntityWithBusinessEmailCompromiseUserBased();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);
    await page.waitForTimeout(3000);

    // 4) Open the collection for this entity and answer No to all questions
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await remediationPage.clickOpenCollectionBtn();
    const total = await remediationPage.getNoRadioButtonCount();
    console.log(`📋 Total questions to answer No: ${total}`);
    expect(total).toBeGreaterThan(0);
    await remediationPage.answerAllNoQuestions(total);

    // 5) Navigate back to the collection list and capture the framework card score
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await page.waitForTimeout(5000);
    const { frameworkName, frameworkScore } =
      await remediationSimulationPage.getFirstFrameworkCardInfo(0);

    TestData.setKey(
      FILE_KEYS.REMEDIATION_SIM_FRAMEWORK_NAME,
      frameworkName,
      TEST_DATA_FILE_ENUMS.REMEDIATION_SIMULATION,
    );
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SIM_FRAMEWORK_SCORE,
      frameworkScore,
      TEST_DATA_FILE_ENUMS.REMEDIATION_SIMULATION,
    );
  });

  test("RS-02 | @regression Verify Remediation Simulation projected score matches reassessed framework score", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientName = TestData.getKey(
      FILE_KEYS.REMEDIATION_SIM_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.REMEDIATION_SIMULATION,
    );
    const entityName = TestData.getKey(
      FILE_KEYS.REMEDIATION_SIM_ENTITY_NAME,
      TEST_DATA_FILE_ENUMS.REMEDIATION_SIMULATION,
    );
    console.log(`▶ Using client: ${clientName} | entity: ${entityName}`);

    // 1) Search and open the client created in RS-01
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(3000);

    // 2) Navigate into the entity context via Collection
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await page.waitForTimeout(3000);

    // 3) Open Remediation from the side menu
    await remediationPage.clickRemediationButton();
    await remediationPage.waitForSpinner();
    await page.waitForTimeout(3000);

    // 4) Click the Select All checkbox
    await remediationSimulationPage.clickSelectAllCheckbox();
    await page.waitForTimeout(2000);

    // 5) Click Simulate Remediation
    await remediationSimulationPage.clickSimulateRemediationButton();

    // 6) Wait for the simulation to complete
    await page.waitForTimeout(60000);

    // 7) Capture and save the projected score
    const projectedScore = await remediationSimulationPage.getProjectedScore();
    TestData.setKey(
      FILE_KEYS.REMEDIATION_SIM_PROJECTED_SCORE,
      projectedScore,
      TEST_DATA_FILE_ENUMS.REMEDIATION_SIMULATION,
    );
    console.log(`✔ Saved Projected Score: ${projectedScore}`);

    // 8) Open the collection from the side menu and answer Yes to all questions
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await remediationPage.clickOpenCollectionBtn();
    const totalYes = await remediationPage.getYesRadioButtonCount();
    console.log(`📋 Total questions to answer Yes: ${totalYes}`);
    expect(totalYes).toBeGreaterThan(0);
    await remediationPage.answerAllYesQuestions(totalYes);

    // 9) Go back to collection list, fetch the framework card score and compare
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(entityName);
    await page.waitForTimeout(5000);
    const { frameworkScore: actualScore } =
      await remediationSimulationPage.getFirstFrameworkCardInfo(0);

    console.log(
      `🔎 Projected Score: ${projectedScore} | Actual Score: ${actualScore}`,
    );
    expect(actualScore).toBe(projectedScore);
  });
});
