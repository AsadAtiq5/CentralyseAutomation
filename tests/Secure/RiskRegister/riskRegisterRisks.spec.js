const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const RiskRegisterRisks = require("../../../pages/Secure/RiskRegister/RiskRegisterRisks");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");
const {
  calculateRiskResidual,
  calculateFinancialResidual,
} = require("../../../helpers/riskRegister/calculateRiskHelper");
const {
  getAssociatedRiskCount,
} = require("../../../helpers/riskRegister/riskGroupHelper");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Risk Register Risks", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let riskRegisterRisks;
  let collectionPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    riskRegisterRisks = new RiskRegisterRisks(page);
    collectionPage = new CollectionPage(page);

    await addClientPage.goto("/clients");
  });

  test("RRR - 00 | Setup - Create client and multientity with risk", async ({
    page,
  }) => {
    test.setTimeout(600000);

    await managementPage.clickAddClientButton();
    const clientName = await addClientPage.createUniqueClientName("RRR");

    TestData.setKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl();
    await addClientPage.clickAddClientButton();
    await page.waitForTimeout(3000);

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);

    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);

    const subEntityName = await addEntityPage.createUniqueEntityName(
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const selectedRisk = await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);

    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await riskRegisterRisks.waitForMultiEntityCreatedToast();
    await addEntityPage.verifyEntityInList(subEntityName);
    await page.waitForTimeout(2000);

    TestData.setKey(
      "subEntityName",
      subEntityName,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    TestData.setKey(
      "selectedRisk",
      selectedRisk,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Navigate to collection and answer all questions
    await addEntityPage.navigateToCollection();
    await addEntityPage.selectEntityAndNavigate(subEntityName);
    await collectionPage.getFrameworkName(0);

    const answers = await riskRegisterRisks.answerAllQuestions();

    TestData.setKey(
      "collectionAnswers",
      answers,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
  });

  test("RRR - 01 | @smoke verify risk should be visible after creating sub entity", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    let rowCount = await riskRegisterRisks.getTableRowsCount();

    expect(rowCount).toBeGreaterThan(0);
  });

  test("RRR - 02 | @regression Verify risk count from backend", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const selectedRisk = TestData.getKey(
      "selectedRisk",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Get the Total count from the UI filter badge
    const uiTotal = await riskRegisterRisks.getSeverityCount("Total");

    // Get the risk count from the backend S3 template
    const backendTotal = await getAssociatedRiskCount([selectedRisk]);

    console.log(
      `Risk count → UI: ${uiTotal} | Backend: ${backendTotal} | Framework: ${selectedRisk}`,
    );

    expect(uiTotal).toBe(backendTotal);
  });

  test("RRR - 03 | @regression Add Automatic Risk", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to the risk register risks screen
    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Open the New Risk popup on the Automatic tab, ensuring the controls table
    // is populated (it renders empty if the popup mounts before the entity's
    // controls have finished loading)
    await riskRegisterRisks.openAutomaticRiskPopupWithControls();

    // Enter a unique risk name and save it
    const automaticRiskName =
      await riskRegisterRisks.createUniqueRiskName("RA");
    TestData.setKey(
      "automaticRiskName",
      automaticRiskName,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Select 2 random controls, capture id/name/impact/probability per control
    const selectedControls =
      await riskRegisterRisks.selectRandomControlsFromPopup(2);
    TestData.setKey(
      "selectedControls",
      selectedControls,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Select a random Impact and save the selection
    const selectedImpact = await riskRegisterRisks.selectRandomImpact();
    TestData.setKey(
      "automaticRiskImpact",
      selectedImpact,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Select a random Probability and save the selection
    const selectedProbability =
      await riskRegisterRisks.selectRandomProbability();
    TestData.setKey(
      "automaticRiskProbability",
      selectedProbability,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Save the risk and wait for the popup to close
    await riskRegisterRisks.clickSaveRiskButton();
    await riskRegisterRisks.waitForNewRiskPopupHidden();
    await riskRegisterRisks.waitForRiskCreatedToast();

    // Search for the created risk and verify it appears in the table
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.verifyRiskVisible(automaticRiskName);
  });

  test("RRR - 04 | @regression Verify Effectiveness and Residual", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const automaticRiskName = TestData.getKey(
      "automaticRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const selectedControls = TestData.getKey(
      "selectedControls",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const collectionAnswers = TestData.getKey(
      "collectionAnswers",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const riskImpact = TestData.getKey(
      "automaticRiskImpact",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const riskProbability = TestData.getKey(
      "automaticRiskProbability",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Search for the risk and open it
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
    await page.waitForTimeout(2000);

    // Calculate expected values from stored test data
    const expected = calculateRiskResidual(
      collectionAnswers,
      selectedControls,
      riskImpact,
      riskProbability,
    );

    // Verify effectiveness
    const actualEffectiveness = await riskRegisterRisks.getEffectivenessValue();
    console.log(
      `Effectiveness → expected: ${expected.effectivenessDisplay} | actual: ${actualEffectiveness}`,
    );
    expect
      .soft(actualEffectiveness, `Effectiveness mismatch`)
      .toBe(expected.effectivenessDisplay);

    // Verify residual probability
    const actualResidualProbability =
      await riskRegisterRisks.getResidualProbability();
    console.log(
      `Residual Probability → expected: ${expected.residualProbability} | actual: ${actualResidualProbability}`,
    );
    expect
      .soft(actualResidualProbability, `Residual Probability mismatch`)
      .toBe(expected.residualProbability);

    // Verify residual impact
    const actualResidualImpact = await riskRegisterRisks.getResidualImpact();
    console.log(
      `Residual Impact → expected: ${expected.residualImpact} | actual: ${actualResidualImpact}`,
    );
    expect
      .soft(actualResidualImpact, `Residual Impact mismatch`)
      .toBe(expected.residualImpact);
  });

  test("RRR - 05 | @regression Add Comment to Automatic Risk", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const automaticRiskName = TestData.getKey(
      "automaticRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Search for the risk and open it
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
    await page.waitForTimeout(2000);

    // Click the Comments section
    await riskRegisterRisks.clickCommentsSection();
    await page.waitForTimeout(1000);

    // Add a comment and verify it appears
    const testComment = "This is an automated test comment for automatic risk.";
    await riskRegisterRisks.addComment(testComment);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.verifyComment(testComment);
  });

  test("RRR - 06 | @regression Verify Financial Exposure Calculation", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const automaticRiskName = TestData.getKey(
      "automaticRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Search for the risk and open it
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
    await page.waitForTimeout(2000);

    // Enter edit mode
    await riskRegisterRisks.clickEditRiskButton();

    // Enable Financial Exposure toggle
    await riskRegisterRisks.enableFinancialExposureToggle();

    // Open the Calculator
    await riskRegisterRisks.clickCalculatorButton();
    await page.waitForTimeout(1000);

    // Switch to Basic mode
    await riskRegisterRisks.clickBasicToggle();

    // Set a random Most Likely slider value and save it
    const mostLikelySliderValue =
      await riskRegisterRisks.setBasicMostLikelySlider();
    TestData.setKey(
      "mostLikelySliderValue",
      mostLikelySliderValue,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Capture and store the Primary Loss value
    const primaryLossValue = await riskRegisterRisks.getPrimaryLossValue();
    console.log(`Primary Loss value: ${primaryLossValue}`);
    TestData.setKey(
      "primaryLossValue",
      primaryLossValue,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Save the calculator
    await riskRegisterRisks.clickCalculatorSaveButton();
    await page.waitForTimeout(1000);

    // Save the risk
    await riskRegisterRisks.clickRiskEditSaveButton();

    // Verify the risk updated toast
    await riskRegisterRisks.waitForRiskUpdatedToast();

    // Capture and store the effectiveness value
    const effectivenessValue = await riskRegisterRisks.getEffectivenessValue();
    console.log(
      `Effectiveness after financial exposure: ${effectivenessValue}`,
    );
    TestData.setKey(
      "financialEffectivenessValue",
      effectivenessValue,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Calculate expected financial residual and verify against the UI
    // effectivenessValue is e.g. "13%" → raw 0-10 scale = 13/10 = 1.3
    const effectivenessRaw = Number.parseInt(effectivenessValue, 10) / 10;
    const expectedResidual = calculateFinancialResidual(
      primaryLossValue,
      effectivenessRaw,
    );
    console.log(
      `Financial Residual → expected: $${expectedResidual} | primaryLoss: ${primaryLossValue} | effectiveness: ${effectivenessRaw}`,
    );

    const actualResidualStr =
      await riskRegisterRisks.getFinancialResidualValue();
    const actualResidual = Number.parseFloat(
      actualResidualStr.replace("$", ""),
    );
    console.log(`Financial Residual → actual: ${actualResidualStr}`);

    expect
      .soft(actualResidual, "Financial Residual mismatch")
      .toBeCloseTo(expectedResidual, 0);
  });

  // test("RRR - 07 | @regression Severity count of the risk from backend", async ({
  //   page,
  // }) => {
  //   test.setTimeout(600000);

  //   const clientName = TestData.getKey(
  //     FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
  //     TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
  //   );

  //   await managementPage.searchAndClickClient(clientName);
  //   await page.waitForTimeout(2000);

  //   await riskRegisterRisks.navigateToRiskRegisterRisks();
  //   await riskRegisterRisks.assertRisksTitleVisible();

  //   const severities = ["Total", "Critical", "High", "Medium", "Low"];

  //   for (const severity of severities) {
  //     // Read the count shown in the filter circle before clicking
  //     const expectedCount = await riskRegisterRisks.getSeverityCount(severity);

  //     // Click the filter
  //     await riskRegisterRisks.clickSeverityFilter(severity);

  //     // Count actual table rows (emptyStateCheck has a short timeout and returns 0 for no-data)
  //     const actualCount =
  //       expectedCount > 0
  //         ? await riskRegisterRisks.getTableRowsCount()
  //         : await riskRegisterRisks.emptyStateCheck();

  //     console.log(
  //       `${severity} → expected: ${expectedCount} | actual: ${actualCount}`,
  //     );

  //     expect
  //       .soft(actualCount, `${severity} row count mismatch`)
  //       .toBe(expectedCount);
  //   }
  // });

  // test("RRR - 08 | @regression Escalate the Risk", async ({ page }) => {
  //   test.setTimeout(600000);

  //   const clientName = TestData.getKey(
  //     FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
  //     TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
  //   );
  //   const automaticRiskName = TestData.getKey(
  //     "automaticRiskName",
  //     TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
  //   );

  //   await managementPage.searchAndClickClient(clientName);
  //   await page.waitForTimeout(2000);

  //   await riskRegisterRisks.navigateToRiskRegisterRisks();
  //   await riskRegisterRisks.assertRisksTitleVisible();

  //   // Search for the risk and open it
  //   await riskRegisterRisks.searchRisk(automaticRiskName);
  //   await page.waitForTimeout(2000);
  //   await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
  //   await page.waitForTimeout(2000);

  //   // Click Escalate button
  //   await riskRegisterRisks.clickEscalateButton();

  //   // Fill both escalation reason textareas
  //   await riskRegisterRisks.fillEscalateTextareas(
  //     "Automated escalation reason for testing purposes.",
  //   );

  //   // Select random Impact and Probability from the Inherent section
  //   await riskRegisterRisks.selectEscalateImpact();
  //   await riskRegisterRisks.selectEscalateProbability();

  //   // Save the escalation form
  //   await riskRegisterRisks.clickEscalateFormSaveButton();

  //   // Verify the escalation toast
  //   await riskRegisterRisks.waitForRiskEscalatedToast();

  //   // Verify the risk status is set to Escalated
  //   await riskRegisterRisks.verifyRiskEscalatedStatus();
  // });

  // test("RRR - 09 | @regression De-escalate the Risk", async ({ page }) => {
  //   test.setTimeout(600000);

  //   const clientName = TestData.getKey(
  //     FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
  //     TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
  //   );
  //   const automaticRiskName = TestData.getKey(
  //     "automaticRiskName",
  //     TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
  //   );

  //   await managementPage.searchAndClickClient(clientName);
  //   await page.waitForTimeout(2000);

  //   await riskRegisterRisks.navigateToRiskRegisterRisks();
  //   await riskRegisterRisks.assertRisksTitleVisible();

  //   // Search for the escalated risk and open it
  //   await riskRegisterRisks.searchRisk(automaticRiskName);
  //   await page.waitForTimeout(2000);
  //   await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
  //   await page.waitForTimeout(2000);

  //   // Click De-Escalate button
  //   await riskRegisterRisks.clickDeEscalateButton();

  //   // Add a comment in the de-escalation modal
  //   await riskRegisterRisks.fillDeEscalateComment(
  //     "Automated de-escalation comment for testing purposes.",
  //   );

  //   // Confirm de-escalation
  //   await riskRegisterRisks.clickDeEscalateConfirmButton();

  //   // Verify the de-escalation toast
  //   await riskRegisterRisks.waitForRiskDeEscalatedToast();

  //   await page.waitForTimeout(2000);
  //   await riskRegisterRisks.verifyRiskOpenStatus();
  // });

  test("RRR - 10 | @regression Archive the Automatic risk", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const automaticRiskName = TestData.getKey(
      "automaticRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Search for the automatic risk and open it
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
    await page.waitForTimeout(2000);

    // Click the Archive button
    await riskRegisterRisks.clickArchiveRiskButton();

    // Confirm archiving in the popup
    await riskRegisterRisks.clickArchiveRiskConfirmButton();

    // Verify the archive toast
    await riskRegisterRisks.waitForRiskArchivedToast();

    // Navigate to the Archive sub-section via the side menu
    await riskRegisterRisks.navigateToArchiveRisks();

    // Verify the archived risk appears in the archive table
    await riskRegisterRisks.verifyRiskVisible(automaticRiskName);
  });

  test("RRR - 11 | @regression Reactivate the archived risk", async ({
    page,
  }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const automaticRiskName = TestData.getKey(
      "automaticRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to risk register first so the sub-menu is expanded, then scroll Archive into view
    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.navigateToArchiveRisks();

    // Search for the archived risk and open it
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
    await page.waitForTimeout(2000);

    // Click Reactivate button
    await riskRegisterRisks.clickReactivateButton();

    // Confirm reactivation in the popup
    await riskRegisterRisks.clickReactivateConfirmButton();

    // Verify the reactivation toast
    await riskRegisterRisks.waitForRiskReactivatedToast();

    // Navigate back to the Active risks sub-section
    await riskRegisterRisks.navigateToRiskRegisterRisks();

    // Search the risk and verify it is back in the active list
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.verifyRiskVisible(automaticRiskName);
  });

  test("RRR - 12 | @regression Delete Automatic Risk", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const automaticRiskName = TestData.getKey(
      "automaticRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Search for the automatic risk and open it
    await riskRegisterRisks.searchRisk(automaticRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(automaticRiskName);
    await page.waitForTimeout(2000);

    // Click the Delete button
    await riskRegisterRisks.clickDeleteRiskButton();

    // Type "confirm" and click CONFIRM in the modal
    await riskRegisterRisks.typeDeleteRiskConfirmation();
    await riskRegisterRisks.clickDeleteRiskConfirmButton();

    // Verify the delete toast
    await riskRegisterRisks.waitForRiskDeletedToast();

    await riskRegisterRisks.verifyNoDataAvailable();
  });

  test("RRR - 13 | @regression Add Manual Risk", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Open the add risk modal and select Manual
    await riskRegisterRisks.clickAddRiskButton();
    await riskRegisterRisks.clickManualButton();

    // Fill in all manual risk form fields and capture the generated risk name
    const manualRiskName = await riskRegisterRisks.fillManualForm("RM");

    // Save the manual risk name for potential future tests
    TestData.setKey(
      "manualRiskName",
      manualRiskName,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    // Wait for creation toast
    await riskRegisterRisks.waitForRiskCreatedToast();

    // Search and verify the manual risk is visible in the list
    await riskRegisterRisks.searchRisk(manualRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.verifyRiskVisible(manualRiskName);
  });

  test("RRR - 14 | @regression Archive Manual Risk", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const manualRiskName = TestData.getKey(
      "manualRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Search for the manual risk and open it
    await riskRegisterRisks.searchRisk(manualRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(manualRiskName);
    await page.waitForTimeout(2000);

    // Click the Archive button and confirm
    await riskRegisterRisks.clickArchiveRiskButton();
    await riskRegisterRisks.clickArchiveRiskConfirmButton();

    // Wait for the archive toast
    await riskRegisterRisks.waitForRiskArchivedToast();

    // Navigate to the Archive sub-section
    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.navigateToArchiveRisks();

    // Verify the manual risk appears in the archived list
    await riskRegisterRisks.searchRisk(manualRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.verifyRiskVisible(manualRiskName);
  });

  test("RRR - 15 | @regression Reactivate Manual Risk", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const manualRiskName = TestData.getKey(
      "manualRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    // Navigate to risk register then into Archive sub-section
    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.navigateToArchiveRisks();

    // Search for the archived manual risk and open it
    await riskRegisterRisks.searchRisk(manualRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(manualRiskName);
    await page.waitForTimeout(2000);

    // Click Reactivate and confirm
    await riskRegisterRisks.clickReactivateButton();
    await riskRegisterRisks.clickReactivateConfirmButton();

    // Wait for reactivation toast
    await riskRegisterRisks.waitForRiskReactivatedToast();

    // Navigate back to Active risks and verify the risk is visible
    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.searchRisk(manualRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.verifyRiskVisible(manualRiskName);
  });

  test("RRR - 16 | @regression Delete Manual Risk", async ({ page }) => {
    test.setTimeout(600000);

    const clientName = TestData.getKey(
      FILE_KEYS.RISK_REGISTER_RISKS_CLIENT_NAME,
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );
    const manualRiskName = TestData.getKey(
      "manualRiskName",
      TEST_DATA_FILE_ENUMS.RISK_REGISTER_RISKS,
    );

    await managementPage.searchAndClickClient(clientName);
    await page.waitForTimeout(2000);

    await riskRegisterRisks.navigateToRiskRegisterRisks();
    await riskRegisterRisks.assertRisksTitleVisible();

    // Search for the manual risk and open it
    await riskRegisterRisks.searchRisk(manualRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.clickSearchedRisk(manualRiskName);
    await page.waitForTimeout(2000);

    // Click the Delete button
    await riskRegisterRisks.clickDeleteRiskButton();

    // Type "confirm" and click CONFIRM in the modal
    await riskRegisterRisks.typeDeleteRiskConfirmation();
    await riskRegisterRisks.clickDeleteRiskConfirmButton();

    // Verify the delete toast
    await riskRegisterRisks.waitForRiskDeletedToast();

    // Search and verify no data is shown
    await riskRegisterRisks.searchRisk(manualRiskName);
    await page.waitForTimeout(2000);
    await riskRegisterRisks.verifyNoDataAvailable();
  });
});
