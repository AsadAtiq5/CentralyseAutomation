const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const ControlsFilterPage = require("../../Secure/Controls/Filter");
const TableEntityLeader = require("./tableEntityLeader");

// Drives the Controls > Table filter panel as the ENTITY LEADER.
//
// The filter panel itself is delegated to the Secure ControlsFilterPage
// (`this.filter`) with no adaptation at all: it addresses the table by row
// position and the panel by category title, and neither carries an entity or
// client name. That is the whole screen apart from getting to it.
//
// GETTING TO IT IS DELEGATED TOO - to the sibling TableEntityLeader
// (`this.controlsTable`), which already owns arrival, sub-entity creation, and
// the two things this screen needs that no Secure page object provides:
// selecting the entity in the Controls table's own dropdown, and reloading when
// the table settles without rendering rows.
//
// WHY COMPOSE A SIBLING rather than copy those methods in, which is what the
// rest of this suite does for ensureOnUpperdeck(): those dropdown selectors
// were written from the live markup and have not yet been through a green run.
// A second copy would mean fixing the same selector twice when the first run
// tells us something about it. The cost is a coupling between two page objects
// in the same suite, which the house rule against editing existing methods in
// place already keeps safe.
//
// WHY THE TABLE IS SCOPED TO ONE ENTITY here, given the filter check works at
// any scope: getAllTableRowData() reads eight cells per row and this suite
// calls it twice, before and after filtering. At the dropdown's default "All"
// the snapshot covers every entity in a client that every other spec in the job
// adds to, so the cost grows with the suite. Scoped to one BEC entity it is a
// couple of dozen rows. The trade-off is that the panel's "Entity" category
// then offers a single option, so a random pick landing there is trivially
// satisfied - it still passes correctly, it just proves less that run.
class ControlFiltersEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.filter = new ControlsFilterPage(page);
    this.controlsTable = new TableEntityLeader(page);
  }

  // --- arrival and setup ----------------------------------------------------

  async ensureOnUpperdeck(timeoutMs = 120000) {
    await this.controlsTable.ensureOnUpperdeck(timeoutMs);
  }

  async navigateToMultiEntity() {
    await this.controlsTable.navigateToMultiEntity();
  }

  // Creates the sub-entity this suite filters, on Business Email Compromise
  // with user-based collection, and returns its name.
  //
  // A framework is what puts controls in the table at all - an entity with none
  // would give CFEL - 01 an empty table to assert on and CFEL - 02 nothing to
  // filter.
  async createEntityWithBEC(prefix = "CFEL_Entity") {
    return await this.controlsTable.createEntityWithBEC(prefix);
  }

  // Collection -> Controls -> Table, scoped to one entity and confirmed to have
  // rendered. The Collection step is not decoration: the Controls side-menu
  // item only resolves once the app is inside the entity.
  async openControlsTableForEntity(entityName) {
    await this.controlsTable.openControlsTableForEntity(entityName);
  }

  // --- table ----------------------------------------------------------------

  // Snapshots every visible row. Returns [] on an empty table rather than
  // throwing, which is why the caller has to decide whether empty is a failure.
  async getAllTableRowData() {
    return await this.filter.getAllTableRowData();
  }

  // Asserts the controls table actually rendered rows, and returns the count so
  // the caller can log it.
  //
  // This is the assertion the Secure CF - 01 leaves implicit: that test creates
  // a client and an entity and then simply navigates, so a populated table is
  // taken as read. Keeping CFEL - 01 a pure setup test would mean a test that
  // navigates, asserts nothing and passes just as happily on an empty table -
  // so the check the Secure version implies is made explicit here.
  //
  // openControlsTableForEntity() has already retried with a reload by this
  // point, so a genuinely empty table here means the entity has no controls
  // rather than that the screen failed to paint.
  async verifyControlsTableHasRows() {
    console.log("Verifying the controls table rendered rows...");
    const rows = await this.getAllTableRowData();
    expect(
      rows.length,
      "The controls table rendered no rows for this entity.",
    ).toBeGreaterThan(0);
    console.log(`Controls table rendered ${rows.length} row(s).`);
    return rows.length;
  }

  // --- filter panel ---------------------------------------------------------

  async openFilterPanel() {
    console.log("Opening the controls filter panel...");
    await this.filter.clickFilterButton();
    console.log("Filter panel open.");
  }

  // Picks ONE random category and one option within it, and returns the
  // selection so the caller can hand it to the verification.
  //
  // One category rather than several, matching the Secure CF - 02: filters
  // combine with AND across categories, so stacking them tends to empty the
  // table and the verification then proves nothing.
  async selectOneRandomFilter() {
    const selected = await this.filter.selectOneRandomFilterCategory();
    console.log("Filter selected:", JSON.stringify(selected));
    return selected;
  }

  async applyFilters() {
    console.log("Applying the selected filter...");
    await this.filter.clickApplyFilterButton();
    await this.waitForSpinner();
    console.log("Filter applied.");
  }

  // Asserts every row still displayed satisfies the applied filter. The page
  // object owns the assertion, and treats a filter that matches nothing as the
  // valid result it is.
  async verifyFilteredRows(allRowsSnapshot, selectedFilters) {
    await this.filter.verifyFilteredRows(allRowsSnapshot, selectedFilters);
  }
}

module.exports = ControlFiltersEntityLeader;
