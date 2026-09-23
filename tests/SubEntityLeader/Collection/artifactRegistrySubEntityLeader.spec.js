const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ArtifactRegistrySubEntityLeader = require("../../../pages/SubEntityLeader/Collection/artifactRegistrySubEntityLeader");
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

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Artifact Registry Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // These tests share registry state and MUST run in declaration order:
  // ARSEL - 01 asserts the registry is empty, 02 uploads into it, 03 empties it
  // again, and 04 re-uploads so 05 has something to link. The suite runs with
  // workers: 1 and fullyParallel: false, which preserves that order.
  let artifactRegistrySubEntityLeader;

  test.beforeEach(async ({ page }) => {
    artifactRegistrySubEntityLeader = new ArtifactRegistrySubEntityLeader(page);
    // Armed before navigating: this assessment is fully answered, so the
    // chapter completion modal surfaces once the collection is opened and
    // intercepts every click underneath it.
    await artifactRegistrySubEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await artifactRegistrySubEntityLeader.goto("/");
    await artifactRegistrySubEntityLeader.waitForLoad();

    // The leader lands on multi entity, so the registry is reached from the
    // side menu rather than by URL.
    await artifactRegistrySubEntityLeader.verifyOnMultiEntityScreen();
    await artifactRegistrySubEntityLeader.navigateToArtifactRegistry();
  });

  test("ARSEL - 01 | @regression Verify No Artifact Found text on the screen", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await artifactRegistrySubEntityLeader.verifyNoArtifactsFound();
  });

  test("ARSEL - 02 | @regression Upload artifact from filesTest folder", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await artifactRegistrySubEntityLeader.uploadArtifact(ARTIFACT_FILE_PATH);
    await artifactRegistrySubEntityLeader.verifyUploadedFile(
      ARTIFACT_FILE_NAME,
    );
  });

  test("ARSEL - 03 | @regression Verify delete artifact", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await artifactRegistrySubEntityLeader.deleteFirstArtifact();
  });

  test("ARSEL - 04 | @regression Verify uploaded artifact in linked artifact on question", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1. Upload an artifact first to ensure we have data
    await artifactRegistrySubEntityLeader.uploadArtifact(ARTIFACT_FILE_PATH);
    await artifactRegistrySubEntityLeader.verifyUploadedFile(
      ARTIFACT_FILE_NAME,
    );

    // 2. Get artifact names from Registry
    const artifactNames =
      await artifactRegistrySubEntityLeader.getArtifactNames();
    console.log("Artifact Names from Registry:", artifactNames);

    // 3. Open collection and navigate to question upload
    await artifactRegistrySubEntityLeader.openCollection();
    await artifactRegistrySubEntityLeader.clickFirstQuestionUploadIcon();

    // 4. Get artifact names from Side Registry
    const sideArtifactNames =
      await artifactRegistrySubEntityLeader.getSideRegistryArtifactNames();
    console.log("Artifact Names from Side Registry:", sideArtifactNames);

    // 5. Verification: the registry upload has to be offered on the question
    expect(sideArtifactNames).toContain(ARTIFACT_FILE_NAME);
  });

  test("ARSEL - 05 | @regression Verify artifact selection from question", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    await artifactRegistrySubEntityLeader.openCollection();
    const questionDetails =
      await artifactRegistrySubEntityLeader.getQuestionDetails();

    TestData.setKey(
      FILE_KEYS.QUESTION_DETAILS_DATA,
      questionDetails,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_ARTIFACT_QUESTION,
      APP_SCOPE.SUB_ENTITY_LEADER,
    );
    console.log("Saved question details using TestData helper");

    const linkedArtifactName =
      await artifactRegistrySubEntityLeader.linkRandomArtifact();

    // Cross-check from the other side: the question the artifact was linked to
    // must show up on that artifact's own linked-questions list.
    await artifactRegistrySubEntityLeader.navigateToArtifactRegistry();
    await artifactRegistrySubEntityLeader.clickArtifactByName(
      linkedArtifactName,
    );
    await artifactRegistrySubEntityLeader.verifyLinkedQuestionDetails(
      questionDetails,
    );
  });
});
