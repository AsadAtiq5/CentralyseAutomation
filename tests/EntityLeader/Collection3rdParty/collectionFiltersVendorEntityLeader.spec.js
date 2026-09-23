const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const CollectionFiltersVendorEntityLeader = require("../../../pages/EntityLeader/Collection3rdParty/collectionFiltersVendorEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 600000,
};

// This suite READS the third party score calculation suite's data file for
// everything it needs - the vendor UUIDs AND the answer set. Nothing is
// produced here, so there is no file of its own. Same arrangement AFEL - 01 has
// with the first party score calculation suite.
const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_SCORE_CALCULATION_3RD_PARTY;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key the third party score calculation suite stored, naming the
// producer when it is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Collection3rdParty/scoreCalculationVendorEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Third Party Collection Filters", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // WHAT THIS ASSERTS AGAINST, and why it needs the score calculation suite for
  // BOTH halves of the comparison.
  //
  // The Secure FT3P - 01 depends on scoreCalculationThirdParty.spec.js twice
  // over: SC3P - 00 for the client and vendor it walks into, and SC3P - 01 for
  // the answer set that becomes the expected result. This spec has the same two
  // dependencies, both on the EntityLeader side - SC3PEL - 00 for the vendor
  // UUIDs and SC3PEL - 01 for the twelve answers it recorded.
  //
  // That second one is the point of the test: the filters are checked against
  // what was actually answered, derived from stored data, never read back off
  // the screen the assertion is checking.
  //
  // TWO THINGS THIS PORT DOES DIFFERENTLY FROM THE SECURE SPEC:
  //
  //   - IT DEEP LINKS. The Secure spec starts at /clients, searches the client
  //     by name and walks 3rd Party -> Vendors -> vendor -> Collection. This
  //     role has no /clients screen; it is already inside the client and can go
  //     straight to /third-party/<clientId>/collection/<vendorId>. That also
  //     removes the "first vendor in the list" ambiguity - this client
  //     accumulates vendors from every spec in the job.
  //
  //   - AN EMPTY ANSWER SET THROWS. The Secure spec writes
  //     `expect(true).toBe(false)` when the stored data is empty, which fails
  //     with no explanation of what to run. required() plus the explicit check
  //     below names the producer instead.
  //
  // DEPENDENCY - SC3PEL - 00 and SC3PEL - 01 must both have completed, in the
  // SAME run: ELS - 01 provisions a brand new client on every invocation, so
  // data left over from a previous run describes a questionnaire this session's
  // leader cannot reach. The runner orders this file after the third party
  // score calculation spec for that reason.
  let collectionFiltersVendor;

  test.beforeEach(async ({ page }) => {
    collectionFiltersVendor = new CollectionFiltersVendorEntityLeader(page);
    // Armed before navigating: this questionnaire is fully answered, so the
    // chapter completion modal can surface part-way through the filter work and
    // would intercept every click underneath it.
    await collectionFiltersVendor.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await collectionFiltersVendor.goto("/");
    await collectionFiltersVendor.waitForLoad();
  });

  test("FT3PEL - 01 | @smoke Verify vendor collection filters as the entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientId = required(
      FILE_KEYS.ENTITY_LEADER_SC3P_CLIENT_ID,
      "SC3PEL - 00",
    );
    const vendorId = required(
      FILE_KEYS.ENTITY_LEADER_SC3P_VENDOR_ID,
      "SC3PEL - 00",
    );
    const questionData = required(
      FILE_KEYS.ENTITY_LEADER_SC3P_ANSWERS,
      "SC3PEL - 01",
    );

    // required() catches a missing key, but not a key holding an empty array -
    // an answer set with nothing in it would make every filter trivially match
    // and the assertion below meaningless.
    if (!Array.isArray(questionData) || questionData.length === 0) {
      throw new Error(
        "Missing entity leader third party answer data. Run tests/EntityLeader/Collection3rdParty/scoreCalculationVendorEntityLeader.spec.js (SC3PEL - 00, then SC3PEL - 01) before this spec.",
      );
    }
    console.log(
      `Question data set: ${questionData.length} answered question(s).`,
    );

    // 1) Arrival, not navigation - the session puts this role on the upperdeck.
    await collectionFiltersVendor.ensureOnUpperdeck();

    // 2) Straight onto the SC3PEL vendor's collection card list. This replaces
    //    the Secure spec's /clients search and vendor list walk. The framework
    //    card is deliberately left CLOSED - step 3 opens it.
    await collectionFiltersVendor.openCollectionByIds(clientId, vendorId);

    // 3) Open the questionnaire and then the filters panel, in that order.
    const frameworkName =
      await collectionFiltersVendor.openFrameworkAndFiltersPanel(0);
    console.log(`Filtering the questionnaire: ${frameworkName}`);

    const finalSelection = await collectionFiltersVendor.selectRandomFilters();
    await collectionFiltersVendor.applyFilters();

    // 4) Expected question set is derived from the stored answers, never read
    //    back off the screen the assertion is checking.
    const answerFiltered =
      await collectionFiltersVendor.getExpectedFilteredQuestions(
        questionData,
        finalSelection,
      );
    console.log("Filtered Questions:", answerFiltered);

    const filterCount = answerFiltered.length;
    if (filterCount === 0) {
      // A random selection can legitimately match nothing; there is no question
      // list to assert against in that case.
      console.log("No Data Found");
    }
    if (filterCount > 0) {
      const questionCount = await collectionFiltersVendor.getQuestionCount();
      console.log(
        `Question count - expected ${filterCount} | actual ${questionCount}`,
      );
      expect(questionCount).toBe(filterCount);
      await collectionFiltersVendor.verifyFilteredQuestionsSet(finalSelection);
    }
  });
});
