const { test, expect } = require("@playwright/test");
const path = require("path");
const TestData = require("../../../constant/testData");
const ArtifactRegistry = require("../../../pages/Beacher/Application/ArtifactRegistry");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const { FILE_KEYS, TEST_DATA_FILE_ENUMS } = require("../../../constant/enums");

// Scope this spec's test data to the Beacher app (testData/Beacher/).
process.env.APP = "Beacher";

const BEACHER_ARTIFACT = TEST_DATA_FILE_ENUMS.BEACHER_ARTIFACT_QUESTION;

// Creates a brand-new Beacher entity via the New Entity wizard so this spec is
// self-contained and does not depend on the wizard/score-calculation spec
// having run first. Returns the unique client name that was created.
async function createBeacherClient(page) {
  const wizard = new Wizard(page);

  await wizard.goto("/clients");
  await wizard.waitForSpinner();

  // Step 1 - Organizational/General.
  await wizard.clickNewButton();
  await wizard.waitForWizardModal();
  const clientName = await wizard.enterUniqueClientName("Beacher_Artifact");
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

test.describe.serial("Beacher Artifact Registry", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let artifactRegistry;

  test.beforeEach(async ({ page }, testInfo) => {
    artifactRegistry = new ArtifactRegistry(page);

    // The setup test (BAR - 00) creates a fresh client every run. Skip the
    // search/navigation for it (there is nothing to open yet) based on the test
    // title, so a new wizard is always created regardless of any stored data.
    if (testInfo.title.includes("BAR - 00")) return;

    // For every other test: search the client created in setup and navigate
    // straight to its Artifact Registry screen.
    const clientName = TestData.getKey(
      FILE_KEYS.WIZARD_CLIENT_NAME,
      BEACHER_ARTIFACT,
    );
    const scoreCalculation = new ScoreCalculation(page);
    await scoreCalculation.goto("/clients");
    await scoreCalculation.waitForSpinner();
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();

    const uuids = fetchPageURL(page.url());
    const entityID = uuids[0];
    if (!entityID) {
      throw new Error(
        `Could not resolve the Beacher entity id from URL: ${page.url()}`,
      );
    }
    console.log("using client ID ", entityID);

    await artifactRegistry.goto(
      `/first-party/${entityID}/collection/artifacts-registry`,
    );
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  test("BAR - 00 | @regression Setup: create a fresh Beacher client via the wizard", async ({
    page,
  }) => {
    test.setTimeout(600000);

    // Always create a brand-new client so the suite runs independently.
    const clientName = await createBeacherClient(page);
    TestData.setKey(FILE_KEYS.WIZARD_CLIENT_NAME, clientName, BEACHER_ARTIFACT);
  });

  test("BAR - 01 | @regression Verify No Artifact Found text on the screen", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await artifactRegistry.verifyNoArtifactsFound();
  });

  test("BAR - 02 | @regression Upload artifact from filesTest folder", async ({
    page,
  }) => {
    test.setTimeout(600000);
    const filePath = path.join(process.cwd(), "filesTest/Files/testFile.pdf");
    await artifactRegistry.uploadArtifact(filePath);
    await artifactRegistry.verifyUploadedFile("testFile.pdf");
  });

  test("BAR - 03 | @regression Verify delete artifact", async ({ page }) => {
    test.setTimeout(600000);
    await artifactRegistry.deleteFirstArtifact();
  });

  test("BAR - 04 | @regression Verify uploaded artifact in linked artifact on question", async ({
    page,
  }) => {
    test.setTimeout(600000);

    // 1. Upload an artifact first to ensure we have data
    const filePath = path.join(process.cwd(), "filesTest/Files/testFile.pdf");
    await artifactRegistry.uploadArtifact(filePath);
    await artifactRegistry.verifyUploadedFile("testFile.pdf");

    // 2. Get artifact names from Registry
    const artifactNames = await artifactRegistry.getArtifactNames();
    console.log("Artifact Names from Registry:", artifactNames);

    // 3. Open application and navigate to question upload
    await artifactRegistry.openApplication();
    await artifactRegistry.clickFirstQuestionUploadIcon();

    // 4. Get artifact names from Side Registry
    const sideArtifactNames =
      await artifactRegistry.getSideRegistryArtifactNames();
    console.log("Artifact Names from Side Registry:", sideArtifactNames);

    // 5. Verification: Check if uploaded artifact is present in side registry
    expect(sideArtifactNames).toContain("testFile.pdf");
  });

  test("BAR - 05 | @regression Verify artifact selection from question", async ({
    page,
  }) => {
    test.setTimeout(600000);
    await artifactRegistry.openApplication();
    const questionDetails = await artifactRegistry.getQuestionDetails();

    TestData.setKey(
      FILE_KEYS.QUESTION_DETAILS_DATA,
      questionDetails,
      BEACHER_ARTIFACT,
    );
    console.log("Saved question details using TestData helper");

    const linkedArtifactName = await artifactRegistry.linkRandomArtifact();

    await artifactRegistry.navigateToArtifactRegistryFromSideMenu();
    await artifactRegistry.clickArtifactByName(linkedArtifactName);
    await artifactRegistry.verifyLinkedQuestionDetails(questionDetails);
  });
});
