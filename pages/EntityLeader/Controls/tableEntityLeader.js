const BasePage = require("../../Secure/BasePage");
const { expect } = require("@playwright/test");
const AddEntityPage = require("../../Secure/AddEntityPage");
const CollectionPage = require("../../Secure/CollectionPage");
const ControlsTablePage = require("../../Secure/Controls/Table");

// Drives the Controls > Table screen as the ENTITY LEADER.
//
// Everything on the Controls screen itself is delegated to the Secure
// ControlsTablePage (`this.table`): the side-menu route, the Dynamic Labels
// panel, the CDK drag-and-drop, the save toast and the row assertions are the
// same app components for every role, and they address the table by row
// position rather than by client or entity. Entity creation goes to
// AddEntityPage (`this.entities`) and framework cards to CollectionPage
// (`this.collection`).
//
// WHAT THIS CLASS OWNS
//
//   - Arrival and entity creation. The Secure spec creates a whole CLIENT per
//     test; this role has no /clients screen and is already inside the client
//     ELS - 01 provisioned, so it builds only its own sub-entity.
//
//   - Scoping the table to one entity, which is a step of its own for this
//     role. The Secure spec goes Collection -> Controls -> Table and never
//     picks an entity, because its client holds exactly one. This role's
//     client accumulates entities from every spec in the job, and the Controls
//     table carries its OWN entity dropdown that defaults to "All" - so it
//     opens listing every entity's controls. The collection-side selection
//     does not scope it; selectEntityOnControlsTable() is what does.
//
//     That matters for correctness, not just speed: with "All" selected, "the
//     first row" is whichever entity sorts first, so CTEL - 01 would tag a row
//     belonging to another spec's entity and CTEL - 03 would assign its tag to
//     every control in the client.
//
//   - ensureTableRowsVisible(), because the table can settle empty on first
//     paint. See that method.
//
//   - Opening a framework card BY NAME rather than by index, for the reason the
//     other EntityLeader ports document.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in the other EntityLeader page objects. That is this suite's
// deliberate shape - each one owns its own copy so a change made for one flow
// cannot break another. Lifting an EntityLeaderBasePage would be the right
// cleanup, but it would mean altering page-object methods the shipped EL specs
// already depend on, so it is left as a separate decision.

// Framework the entities this suite builds are provisioned with, via
// selectBusinessEmailCompromise() + selectInitialCollectionMethod().
const DEFAULT_FRAMEWORK = "Business Email Compromise";

class TableEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.entities = new AddEntityPage(page);
    this.collection = new CollectionPage(page);
    this.table = new ControlsTablePage(page);
    this.selectors = {
      // The upperdeck score ring - the first thing to paint on the landing
      // screen, so it is what arrival waits on.
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      chapterCompletionModal: ".chapter-completion-modal",
      // Collection card for one named framework. contains() rather than an
      // exact match: the span can render as "<FRAMEWORK> | <SUBENTITY>", which
      // an exact match can never hit.
      cardByName: (name) =>
        `//div[contains(@class,'entity-card-box')][.//span[contains(@class,'sub-entity-name') and contains(normalize-space(.),'${name}')]]`,
      // Entity dropdown on the Controls table. The click target is the chevron
      // beside the ng-select, not ng-select's own arrow: `.cygov-select` here
      // carries `hide-arrow`, so that arrow is not rendered.
      entityDropdownArrow:
        "//div[contains(@class,'cygov-select')]//div[contains(@class,'arrow-wrapper') and contains(@class,'drop-down-arrow')]",
      // Fallback opener: the element ng-select binds its own open handler to.
      entitySelectContainer: ".cygov-select .ng-select-container",
      // ng-select renders its panel detached from the trigger, at body level.
      entityDropdownPanel: "ng-dropdown-panel",
      // One option in that panel, by exact entity name. Exact rather than
      // contains(): the entities this suite creates share a prefix
      // (CTEL_Entity_ and CTEL_All_) and a re-run leaves more of them, so a
      // substring match could pick the wrong one. The label carries a
      // `capitalize` class, but CSS text-transform does not change the DOM
      // text, so the raw name matches.
      entityDropdownOption: (name) =>
        `//ng-dropdown-panel//div[contains(@class,'ng-option')]//span[contains(@class,'ng-option-label') and normalize-space(text())='${name}']`,
      // Currently selected value, used to keep the selection idempotent.
      entitySelectedLabel: ".cygov-select .ng-value-label",
    };
  }

  // --- arrival --------------------------------------------------------------

  // Confirms the session landed on the client's upperdeck. This is an arrival
  // check, not navigation: the app routes this role there by itself once the
  // saved session is restored. The wait is generous because this is the first
  // authenticated render of the run.
  async ensureOnUpperdeck(timeoutMs = 120000) {
    console.log("Verifying the entity leader landed on the upperdeck...");
    await expect(this.page).toHaveURL(/\/upperdeck/, { timeout: timeoutMs });
    await this.waitForSpinner();
    await this.page
      .locator(this.selectors.overallScoreBox)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Entity leader is on the upperdeck.");
  }

  // --- multi entity ---------------------------------------------------------

  async navigateToMultiEntity() {
    console.log("Navigating to the Multi Entity screen...");
    await this.entities.clickMultiEntitySidebar();
    console.log("Multi Entity screen open.");
  }

  // Creates one sub-entity on Business Email Compromise with user-based
  // collection, and returns its name.
  //
  // Mirrors the Secure spec's own creation steps rather than
  // addEntityWithBusinessEmailCompromiseUserBased(): CT - 01 and CT - 03 both
  // pick the framework and the collection method explicitly and never walk the
  // framework-settings pages, so this keeps the same shape.
  async createEntityWithBEC(prefix = "CTEL_Entity") {
    await this.entities.clickNewEntity();
    const entityName = await this.entities.createUniqueEntityName(prefix);
    await this.entities.selectBusinessEmailCompromise();
    await this.entities.selectInitialCollectionMethod();
    await this.entities.clickEntityAdd();
    await this.entities.waitForToast();
    await this.entities.verifyEntityInList(entityName);
    console.log(`Entity created for the controls flow: ${entityName}`);
    return entityName;
  }

  // --- navigation to the controls table -------------------------------------

  // Opens one entity's collection by NAME through the side menu and the entity
  // dropdown, which pins the entity before Controls is opened.
  async openEntityCollection(entityName) {
    console.log(`Opening the collection for entity: ${entityName}`);
    await this.entities.navigateToCollection();
    await this.entities.selectEntityAndNavigate(entityName);
    await this.waitForSpinner();
    console.log("Collection open.");
  }

  // Collection -> Controls -> Table.
  //
  // The Collection step is not decoration: the Controls side-menu item only
  // resolves once the app is inside the entity, so openEntityCollection() has
  // to have run first.
  async navigateToControlsTable() {
    console.log("Navigating to Controls > Table...");
    await this.table.navigateToControlsTable();
    await this.waitForSpinner();
    console.log("Controls Table open.");
  }

  // Reads the entity currently selected in the Controls table dropdown. Returns
  // "" when nothing has rendered yet; the default selection reads "All".
  async getSelectedEntityOnControlsTable() {
    const label = this.page.locator(this.selectors.entitySelectedLabel).first();
    if ((await label.count()) === 0) {
      return "";
    }
    return (await label.innerText())?.trim() ?? "";
  }

  // Scopes the Controls table to ONE entity through its own dropdown.
  //
  // This has to happen before the edit icon is clicked. The dropdown defaults
  // to "All", so the table opens listing every entity's controls, and every
  // row-position assertion in this suite - the first row's tag column, and the
  // set of controls "Assign To All" reaches - would otherwise be about the
  // wrong entity.
  //
  // Idempotent: returns early when the entity is already selected, so it is
  // safe to call again after a reload.
  async selectEntityOnControlsTable(entityName, timeoutMs = 60000) {
    if ((await this.getSelectedEntityOnControlsTable()) === entityName) {
      console.log(`Controls table is already scoped to: ${entityName}`);
      return;
    }

    console.log(`Scoping the Controls table to entity: ${entityName}`);
    const arrow = this.page.locator(this.selectors.entityDropdownArrow).first();
    await arrow.waitFor({ state: "visible", timeout: timeoutMs });
    await arrow.click({ force: true });

    // Wait on the PANEL rather than assuming the chevron opened it: the chevron
    // is a sibling of the ng-select, so whether it opens the panel depends on
    // the wrapper's own click handler. The ng-select container is the fallback.
    const panel = this.page.locator(this.selectors.entityDropdownPanel).first();
    const opened = await panel
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (!opened) {
      console.log("Chevron did not open the panel - clicking the ng-select...");
      await this.page
        .locator(this.selectors.entitySelectContainer)
        .first()
        .click({ force: true });
      await panel.waitFor({ state: "visible", timeout: timeoutMs });
    }

    const option = this.page
      .locator(this.selectors.entityDropdownOption(entityName))
      .first();
    await option.waitFor({ state: "visible", timeout: timeoutMs });
    await option.click({ force: true });

    // The panel closing is the signal the selection was taken; the table then
    // refetches, which the spinner covers.
    await panel
      .waitFor({ state: "hidden", timeout: timeoutMs })
      .catch(() => {});
    await this.waitForSpinner();
    console.log(`Controls table scoped to entity: ${entityName}`);
  }

  // Makes sure the controls table has actually rendered its rows, reloading and
  // re-scoping until it does. Returns the row count so a caller can log it.
  //
  // Why a reload rather than a longer wait: the table can settle EMPTY after
  // the entity is selected - the request resolves, the spinner clears, no rows
  // paint - and it does not recover on its own. There is nothing left to wait
  // for at that point, so refetching the screen is the only way through.
  //
  // A reload drops the dropdown back to "All", so the scope is re-applied on
  // every attempt; selectEntityOnControlsTable() no-ops when it is already set.
  async ensureTableRowsVisible(
    entityName,
    { attempts = 3, perAttemptTimeout = 30000 } = {},
  ) {
    const rows = this.page.locator(this.table.selectors.tableRows);

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const visible = await rows
        .first()
        .waitFor({ state: "visible", timeout: perAttemptTimeout })
        .then(() => true)
        .catch(() => false);

      if (visible) {
        const count = await rows.count();
        console.log(
          `Controls table rendered ${count} row(s) on attempt ${attempt}/${attempts}.`,
        );
        return count;
      }

      if (attempt === attempts) {
        throw new Error(
          `The controls table showed no rows for entity "${entityName}" after ` +
            `${attempts} attempts. The entity may genuinely have no controls, ` +
            "rather than the table having failed to paint.",
        );
      }

      console.log(
        `No table rows yet (attempt ${attempt}/${attempts}) - reloading...`,
      );
      await this.page.reload();
      await this.waitForLoad();
      await this.waitForSpinner();
      await this.selectEntityOnControlsTable(entityName);
    }
  }

  // Collection -> Controls -> Table, scoped to one entity and confirmed to have
  // rendered. This is the entry point every test in this suite uses.
  async openControlsTableForEntity(entityName) {
    await this.openEntityCollection(entityName);
    await this.navigateToControlsTable();
    await this.selectEntityOnControlsTable(entityName);
    await this.ensureTableRowsVisible(entityName);
  }

  // --- tags panel -----------------------------------------------------------

  async clickEditIcon() {
    console.log("Opening the Dynamic Labels panel...");
    await this.table.clickEditIcon();
  }

  async clickAddTagButton() {
    console.log("Clicking the add tag (+) button...");
    await this.table.clickAddTagButton();
  }

  // Creates the tag. Returns the name so the caller can store it - the name is
  // random, so it cannot be re-derived by a later test.
  async createTag(tagName) {
    console.log(`Adding the tag: "${tagName}"`);
    await this.table.fillTagName(tagName);
    return tagName;
  }

  async dragTagToTableRow(tagName) {
    console.log(`Dragging the tag "${tagName}" onto the first table row...`);
    await this.table.dragTagToTableRow(tagName);
  }

  // Drops the tag on the "Assign To All The Controls" area, which assigns it to
  // every control in one action rather than row by row.
  async dragTagToAllControls(tagName) {
    console.log(`Dragging the tag "${tagName}" onto Assign To All Controls...`);
    await this.table.dragTagToAllControls(tagName);
  }

  // Saves and waits for the confirmation toast. The toast is what proves the
  // change reached the backend - the tag renders in the row optimistically
  // before that.
  async saveAndWaitForToast() {
    console.log("Saving the tag assignment...");
    await this.table.clickSaveButton();
    await this.table.waitForQuestionUpdatedToast();
    console.log("Tag assignment saved.");
  }

  async clickTagCrossInFirstRow(tagName) {
    console.log(`Removing the tag "${tagName}" from the first row...`);
    await this.table.clickTagCrossInFirstRow(tagName);
  }

  // --- assertions -----------------------------------------------------------

  async verifyTagInFirstRow(tagName) {
    await this.table.verifyTagInFirstRow(tagName);
  }

  async verifyTagNotInFirstRow(tagName) {
    await this.table.verifyTagNotInFirstRow(tagName);
  }

  async verifyTagInAllQuestionsSettings(tagName) {
    console.log(
      `Verifying the tag "${tagName}" on every question's settings...`,
    );
    await this.table.verifyTagInAllQuestionsSettings(tagName);
  }

  // --- collection -----------------------------------------------------------

  // Opens one framework card BY NAME and returns that name.
  //
  // Not table.getFrameworkName(0): that reads the card at an index, which is
  // safe for the Secure spec because it creates a one-framework entity moments
  // earlier in a client of its own. Here the collection is reached through a
  // client holding many entities, so the name is the reliable handle.
  async openFrameworkByName(frameworkName = DEFAULT_FRAMEWORK) {
    console.log(`Opening the "${frameworkName}" framework card...`);
    const card = this.page
      .locator(this.selectors.cardByName(frameworkName))
      .first();
    await card.waitFor({ state: "visible", timeout: 120000 });
    // An answered assessment can raise the chapter completion modal here, which
    // would then intercept every settings click in the question list.
    await this.dismissChapterCompletionModalIfPresent();
    await this.collection.clickOpenBtnByCard(card);
    await this.waitForSpinner();
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // CTEL - 03 walks every question's settings panel, and the modal surfaces
  // part-way through that work rather than at any point a spec could probe for.
  // Playwright's addLocatorHandler runs the callback whenever the modal turns
  // up and blocks an action, then retries the original action.
  //
  // Call this before navigating, so the handler is armed for the whole run.
  async registerChapterCompletionModalHandler() {
    const modal = this.page
      .locator(this.selectors.chapterCompletionModal)
      .first();
    await this.page.addLocatorHandler(modal, async () => {
      console.log("Chapter completion modal appeared - dismissing it.");
      const continueBtn = modal
        .locator("button")
        .filter({ hasText: "CONTINUE" })
        .first();
      // Fall back to any button in the modal: the label carries a chevron
      // ("CONTINUE >") and is the kind of copy that gets reworded.
      const target = (await continueBtn.count())
        ? continueBtn
        : modal.locator("button").first();
      await target.click();
    });
    console.log("Chapter completion modal auto-dismiss handler registered.");
  }

  // Dismisses the chapter-completion modal if it is showing, and reports
  // whether it was there.
  //
  // It is an ngb-modal-window overlaying the whole page, so it silently
  // intercepts pointer events and a click underneath it fails with "subtree
  // intercepts pointer events" rather than anything naming the modal.
  //
  // It is INTERMITTENT, so this never throws when the modal is absent; a short
  // probe then carrying on is the correct behaviour, matching how the
  // QuestionEngine treats its continue modal.
  async dismissChapterCompletionModalIfPresent(probeMs = 5000) {
    const modal = this.page
      .locator(this.selectors.chapterCompletionModal)
      .first();
    const appeared = await modal
      .waitFor({ state: "visible", timeout: probeMs })
      .then(() => true)
      .catch(() => false);
    if (!appeared) {
      console.log("No chapter completion modal - proceeding normally.");
      return false;
    }

    console.log("Chapter completion modal is showing - dismissing it...");
    const continueBtn = modal
      .locator("button")
      .filter({ hasText: "CONTINUE" })
      .first();
    const target = (await continueBtn.count())
      ? continueBtn
      : modal.locator("button").first();
    // registerChapterCompletionModalHandler() may have already dismissed this
    // same modal between the probe above and this click - both are armed on
    // purpose. A modal that is already gone is the outcome wanted, so a click
    // that finds nothing must not fail the test.
    try {
      await target.click({ timeout: 15000 });
    } catch (err) {
      if (await modal.isVisible()) {
        throw err;
      }
      console.log("Modal was already dismissed by the handler - carrying on.");
      return true;
    }
    await modal.waitFor({ state: "hidden", timeout: 30000 });
    console.log("Chapter completion modal dismissed.");
    return true;
  }
}

TableEntityLeader.DEFAULT_FRAMEWORK = DEFAULT_FRAMEWORK;

module.exports = TableEntityLeader;
