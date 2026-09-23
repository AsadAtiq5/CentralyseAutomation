const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AddCommentEntityLeader = require("../../../pages/EntityLeader/Collection/addCommentEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 600000,
};

const COMMENT_TEXT = "Test comment verify";

// This suite READS the score calculation suite's data file rather than owning
// one: the sub-entity being commented on is the one SCEL - 00 created, so its
// UUIDs are already filed there and duplicating them under a second key would
// just give the two suites two versions of the same truth to drift apart.
const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_SCORE_CALCULATION;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key the score calculation suite stored, naming the producer when
// it is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Collection/scoreCalculationEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Add Comment Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // WHERE THIS COMMENTS, and why it is not this spec's own entity.
  //
  // The Secure ACM - 01 comments on the COLLABORATIVE sub-entity that the
  // addMultiEntity suite left behind, reached by deep linking with the IDs that
  // suite stored. This spec does the same thing one suite over: it reuses the
  // sub-entity SCEL - 00 built, so the entity leader flow needs no third entity
  // of its own.
  //
  // WHAT THAT MEANS IN PRACTICE - by the time this runs, SCEL - 01 has fully
  // answered that assessment. Commenting on answered questions is the realistic
  // case, but it is also precisely when the chapter-completion modal surfaces,
  // which is why the handler below is armed before any navigation.
  //
  // DEPENDENCY - SCEL - 00 must have completed, in the SAME run: ELS - 01
  // provisions a brand new client on every invocation, so IDs left over from a
  // previous run point at a client this session's leader cannot reach. The
  // runner orders this file after scoreCalculationEntityLeader.spec.js for that
  // reason, and required() names the producer if the keys are missing.
  let addCommentEntityLeader;

  test.beforeEach(async ({ page }) => {
    addCommentEntityLeader = new AddCommentEntityLeader(page);
    // Armed before navigating: on a fully answered assessment the chapter
    // completion modal surfaces part-way through the question work and
    // intercepts every click underneath it.
    await addCommentEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck. The test
    // deep links on from there.
    await addCommentEntityLeader.goto("/");
    await addCommentEntityLeader.waitForLoad();
  });

  test("ACMEL - 01 | @smoke Add a comment on the collection questions as the entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const entityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_ID,
      "SCEL - 00",
    );
    const subEntityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_SUBENTITY_ID,
      "SCEL - 00",
    );

    // 1) Arrival, not navigation - the session puts this role on the upperdeck.
    //    Confirmed before deep linking, so a failure here reads as "the session
    //    is not what we think it is" rather than as a broken collection URL.
    await addCommentEntityLeader.ensureOnUpperdeck();

    // 2) Straight into the sub-entity SCEL - 00 built. This role is scoped to
    //    the whole client, so it can deep link exactly as the Secure spec
    //    does - no client search, no entity dropdown.
    await addCommentEntityLeader.openCollectionByIds(entityID, subEntityID);

    // 3) Open the assessment the comments are added to.
    const frameworkName = await addCommentEntityLeader.openFirstFramework();
    console.log(`Commenting on framework: ${frameworkName}`);

    // 4) Walk every question set adding the comment. The page object verifies
    //    each comment it adds, so there is nothing left for the spec to assert.
    await addCommentEntityLeader.addCommentToAllQuestionSets(COMMENT_TEXT);
  });
});
