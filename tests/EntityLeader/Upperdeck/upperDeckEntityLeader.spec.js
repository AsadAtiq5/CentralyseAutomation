const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const UpperDeckEntityLeader = require("../../../pages/EntityLeader/Upperdeck/upperDeckEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");
const {
  getAssociatedRiskCount,
} = require("../../../helpers/riskRegister/riskGroupHelper");

const TIMEOUTS = {
  SHORT: 120000,
  EXTRA_LONG: 1200000,
};

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_UPPERDECK;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

// How many sub-entities UDEL - 01 builds. Only the first is answered, so the
// rest stay at zero and the averaged upperdeck score is a real figure rather
// than a flat one.
const ENTITY_COUNT = 4;
const ENTITY_PREFIX = "UDEL_Entity";
const RISK_FRAMEWORK = "Business Email Compromise";

// Backend processing waits. Both are inherited from the Secure UD - 01, which
// needs them for the same reason: entity scores and the aggregate they roll up
// into are computed asynchronously, and no element state on the page reflects
// "the backend has finished recomputing" - the old figure simply renders until
// the new one replaces it. There is nothing to wait FOR, so these stay fixed.
const WAITS = {
  AFTER_FIRST_ENTITY: 60000,
  BEFORE_READING_SCORES: 120000,
};

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Upperdeck/upperDeckEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Upperdeck Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - UDEL - 02 and UDEL - 03 depend on UDEL - 01.
  //
  // The Secure UD - 01 creates its own client, then hands the client name to
  // UD - 02 and UD - 03 so they can navigate back into it. This role creates no
  // client - ELS - 01 provisioned one and the session lands inside it - so
  // there is no client name to store and no searchClient/clickClientCard step.
  //
  // What DOES have to be handed forward is the entity count. UD - 03 hardcodes
  // `backendRiskCount * 4` because its client always has exactly the four
  // entities UD - 01 just made. Here the client persists between runs, so a
  // second run of UDEL - 01 would leave eight - see the note on that test.
  //
  // UDEL - 01 is the only test that writes anything; 02 and 03 are read-only.
  let upperDeck;

  test.beforeEach(async ({ page }) => {
    upperDeck = new UpperDeckEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await upperDeck.goto("/");
    await upperDeck.waitForLoad();
  });

  test("UDEL - 01 | @smoke Verify the score", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    // 1) Arrival, not navigation - the session puts this role on the upperdeck.
    //    This replaces the whole of the Secure spec's client creation and
    //    client-card navigation.
    await upperDeck.ensureOnUpperdeck();
    const clientName = await upperDeck.getClientName();
    console.log(`Operating on client: ${clientName}`);

    // 2) Build the entity set. This is the capability that separates this role
    //    from the sub entity leader, which is locked to one assigned entity.
    await upperDeck.navigateToMultiEntity();

    const entityNames = [];
    entityNames.push(await upperDeck.createEntityWithBEC(ENTITY_PREFIX));

    // 3) Answer the FIRST entity only, so the others stay at zero and the
    //    average is a meaningful number.
    await upperDeck.answerEntityCollection(entityNames[0]);

    // 4) Back to multi entity, reload, and let the first entity's score land
    //    before the remaining entities are added.
    await upperDeck.navigateToMultiEntity();
    await upperDeck.reloadAndSettle();
    await upperDeck.page.waitForTimeout(WAITS.AFTER_FIRST_ENTITY);

    for (let i = 1; i < ENTITY_COUNT; i++) {
      entityNames.push(await upperDeck.createEntityWithBEC(ENTITY_PREFIX));
    }

    // 5) Let the aggregate settle before anything is read.
    await upperDeck.page.waitForTimeout(WAITS.BEFORE_READING_SCORES);

    // 6) Read every entity card in one pass.
    const entityScores = await upperDeck.getMultiEntityScores();
    console.log("Multi entity scores:", JSON.stringify(entityScores));

    // 7) The upperdeck weights every entity equally, so the expected figure is
    //    the plain mean of the cards.
    //
    //    Derived from the cards actually on screen rather than from a hardcoded
    //    quarter-each, which is what the Secure spec can assume: its client is
    //    new every run and therefore always holds exactly four. This client is
    //    provisioned once by ELS - 01 and survives, so a re-run of this test
    //    leaves eight entities and a fixed 25% weighting would silently assert
    //    the wrong total.
    const total = entityScores.reduce((sum, e) => sum + e.score, 0);
    const averageScore = total / entityScores.length;
    const roundedAverage = Math.floor(averageScore * 10) / 10;

    // 8) Compare against the aggregate the upperdeck renders.
    await upperDeck.openUpperdeck();
    const upperdeckScore = await upperDeck.getUpperdeckScore();
    console.log(
      `Upperdeck score - expected ${roundedAverage} | actual ${upperdeckScore} (mean of ${entityScores.length} entities)`,
    );
    expect(upperdeckScore).toBe(roundedAverage);

    // 9) Hand the entity set forward - UDEL - 03 multiplies the per-framework
    //    backend risk count by it, and it cannot be re-derived there without
    //    walking back to the multi entity screen.
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_UPPERDECK_ENTITY_NAMES,
      entityNames,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_UPPERDECK_ENTITY_COUNT,
      entityScores.length,
      FILE,
      SCOPE,
    );
  });

  test("UDEL - 02 | @regression Download Master Report", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    // The Secure spec spends its first steps re-finding the client it stored.
    // This role is already inside it.
    await upperDeck.ensureOnUpperdeck();

    // The page object owns the whole flow, including the toast that proves the
    // file was written rather than just that the menu option was clicked.
    await upperDeck.downloadMasterReport();
  });

  test("UDEL - 03 | @regression Risk count", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    // Every entity carries the same framework, so the client-wide total is the
    // framework's own risk count multiplied by the number of entities.
    const entityCount = required(
      FILE_KEYS.ENTITY_LEADER_UPPERDECK_ENTITY_COUNT,
      "UDEL - 01",
    );

    await upperDeck.ensureOnUpperdeck();

    const uiTotalCount = await upperDeck.getTotalRiskCount();

    // Derived from the S3 framework template, never read off the screen the
    // assertion is checking.
    const backendRiskCount = await getAssociatedRiskCount([RISK_FRAMEWORK]);
    const expectedTotal = backendRiskCount * entityCount;

    console.log(
      `Risk count - expected ${expectedTotal} | actual ${uiTotalCount} (${backendRiskCount} per framework x ${entityCount} entities)`,
    );
    expect(uiTotalCount).toBe(expectedTotal);
  });
});
