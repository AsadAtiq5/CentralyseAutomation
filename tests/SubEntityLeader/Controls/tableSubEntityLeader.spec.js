const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const TableSubEntityLeader = require("../../../pages/SubEntityLeader/Controls/tableSubEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  // CTSEL - 01 and CTSEL - 02 only drive the table and its tags panel.
  LONG: 600000,
  // CTSEL - 03 additionally opens the settings panel on every question across
  // every question set, which is the long pole in this file.
  EXTRA_LONG: 1200000,
};

// Tag names are capped at 10 characters by the Dynamic Labels input, and are
// generated per run so a re-run never collides with a tag already on the entity.
const newTagName = () => `tg${Math.random().toString(36).slice(2, 8)}`;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Controls Table Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - CTSEL - 02 depends on CTSEL - 01.
  //
  // The Secure CT - 01 creates its own client and entity and hands the client
  // name plus the tag name to CT - 02 through TestData; CT - 03 then builds a
  // second client and entity of its own, so it is independent. This role can
  // create none of that - it has exactly one assigned entity, provisioned by
  // SSEL - 01 - so all three tests run against the same controls table.
  //
  // Only the TAG NAME therefore needs handing forward: it is random, so
  // CTSEL - 02 cannot re-derive the tag it has to remove. There is no client or
  // entity name to store alongside it.
  //
  // CTSEL - 03 mints its own tag, so it does not collide with the one
  // CTSEL - 01 assigns - and unlike the Secure CT - 03 it needs no setup of its
  // own. workers: 1 and fullyParallel: false preserve declaration order.
  //
  // These tests are additive: they attach label metadata to controls and never
  // touch an answer, so this file is safe to run before the specs that rewrite
  // the assessment.
  let tableSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    tableSubEntityLeader = new TableSubEntityLeader(page);
    // Armed before navigating: the assessment is fully answered by the time
    // this suite reaches here, so the chapter completion modal surfaces during
    // the question work in CTSEL - 03 and intercepts clicks underneath it.
    await tableSubEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await tableSubEntityLeader.goto("/");
    await tableSubEntityLeader.waitForLoad();
  });

  test("CTSEL - 01 | @smoke Controls Table - Add tag and verify assigned tag as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Get to the collection from wherever the restored session landed. This
    //    replaces the whole of the Secure spec's Step 1-3 setup, but the step
    //    itself still matters: the Controls side-menu item only resolves once
    //    the app is inside the entity.
    await tableSubEntityLeader.ensureOnCollection();

    // 2) Collection -> Controls -> Table.
    await tableSubEntityLeader.navigateToControlsTable();

    // 3) Open the Dynamic Labels panel and mint a new tag.
    await tableSubEntityLeader.clickEditIcon();
    await tableSubEntityLeader.clickAddTagButton();
    const tagName = await tableSubEntityLeader.createTag(newTagName());
    console.log(`Tag name to add: "${tagName}"`);

    // 4) Drag it onto the first row's tag column and save.
    await tableSubEntityLeader.dragTagToTableRow(tagName);
    await tableSubEntityLeader.saveAndWaitForToast();

    // 5) The tag has to be rendered against that row - the page object owns the
    //    assertion.
    await tableSubEntityLeader.verifyTagInFirstRow(tagName);

    // 6) Hand the tag forward. It is random, so CTSEL - 02 cannot re-derive the
    //    tag it has to remove.
    TestData.setKey(
      FILE_KEYS.SUB_ENTITY_LEADER_CONTROL_TAG_NAME,
      tagName,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_CONTROL,
      APP_SCOPE.SUB_ENTITY_LEADER,
    );
    console.log(`Tag "${tagName}" added and assigned to the first row.`);
  });

  test("CTSEL - 02 | @smoke Controls Table - Delete tag from question as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const tagName = TestData.getKey(
      FILE_KEYS.SUB_ENTITY_LEADER_CONTROL_TAG_NAME,
      TEST_DATA_FILE_ENUMS.SUB_ENTITY_LEADER_CONTROL,
      APP_SCOPE.SUB_ENTITY_LEADER,
    );

    // Name the producer instead of letting a locator time out further down - a
    // missing key here means CTSEL - 01 has not run, not a tag-removal bug.
    if (!tagName) {
      throw new Error(
        "Missing sub entity leader control tag. Run CTSEL - 01 in tests/SubEntityLeader/Controls/tableSubEntityLeader.spec.js before this spec.",
      );
    }
    console.log(`Removing tag: "${tagName}"`);

    // 1) Get to the collection, then Controls -> Table. The Secure spec spends
    //    its Step 1 re-finding the client it stored; this role has none to find.
    await tableSubEntityLeader.ensureOnCollection();
    await tableSubEntityLeader.navigateToControlsTable();

    // 2) Open the Dynamic Labels panel - the cross on an assigned tag only
    //    renders in edit mode.
    await tableSubEntityLeader.clickEditIcon();

    // 3) Click the cross on the tag in the first row, then save.
    await tableSubEntityLeader.clickTagCrossInFirstRow(tagName);
    await tableSubEntityLeader.saveAndWaitForToast();

    // 4) The tag must be gone from that row.
    await tableSubEntityLeader.verifyTagNotInFirstRow(tagName);
    console.log(`Tag "${tagName}" deleted from the first row.`);
  });

  test("CTSEL - 03 | @smoke Controls Table - Assign tag to all questions and verify in collection as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    const frameworkName = TableSubEntityLeader.DEFAULT_FRAMEWORK;

    // 1) Get to the collection, then Controls -> Table. The Secure CT - 03
    //    builds a second client and entity for itself to stay independent of
    //    CT - 01; this test stays independent by minting its own tag instead.
    await tableSubEntityLeader.ensureOnCollection();
    await tableSubEntityLeader.navigateToControlsTable();

    // 2) Open the Dynamic Labels panel and mint a tag of its own.
    await tableSubEntityLeader.clickEditIcon();
    await tableSubEntityLeader.clickAddTagButton();
    const tagName = await tableSubEntityLeader.createTag(newTagName());
    console.log(`Tag name: "${tagName}"`);

    // 3) Drop it on "Assign To All The Controls" and save - one action instead
    //    of a drag per row.
    await tableSubEntityLeader.dragTagToAllControls(tagName);
    await tableSubEntityLeader.saveAndWaitForToast();

    // 4) Back to the collection and into the assessment. This is the check that
    //    the assignment reached the questions, not just the controls table.
    await tableSubEntityLeader.ensureOnCollection();
    await tableSubEntityLeader.openFrameworkByName(frameworkName);

    // 5) Every question's settings panel has to show the tag. The page object
    //    owns the assertion and walks every question set.
    await tableSubEntityLeader.verifyTagInAllQuestionsSettings(tagName);
    console.log(`Tag "${tagName}" verified in all question settings.`);
  });
});
