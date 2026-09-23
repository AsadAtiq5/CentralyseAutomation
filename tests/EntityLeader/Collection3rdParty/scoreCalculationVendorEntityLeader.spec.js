const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ScoreCalculationVendorEntityLeader = require("../../../pages/EntityLeader/Collection3rdParty/scoreCalculationVendorEntityLeader");
const {
  getAnswerOptions,
} = require("../../../helpers/collection/answerOptionsHelper");
const {
  calculateScore,
} = require("../../../helpers/collection/calculateScoreHelper");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 1200000,
};

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_SCORE_CALCULATION_3RD_PARTY;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

// Prefix for the vendor SC3PEL - 00 builds, so it is identifiable in a client
// that also carries the vendor suite's VenEL / ReqEL / DelEL vendors. Short
// because the vendor name field caps at 20 characters and the generator appends
// a timestamp.
const VENDOR_PREFIX = "SC3PVen";

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing - a
// missing key means an earlier test has not run, not a bug in this one.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Collection3rdParty/scoreCalculationVendorEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Third Party Score Calculation", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // HOW THIS PORT DIFFERS FROM
  // tests/Secure/Collection3rdParty/scoreCalculationThirdParty.spec.js
  //
  //   - NO CLIENT IS CREATED. The Secure SC3P - 00 builds a dedicated
  //     SC3PClient so the vendor it scores is the only one on the client. An
  //     entity leader has no /clients screen, so this port gets the same
  //     isolation one level down: a brand new VENDOR, whose only questionnaire
  //     is the one SC3PEL - 01 answers, which is what makes the card score
  //     attributable to those answers alone. Nothing else in the EntityLeader
  //     job touches this vendor.
  //
  //   - SC3PEL - 01 DEEP LINKS. The Secure SC3P - 01 re-walks
  //     client -> 3rd Party -> Vendors -> vendor -> Collection every time. This
  //     role can go straight to /third-party/<clientId>/collection/<vendorId>
  //     using the ids SC3PEL - 00 stored.
  //
  //   - THE SCORE IS READ AFTER A REFRESH. The Secure spec reads it straight
  //     after the last question; see refreshCollectionForScore() in the page
  //     object for why that is not safe to rely on.
  //
  // ORDERING - SC3PEL - 01 depends on SC3PEL - 00 for the client and vendor
  // UUIDs. Those are not rendered anywhere on screen, so they can only be read
  // off the URL the setup test lands on. workers: 1 and fullyParallel: false
  // preserve declaration order.
  let scoreCalculationVendor;

  test.beforeEach(async ({ page }) => {
    scoreCalculationVendor = new ScoreCalculationVendorEntityLeader(page);
    // Armed before any navigation: the chapter-completion modal surfaces
    // part-way through the question work, not at a point a spec could probe for.
    await scoreCalculationVendor.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and for
    // an entity leader the app routes to the client's upperdeck. Each test
    // navigates on from there itself - SC3PEL - 01 deep links straight into the
    // vendor collection using the UUIDs SC3PEL - 00 stored.
    await scoreCalculationVendor.goto("/");
    await scoreCalculationVendor.waitForLoad();
  });

  test("SC3PEL - 00 | @smoke Setup vendor for third party score calculation", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Arrival, not client creation - the session puts this role inside its
    //    client, so the only thing to work out is the client id.
    const clientId = await scoreCalculationVendor.openVendorsForThisClient();
    console.log(`Operating on client: ${clientId}`);

    // 2) Build the dedicated vendor on AI Governance, matching what the Secure
    //    SC3P - 00 picks.
    const vendorName =
      await scoreCalculationVendor.createVendorForScoreCalculation(
        VENDOR_PREFIX,
      );

    // 3) Open its collection through the vendor list - the only route available
    //    before the vendor UUID is known.
    await scoreCalculationVendor.openVendorCollectionByName(vendorName);

    // 4) Both UUIDs come off the collection URL, the only place the app exposes
    //    the vendor id, and let SC3PEL - 01 deep link in without walking the
    //    vendor list again.
    const uuids = await scoreCalculationVendor.getCollectionIds();
    if (uuids.length < 2) {
      throw new Error(
        `Expected a client and a vendor UUID in the collection URL, got ${uuids.length}: ${uuids.join(", ")}`,
      );
    }

    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SC3P_VENDOR_NAME,
      vendorName,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SC3P_CLIENT_ID,
      uuids[0],
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SC3P_VENDOR_ID,
      uuids[1],
      FILE,
      SCOPE,
    );
    console.log(
      `Setup complete - vendor "${vendorName}" with client ID ${uuids[0]} and vendor ID ${uuids[1]} saved.`,
    );
  });

  test("SC3PEL - 01 | @regression Score Calculation third party", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientId = required(
      FILE_KEYS.ENTITY_LEADER_SC3P_CLIENT_ID,
      "SC3PEL - 00",
    );
    const vendorId = required(
      FILE_KEYS.ENTITY_LEADER_SC3P_VENDOR_ID,
      "SC3PEL - 00",
    );

    // 1) Straight into the vendor SC3PEL - 00 built. The Secure spec spends its
    //    first steps re-finding the client and walking the vendor list; this
    //    role can deep link because it is scoped to the whole client.
    await scoreCalculationVendor.openCollectionByIds(clientId, vendorId);

    // 2) The framework name resolves this framework's answer options, which
    //    carry the per-answer scores the expected total is built from.
    const frameworkName =
      await scoreCalculationVendor.getFrameworkNameAndOpen(0);
    const answerOption = await getAnswerOptions(frameworkName);

    // 3) Answer every question across every page of the questionnaire.
    const answers =
      await scoreCalculationVendor.questionEngine.answerAllQuestions();

    // 4) The card score is rendered from the saved answers, so the collection
    //    has to be reopened before it is read.
    await scoreCalculationVendor.refreshCollectionForScore(clientId, vendorId);

    // 5) Expected score is derived from the answers just given, never read back
    //    off the screen the assertion is checking. The third argument defaults
    //    to false - partial answers score by their stored partial value rather
    //    than by percentage - which is what the Secure SC3P - 01 relies on too.
    const totalScore = calculateScore(answers, answerOption);

    const score = await scoreCalculationVendor.getScore(0);
    const uiScore = score ? parseFloat(score) : 0;
    // The UI renders one decimal place, so the calculated score is rounded to
    // match before comparing.
    const roundedTotalScore = parseFloat(totalScore.toFixed(1));

    // Stored for any follow-up spec that has to re-verify this same score: the
    // answers were random and cannot be re-derived later.
    TestData.setKey(FILE_KEYS.ENTITY_LEADER_SC3P_ANSWERS, answers, FILE, SCOPE);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_SC3P_FRAMEWORK_NAME,
      frameworkName,
      FILE,
      SCOPE,
    );

    console.log(`Framework: ${frameworkName}`);
    console.log(`Questions answered: ${answers.length}`);
    console.log(`Score - expected ${roundedTotalScore} | actual ${uiScore}`);
    expect(uiScore).toBe(roundedTotalScore);
  });
});
