const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const RiskRegisterRiskEntityLeader = require("../../../pages/EntityLeader/RiskRegister/riskRegisterRiskEntityLeader");
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

const ENTITY_PREFIX = "RRREL_Entity";

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_RISK_REGISTER;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer test when it is missing -
// a missing key means an earlier test has not run, not a bug in this one.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/RiskRegister/riskRegisterRiskEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Risk Register Risks", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - these tests form one chain and run in declaration order.
  //
  // RRREL - 00 builds the sub-entity every other test works inside and answers
  // its assessment; 03 creates the automatic risk that 04, 05, 06, 10, 11 and
  // 12 all act on; 13 creates the manual risk that 14, 15 and 16 act on.
  // workers: 1 and fullyParallel: false preserve declaration order.
  //
  // WHAT REPLACES THE SECURE SETUP: RRR - 00 creates a CLIENT and an entity and
  // hands the client name forward, so each later test can search its way back
  // in. This role has no /clients screen and is already inside the client
  // ELS - 01 provisioned, so only the sub-entity is built - and the ENTITY name
  // is what gets handed forward instead, because every test has to re-scope the
  // risks screen to it.
  //
  // WHY THE SCOPE IS NOT OPTIONAL: the risk-register dropdown defaults to
  // "All - Risks". The Secure client holds exactly one entity, so unscoped and
  // scoped are the same view there. This client accumulates a sub-entity from
  // nearly every spec in the job, nearly all on Business Email Compromise, so
  // unscoped the row count and the severity badges span all of them - and
  // RRREL - 02, which compares the Total badge against one framework's risk
  // count, would be comparing against that count times however many entities
  // exist at the time.
  //
  // RRR - 07, 08 and 09 are commented out in the Secure spec, so they have no
  // counterpart here - porting them would create cases with nothing to compare
  // against.
  let riskRegister;

  test.beforeEach(async ({ page }) => {
    riskRegister = new RiskRegisterRiskEntityLeader(page);
    // Armed before navigating: RRREL - 00 answers a full assessment, which is
    // when the chapter completion modal surfaces, and it intercepts every click
    // underneath it.
    await riskRegister.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await riskRegister.goto("/");
    await riskRegister.waitForLoad();
  });

  // Every test after the setup starts the same way: arrive, open the risks
  // screen and narrow it to the sub-entity RRREL - 00 built.
  const openScopedRisks = async (producer = "RRREL - 00") => {
    const entityName = required(
      FILE_KEYS.ENTITY_LEADER_RISK_ENTITY_NAME,
      producer,
    );
    await riskRegister.ensureOnUpperdeck();
    await riskRegister.navigateToRisks();
    await riskRegister.scopeRisksToEntity(entityName);
    return entityName;
  };

  test("RRREL - 00 | Setup - Create multientity with risk and answer the collection", async () => {
    test.setTimeout(TIMEOUT);

    // 1. Arrival, not navigation - this replaces the Secure spec's /clients
    //    navigation and client creation entirely.
    await riskRegister.ensureOnUpperdeck();

    // 2. Create the sub-entity this whole suite works inside, on Business Email
    //    Compromise - the framework that gives it risks at all.
    await riskRegister.navigateToMultiEntity();
    const entityName = await riskRegister.createEntityWithBEC(ENTITY_PREFIX);

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    console.log(`Saved risk register entity: "${entityName}"`);

    // 3. Open its collection and answer every question. The answers are what
    //    RRREL - 04 derives the expected residual from, and they are random, so
    //    they cannot be re-derived later.
    await riskRegister.openEntityCollection(entityName);
    await riskRegister.openFrameworkCard();
    const answers = await riskRegister.captureCollectionAnswers();

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_COLLECTION_ANSWERS,
      answers,
      FILE,
      SCOPE,
    );
    console.log(`Stored ${answers.length} collection answer(s).`);
  });

  test("RRREL - 01 | @smoke verify risk should be visible after creating sub entity", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    const rowCount = await riskRegister.getTableRowsCount();
    console.log(`Risk rows - expected > 0 | actual ${rowCount}`);
    expect(rowCount).toBeGreaterThan(0);
  });

  test("RRREL - 02 | @regression Verify risk count from backend", async () => {
    test.setTimeout(TIMEOUT);

    // The framework is a constant rather than something the setup test stored:
    // RRREL - 00 always provisions the entity with Business Email Compromise,
    // and the Secure spec stores that identical string.
    const selectedRisk = RiskRegisterRiskEntityLeader.DEFAULT_FRAMEWORK;

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    // UI badge vs the count derived from the S3 framework template. Only
    // comparable because the screen is scoped to one entity - see the note at
    // the top of this file.
    const uiTotal = await riskRegister.getSeverityCount("Total");
    const backendTotal = await getAssociatedRiskCount([selectedRisk]);

    console.log(
      `Risk count - expected ${backendTotal} | actual ${uiTotal} | framework: ${selectedRisk}`,
    );
    expect(uiTotal).toBe(backendTotal);
  });

  test("RRREL - 03 | @regression Add Automatic Risk", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    // Opens on the Automatic tab, waiting for the controls table to populate.
    await riskRegister.openAutomaticRiskPopup();

    const automaticRiskName = await riskRegister.createUniqueRiskName("RA");
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      automaticRiskName,
      FILE,
      SCOPE,
    );

    // Each stored value feeds the residual calculation in RRREL - 04, which is
    // why all three are captured rather than just applied.
    const selectedControls = await riskRegister.selectRandomControls(2);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_SELECTED_CONTROLS,
      selectedControls,
      FILE,
      SCOPE,
    );

    const selectedImpact = await riskRegister.selectRandomImpact();
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_IMPACT,
      selectedImpact,
      FILE,
      SCOPE,
    );

    const selectedProbability = await riskRegister.selectRandomProbability();
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_PROBABILITY,
      selectedProbability,
      FILE,
      SCOPE,
    );

    await riskRegister.saveRiskAndWaitForToast();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.verifyRiskVisible(automaticRiskName);
  });

  test("RRREL - 04 | @regression Verify Effectiveness and Residual", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRREL - 03",
    );
    const selectedControls = required(
      FILE_KEYS.ENTITY_LEADER_RISK_SELECTED_CONTROLS,
      "RRREL - 03",
    );
    const collectionAnswers = required(
      FILE_KEYS.ENTITY_LEADER_RISK_COLLECTION_ANSWERS,
      "RRREL - 00",
    );
    const riskImpact = required(
      FILE_KEYS.ENTITY_LEADER_RISK_IMPACT,
      "RRREL - 03",
    );
    const riskProbability = required(
      FILE_KEYS.ENTITY_LEADER_RISK_PROBABILITY,
      "RRREL - 03",
    );

    await openScopedRisks();
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

  test("RRREL - 05 | @regression Add Comment to Automatic Risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRREL - 03",
    );
    const testComment = "This is an automated test comment for automatic risk.";

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.addCommentToRisk(testComment);
    await riskRegister.verifyComment(testComment);
  });

  test("RRREL - 06 | @regression Verify Financial Exposure Calculation", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRREL - 03",
    );

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    // Edit mode -> Financial Exposure on -> calculator -> Basic.
    await riskRegister.openFinancialCalculator();

    const mostLikelySliderValue = await riskRegister.setMostLikelySlider();
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_MOST_LIKELY_SLIDER,
      mostLikelySliderValue,
      FILE,
      SCOPE,
    );

    const primaryLossValue = await riskRegister.getPrimaryLossValue();
    console.log(`Primary Loss value: ${primaryLossValue}`);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_RISK_PRIMARY_LOSS,
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
      FILE_KEYS.ENTITY_LEADER_RISK_FINANCIAL_EFFECTIVENESS,
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

  test("RRREL - 10 | @regression Archive the Automatic risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRREL - 03",
    );

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.archiveRisk();

    // The Archive side-menu item is disabled until the entity actually has an
    // archived risk, so this is only reachable now that one exists.
    await riskRegister.navigateToArchiveRisks();
    await riskRegister.verifyRiskVisible(automaticRiskName);
  });

  test("RRREL - 11 | @regression Reactivate the archived risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRREL - 03",
    );

    // Risk Register first so its sub-menu is expanded, then into Archive.
    await openScopedRisks();
    await riskRegister.navigateToArchiveRisks();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.reactivateRisk();

    // Back to the active list - the risk has to be there again.
    await riskRegister.navigateToRisks();
    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.verifyRiskVisible(automaticRiskName);
  });

  test("RRREL - 12 | @regression Delete Automatic Risk", async () => {
    test.setTimeout(TIMEOUT);

    const automaticRiskName = required(
      FILE_KEYS.ENTITY_LEADER_AUTOMATIC_RISK_NAME,
      "RRREL - 03",
    );

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(automaticRiskName);
    await riskRegister.openRisk(automaticRiskName);

    await riskRegister.deleteRisk();
    await riskRegister.verifyNoDataAvailable();
  });

  test("RRREL - 13 | @regression Add Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    const manualRiskName = await riskRegister.createManualRisk("RM");
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_MANUAL_RISK_NAME,
      manualRiskName,
      FILE,
      SCOPE,
    );

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyRiskVisible(manualRiskName);
  });

  test("RRREL - 14 | @regression Archive Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    const manualRiskName = required(
      FILE_KEYS.ENTITY_LEADER_MANUAL_RISK_NAME,
      "RRREL - 13",
    );

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.openRisk(manualRiskName);

    await riskRegister.archiveRisk();

    await riskRegister.navigateToRisks();
    await riskRegister.navigateToArchiveRisks();
    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyRiskVisible(manualRiskName);
  });

  test("RRREL - 15 | @regression Reactivate Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    const manualRiskName = required(
      FILE_KEYS.ENTITY_LEADER_MANUAL_RISK_NAME,
      "RRREL - 13",
    );

    await openScopedRisks();
    await riskRegister.navigateToArchiveRisks();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.openRisk(manualRiskName);

    await riskRegister.reactivateRisk();

    await riskRegister.navigateToRisks();
    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyRiskVisible(manualRiskName);
  });

  test("RRREL - 16 | @regression Delete Manual Risk", async () => {
    test.setTimeout(TIMEOUT);

    const manualRiskName = required(
      FILE_KEYS.ENTITY_LEADER_MANUAL_RISK_NAME,
      "RRREL - 13",
    );

    await openScopedRisks();
    await riskRegister.verifyRisksTitleVisible();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.openRisk(manualRiskName);

    await riskRegister.deleteRisk();

    await riskRegister.searchRisk(manualRiskName);
    await riskRegister.verifyNoDataAvailable();
  });
});
