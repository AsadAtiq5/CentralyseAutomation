const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const AddEntityPage = require("../../Secure/AddEntityPage");
const CollectionPage = require("../../Secure/CollectionPage");
const QuestionEngine = require("../../Secure/Collection/QuestionEngine");
const StartFresh = require("../../Secure/Collection/StartFresh");
const Reassessment = require("../../Secure/Collection/Reassessment");

// Drives the Start Fresh flow on the collection as the ENTITY LEADER.
//
// The Start Fresh mechanics - the trigger on the framework card, the footer
// confirm and the "no answers remain" sweep - are delegated to the Secure
// StartFresh page object (`this.startFresh`), and the edit-framework panel to
// the Secure Reassessment one (`this.reassessment`). Entity creation goes to
// AddEntityPage (`this.entities`), card handling to CollectionPage
// (`this.collection`) and the answer pass to QuestionEngine
// (`this.questionEngine`).
//
// WHAT THIS CLASS OWNS
//
//   - Arrival and entity creation. The Secure spec creates a whole CLIENT; this
//     role has no /clients screen and is already inside the client ELS - 01
//     provisioned, so it builds only its own sub-entity.
//
//   - Everything addressed BY NAME rather than by index or .first(). The Secure
//     SF - 01 works in a client holding exactly one entity with one framework
//     and one archive, which is what makes index 0 and .first() identify the
//     right thing there. This role's client accumulates entities from every
//     spec in the job, so a name is the only unambiguous handle. contains()
//     rather than an exact match, for the reason the import port documents: the
//     card span can render as "<FRAMEWORK> | <SUBENTITY>" and an exact match
//     can never hit that.
//
//   - openArchiveWhenReady(), which waits for the Archive menu item to be
//     ENABLED and not merely visible. See that method.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in the other EntityLeader page objects. That is this suite's
// deliberate shape - each one owns its own copy so a change made for one flow
// cannot break another. Lifting an EntityLeaderBasePage would be the right
// cleanup, but it would mean altering page-object methods the shipped EL specs
// already depend on, so it is left as a separate decision.

// Framework the entity this suite builds is provisioned with, via
// addEntityWithBusinessEmailCompromiseUserBased().
const DEFAULT_FRAMEWORK = "Business Email Compromise";

class StartFreshEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.entities = new AddEntityPage(page);
    this.collection = new CollectionPage(page);
    this.questionEngine = new QuestionEngine(page);
    this.startFresh = new StartFresh(page);
    this.reassessment = new Reassessment(page);
    this.selectors = {
      // The upperdeck score ring - the first thing to paint on the landing
      // screen, so it is what arrival waits on.
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      chapterCompletionModal: ".chapter-completion-modal",
      // Collection card for one named framework.
      cardByName: (name) =>
        `//div[contains(@class,'entity-card-box')][.//span[contains(@class,'sub-entity-name') and contains(normalize-space(.),'${name}')]]`,
      // Same anchor, used to pick the framework inside the edit panel.
      frameworkCard: (name) =>
        `//div[contains(@class,'entity-card')]//span[contains(@class,'sub-entity-name') and contains(normalize-space(.),'${name}')]`,
      // Archive item in the COLLECTION sub-menu. Resolves the button rather
      // than the span, because the button carries the disabled state.
      archiveSideMenuBtn:
        "//button[contains(@class,'sub-menu-sub-item')][.//span[contains(@class,'collection-menu') and normalize-space(text())='Archive']]",
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

  // Creates the disposable sub-entity this flow wipes, on Business Email
  // Compromise with user-based collection, and returns its name.
  //
  // Disposable is the point: Start Fresh CLEARS every answer on the framework
  // and archives them. Pointing that at a shared entity would destroy whatever
  // else depends on those answers.
  async createEntityWithBEC(prefix = "SFEL_Entity") {
    await this.entities.clickNewEntity();
    const entityName = await this.entities.createUniqueEntityName(prefix);
    await this.entities.addEntityWithBusinessEmailCompromiseUserBased();
    await this.entities.waitForToast();
    await this.entities.verifyEntityInList(entityName);
    console.log(`Entity created for the Start Fresh flow: ${entityName}`);
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

  // Opens one framework card BY NAME and returns that name.
  async openFrameworkByName(frameworkName = DEFAULT_FRAMEWORK) {
    console.log(`Opening the "${frameworkName}" framework card...`);
    const card = this.page
      .locator(this.selectors.cardByName(frameworkName))
      .first();
    await card.waitFor({ state: "visible", timeout: 120000 });
    // A fully answered assessment can raise the chapter-completion modal here,
    // which would then intercept every click in the question list underneath.
    await this.dismissChapterCompletionModalIfPresent();
    await this.collection.clickOpenBtnByCard(card);
    await this.waitForSpinner();
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // Answers every question across every page of the assessment. Unlike the sub
  // entity leader port, this suite answers its own: its entity is brand new, so
  // there is no earlier spec to have left a score on the card.
  async answerAllQuestions() {
    console.log("Answering every question in the assessment...");
    const answers = await this.questionEngine.answerAllQuestions();
    console.log(`Answered ${answers.length} question(s).`);
    return answers;
  }

  // Returns the raw score text from the NAMED card. Raw because the archive
  // check compares it as text.
  async getScoreByName(frameworkName = DEFAULT_FRAMEWORK) {
    const card = this.page
      .locator(this.selectors.cardByName(frameworkName))
      .first();
    await card.waitFor({ state: "visible", timeout: 120000 });
    const score = await this.collection.fetchScoreByCard(card);
    console.log(`Score read from the "${frameworkName}" card: ${score}`);
    return score;
  }

  // --- edit panel + Start Fresh --------------------------------------------

  async openEditFrameworkPanel() {
    console.log("Opening the edit collection framework panel...");
    await this.reassessment.clickEditCollectionFrameworkButton();
    console.log("Edit collection framework panel open.");
  }

  // Picks the framework card inside the edit panel by name.
  //
  // Not delegated to Reassessment.clickBusinessEmailCompromiseCard(): that
  // method's selector demands an exact card label - see the class comment.
  async selectFrameworkCard(frameworkName = DEFAULT_FRAMEWORK) {
    console.log(`Selecting the "${frameworkName}" framework card...`);
    const card = this.page.locator(this.selectors.frameworkCard(frameworkName));
    await card.first().waitFor({ state: "visible", timeout: 60000 });
    await card.first().click();
    await this.waitForSpinner();
    console.log(`Framework card selected: ${frameworkName}`);
  }

  // Opens the Start Fresh modal from the edit panel.
  //
  // Unlike the reassessment trigger, `div.start-fresh` is rendered
  // unconditionally - it carries no *ngIf - so this needs no readiness retry.
  async openStartFreshModal() {
    console.log("Opening the Start Fresh modal...");
    await this.startFresh.clickStartFreshButton();
    console.log("Start Fresh modal open.");
  }

  async confirmStartFresh() {
    console.log("Confirming Start Fresh in the footer dialog...");
    await this.startFresh.clickStartFreshConfirmButton();
    await this.waitForSpinner();
    console.log("Start Fresh confirmed.");
  }

  // Asserts no answer remains selected on any page of the assessment.
  async verifyAllAnswersRemoved() {
    console.log("Verifying every answer was cleared by Start Fresh...");
    await this.startFresh.verifyAllAnswersRemoved();
  }

  // --- archive --------------------------------------------------------------

  // Opens the Archive screen, waiting for the side-menu item to become ENABLED.
  //
  // Why not the shared clickArchiveSideMenuItem(): that one waits only for the
  // span to be visible, and the item renders greyed out until the entity
  // actually has an archive. The click then spends its whole budget retrying
  // against a disabled button and fails with "element is not enabled", which
  // reads as a broken menu rather than as "the archive is not there yet". The
  // Start Fresh that produces the archive completes asynchronously, so there is
  // a real window here where the item is visible but not yet clickable.
  async openArchiveWhenReady(timeoutMs = 120000) {
    console.log("Opening the Archive screen from the side menu...");
    const item = this.page.locator(this.selectors.archiveSideMenuBtn).first();
    await item.waitFor({ state: "visible", timeout: timeoutMs });
    await expect(item).toBeEnabled({ timeout: timeoutMs });
    await item.click();
    await this.waitForSpinner();
    console.log("Archive screen open.");
  }

  // Asserts the archived card FOR ONE NAMED FRAMEWORK carries the score
  // captured before the Start Fresh.
  //
  // Why not the shared verifyArchivedCardScore(): it reads the first card with
  // an .archived-border. That identifies the right archive only while the
  // entity has exactly one, which is true for the entity this suite builds -
  // but the name match costs nothing and stays correct if this entity is ever
  // archived twice.
  //
  // hasText is a case-insensitive substring match, which is what this needs:
  // the card label is uppercased in CSS and can read
  // "<FRAMEWORK> | <SUBENTITY>".
  async verifyArchivedCardScoreByName(
    frameworkName,
    expectedScore,
    timeoutMs = 120000,
  ) {
    console.log(`Verifying the archived "${frameworkName}" card score...`);
    const card = this.page
      .locator(".entity-card-box:has(.archived-border)")
      .filter({ hasText: frameworkName })
      .first();
    await card.waitFor({ state: "visible", timeout: timeoutMs });

    const scoreLocator = card.locator("span.total-score");
    await scoreLocator.waitFor({ state: "visible", timeout: timeoutMs });
    const actualScore = (await scoreLocator.innerText())?.trim();
    const expected = (expectedScore ?? "").toString().trim();
    console.log(`Archive score - expected ${expected} | actual ${actualScore}`);
    expect(actualScore).toBe(expected);
    console.log(`Archived "${frameworkName}" card score matches.`);
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // This suite answers a full assessment, so the modal surfaces part-way
  // through the question work rather than at any point a spec could probe for.
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

StartFreshEntityLeader.DEFAULT_FRAMEWORK = DEFAULT_FRAMEWORK;

module.exports = StartFreshEntityLeader;
