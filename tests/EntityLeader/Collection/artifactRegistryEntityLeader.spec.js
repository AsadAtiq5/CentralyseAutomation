const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ArtifactRegistryEntityLeader = require("../../../pages/EntityLeader/Collection/artifactRegistryEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 600000,
};

const ARTIFACT_FILE_NAME = "testFile.pdf";
const ARTIFACT_FILE_PATH = path.join(
  process.cwd(),
  "filesTest/Files/testFile.pdf",
);

// This suite READS the score calculation suite's data file for the entity it
// operates on: the sub-entity being used is the one SCEL - 00 created, so its
// UUIDs are already filed there and duplicating them under a second key would
// just give the two suites two versions of the same truth to drift apart. The
// question details AREL - 05 captures get their own file, since nothing else
// produces them.
const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_SCORE_CALCULATION;
const QUESTION_FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_ARTIFACT_QUESTION;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key the score calculation suite stored, naming the producer when it
// is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Collection/scoreCalculationEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Artifact Registry Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // SETUP 00 HAS NO COUNTERPART HERE, which is why the numbering starts at 01.
  //
  // That test exists to build a client and a sub-entity for these cases to run
  // against. This role cannot create a client - it has no /clients screen - and
  // it does not need to: ELS - 01 provisioned the client and SCEL - 00 already
  // built the sub-entity, so this suite provisions nothing and reuses both.
  //
  // ORDERING WITHIN THE FILE - these tests share registry state and MUST run in
  // declaration order: AREL - 01 asserts the registry is empty, 02 uploads into
  // it, 03 empties it again, and 04 re-uploads so 05 has something to link.
  // workers: 1 and fullyParallel: false preserve that order.
  //
  // ORDERING AGAINST THE OTHER EL SPECS - two hard constraints:
  //   1. SCEL - 00 must have completed, in the SAME run. ELS - 01 provisions a
  //      brand new client on every invocation, so IDs left over from a previous
  //      run point at a client this session's leader cannot reach.
  //   2. This file must run BEFORE the Policy Management spec. PMEL - 10 copies
  //      a policy into an Artifacts Registry, and AREL - 01 asserts an EMPTY
  //      one. PMEL - 10 copies into a destination sub-entity it creates itself
  //      rather than into this entity's registry, so the two probably do not
  //      collide - but "probably" is not worth an empty-state assertion, and
  //      running first costs nothing.
  // The runner encodes both.
  let artifactRegistryEntityLeader;

  test.beforeEach(async ({ page }) => {
    artifactRegistryEntityLeader = new ArtifactRegistryEntityLeader(page);
    // Armed before navigating: the SCEL assessment is fully answered, so the
    // chapter completion modal surfaces once the collection is opened and
    // intercepts every click underneath it.
    await artifactRegistryEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await artifactRegistryEntityLeader.goto("/");
    await artifactRegistryEntityLeader.waitForLoad();
    await artifactRegistryEntityLeader.ensureOnUpperdeck();

    // Every test starts on the registry. The Secure spec does the same thing in
    // its own beforeEach; the difference is only which entity ID it deep links
    // with.
    const entityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_ID,
      "SCEL - 00",
    );
    await artifactRegistryEntityLeader.openArtifactRegistry(entityID);
  });

  test("AREL - 01 | @regression Verify No Artifact Found text on the screen", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await artifactRegistryEntityLeader.verifyNoArtifactsFound();
  });

  test("AREL - 02 | @regression Upload artifact from filesTest folder", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await artifactRegistryEntityLeader.uploadArtifact(ARTIFACT_FILE_PATH);
    await artifactRegistryEntityLeader.verifyUploadedFile(ARTIFACT_FILE_NAME);
  });

  test("AREL - 03 | @regression Verify delete artifact", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await artifactRegistryEntityLeader.deleteFirstArtifact();
  });

  test("AREL - 04 | @regression Verify uploaded artifact in linked artifact on question", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const entityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_ID,
      "SCEL - 00",
    );
    const subEntityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_SUBENTITY_ID,
      "SCEL - 00",
    );

    // 1. Upload an artifact first to ensure we have data. AREL - 03 emptied the
    //    registry, so this is not redundant with AREL - 02.
    await artifactRegistryEntityLeader.uploadArtifact(ARTIFACT_FILE_PATH);
    await artifactRegistryEntityLeader.verifyUploadedFile(ARTIFACT_FILE_NAME);

    // 2. Get artifact names from Registry
    const artifactNames = await artifactRegistryEntityLeader.getArtifactNames();
    console.log("Artifact Names from Registry:", artifactNames);

    // 3. Open the SCEL sub-entity's assessment and the question artifact panel.
    //    Deep linked with both UUIDs rather than picking the first Open button:
    //    this client holds several entities, so the first button is not
    //    necessarily the entity whose registry was just uploaded to.
    await artifactRegistryEntityLeader.openSubEntityCollection(
      entityID,
      subEntityID,
    );
    await artifactRegistryEntityLeader.clickFirstQuestionUploadIcon();

    // 4. Get artifact names from Side Registry
    const sideArtifactNames =
      await artifactRegistryEntityLeader.getSideRegistryArtifactNames();
    console.log("Artifact Names from Side Registry:", sideArtifactNames);

    // 5. Verification: the registry upload has to be offered on the question
    expect(sideArtifactNames).toContain(ARTIFACT_FILE_NAME);
  });

  test("AREL - 05 | @regression Verify artifact selection from question", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const entityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_ENTITY_ID,
      "SCEL - 00",
    );
    const subEntityID = required(
      FILE_KEYS.ENTITY_LEADER_SCORE_CALCULATION_SUBENTITY_ID,
      "SCEL - 00",
    );

    await artifactRegistryEntityLeader.openSubEntityCollection(
      entityID,
      subEntityID,
    );
    const questionDetails =
      await artifactRegistryEntityLeader.getQuestionDetails();

    TestData.setKey(
      FILE_KEYS.QUESTION_DETAILS_DATA,
      questionDetails,
      QUESTION_FILE,
      SCOPE,
    );
    console.log("Saved question details using TestData helper");

    const linkedArtifactName =
      await artifactRegistryEntityLeader.linkRandomArtifact();

    // Cross-check from the other side: the question the artifact was linked to
    // must show up on that artifact's own linked-questions list.
    await artifactRegistryEntityLeader.openArtifactRegistry(entityID);
    await artifactRegistryEntityLeader.clickArtifactByName(linkedArtifactName);
    await artifactRegistryEntityLeader.verifyLinkedQuestionDetails(
      questionDetails,
    );
  });
});
