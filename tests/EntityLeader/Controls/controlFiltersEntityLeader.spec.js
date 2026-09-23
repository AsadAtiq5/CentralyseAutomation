const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ControlFiltersEntityLeader = require("../../../pages/EntityLeader/Controls/controlFiltersEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUT = 600000;

const ENTITY_PREFIX = "CFEL_Entity";

// Shares the controls data file with the Controls Table suite, mirroring Secure
// where CONTROL_FILTER_CLIENT_NAME sits alongside CONTROL_CLIENT_NAME in
// control.json. The two suites use different keys, so neither overwrites the
// other.
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
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Controls/controlFiltersEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Controls Filter Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - CFEL - 02 depends on CFEL - 01 for the entity name.
  //
  // That is the Secure shape with one substitution. CF - 01 creates a client
  // and an entity and hands the CLIENT name to CF - 02, which needs it to
  // navigate back in. This role has no client to create or navigate back to,
  // but it does need to reach the same SUB-ENTITY - the Controls table's own
  // dropdown defaults to "All", so the entity has to be re-selected on every
  // visit and its name is what CFEL - 02 cannot re-derive.
  //
  // CFEL - 01 also does more than set up. The Secure CF - 01 navigates and
  // asserts nothing, which is defensible there because it created the entity
  // moments earlier; here the populated-table check is made explicit, so the
  // test cannot pass on an empty table.
  //
  // Neither test writes anything to the application: they read the table and
  // apply a filter to the current view. The only mutation in this file is the
  // sub-entity CFEL - 01 creates.
  let controlFiltersEntityLeader;

  test.beforeEach(async ({ page }) => {
    controlFiltersEntityLeader = new ControlFiltersEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await controlFiltersEntityLeader.goto("/");
    await controlFiltersEntityLeader.waitForLoad();
  });

  test("CFEL - 01 | @smoke Controls Filter - Setup: create entity and verify the controls table is populated", async () => {
    test.setTimeout(TIMEOUT);

    // 1. Arrival, not navigation - the session puts this role on the upperdeck.
    //    This replaces the Secure spec's /clients navigation, client creation
    //    and click-into-client entirely.
    await controlFiltersEntityLeader.ensureOnUpperdeck();

    // 2/3. Create the sub-entity this suite filters, on Business Email
    //      Compromise. The framework is what puts controls in the table at all.
    await controlFiltersEntityLeader.navigateToMultiEntity();
    const entityName =
      await controlFiltersEntityLeader.createEntityWithBEC(ENTITY_PREFIX);

    // 4/5. Collection, then Controls > Table, scoped to that entity. Visiting
    //      the collection is also what populates the controls data, which is
    //      why the Secure spec makes the same trip.
    await controlFiltersEntityLeader.openControlsTableForEntity(entityName);

    // 6. The table has to carry rows. The page object owns the assertion; this
    //    is the check the Secure CF - 01 leaves implicit.
    const rowCount =
      await controlFiltersEntityLeader.verifyControlsTableHasRows();
    console.log(`Controls table populated with ${rowCount} row(s).`);

    // 7. Hand the entity name forward - CFEL - 02 has to re-select it, and the
    //    name is generated per run so it cannot be re-derived.
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_CONTROL_FILTER_ENTITY_NAME,
      entityName,
      FILE,
      SCOPE,
    );
    console.log(`Saved filter entity: "${entityName}"`);
  });

  test("CFEL - 02 | @smoke Controls Filter - Random Filter Verification", async () => {
    test.setTimeout(TIMEOUT);

    const entityName = required(
      FILE_KEYS.ENTITY_LEADER_CONTROL_FILTER_ENTITY_NAME,
      "CFEL - 01",
    );
    console.log(`Using entity: "${entityName}"`);

    // 1/2. Arrival, then Controls > Table scoped to the same entity. The Secure
    //      spec spends its Step 1 re-finding the client it stored; this role
    //      re-selects the entity instead.
    await controlFiltersEntityLeader.ensureOnUpperdeck();
    await controlFiltersEntityLeader.openControlsTableForEntity(entityName);

    // 3. Snapshot every row BEFORE filtering. Taken first so the comparison is
    //    against the unfiltered table rather than against the screen the
    //    assertion is checking.
    const allRowsSnapshot =
      await controlFiltersEntityLeader.getAllTableRowData();
    console.log(`Pre-filter snapshot: ${allRowsSnapshot.length} row(s).`);

    // 4. Open the panel and apply one random category/option pair.
    await controlFiltersEntityLeader.openFilterPanel();
    const selectedFilters =
      await controlFiltersEntityLeader.selectOneRandomFilter();
    await controlFiltersEntityLeader.applyFilters();

    // 5. Every row still displayed must satisfy the applied filter. A filter
    //    that matches nothing is a valid result and is treated as such by the
    //    page object, which owns the assertion.
    await controlFiltersEntityLeader.verifyFilteredRows(
      allRowsSnapshot,
      selectedFilters,
    );
    console.log("Random filter verification passed.");
  });
});
