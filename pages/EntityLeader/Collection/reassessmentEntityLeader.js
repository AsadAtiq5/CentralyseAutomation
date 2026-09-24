const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const AddEntityPage = require("../../Secure/AddEntityPage");
const CollectionPage = require("../../Secure/CollectionPage");
const QuestionEngine = require("../../Secure/Collection/QuestionEngine");
const Reassessment = require("../../Secure/Collection/Reassessment");

// Drives the reassessment flow as the ENTITY LEADER.
//
// The reassessment mechanics are delegated to the Secure Reassessment page
// object (`this.reassessment`): the edit panel, the Start Reassessment button
// and its readiness race, the re-answer loop, the Archive side menu and the
// archived-card comparison are the same app components for every role. Entity
// creation goes to AddEntityPage (`this.entities`), the framework cards to
// CollectionPage (`this.collection`) and the first question pass to
// QuestionEngine (`this.questionEngine`).
//
// WHAT THIS CLASS OWNS is the route.
//
//   - The Secure spec creates a whole CLIENT per test. This role has no
//     /clients screen; it is already inside the client ELS - 01 provisioned, so
//     each test builds only its own sub-entity in it.
//
//   - Navigation to the assessment goes through the entity dropdown BY NAME
//     (openEntityCollection), not the deep link the other EntityLeader
//     Collection suites use. Two reasons: the UUIDs are not known here - this
//     suite creates its entity rather than reading one SCEL - 00 stored - and
//     the reassessment flow has to come back to the same entity repeatedly,
//     including inside the readiness-retry callback. Selecting by name is
//     deterministic in a client holding many entities, which "the first Open
//     button" is not.
//
// WHY THIS SUITE BUILDS ITS OWN ENTITIES, and does not reuse SCEL_Entity:
// starting a reassessment ARCHIVES the current assessment and resets the live
// one. Doing that to the SCEL sub-entity would destroy the answer set SCEL - 01
// recorded and AFEL - 01 asserts against. A reassessment target has to be
// disposable, so each test here creates one.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in the other EntityLeader page objects. That is this suite's
// deliberate shape - each one owns its own copy so a change made for one flow
// cannot break another. Lifting an EntityLeaderBasePage would be the right
// cleanup, but it would mean altering page-object methods the shipped EL specs
// already depend on, so it is left as a separate decision.
class ReassessmentEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.entities = new AddEntityPage(page);
    this.collection = new CollectionPage(page);
    this.questionEngine = new QuestionEngine(page);
    this.reassessment = new Reassessment(page);
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

  // --- multi entity ---------------------------------------------------------

  async navigateToMultiEntity() {
    console.log("Navigating to the Multi Entity screen...");
    await this.entities.clickMultiEntitySidebar();
    console.log("Multi Entity screen open.");
  }

  // Creates one disposable sub-entity on Business Email Compromise with
  // user-based collection, and returns its name.
  //
  // Business Email Compromise is not incidental: the Secure page object
  // addresses the reassessment card by that exact framework name
  // (businessEmailCompromiseCard), so an entity built on any other framework
  // would leave that selector with nothing to click.
  async createEntityWithBEC(prefix = "RAEL_Entity") {
    await this.entities.clickNewEntity();
    const entityName = await this.entities.createUniqueEntityName(prefix);
    await this.entities.addEntityWithBusinessEmailCompromiseUserBased();
    await this.entities.waitForToast();
    await this.entities.verifyEntityInList(entityName);
    console.log(`Entity created for the reassessment flow: ${entityName}`);
    return entityName;
  }

  // --- collection -----------------------------------------------------------

  // Opens one entity's collection by NAME through the side menu and the entity
  // dropdown. Selecting by name keeps this deterministic in a client that holds
  // many entities.
  async openEntityCollection(entityName) {
    console.log(`Opening the collection for entity: ${entityName}`);
    await this.entities.navigateToCollection();
    await this.entities.selectEntityAndNavigate(entityName);
    await this.waitForSpinner();
    console.log("Collection open.");
  }

  // Opens the framework card and returns its name. Also dismisses the
  // chapter-completion modal, which surfaces once an assessment has been fully
  // answered and would then intercept clicks on the question cards.
  async openFrameworkCard(index = 0) {
    console.log(`Opening the framework card at index ${index}...`);
    const frameworkName = await this.collection.getFrameworkName(index);
    await this.waitForSpinner();
    await this.dismissChapterCompletionModalIfPresent();
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // First pass over the assessment: answers only what is still unanswered.
  async answerAllQuestions() {
    console.log("Answering every question in the assessment...");
    const answers = await this.questionEngine.answerAllQuestions();
    console.log(`Answered ${answers.length} question(s).`);
    return answers;
  }

  // Second pass, after the reassessment has started: re-picks an answer for
  // EVERY question even where one is already selected, which is what makes the
  // live assessment diverge from the archived one.
  async reAnswerAllQuestions() {
    console.log("Re-answering every question in the assessment...");
    await this.reassessment.reAnswerAllQuestions();
    console.log("All questions re-answered.");
  }

  // Reads the three figures the archive is later compared against, off the
  // framework card in one pass. Returned as strings, exactly as rendered -
  // verifyArchivedCardData() compares them as text, so parsing them here would
  // only have to be undone.
  async getCardMetrics(index = 0) {
    const card = await this.collection.fetchFrameworkCard(index);
    const score = await this.collection.fetchScoreByCard(card);
    const collectionPercentage =
      await this.collection.fetchCollectionPercentageByCard(card);
    const remediationPercentage =
      await this.collection.fetchRemediationPercentageByCard(card);
    console.log(
      `Card metrics - score: ${score}, collection: ${collectionPercentage}, remediation: ${remediationPercentage}`,
    );
    return { score, collectionPercentage, remediationPercentage };
  }

  // --- reassessment ---------------------------------------------------------

  // Opens the edit panel and selects the Business Email Compromise framework,
  // which is the state the Start Reassessment button lives in.
  async openReassessmentPanel() {
    console.log("Opening the framework edit panel...");
    await this.reassessment.clickEditCollectionFrameworkButton();
    await this.reassessment.clickBusinessEmailCompromiseCard();
    console.log("Edit panel open on the Business Email Compromise framework.");
  }

  // Clicks Start Reassessment, tolerating the backend-readiness race on a
  // freshly created framework.
  //
  // Owns the reopen callback the Secure page object requires. Right after an
  // entity is created the framework's initial assessment is not ready, so the
  // panel renders only "Start Fresh" / "Import Assessment" and does NOT
  // live-refresh - the panel has to be torn down and refetched. Reopening goes
  // through the entity dropdown by name, so the retry always lands back on the
  // same entity.
  async startReassessmentWhenReady(entityName) {
    console.log("Starting the reassessment (waiting for readiness)...");
    await this.reassessment.clickStartReassessmentWhenReady(async () => {
      await this.page.reload();
      await this.waitForLoad();
      await this.entities.selectEntityAndNavigate(entityName);
      await this.openReassessmentPanel();
    });
  }

  // Clicks Start Reassessment directly, with no readiness retry. Correct only
  // once the assessment has been answered - answering is itself proof that the
  // backend finished initializing the framework, so the race the retry version
  // handles cannot still be open.
  async startReassessment() {
    console.log("Starting the reassessment...");
    await this.reassessment.clickStartReassessmentButton();
  }

  async confirmStartReassessment() {
    console.log("Confirming Start Reassessment in the footer dialog...");
    await this.reassessment.clickStartReassessmentConfirmButton();
    console.log("Start Reassessment confirmed.");
  }

  async verifyReassessmentLabelVisible() {
    console.log("Verifying the reassessment label on the framework card...");
    await this.reassessment.verifyReassessmentLabelVisible();
  }

  // --- archive --------------------------------------------------------------

  async openArchive() {
    console.log("Opening the Archive from the side menu...");
    await this.reassessment.clickArchiveSideMenuItem();
    console.log("Archive open.");
  }

  // Asserts the archived card still carries the pre-reassessment figures, which
  // is the whole point of the flow: reassessing must snapshot the old
  // assessment rather than move it.
  async verifyArchivedCardData(metrics) {
    console.log("Verifying the archived card against the captured metrics...");
    await this.reassessment.verifyArchivedCardData(
      metrics.score,
      metrics.collectionPercentage,
      metrics.remediationPercentage,
    );
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // This suite answers a full assessment and then re-answers it, so the modal
  // is more likely here than anywhere else in the EntityLeader job. It does NOT
  // reliably appear at a probe-able moment - it surfaces part-way through the
  // question work - so a handler is the only thing that catches it. Playwright
  // runs the callback whenever the modal turns up and blocks an action, then
  // retries the original action.
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

module.exports = ReassessmentEntityLeader;
