const BasePage = require("../../Secure/BasePage");
const ControlsNavigatorPage = require("../../Secure/Controls/Navigator");
const TableEntityLeader = require("./tableEntityLeader");

// Drives the Controls > Navigator screen as the ENTITY LEADER.
//
// The Navigator itself is delegated to the Secure ControlsNavigatorPage
// (`this.navigator`) without adaptation: it addresses its SVG nodes by TOOLTIP
// text and the root score by class, and neither carries an entity or client
// name.
//
// Arrival, sub-entity creation and the route into the collection are delegated
// to the sibling TableEntityLeader (`this.controlsTable`), which also owns the
// Controls entity dropdown - the same reasoning as
// controlFiltersEntityLeader: those dropdown selectors were written from live
// markup and have not been through a green run, so they stay in one place.
//
// WHY THE ENTITY SCOPE MATTERS MORE HERE THAN ANYWHERE ELSE IN THIS SUITE.
//
// This spec CHANGES AN ANSWER - that is the point of the case, since the node
// has to recolour to match it. The Secure page object finds its level-4 node by
// taking the FIRST `g.node.lvl4` whose tooltip matches, and by the time this
// spec runs the leader's client holds a dozen-odd Business Email Compromise
// sub-entities, every one of which has a BEC-1.1 node with that exact tooltip.
// Unscoped, "the first match" is undefined - and if it resolves to
// SCEL_Entity, this spec silently rewrites one of the answers AFEL - 01
// asserts against.
//
// Reading and writing are at least self-consistent either way: the node click
// and both colour reads all take the same first match, so the assertion is
// about whichever node was answered. The exposure is to OTHER specs, not to
// this one.
//
// scopeToEntity() is therefore best-effort rather than optional: it applies the
// dropdown when the Navigator has one and says so loudly when it does not,
// because that is the case where the isolation above stops holding.
class NavigatorEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.navigator = new ControlsNavigatorPage(page);
    this.controlsTable = new TableEntityLeader(page);
  }

  // --- arrival and setup ----------------------------------------------------

  async ensureOnUpperdeck(timeoutMs = 120000) {
    await this.controlsTable.ensureOnUpperdeck(timeoutMs);
  }

  async navigateToMultiEntity() {
    await this.controlsTable.navigateToMultiEntity();
  }

  // Creates the sub-entity this spec answers a question on, and returns its
  // name.
  //
  // Business Email Compromise is required, not incidental: the whole node path
  // this spec walks - Protect > Access Controls > Multi-Factor Authentication >
  // BEC-1.1 - belongs to that framework, so an entity on any other would leave
  // every tooltip lookup with nothing to find.
  //
  // A dedicated entity is also what keeps the answer change harmless. The
  // Secure CN - 01 gets that from building its own client; here it comes from
  // building an entity nothing else reads.
  async createEntityWithBEC(prefix = "CNEL_Entity") {
    return await this.controlsTable.createEntityWithBEC(prefix);
  }

  // Opens the entity's collection by name. Not decoration: the Controls
  // side-menu item only resolves once the app is inside the entity.
  async openEntityCollection(entityName) {
    await this.controlsTable.openEntityCollection(entityName);
  }

  // --- navigation -----------------------------------------------------------

  // Collection -> Controls -> Navigator.
  async navigateToNavigator() {
    console.log("Navigating to Controls > Navigator...");
    await this.navigator.navigateToNavigator();
    await this.waitForSpinner();
    console.log("Controls Navigator open.");
  }

  // Scopes the Navigator to one entity through the Controls entity dropdown,
  // when that dropdown is present on this screen.
  //
  // Confirmed present on Controls > Table, where it defaults to "All". Whether
  // Navigator renders the same control is NOT confirmed, so this probes for it
  // rather than assuming: absent, it logs a warning and carries on, because the
  // spec can still complete - see the class comment for what is lost.
  //
  // Returns true when the scope was applied.
  async scopeToEntity(entityName, probeMs = 10000) {
    const arrow = this.page
      .locator(this.controlsTable.selectors.entityDropdownArrow)
      .first();
    const present = await arrow
      .waitFor({ state: "visible", timeout: probeMs })
      .then(() => true)
      .catch(() => false);

    if (!present) {
      console.log(
        "WARNING: no entity dropdown on the Navigator - it is showing every " +
          "entity in the client. The BEC-1.1 node this spec answers may " +
          "belong to another entity.",
      );
      return false;
    }

    await this.controlsTable.selectEntityOnControlsTable(entityName);
    // The tree redraws from scratch on a scope change, so the root has to be
    // back on screen before any node is clicked.
    await this.page
      .locator(this.navigator.selectors.rootText)
      .first()
      .waitFor({ state: "visible", timeout: 120000 });
    console.log(`Navigator scoped to entity: ${entityName}`);
    return true;
  }

  // --- root score -----------------------------------------------------------

  async clickRootScore() {
    await this.navigator.clickRootScore();
  }

  // Asserts the root score is rendered in the colour band its value falls into.
  async verifyScoreColorCombination() {
    console.log("Verifying the root score colour matches its value...");
    await this.navigator.verifyScoreColorCombination();
  }

  // --- tree navigation ------------------------------------------------------

  async clickLevel1Node(tooltipText) {
    console.log(`Opening level 1 node: "${tooltipText}"`);
    await this.navigator.clickLevel1Node(tooltipText);
  }

  async clickLevel2Node(tooltipText) {
    console.log(`Opening level 2 node: "${tooltipText}"`);
    await this.navigator.clickLevel2Node(tooltipText);
  }

  async clickLevel3Node(tooltipText) {
    console.log(`Opening level 3 node: "${tooltipText}"`);
    await this.navigator.clickLevel3Node(tooltipText);
  }

  async clickLevel4NodeByPartialTooltip(partialTooltip) {
    console.log(`Opening level 4 node matching: "${partialTooltip}"`);
    await this.navigator.clickLevel4NodeByPartialTooltip(partialTooltip);
  }

  // Reads a node's current border colour. Called BEFORE the answer is changed,
  // so the run can show the colour actually moved rather than happening to
  // already match.
  async getNodeBorderColor(level, tooltip, partial = false) {
    return await this.navigator.getNodeBorderColor(level, tooltip, partial);
  }

  // --- answering ------------------------------------------------------------

  async clickOriginalQuestion() {
    console.log("Opening the original question panel...");
    await this.navigator.clickOriginalQuestion();
  }

  // Picks a random answer and returns it, plus any partial-slider metadata, so
  // the caller can derive the colour that answer should produce.
  async selectRandomAnswer() {
    const result = await this.navigator.selectRandomAnswerInNavigator();
    console.log(`Answer selected: "${result.answerText}"`);
    return result;
  }

  // Saves and waits for the confirmation toast. The toast is what proves the
  // answer reached the backend - the node recolours off the saved value, so
  // reading the border before this would race the save.
  async saveAndWaitForToast() {
    console.log("Saving the answer...");
    await this.navigator.clickSaveButton();
    await this.navigator.waitForControlUpdatedToast();
    console.log("Answer saved.");
  }

  // --- colour assertion -----------------------------------------------------

  // Maps an answer onto the border colour it should produce. Synchronous - it
  // is a pure lookup, not a page read, which is what keeps the expected value
  // independent of the screen being asserted.
  getExpectedColorForAnswer(answerText, partialMeta = null) {
    return this.navigator.getExpectedColorForAnswer(answerText, partialMeta);
  }

  // Asserts the node border carries the expected colour.
  //
  // The delegate RELOADS the page before reading: the Navigator does not
  // repaint a node in place after a save, so an in-session read returns the old
  // answer's colour. That reload drops any dropdown scope, which is safe here
  // because the read takes the same first-match node either way.
  async verifyNodeBorderColorMatch(level, tooltip, partial, expectedColor) {
    console.log(`Verifying the node border colour is ${expectedColor}...`);
    await this.navigator.verifyNodeBorderColorMatch(
      level,
      tooltip,
      partial,
      expectedColor,
    );
  }
}

module.exports = NavigatorEntityLeader;
