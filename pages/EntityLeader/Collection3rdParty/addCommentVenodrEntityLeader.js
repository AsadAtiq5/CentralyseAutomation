const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const CollectionPage = require("../../Secure/CollectionPage");
const AddCommentThirdParty = require("../../Secure/Collection 3rd Party/AddCommentThirdParty");

// Drives commenting on a VENDOR's questionnaire as the ENTITY LEADER.
//
// The comment mechanics are delegated to the Secure AddCommentThirdParty page
// object (`this.comment`) and the framework cards to CollectionPage
// (`this.collection`): the comment box, the ADD button and the activity panel
// are the same app components for every role, and only the route to reach them
// differs. Confirmed live for this role before porting - on the vendor
// questionnaire all twelve question cards render a textarea.explain-answer, an
// ADD button and a .see-activity link, so nothing needed a role-specific
// rewrite.
//
// WHAT THIS CLASS OWNS is that route. Unlike the Secure spec there is no client
// to search for: an entity leader is scoped to the whole client, so it can deep
// link straight into the vendor SC3PEL - 00 built.
//
// A NOTE ON THE TWO addCommentForAllQuestions() METHODS, because they differ and
// the difference is easy to miss:
//   - AddComment (first party) hardcodes its loop to `i < 1`, so it comments on
//     ONE question whatever count it is handed.
//   - AddCommentThirdParty (this one) loops to `i < loopCount`, so the count it
//     is handed is real.
// This class therefore names its methods for what they actually do rather than
// passing a count through, so a caller cannot be misled by the shared name.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in the other EntityLeader page objects. That is this suite's
// deliberate shape - each one owns its own copy so a change made for one flow
// cannot break another.
class AddCommentVendorEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.collection = new CollectionPage(page);
    this.comment = new AddCommentThirdParty(page);
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

  // Deep links straight into one vendor's collection.
  //
  // Both UUIDs come from the third party score calculation suite, which is the
  // only place they are exposed - the app renders the vendor id nowhere on
  // screen and the vendors list carries it only as a query parameter, so
  // SC3PEL - 00 reads them off the collection URL and stores them.
  //
  // Waits on the cards rather than just the URL: /collection resolves before the
  // list paints, and acting on a half-rendered list is the main flake in this
  // flow.
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

  // Opens the first framework card on the collection and returns its name, so
  // the caller can log which questionnaire was commented on.
  //
  // Index 0 is unambiguous here: the vendor SC3PEL - 00 creates carries exactly
  // one framework, and nothing else in the job adds one to it.
  async openFirstFramework() {
    console.log("Opening the first framework card on the collection...");
    const frameworkName = await this.collection.clickFirstEntityOpen();
    await this.waitForSpinner();
    // The questionnaire on this vendor has already been fully answered by
    // SC3PEL - 01, which is exactly when the chapter-completion modal surfaces.
    // Left up it would intercept every click on the ADD comment button.
    await this.dismissChapterCompletionModalIfPresent();
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // Adds the comment to the FIRST question of the open set and verifies it, by
  // reopening that question's activity panel and reading the latest entry back.
  //
  // Scope matches the Secure ACM3P - 01, which passes a count of 1. It is not an
  // arbitrary choice: the third-party loop honours the count it is given, so
  // this is a real one-question scope rather than the first-party class's
  // hardcoded one.
  //
  // The verification lives inside the delegated method, so the spec needs no
  // assertion of its own.
  async addCommentToFirstQuestion(commentText) {
    console.log(`Adding a comment to the first question: "${commentText}"`);
    await this.comment.addCommentForAllQuestions(1, commentText);
    console.log("Comment added and verified on the first question.");
  }

  // Adds the comment to EVERY question in EVERY set, paging through with the
  // NEXT SET button.
  //
  // Not what the ported spec calls - kept because it is the only correct way to
  // widen the scope. Handing addCommentToFirstQuestion() a bigger number would
  // not work: this class deliberately does not expose the count, and the
  // question set on the vendor renders no NEXT button, so a caller reaching for
  // "all" needs the set-walking loop rather than a larger loop bound.
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
  // an action, then retries the original action.
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

module.exports = AddCommentVendorEntityLeader;
