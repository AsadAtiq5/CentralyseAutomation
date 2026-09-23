const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AddCommentSubEntityLeader = require("../../../pages/SubEntityLeader/Collection/addCommentSubEntityLeader");

const TIMEOUTS = {
  LONG: 600000,
};

const COMMENT_TEXT = "Test comment verify";

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Add Comment Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  let addCommentSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    addCommentSubEntityLeader = new AddCommentSubEntityLeader(page);
    // Armed before navigating: on a fully answered assessment the chapter
    // completion modal surfaces part-way through the question work and
    // intercepts every click underneath it.
    await addCommentSubEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await addCommentSubEntityLeader.goto("/");
    await addCommentSubEntityLeader.waitForLoad();
  });

  test("ACMSEL - 01 | @smoke Add a comment on the collection questions as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) The leader lands on multi entity, not the collection, so the screen is
    //    confirmed before navigating on from it.
    await addCommentSubEntityLeader.verifyOnMultiEntityScreen();

    // 2) Side menu is the only route to the collection for this role - there is
    //    no client/entity picker to go through first.
    await addCommentSubEntityLeader.navigateToCollectionFromSideMenu();

    // 3) Open the assessment the comments are added to.
    const frameworkName = await addCommentSubEntityLeader.openFirstFramework();
    console.log(`Commenting on framework: ${frameworkName}`);

    // 4) Walk every question set adding the comment. The page object verifies
    //    each comment it adds, so there is nothing left for the spec to assert.
    await addCommentSubEntityLeader.addCommentToAllQuestionSets(COMMENT_TEXT);
  });
});
