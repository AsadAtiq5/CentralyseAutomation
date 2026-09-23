const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const StartFreshSubEntityLeader = require("../../../pages/SubEntityLeader/Collection/startFreshSubEntityLeader");

const TIMEOUTS = {
  // No questions are answered here - SCSEL - 01 does that. The only long step
  // left is the post-wipe sweep, which pages through every question set once.
  LONG: 600000,
};

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Start Fresh Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - this spec both DEPENDS ON and DESTROYS the shared assessment.
  //
  // Depends on: SCSEL - 01 answers Business Email Compromise end to end. This
  // spec does not answer anything itself - it reads the score that pass left on
  // the card, which is the value the archive then has to hold. Run against an
  // unanswered assessment there is no meaningful score to archive and the
  // post-wipe sweep passes trivially.
  //
  // Destroys: Start Fresh clears that entity's answers and archives them. This
  // role has ONE assigned entity, provisioned by SSEL - 01 and shared by every
  // spec in the suite, so this also invalidates the answer set SCSEL - 01 stored
  // and AFSEL - 01 reads back. It therefore has to run after both.
  //
  // The Secure SF - 01 needs neither caveat: it builds its own client and
  // multi-entity, answers them itself, and wipes a framework nothing else uses.
  let startFreshSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    startFreshSubEntityLeader = new StartFreshSubEntityLeader(page);
    // Armed before navigating: the assessment is already fully answered when
    // this spec runs, so the chapter completion modal surfaces once the
    // collection is opened and intercepts every click underneath it.
    await startFreshSubEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await startFreshSubEntityLeader.goto("/");
    await startFreshSubEntityLeader.waitForLoad();
  });

  test("SFSEL - 01 | @smoke Start Fresh clears the answers and archives the score as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Business Email Compromise, addressed BY NAME throughout: this entity can
    // carry more than one framework, and nothing pins which card the collection
    // paints first.
    const frameworkName = StartFreshSubEntityLeader.DEFAULT_FRAMEWORK;

    // 1) Get to the collection from wherever the restored session landed. This
    //    replaces the whole of the Secure spec's Step 1-4 setup: there is no
    //    client or entity to create and no picker to go through, the leader is
    //    already inside its one assigned entity.
    await startFreshSubEntityLeader.ensureOnCollection();

    // 2) Save the score off the card before wiping it. No reload is needed
    //    first - the answers were saved by SCSEL - 01 in an earlier spec, so
    //    the collection this run just loaded already renders the settled score.
    const frameworkScore =
      await startFreshSubEntityLeader.getScoreByName(frameworkName);
    console.log(`Saved framework score: ${frameworkScore}`);

    // 3) Open the edit panel and pick the framework to wipe.
    await startFreshSubEntityLeader.openEditFrameworkPanel();
    await startFreshSubEntityLeader.selectFrameworkCard(frameworkName);

    // 4) Start Fresh, then confirm it in the footer dialog.
    await startFreshSubEntityLeader.openStartFreshModal();
    await startFreshSubEntityLeader.confirmStartFresh();

    // 5) Reopen the assessment - every answer must be gone. The page object
    //    owns the assertion and walks every page of questions.
    await startFreshSubEntityLeader.openFrameworkByName(frameworkName);
    await startFreshSubEntityLeader.verifyAllAnswersRemoved();

    // 6) The archived card must still carry the pre-wipe score. That value was
    //    captured in step 2 and is never read back off the screen being
    //    asserted.
    await startFreshSubEntityLeader.openArchiveWhenReady();
    await startFreshSubEntityLeader.verifyArchivedCardScoreByName(
      frameworkName,
      frameworkScore,
    );
  });
});
