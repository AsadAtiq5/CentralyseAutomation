const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const Filters = require("../../Secure/Collection/Filters");

// Drives the collection question filters as the ENTITY LEADER.
//
// Everything below the filters panel is delegated to the Secure Filters page
// object (`this.filters`): the panel, the option checkboxes, the expected-set
// derivation and the filtered-question verification are the same app components
// for every role, and only the route to reach them differs.
//
// WHAT THIS CLASS OWNS is that route, and it differs from BOTH other roles.
//
//   - The Secure spec walks /clients, searches the client SC - 00 created and
//     clicks into it. This role has no /clients screen and does not need one -
//     it is already inside the client ELS - 01 provisioned.
//
//   - The sub entity leader reaches the collection from the side menu, which is
//     safe for it because it sees exactly one entity. An entity leader's client
//     holds many by the time this runs - the four UDEL_Entity cards,
//     PolicySubEL and the SCEL_Entity this suite targets - so the side menu
//     lands on an entity picker rather than on a known assessment. This class
//     therefore deep links with BOTH UUIDs, pinning the screen to the SCEL
//     sub-entity whose answers are the expected result.
class ApplyFiltersEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.filters = new Filters(page);
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

  // Deep links to the SCEL sub-entity's collection and stops on the CARD LIST.
  //
  // Deliberately does NOT open the framework card. Filters.clickFiltersButton()
  // calls clickFirstEntityOpen() itself, so opening the assessment here would
  // make that click land on an already-open assessment and the filters panel
  // would never appear. openFiltersPanel() is what opens the card.
  //
  // Deep linked with both UUIDs rather than routing through the side menu: in a
  // client holding many entities the side menu lands on a picker, and the first
  // card would be whichever entity sorts first - not necessarily the one whose
  // answer set is being used as the expected result.
  async openSubEntityCollection(entityId, subEntityId, timeoutMs = 120000) {
    const url = `/first-party/${entityId}/collection/${subEntityId}`;
    console.log(`Navigating directly to the collection: ${url}`);
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

  // Opens the filters panel. Note this ALSO opens the first framework card:
  // Filters.clickFiltersButton() calls clickFirstEntityOpen() itself, so the
  // caller must not open the framework beforehand.
  //
  // The chapter-completion modal can surface on that card open - this
  // assessment was fully answered by SCEL - 01 - and would then intercept the
  // click on the filters popup. The auto-dismiss handler armed by the spec
  // covers it: Playwright runs the handler when the modal blocks the click and
  // then retries the click, which is the only point at which it can be caught
  // here, since the open and the panel click happen inside one delegated call.
  async openFiltersPanel() {
    console.log("Opening the filters panel on the collection...");
    await this.filters.clickFiltersButton();
    console.log("Filters panel open.");
  }

  // Picks a random set of Answer and Severity options and returns the
  // selection, so the caller can derive the expected question set from it.
  async selectRandomFilters() {
    const finalSelection = await this.filters.randomFilterSelector();
    console.log("Filters selected:", JSON.stringify(finalSelection));
    return finalSelection;
  }

  // Applies the selected filters and waits for the question list to settle.
  async applyFilters() {
    console.log("Applying the selected filters...");
    await this.filters.clickApplyFilterButton();
    await this.waitForSpinner();
    console.log("Filters applied.");
  }

  // Derives the questions the filters SHOULD return, from the answer set
  // SCEL - 01 stored. This is computed from data, never read off the screen
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
    await this.filters.verifyFilteredQuestionsSet(finalSelection);
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // Why a handler and not a one-off check: the modal does NOT reliably appear
  // when the framework is opened - a probe at that moment can report nothing -
  // it surfaces seconds later. So there is no single point in the flow at which
  // it can be dismissed, and in this suite the card open and the panel click
  // happen inside one delegated call with no seam to probe in between.
  // Playwright's addLocatorHandler runs the callback whenever the modal turns
  // up and blocks an action, then retries the original action, which is exactly
  // the shape of this problem.
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

module.exports = ApplyFiltersEntityLeader;
