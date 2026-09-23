const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ControlFiltersSubEntityLeader = require("../../../pages/SubEntityLeader/Controls/controlFIltersSubEntityLeader");

const TIMEOUT = 600000;

const storageStatePath = path.join(
  process.cwd(),
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Controls Filter Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - these two tests are INDEPENDENT of each other.
  //
  // The Secure CF - 01 is a pure setup test: it creates a client and an entity
  // and hands the client name to CF - 02 through TestData, which CF - 02 needs
  // in order to navigate back into that client. This role creates neither and
  // has nowhere to navigate back to - it has exactly one assigned entity,
  // provisioned by SSEL - 01, and both tests reach it the same way. So there is
  // no data to hand forward and no CONTROL_FILTER_CLIENT_NAME equivalent here.
  //
  // That leaves CF - 01 with only one thing this role can still do: confirm the
  // controls data is populated and visible. CFSEL - 01 keeps that and asserts on
  // it, rather than staying a setup test with nothing to set up - see
  // verifyControlsTableHasRows() for why the assertion was added.
  //
  // Neither test writes anything: they read the table and apply a filter to the
  // current view, so this file is safe to run at any point after SSEL - 01.
  let controlFiltersSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    controlFiltersSubEntityLeader = new ControlFiltersSubEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await controlFiltersSubEntityLeader.goto("/");
    await controlFiltersSubEntityLeader.waitForLoad();
  });

  test("CFSEL - 01 | @smoke Controls Filter - Verify the controls table is populated for the sub entity leader", async () => {
    test.setTimeout(TIMEOUT);

    // 1) Get to the collection from wherever the restored session landed. This
    //    replaces the whole of the Secure spec's client and entity creation,
    //    but the step itself still matters: the Controls side-menu item only
    //    resolves once the app is inside the entity.
    await controlFiltersSubEntityLeader.ensureOnCollection();

    // 2) Collection -> Controls -> Table.
    await controlFiltersSubEntityLeader.navigateToControlsTable();

    // 3) The table has to carry rows. The page object owns the assertion; this
    //    is the check the Secure CF - 01 can leave implicit because it created
    //    the entity itself moments earlier.
    const rowCount =
      await controlFiltersSubEntityLeader.verifyControlsTableHasRows();
    console.log(`Controls table populated with ${rowCount} row(s).`);
  });

  test("CFSEL - 02 | @smoke Controls Filter - Random Filter Verification as the sub entity leader", async () => {
    test.setTimeout(TIMEOUT);

    // 1) Get to the collection, then Controls -> Table. The Secure spec spends
    //    its Step 1 re-finding the client it stored in TestData; this role has
    //    none to find.
    await controlFiltersSubEntityLeader.ensureOnCollection();
    await controlFiltersSubEntityLeader.navigateToControlsTable();

    // 2) Snapshot every row BEFORE filtering. Taken first so the comparison is
    //    against the unfiltered table rather than against the screen the
    //    assertion is checking.
    const allRowsSnapshot =
      await controlFiltersSubEntityLeader.getAllTableRowData();
    console.log(`Pre-filter snapshot: ${allRowsSnapshot.length} row(s).`);

    // 3) Open the panel and apply one random category/option pair.
    await controlFiltersSubEntityLeader.openFilterPanel();
    const selectedFilters =
      await controlFiltersSubEntityLeader.selectOneRandomFilter();
    await controlFiltersSubEntityLeader.applyFilters();

    // 4) Every row still displayed must satisfy the applied filter. A filter
    //    that matches nothing is a valid result and is treated as such by the
    //    page object, which owns the assertion.
    await controlFiltersSubEntityLeader.verifyFilteredRows(
      allRowsSnapshot,
      selectedFilters,
    );
    console.log("Random filter verification passed.");
  });
});
