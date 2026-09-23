const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const RiskRegisterRisksSubEntityLeader = require("../../../pages/SubEntityLeader/RiskRegister/riskRegisterRisksSubEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");
const {
  calculateRiskResidual,
  calculateFinancialResidual,
} = require("../../../helpers/riskRegister/calculateRiskHelper");
const {
  getAssociatedRiskCount,
} = require("../../../helpers/riskRegister/riskGroupHelper");

const TIMEOUT = 600000;

const FILE = TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_RISK_REGISTER;
const SCOPE = APP_SCOPE.SUB_ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

// Reads a key this suite stored, naming the producer test when it is missing -
// a missing key means an earlier test has not run, not a bug in this one.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/SubEntityLeader/RiskRegister/riskRegisterRisksSubEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Sub Entity Leader Risk Register Risks", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - these tests form one chain and run in declaration order.
  //
  // The Secure RRR - 00 creates a client and a multi-entity, answers the
  // collection, and hands the client name forward so every later test can
  // navigate back into it. This role can create neither: it has exactly one
  // assigned entity, provisioned by SSEL - 01, which every test here is already
  // inside. So there is no client name to store and no searchAndClickClient()
  // step at the top of each test - only ensureOnCollection().
  //
  // What survives of RRR - 00 is the half that still means something: capturing
  // the collection answers, which RRRSEL - 04 needs to derive the expected
  // residual. See captureCollectionAnswers() for why that is non-destructive on
  // an assessment SCSEL - 01 has already answered.
  //
  // Everything else chains as it does in the Secure spec: 03 creates the
  // automatic risk that 04, 05, 06, 10, 11 and 12 all act on, and 13 creates the
  // manual risk that 14, 15 and 16 act on. workers: 1 and fullyParallel: false
  // preserve declaration order.
  //
  // RRR - 07, 08 and 09 are commented out in the Secure spec, so they have no
  // counterpart here - porting them would create cases with nothing to compare
  // against.
  let riskRegister;

  test.beforeEach(async ({ page }) => {
    riskRegister = new RiskRegisterRisksSubEntityLeader(page);
    // Armed before navigating: the assessment is fully answered by the time
    // this suite reaches here, so the chapter completion modal can surface
    // during the setup test's question walk.
    await riskRegister.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await riskRegister.goto("/");
    await riskRegister.waitForLoad();
  });

  test("RRRSEL - 00 | Setup - Capture the collection answers", async () => {
    test.setTimeout(TIMEOUT);

    // 1) Get to the collection. This replaces the Secure spec's client and
    //    entity creation entirely - SSEL - 01 already provisioned both.
    await riskRegister.ensureOnCollection();

    // 2) Open the assessment and capture every answer. Non-destructive: the
    //    underlying walk reads an existing selection rather than replacing it.
    await riskRegister.openFrameworkByName();
    const answers = await riskRegister.captureCollectionAnswers();

    // 3) Hand the answers forward - RRRSEL - 04 derives the expected residual
    //    from them, and they cannot be re-derived once other specs overwrite
    //    the assessment.
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_COLLECTION_ANSWERS,
      answers,
      FILE,
      SCOPE,
    );
    console.log(`Stored ${answers.length} collection answer(s).`);
  });

  test("RRRSEL - 01 | @smoke verify risk should be visible for the sub entity leader", async () => {
    test.setTimeout(TIMEOUT);

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    const rowCount = await riskRegister.getTableRowsCount();
    console.log(`Risk rows - expected > 0 | actual ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);
  });

  test("RRRSEL - 02 | @regression Verify risk count from backend", async () => {
    test.setTimeout(TIMEOUT);

    // The framework is a constant for this role rather than something the setup
    // test stored: SSEL - 01 always provisions the entity with Business Email
    // Compromise, and the Secure spec stores that identical string.
    const selectedRisk = RiskRegisterRisksSubEntityLeader.DEFAULT_FRAMEWORK;

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    // UI badge vs the count derived from the S3 framework template.
    const uiTotal = await riskRegister.getSeverityCount("Total");
    const backendTotal = await getAssociatedRiskCount([selectedRisk]);

    console.log(
      `Risk count - expected ${backendTotal} | actual ${uiTotal} | framework: ${selectedRisk}`,
    );
    expect(uiTotal).toBe(backendTotal);
  });

  test("RRRSEL - 03 | @regression Add Automatic Risk", async () => {
    test.setTimeout(TIMEOUT);

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    // Opens on the Automatic tab, waiting for the controls table to populate.
    await riskRegister.openAutomaticRiskPopup();

    const automaticRiskName = await riskRegister.createUniqueRiskName("RA");
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      automaticRiskName,
      FILE,
      SCOPE,
    );

    // Each stored value feeds the residual calculation in RRRSEL - 04, which is
    // why all three are captured rather than just applied.
    const selectedControls = await riskRegister.selectRandomControls(2);
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_SELECTED_CONTROLS,
      selectedControls,
      FILE,
      SCOPE,
    );

    const selectedImpact = await riskRegister.selectRandomImpact();
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_IMPACT,
      selectedImpact,
      FILE,
      SCOPE,
    );

    const selectedProbability = await riskRegister.selectRandomProbability();
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_PROBABILITY,
      selectedProbability,
      FILE,
      SCOPE,
    );

    await riskRegister.saveRiskAndWaitForToast();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.verifyRiskVisible(automaticRiskName);
  });

  test("RRRSEL - 04 | @regression Verify Effectiveness and Residual", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRRSEL - 03",
    );
    const selectedControls = required(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_SELECTED_CONTROLS,
      "RRRSEL - 03",
    );
    const collectionAnswers = required(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_COLLECTION_ANSWERS,
      "RRRSEL - 00",
    );
    const riskImpact = required(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_IMPACT,
      "RRRSEL - 03",
    );
    const riskProbability = required(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_PROBABILITY,
      "RRRSEL - 03",
    );

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    // Expected values are derived from the stored data, never read back off the
    // screen the assertion is checking.
    const expected = calculateRiskResidual(
      collectionAnswers,
      selectedControls,
      riskImpact,
      riskProbability,
    );

    // Soft assertions so one mismatch does not hide the other two.
    const actualEffectiveness = await riskRegister.getEffectivenessValue();
    console.log(
      `Effectiveness - expected ${expected.effectivenessDisplay} | actual ${actualEffectiveness}`,
    );
    expect
      .soft(actualEffectiveness, "Effectiveness mismatch")
      .toBe(expected.effectivenessDisplay);

    const actualResidualProbability =
      await riskRegister.getResidualProbability();
    console.log(
      `Residual Probability - expected ${expected.residualProbability} | actual ${actualResidualProbability}`,
    );
    expect
      .soft(actualResidualProbability, "Residual Probability mismatch")
      .toBe(expected.residualProbability);

    const actualResidualImpact = await riskRegister.getResidualImpact();
    console.log(
      `Residual Impact - expected ${expected.residualImpact} | actual ${actualResidualImpact}`,
    );
    expect
      .soft(actualResidualImpact, "Residual Impact mismatch")
      .toBe(expected.residualImpact);
  });

  test("RRRSEL - 05 | @regression Add Comment to Automatic Risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRRSEL - 03",
    );
    const testComment = "This is an automated test comment for automatic risk.";

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.addCommentToRisk(testComment);
    await riskRegister.verifyComment(testComment);
  });

  test("RRRSEL - 06 | @regression Verify Financial Exposure Calculation", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRRSEL - 03",
    );

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    // Edit mode -> Financial Exposure on -> calculator -> Basic.
    await riskRegister.openFinancialCalculator();

    const mostLikelySliderValue = await riskRegister.setMostLikelySlider();
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_MOST_LIKELY_SLIDER,
      mostLikelySliderValue,
      FILE,
      SCOPE,
    );

    const primaryLossValue = await riskRegister.getPrimaryLossValue();
    console.log(`Primary Loss value: ${primaryLossValue}`);
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_PRIMARY_LOSS,
      primaryLossValue,
      FILE,
      SCOPE,
    );

    await riskRegister.saveFinancialExposure();

    const effectivenessValue = await riskRegister.getEffectivenessValue();
    console.log(
      `Effectiveness after financial exposure: ${effectivenessValue}`,
    );
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_RISK_FINANCIAL_EFFECTIVENESS,
      effectivenessValue,
      FILE,
      SCOPE,
    );

    // effectivenessValue is e.g. "13%" -> raw 0-10 scale = 13/10 = 1.3
    const effectivenessRaw = Number.parseInt(effectivenessValue, 10) / 10;
    const expectedResidual = calculateFinancialResidual(
      primaryLossValue,
      effectivenessRaw,
    );

    const actualResidualStr = await riskRegister.getFinancialResidualValue();
    const actualResidual = Number.parseFloat(
      actualResidualStr.replace("$", ""),
    );
    console.log(
      `Financial Residual - expected ${expectedResidual} | actual ${actualResidual} | primaryLoss ${primaryLossValue} | effectiveness ${effectivenessRaw}`,
    );

    expect
      .soft(actualResidual, "Financial Residual mismatch")
      .toBeCloseTo(expectedResidual, 0);
  });

  test("RRRSEL - 10 | @regression Archive the Automatic risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRRSEL - 03",
    );

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.archiveRisk();

    // The Archive side-menu item is disabled until the entity actually has an
    // archived risk, so this is only reachable now that one exists.
    await riskRegister.navigateToArchiveRisks();
    await riskRegister.verifyRiskVisible(automaticRiskName);
  });

  test("RRRSEL - 11 | @regression Reactivate the archived risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRRSEL - 03",
    );

    await riskRegister.ensureOnCollection();
    // Risk Register first so its sub-menu is expanded, then into Archive.
    await riskRegister.navigateToRisks();
    await riskRegister.navigateToArchiveRisks();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.reactivateRisk();

    // Back to the active list - the risk has to be there again.
    await riskRegister.navigateToRisks();
    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.verifyRiskVisible(automaticRiskName);
  });

  test("RRRSEL - 12 | @regression Delete Automatic Risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRRSEL - 03",
    );

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.deleteRisk();
    await riskRegister.verifyNoDataAvailable();
  });

  test("RRRSEL - 13 | @regression Add Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    const manualRiskName = await riskRegister.createManualRisk("RM");
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_MANUAL_RISK_NAME,
      manualRiskName,
      FILE,
      SCOPE,
    );

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyRiskVisible(manualRiskName);
  });

  test("RRRSEL - 14 | @regression Archive Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    const manualRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_MANUAL_RISK_NAME,
      "RRRSEL - 13",
    );

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.openRisk(manualRiskName);

    await riskRegister.archiveRisk();

    await riskRegister.navigateToRisks();
    await riskRegister.navigateToArchiveRisks();
    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyRiskVisible(manualRiskName);
  });

  test("RRRSEL - 15 | @regression Reactivate Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    const manualRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_MANUAL_RISK_NAME,
      "RRRSEL - 13",
    );

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.navigateToArchiveRisks();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.openRisk(manualRiskName);

    await riskRegister.reactivateRisk();

    await riskRegister.navigateToRisks();
    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyRiskVisible(manualRiskName);
  });

  test("RRRSEL - 16 | @regression Delete Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    const manualRiskName = required(
      FILE_KEYS.SUB_ENTITY_LEADER_MANUAL_RISK_NAME,
      "RRRSEL - 13",
    );

    await riskRegister.ensureOnCollection();
    await riskRegister.navigateToRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.openRisk(manualRiskName);

    await riskRegister.deleteRisk();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyNoDataAvailable();
  });
});
