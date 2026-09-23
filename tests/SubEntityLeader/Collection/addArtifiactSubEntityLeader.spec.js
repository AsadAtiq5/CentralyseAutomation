const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AddArtifactSubEntityLeader = require("../../../pages/SubEntityLeader/Collection/addArtifiactSubEntityLeader");

const TIMEOUTS = {
  LONG: 600000,
};

const EXPECTED_FILE_NAME = "testFile.csv";

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Add Artifact Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  let addArtifactSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    addArtifactSubEntityLeader = new AddArtifactSubEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await addArtifactSubEntityLeader.goto("/");
    await addArtifactSubEntityLeader.waitForLoad();
  });

  test("AASEL - 01 | @smoke Upload an artifact file as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) The leader lands on multi entity, not the collection, so the screen is
    //    confirmed before navigating on from it.
    await addArtifactSubEntityLeader.verifyOnMultiEntityScreen();

    // 2) Side menu is the only route to the collection for this role - there is
    //    no client/entity picker to go through first.
    await addArtifactSubEntityLeader.navigateToCollectionFromSideMenu();

    // 3) Open the assessment the artifact is attached to.
    const frameworkName = await addArtifactSubEntityLeader.openFirstFramework();
    console.log(`Uploading the artifact against framework: ${frameworkName}`);

    // 4) Upload the file. This also opens the download popup as its last step,
    //    which the verification below reads from.
    await addArtifactSubEntityLeader.uploadArtifact();

    // 5) The upload only counts if the file is actually listed against the
    //    question, so the popup contents are what gets asserted.
    await addArtifactSubEntityLeader.verifyUploadedFile(EXPECTED_FILE_NAME);
  });
});
