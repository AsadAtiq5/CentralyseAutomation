const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const CollectionPage = require("../../Secure/CollectionPage");
const AddComment = require("../../Secure/Collection/AddComment");

// Drives commenting on collection questions as the ENTITY LEADER.
//
// The comment mechanics are delegated to the Secure AddComment page object
// (`this.comment`) and the framework cards to CollectionPage
// (`this.collection`): the comment box, the ADD button and the activity panel
// are the same app components for every role, and only the route to reach them
// differs.
//
// WHAT THIS CLASS OWNS is that route. Unlike the Secure spec there is no client
// to search for, and unlike the sub entity leader there is no side-menu-only
// path: an entity leader is scoped to the whole client, so it can deep link
// straight into the sub-entity SCEL - 00 built.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in upperDeckEntityLeader, scoreCalculationEntityLeader and
// policyManagementPoliciesEntityLeader. That is this suite's deliberate shape:
// each EntityLeader page object owns its own copy so a change made for one
// flow cannot break another. The SubEntityLeader suite instead shares them
// from a SubEntityLeaderBasePage; lifting an equivalent base class here would
// be the right cleanup, but it would mean altering page-object methods the
// shipped EL specs already depend on, so it is left as a separate decision.
class AddCommentEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.collection = new CollectionPage(page);
    this.comment = new AddComment(page);
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

  // Deep links straight into one sub-entity's collection.
  //
  // Both UUIDs come from the score calculation suite, which is the only place
  // they are exposed - the app renders them nowhere on screen, so SCEL - 00
  // reads them off the URL it lands on and stores them.
  //
  // Waits on the cards rather than just the URL: /collection resolves before
  // the list paints, and acting on a half-rendered list is the main flake in
  // this flow.
  async openCollectionByIds(entityId, subEntityId, timeoutMs = 120000) {
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

  // Opens the first framework card on the collection and returns its name, so
  // the caller can log which assessment was commented on.
  async openFirstFramework() {
    console.log("Opening the first framework card on the collection...");
    const frameworkName = await this.collection.clickFirstEntityOpen();
    await this.waitForSpinner();
    // The assessment on this sub-entity has already been fully answered by
    // SCEL - 01, which is exactly when the chapter-completion modal surfaces.
    // Left up it would intercept every click on the ADD comment button.
    await this.dismissChapterCompletionModalIfPresent();
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // Adds the given comment across every question set, paging through with the
  // NEXT SET button until there are none left.
  //
  // Note on scope: the underlying addCommentForAllQuestions() comments on the
  // FIRST question of each set only, despite its name - its loop is bounded to
  // one iteration. It also verifies the comment it just added, so this method
  // carries its own assertion and the spec needs none.
  async addCommentToAllQuestionSets(commentText) {
    console.log(`Adding comment across all question sets: "${commentText}"`);
    await this.comment.addCommentForAllQuestionsSets(commentText);
    console.log("Comment added and verified on every question set.");
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // Why a handler and not a one-off check: the modal does NOT reliably appear
  // when the framework is opened - a probe at that moment can report nothing -
  // it surfaces seconds later, part-way through the question work. So there is
  // no single point in the flow at which it can be dismissed. Playwright's
  // addLocatorHandler runs the callback whenever the modal turns up and blocks
  // an action, then retries the original action, which is exactly the shape of
  // this problem.
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
    // purpose, the handler for the mid-question appearance and this for the
    // framework open. A modal that is already gone is the outcome wanted, so a
    // click that finds nothing must not fail the test.
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

module.exports = AddCommentEntityLeader;
