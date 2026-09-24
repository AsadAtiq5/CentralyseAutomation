const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const AddEntityPage = require("../../Secure/AddEntityPage");
const CollectionPage = require("../../Secure/CollectionPage");
const QuestionEngine = require("../../Secure/Collection/QuestionEngine");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

// Drives the score calculation flow as the ENTITY LEADER: create a sub-entity
// inside the leader's own client, answer its assessment end to end, then read
// the score back off the framework card.
//
// Everything on the screens themselves is delegated - entity creation to
// AddEntityPage (`this.entities`), the framework cards to CollectionPage
// (`this.collection`) and the question loop to QuestionEngine
// (`this.questionEngine`). None of their selectors carries a client or entity
// name, so nothing needed a role-specific rewrite; this is the same split
// upperDeckEntityLeader uses.
//
// WHAT THIS CLASS OWNS, and why the Secure ScoreCalculation page object could
// not simply be reused:
//   - Arrival. An entity leader is dropped on /first-party/<id>/upperdeck by the
//     session redirect rather than navigating there, so ensureOnUpperdeck() is
//     an arrival check, not a navigation step.
//   - There is no client to create or search for. The Secure flow opens
//     /clients, creates a client and clicks its card; this role is already
//     inside the client ELS - 01 provisioned and has no client picker at all.
//   - Refreshing for the score. The Secure spec calls page.reload(), which only
//     works if the app has already returned to the card list by that point.
//     This class navigates back to the collection deep link instead - see
//     refreshCollectionForScore().
//   - The chapter-completion modal, which surfaces once an assessment has been
//     fully answered. Ported from SubEntityLeaderBasePage for the same reason.
class ScoreCalculationEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.entities = new AddEntityPage(page);
    this.collection = new CollectionPage(page);
    this.questionEngine = new QuestionEngine(page);
    this.selectors = {
      // The upperdeck score ring - the first thing to paint on the landing
      // screen, so it is what arrival waits on.
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      // Framework cards on the collection screen. Same value CollectionPage
      // uses; kept here so this class can wait on them without reaching into
      // another page object's selector map.
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

  // --- multi entity ---------------------------------------------------------

  async navigateToMultiEntity() {
    console.log("Navigating to the Multi Entity screen...");
    await this.entities.clickMultiEntitySidebar();
    console.log("Multi Entity screen open.");
  }

  // Creates one sub-entity on Business Email Compromise with user-based
  // collection, and returns its name.
  //
  // The Secure SC - 00 creates a whole client for this flow. An entity leader
  // cannot - it has no /clients screen - but it IS scoped to the whole client
  // and can add entities to it, so a dedicated sub-entity is the equivalent
  // isolation: the assessment answered below is the only one on it, which is
  // what makes the card score attributable to those answers alone.
  async createEntityForScoreCalculation(prefix = "SCEL_Entity") {
    await this.entities.clickNewEntity();
    const entityName = await this.entities.createUniqueEntityName(prefix);
    await this.entities.addEntityWithBusinessEmailCompromiseUserBased();
    await this.entities.waitForToast();
    await this.entities.verifyEntityInList(entityName);
    console.log(`Entity created for the score calculation flow: ${entityName}`);
    return entityName;
  }

  // --- collection -----------------------------------------------------------

  // Opens the collection via the side menu and selects one entity in the
  // dropdown. Used by the setup test only: afterwards the UUIDs are known and
  // openCollectionByIds() is both faster and one fewer dropdown to race with.
  async openCollectionForEntity(entityName, timeoutMs = 120000) {
    console.log(`Opening the collection for entity: ${entityName}`);
    await this.entities.navigateToCollection();
    await this.entities.selectEntityAndNavigate(entityName);
    await this.waitForSpinner();
    await this.page
      .locator(this.selectors.entityCardBox)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Collection open with the framework cards rendered.");
  }

  // Deep links straight into one sub-entity's collection.
  //
  // Waits on the cards rather than just the URL: /collection resolves before
  // the list paints, and acting on a half-rendered list is the main flake in
  // this flow.
  async openCollectionByIds(entityId, subEntityId, timeoutMs = 120000) {
    // Both UUIDs come off the URL SCEL - 00 lands on, which is the only place
    // the app exposes them.
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

  // Returns the [entityId, subEntityId] pair off the current collection URL.
  // Those two UUIDs are not rendered anywhere on the screen, so the URL is the
  // only place they can be read from - which is why the setup test has to land
  // on the collection before it can store them.
  async getCollectionIds() {
    const uuids = fetchPageURL(this.page.url());
    console.log(`UUIDs found in the collection URL: ${uuids.join(", ")}`);
    return uuids;
  }

  // Reads the framework name off the card and opens it in one step, because the
  // name is only reliably readable before the card expands. Returns the name so
  // the caller can resolve that framework's answer options.
  async getFrameworkNameAndOpen(index = 0) {
    console.log(`Opening the framework card at index ${index}...`);
    const frameworkName = await this.collection.getFrameworkName(index);
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // Brings the collection card list back up so the score can be read.
  //
  // This navigates rather than reloading. The Secure spec calls page.reload(),
  // which assumes the app has already walked back from the question view to the
  // card list by the time the last question is answered; navigating to the
  // collection deep link is true regardless of where the question loop left the
  // page, and it is the same URL openCollectionByIds() already proved works for
  // this role.
  //
  // The score itself is rendered from the SAVED answers, so this step is not
  // optional - without it the card still shows the score from before the
  // assessment was answered.
  async refreshCollectionForScore(entityId, subEntityId, timeoutMs = 120000) {
    console.log("Reopening the collection so the card score refreshes...");
    await this.openCollectionByIds(entityId, subEntityId, timeoutMs);
    await this.dismissChapterCompletionModalIfPresent();
  }

  // Returns the raw score text from the card; the caller parses it, because
  // only the caller knows how it wants to compare.
  async getScore(index = 0) {
    const selectedCard = await this.collection.fetchFrameworkCard(index);
    const score = await this.collection.fetchScoreByCard(selectedCard);
    console.log(`Score read from the framework card: ${score}`);
    return score;
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // Why a handler and not a one-off check: the modal does NOT appear when the
  // framework is opened - a probe at that moment reports nothing - it surfaces
  // seconds later, part-way through the question work. So there is no single
  // point in the flow at which it can reliably be dismissed. Playwright's
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
  // Why this exists alongside the handler: once an assessment is fully answered
  // - which SCEL - 01 does - reopening the collection can raise the modal. It
  // is an ngb-modal-window overlaying the whole page, so it silently intercepts
  // pointer events and any read underneath it fails with "subtree intercepts
  // pointer events" rather than anything naming the modal.
  //
  // It is INTERMITTENT, so this never throws when the modal is absent; a short
  // probe then carrying on is the correct behaviour, matching how QuestionEngine
  // treats its continue modal.
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
    // reopen. A modal that is already gone is the outcome wanted, so a click
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

module.exports = ScoreCalculationEntityLeader;
