const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const CollectionPage = require("../../Secure/CollectionPage");
const FiltersThirdParty = require("../../Secure/Collection 3rd Party/FiltersThirdParty");

// Drives the collection filters on a VENDOR's questionnaire as the ENTITY
// LEADER.
//
// The filter mechanics are delegated to the Secure FiltersThirdParty page
// object (`this.filters`) and the framework cards to CollectionPage
// (`this.collection`): the filters popup, the random selection, the apply
// button and the per-question verification are the same app components for
// every role, and only the route to reach them differs.
//
// WHAT THIS CLASS OWNS is that route. Unlike the Secure spec there is no client
// to search for and no vendor list to walk: an entity leader is scoped to the
// whole client, so it can deep link straight into the vendor SC3PEL - 00 built.
//
// THE CARD-OPENING ORDER MATTERS HERE, and it differs from the first party
// filters port. FiltersThirdParty exposes two entry points:
//   - clickFiltersButton() opens the FIRST CARD and then the popup, so the
//     caller must not have opened the assessment beforehand.
//   - clickFiltersPopupButton() opens ONLY the popup, for when the assessment
//     is already open.
// This class takes the second route, matching the Secure FT3P - 01: it opens
// the card through CollectionPage.getFrameworkName(), which also returns the
// framework name worth logging. Calling both would leave no card on screen and
// hang clickFirstEntityOpen().
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in the other EntityLeader page objects. That is this suite's
// deliberate shape - each one owns its own copy so a change made for one flow
// cannot break another.
class CollectionFiltersVendorEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.collection = new CollectionPage(page);
    this.filters = new FiltersThirdParty(page);
    this.selectors = {
      // The upperdeck score ring - the first thing to paint on the landing
      // screen, so it is what arrival waits on.
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      // Framework cards on the collection screen.
      entityCardBox: ".entity-card-box",
      chapterCompletionModal: ".chapter-completion-modal",
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

  // --- collection -----------------------------------------------------------

  // Deep links to the vendor's collection and stops on the CARD LIST.
  //
  // Both UUIDs come from the third party score calculation suite, which is the
  // only place they are exposed - the app renders the vendor id nowhere on
  // screen and the vendors list carries it only as a query parameter.
  //
  // Deep linked rather than routed through the vendor list: this client
  // accumulates vendors from every spec in the job, so "the first vendor" is
  // whichever sorts first - not necessarily the one whose answer set is being
  // used as the expected result.
  //
  // Waits on the cards rather than just the URL: /collection resolves before
  // the list paints, and acting on a half-rendered list is the main flake in
  // this flow.
  async openCollectionByIds(clientId, vendorId, timeoutMs = 180000) {
    const url = `/third-party/${clientId}/collection/${vendorId}`;
    console.log(`Navigating directly to the vendor collection: ${url}`);
    await this.goto(url);
    await this.waitForLoad();
    await this.waitForSpinner();
    await this.page
      .locator(this.selectors.entityCardBox)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Collection open with the framework cards rendered.");
  }

  // --- filters --------------------------------------------------------------

  // Opens the questionnaire and then the filters panel, returning the framework
  // name so the caller can log which questionnaire is under test.
  //
  // The card open comes first and the popup second, which is why
  // clickFiltersPopupButton() is used rather than clickFiltersButton() - see the
  // class comment.
  //
  // The chapter-completion modal can surface on the card open, since SC3PEL - 01
  // fully answered this questionnaire, and would then intercept the click on the
  // filters popup. It is dismissed explicitly here because there IS a seam
  // between the two steps in this route; the handler the spec arms covers the
  // case where it appears later instead.
  //
  // Index 0 is unambiguous: the vendor SC3PEL - 00 creates carries exactly one
  // framework, and nothing else in the job adds one to it.
  async openFrameworkAndFiltersPanel(index = 0) {
    console.log(`Opening the framework card at index ${index}...`);
    const frameworkName = await this.collection.getFrameworkName(index);
    console.log(`Framework under test: ${frameworkName}`);
    await this.waitForSpinner();
    await this.dismissChapterCompletionModalIfPresent();
    await this.filters.clickFiltersPopupButton();
    console.log("Filters panel open.");
    return frameworkName;
  }

  // Picks a random set of Answer and Severity options and returns the
  // selection, so the caller can derive the expected question set from it.
  async selectRandomFilters() {
    const finalSelection = await this.filters.randomFilterSelector();
    console.log("Selected Filters:", finalSelection);
    return finalSelection;
  }

  // Applies the selected filters and waits for the question list to settle.
  async applyFilters() {
    console.log("Applying the selected filters...");
    await this.filters.clickApplyFilterButton();
  }

  // Derives the questions the filters SHOULD return, from the answer set
  // SC3PEL - 01 stored. This is computed from data, never read off the screen
  // being asserted.
  async getExpectedFilteredQuestions(questionData, finalSelection) {
    return await this.filters.filterQuestions(questionData, finalSelection);
  }

  // Number of questions the UI is currently showing.
  async getQuestionCount() {
    return await this.filters.getQuestionCount();
  }

  // Asserts every question still on screen actually matches the applied
  // filters, rather than only that the count lines up.
  async verifyFilteredQuestionsSet(finalSelection) {
    console.log("Verifying every filtered question against the selection...");
    await this.filters.verifyFilteredQuestionsSet(finalSelection);
    console.log("All filtered questions match the applied filters.");
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // Why a handler as well as the explicit dismiss above: the modal does NOT
  // reliably appear when the framework is opened - a probe at that moment can
  // report nothing - it can surface seconds later, part-way through the filter
  // work. Playwright's addLocatorHandler runs the callback whenever the modal
  // turns up and blocks an action, then retries the original action.
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

  // Dismisses the chapter-completion modal if it is showing, and reports whether
  // it was there.
  //
  // It is an ngb-modal-window overlaying the whole page, so it silently
  // intercepts pointer events and any click underneath it fails with "subtree
  // intercepts pointer events" rather than anything naming the modal.
  //
  // It is INTERMITTENT, so this never throws when the modal is absent.
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

module.exports = CollectionFiltersVendorEntityLeader;
