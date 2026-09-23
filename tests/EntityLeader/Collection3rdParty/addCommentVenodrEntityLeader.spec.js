const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AddCommentVendorEntityLeader = require("../../../pages/EntityLeader/Collection3rdParty/addCommentVenodrEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 600000,
};

const COMMENT_TEXT = "Test vendor comment verify";

// This suite READS the third party score calculation suite's data file rather
// than owning one: the vendor being commented on is the one SC3PEL - 00
// created, so its UUIDs are already filed there and duplicating them under a
// second key would just give the two suites two versions of the same truth to
// drift apart. Same arrangement as ACMEL - 01 and the first party score
// calculation suite.
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

test.describe("Entity Leader Add Comment Third Party", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // WHERE THIS COMMENTS, and why it is not this spec's own vendor.
  //
  // The Secure ACM3P - 01 comments on the vendor that the third-party ARTIFACT
  // suite left behind, reached by deep linking with the IDs that suite stored.
  // This spec does the same thing one suite over: it reuses the vendor
  // SC3PEL - 00 built, so the entity leader flow needs no vendor of its own.
  //
  // WHAT THAT MEANS IN PRACTICE - by the time this runs, SC3PEL - 01 has fully
  // answered that questionnaire. Commenting on answered questions is the
  // realistic case, but it is also precisely when the chapter-completion modal
  // surfaces, which is why the handler below is armed before any navigation.
  //
  // It also means some questions already carry a comment: answering can require
  // a mandatory comment, and six of the twelve questions had one when this port
  // was written. That is fine for the assertion - verifyLatestComment() reads
  // the FIRST .each-comment in DOM order, and DOM order follows question order,
  // so the entry it reads belongs to the question this test commented on.
  //
  // DEPENDENCY - SC3PEL - 00 must have completed, in the SAME run: ELS - 01
  // provisions a brand new client on every invocation, so IDs left over from a
  // previous run point at a client this session's leader cannot reach. The
  // runner orders this file after scoreCalculationVendorEntityLeader.spec.js for
  // that reason, and required() names the producer if the keys are missing.
  let addCommentVendor;

  test.beforeEach(async ({ page }) => {
    addCommentVendor = new AddCommentVendorEntityLeader(page);
    // Armed before navigating: on a fully answered questionnaire the chapter
    // completion modal surfaces part-way through the question work and
    // intercepts every click underneath it.
    await addCommentVendor.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck. The test
    // deep links on from there.
    await addCommentVendor.goto("/");
    await addCommentVendor.waitForLoad();
  });

  test("ACM3PEL - 01 | @smoke Add a comment on the vendor collection questions as the entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientId = required(
      FILE_KEYS.ENTITY_LEADER_SC3P_CLIENT_ID,
      "SC3PEL - 00",
    );
    const vendorId = required(
      FILE_KEYS.ENTITY_LEADER_SC3P_VENDOR_ID,
      "SC3PEL - 00",
    );

    // 1) Arrival, not navigation - the session puts this role on the upperdeck.
    //    Confirmed before deep linking, so a failure here reads as "the session
    //    is not what we think it is" rather than as a broken collection URL.
    await addCommentVendor.ensureOnUpperdeck();

    // 2) Straight into the vendor SC3PEL - 00 built. This role is scoped to the
    //    whole client, so it can deep link exactly as the Secure spec does - no
    //    client search, no vendor list walk.
    await addCommentVendor.openCollectionByIds(clientId, vendorId);

    // 3) Open the questionnaire the comment is added to.
    const frameworkName = await addCommentVendor.openFirstFramework();
    console.log(`Commenting on framework: ${frameworkName}`);

    // 4) Add the comment and verify it. Scope matches the Secure ACM3P - 01,
    //    which comments on the first question only. The page object verifies
    //    the comment it adds by reopening the activity panel and reading the
    //    latest entry back, so there is nothing left for the spec to assert.
    await addCommentVendor.addCommentToFirstQuestion(COMMENT_TEXT);
  });
});
