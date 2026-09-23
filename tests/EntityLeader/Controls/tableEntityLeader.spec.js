const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const TableEntityLeader = require("../../../pages/EntityLeader/Controls/tableEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  // CTEL - 01 and CTEL - 02 create a sub-entity and drive the table and its
  // tags panel.
  LONG: 600000,
  // CTEL - 03 additionally opens the settings panel on every question across
  // every question set, which is the long pole in this file.
  EXTRA_LONG: 1200000,
};

const TEST_DATA = {
  ENTITY_PREFIX: "CTEL_Entity",
  ALL_CONTROLS_ENTITY_PREFIX: "CTEL_All",
};

// Tag names are capped at 10 characters by the Dynamic Labels input, and are
// generated per run so a re-run never collides with a tag already there.
const newTagName = () => `tg${Math.random().toString(36).slice(2, 8)}`;

// This suite owns its OWN data file: the only thing crossing tests is the tag
// name CTEL - 01 mints, which is random and cannot be re-derived, plus the
// entity it minted it on.
const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_CONTROL;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Controls/tableEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Controls Table Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - CTEL - 02 depends on CTEL - 01; CTEL - 03 is independent.
  //
  // That is the Secure shape exactly. CT - 01 creates its own client and entity
  // and hands the client name plus the tag name to CT - 02; CT - 03 then builds
  // a second client and entity of its own. Here there is no client to create,
  // so each of the two setup steps builds a SUB-ENTITY instead, and the entity
  // name takes the place of the client name in the handoff.
  //
  // The tag name is the part that genuinely has to be stored: it is random, so
  // CTEL - 02 cannot re-derive the tag it has to remove. CTEL - 03 mints its
  // own, so it never collides with CTEL - 01's.
  //
  // These tests are additive - they attach label metadata to controls and never
  // touch an answer - so this file disturbs no other EntityLeader spec's data.
  // workers: 1 and fullyParallel: false preserve declaration order.
  let tableEntityLeader;

  test.beforeEach(async ({ page }) => {
    tableEntityLeader = new TableEntityLeader(page);
    // Armed before navigating: CTEL - 03 walks every question's settings panel,
    // and the chapter completion modal surfaces part-way through that work and
    // intercepts every click underneath it.
    await tableEntityLeader.registerChapterCompletionModalHandler();
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await tableEntityLeader.goto("/");
    await tableEntityLeader.waitForLoad();
  });

  test("CTEL - 01 | @smoke Controls Table - Add tag and verify assigned tag", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1. Arrival, not navigation - the session puts this role on the upperdeck.
    //    This replaces the Secure spec's /clients navigation and client
    //    creation entirely.
    await tableEntityLeader.ensureOnUpperdeck();

    // 2/3. Create the sub-entity this test tags, on Business Email Compromise.
    await tableEntityLeader.navigateToMultiEntity();
    const entityName = await tableEntityLeader.createEntityWithBEC(
      TEST_DATA.ENTITY_PREFIX,
    );

    // 4. Collection, then Controls > Table, SCOPED to the entity just created.
    //    The table's own entity dropdown defaults to "All", so without this
    //    the first row would belong to whichever entity sorts first. The page
    //    object also reloads if the table settles without rendering rows.
    await tableEntityLeader.openControlsTableForEntity(entityName);

    // 5/6/7. Open the Dynamic Labels panel and mint a new tag.
    await tableEntityLeader.clickEditIcon();
    await tableEntityLeader.clickAddTagButton();
    const tagName = await tableEntityLeader.createTag(newTagName());
    console.log(`Tag name to add: "${tagName}"`);

    // 8/9/10. Drag it onto the first row's tag column and save. The toast is
    //         what proves the change reached the backend.
    await tableEntityLeader.dragTagToTableRow(tagName);
    await tableEntityLeader.saveAndWaitForToast();

    // 11. The tag has to be rendered against that row - the page object owns
    //     the assertion.
    await tableEntityLeader.verifyTagInFirstRow(tagName);

    // 12. Hand both forward. The tag is random, so CTEL - 02 cannot re-derive
    //     the tag it has to remove, and the entity name takes the place of the
    //     client name the Secure spec stores.
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_CONTROL_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_CONTROL_TAG_NAME,
      tagName,
      FILE,
      SCOPE,
    );
    console.log(`Saved test data - entity: "${entityName}", tag: "${tagName}"`);
  });

  test("CTEL - 02 | @smoke Controls Table - Delete tag from question", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const entityName = required(
      FILE_KEYS.ENTITY_LEADER_CONTROL_ENTITY_NAME,
      "CTEL - 01",
    );
    const tagName = required(
      FILE_KEYS.ENTITY_LEADER_CONTROL_TAG_NAME,
      "CTEL - 01",
    );
    console.log(`Using entity: "${entityName}", tag: "${tagName}"`);

    // 1. Arrival. The Secure spec spends its Step 1 re-finding the client it
    //    stored; this role has no client to re-find, only the entity.
    await tableEntityLeader.ensureOnUpperdeck();

    // 2. Back to Controls > Table, scoped to the SAME entity. That is what
    //    makes "the first row" here the row CTEL - 01 tagged; on the default
    //    "All" scope it would be a different row entirely.
    await tableEntityLeader.openControlsTableForEntity(entityName);

    // 3. Open the Dynamic Labels panel - the cross on an assigned tag only
    //    renders in edit mode.
    await tableEntityLeader.clickEditIcon();

    // 4/5. Click the cross on the tag in the first row, then save.
    await tableEntityLeader.clickTagCrossInFirstRow(tagName);
    await tableEntityLeader.saveAndWaitForToast();

    // 6. The tag must be gone from that row.
    await tableEntityLeader.verifyTagNotInFirstRow(tagName);
    console.log(`Tag "${tagName}" deleted from the first row.`);
  });

  test("CTEL - 03 | @smoke Controls Table - Assign tag to all questions and verify in collection", async () => {
    test.setTimeout(TIMEOUTS.EXTRA_LONG);

    const frameworkName = TableEntityLeader.DEFAULT_FRAMEWORK;

    // 1. Arrival.
    await tableEntityLeader.ensureOnUpperdeck();

    // 2. Create this test's own sub-entity. The Secure CT - 03 builds a second
    //    client and entity to stay independent of CT - 01; this does the same
    //    one level down, so the assign-to-all has a controls table of its own
    //    and cannot be confused with the row CTEL - 01 tagged.
    await tableEntityLeader.navigateToMultiEntity();
    const entityName = await tableEntityLeader.createEntityWithBEC(
      TEST_DATA.ALL_CONTROLS_ENTITY_PREFIX,
    );

    // 3/4. Collection, then Controls > Table, scoped to this test's entity. The
    //      scope matters most here: on the default "All" scope, "Assign To All
    //      The Controls" would tag every control in the client rather than this
    //      entity's.
    await tableEntityLeader.openControlsTableForEntity(entityName);

    // 5/6. Open the Dynamic Labels panel and mint a tag of its own.
    await tableEntityLeader.clickEditIcon();
    await tableEntityLeader.clickAddTagButton();
    const tagName = await tableEntityLeader.createTag(newTagName());
    console.log(`Tag name: "${tagName}"`);

    // 7/8. Drop it on "Assign To All The Controls" and save - one action
    //      instead of a drag per row.
    await tableEntityLeader.dragTagToAllControls(tagName);
    await tableEntityLeader.saveAndWaitForToast();

    // 9/10/11. Back to the collection and into the assessment. This is the
    //          check that the assignment reached the questions, not just the
    //          controls table.
    await tableEntityLeader.openEntityCollection(entityName);
    await tableEntityLeader.openFrameworkByName(frameworkName);

    // 12. Every question's settings panel has to show the tag. The page object
    //     owns the assertion and walks every question set.
    await tableEntityLeader.verifyTagInAllQuestionsSettings(tagName);
    console.log(`Tag "${tagName}" verified in all question settings.`);
  });
});
