const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const AddEntityPage = require("../../Secure/AddEntityPage");
const CollectionPage = require("../../Secure/CollectionPage");
const ImportAssessment = require("../../Secure/ImportAssessment/ImportAssessment");

// Drives the Import Assessment flow on the collection as the ENTITY LEADER.
//
// The import mechanics - the modal, its NEXT and ADD buttons, the file chooser,
// the error-border check and the post-import answer sweep - are delegated to
// the Secure ImportAssessment page object (`this.importAssessment`). Entity
// creation goes to AddEntityPage (`this.entities`) and card handling to
// CollectionPage (`this.collection`).
//
// WHAT THIS CLASS OWNS
//
//   - Arrival and entity creation. The Secure spec creates a whole CLIENT; this
//     role has no /clients screen and is already inside the client ELS - 01
//     provisioned, so it builds only its own sub-entity.
//
//   - Everything addressed BY FRAMEWORK NAME, using contains() rather than the
//     exact match the Secure page object uses. Three of its selectors anchor on
//     normalize-space(.)='Business Email Compromise' - the card, its score and
//     its Open button. That exact form holds when the collection has been
//     drilled into for a single entity, which is how this suite navigates, so
//     the Secure methods would very likely work here. But the sub entity leader
//     port found the same span rendering as
//
//       " Business Email Compromise  | SEL1_1787664288125 "
//
//     when the collection lists a framework per sub-entity, and an exact match
//     can never hit that - the failure is a bare 60s "waiting for locator" on
//     a card that is plainly on screen. contains() matches BOTH shapes at no
//     cost, so this class uses it and does not depend on which shape this role
//     gets.
//
// The Import Assessment button itself needs no such treatment: unlike the
// reassessment trigger it carries no readiness race, so a plain click is
// enough.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in the other EntityLeader page objects. That is this suite's
// deliberate shape - each one owns its own copy so a change made for one flow
// cannot break another. Lifting an EntityLeaderBasePage would be the right
// cleanup, but it would mean altering page-object methods the shipped EL specs
// already depend on, so it is left as a separate decision.

// Framework the entity this suite builds is provisioned with, via
// addEntityWithBusinessEmailCompromiseUserBased(). Both workbooks target it, so
// the scores they produce are fixed figures rather than anything derived.
const DEFAULT_FRAMEWORK = "Business Email Compromise";

class ImportAssessmentEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.entities = new AddEntityPage(page);
    this.collection = new CollectionPage(page);
    this.importAssessment = new ImportAssessment(page);
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
      // The Secure businessEmailCompromiseScore selector with its exact name
      // match relaxed to contains() - otherwise identical, including the hop up
      // to entity-card-top-section, so it reads the same score element.
      scoreByName: (name) =>
        `//div[contains(@class,'entity-card')]//span[contains(@class,'sub-entity-name') and contains(normalize-space(.),'${name}')]/ancestor::div[contains(@class,'entity-card-top-section')]//span[contains(@class,'total-score')]`,
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

  // Creates the sub-entity this flow imports into, on Business Email Compromise
  // with user-based collection, and returns its name.
  //
  // The framework is not incidental: both workbooks are built for Business
  // Email Compromise, and the fixed scores the tests assert ("10" and "0.4")
  // only follow from importing them into that framework.
  async createEntityWithBEC(prefix = "IAEL_Entity") {
    await this.entities.clickNewEntity();
    const entityName = await this.entities.createUniqueEntityName(prefix);
    await this.entities.addEntityWithBusinessEmailCompromiseUserBased();
    await this.entities.waitForToast();
    await this.entities.verifyEntityInList(entityName);
    console.log(`Entity created for the import flow: ${entityName}`);
    return entityName;
  }

  // --- collection -----------------------------------------------------------

  // Opens one entity's collection by NAME through the side menu and the entity
  // dropdown. Selecting by name keeps this deterministic in a client that holds
  // many entities, which "the first Open button" would not be.
  async openEntityCollection(entityName) {
    console.log(`Opening the collection for entity: ${entityName}`);
    await this.entities.navigateToCollection();
    await this.entities.selectEntityAndNavigate(entityName);
    await this.waitForSpinner();
    console.log("Collection open.");
  }

  // --- edit panel -----------------------------------------------------------

  // Opens the edit panel. Resolves the same `.edit-collection-framework-btn`
  // pencil the Secure spec clicks through AddEntityPage.
  async openEditFrameworkPanel() {
    console.log("Opening the edit collection framework panel...");
    await this.entities.clickEditEntityButton();
    console.log("Edit collection framework panel open.");
  }

  // Picks the framework card inside the edit panel by name.
  //
  // Not delegated to ImportAssessment.clickBusinessEmailCompromiseCard(): that
  // method's selector demands an exact card label - see the class comment.
  async selectFrameworkCard(frameworkName = DEFAULT_FRAMEWORK) {
    console.log(`Selecting the "${frameworkName}" framework card...`);
    const card = this.page.locator(this.selectors.frameworkCard(frameworkName));
    await card.first().waitFor({ state: "visible", timeout: 60000 });
    await card.first().click();
    await this.waitForSpinner();
    console.log(`Framework card selected: ${frameworkName}`);
  }

  // --- import modal ---------------------------------------------------------

  async clickImportAssessment() {
    console.log("Clicking Import Assessment...");
    await this.importAssessment.clickImportAssessmentButton();
  }

  // Waits for the modal and steps past its first screen.
  async openImportModal() {
    console.log("Waiting for the Import Assessment modal...");
    await this.importAssessment.waitForImportAssessmentModal();
    await this.importAssessment.clickImportAssessmentNextButton();
    console.log("Import Assessment modal open, moved past the first screen.");
  }

  // Hands the workbook to the modal's file chooser.
  async uploadImportFile(filePath) {
    console.log(`Uploading the import workbook: ${filePath}`);
    await this.importAssessment.uploadImportAssessmentFile(filePath);
    console.log("Workbook handed to the import modal.");
  }

  // Asserts the preview table flags the row the workbook could not map - the
  // Not Applicable answer on the first question.
  async verifyImportErrorBorderVisible() {
    console.log("Verifying the import preview flags the unmapped answer...");
    await this.importAssessment.verifyImportErrorBorderVisible();
  }

  async clickAddButton() {
    console.log("Clicking ADD to apply the imported answers...");
    await this.importAssessment.clickImportAssessmentAddButton();
  }

  // Waits for the success modal and dismisses it.
  async confirmImportSuccess() {
    console.log("Waiting for the import success modal...");
    await this.importAssessment.waitForImportSuccessModal();
    await this.importAssessment.clickImportSuccessOkButton();
    await this.waitForSpinner();
    console.log("Import confirmed.");
  }

  // --- collection verification ----------------------------------------------

  // Asserts the NAMED card carries the score the imported answers produce.
  //
  // The assertion lives here rather than in the spec because it is a string
  // comparison against the screen, not a derived numeric value.
  async verifyScoreByName(expectedScore, frameworkName = DEFAULT_FRAMEWORK) {
    const scoreEl = this.page
      .locator(this.selectors.scoreByName(frameworkName))
      .first();
    await scoreEl.waitFor({ state: "visible", timeout: 60000 });
    const score = (await scoreEl.textContent())?.trim();
    console.log(`Card score - expected ${expectedScore} | actual ${score}`);
    if (score !== expectedScore) {
      throw new Error(
        `Expected "${frameworkName}" score "${expectedScore}" but got "${score}"`,
      );
    }
    console.log(`"${frameworkName}" score verified: ${score}`);
  }

  // Opens one framework card BY NAME and returns that name.
  //
  // Not delegated to ImportAssessment.clickBusinessEmailCompromiseOpenButton():
  // besides the exact-name problem, that selector hops to the Open button
  // through an `ng-star-inserted`/`ng-tns` ancestor, which are Angular's own
  // generated markers rather than anything the app names. Resolving the card
  // first and using the shared clickOpenBtnByCard() is the sturdier route.
  async openFrameworkByName(frameworkName = DEFAULT_FRAMEWORK) {
    console.log(`Opening the "${frameworkName}" framework card...`);
    const card = this.page
      .locator(this.selectors.cardByName(frameworkName))
      .first();
    await card.waitFor({ state: "visible", timeout: 120000 });
    // The imported assessment is fully answered, so the chapter completion
    // modal can surface here and intercept every click underneath it.
    await this.dismissChapterCompletionModalIfPresent();
    await this.collection.clickOpenBtnByCard(card);
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // Asserts the imported answers landed: every question answered Yes.
  async verifyAllQuestionsAnsweredYes() {
    console.log("Verifying every imported answer is Yes...");
    await this.importAssessment.verifyAllQuestionsAnsweredYes();
  }

  // Asserts the imported answers landed: first question Yes, every other No.
  async verifyFirstQuestionYesRestNo() {
    console.log("Verifying the imported answers across every question set...");
    await this.importAssessment.verifyFirstQuestionYesRestNo();
  }

  // --- chapter completion modal ---------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // Once the import lands the assessment is fully answered, so the modal
  // surfaces part-way through the question sweep rather than at any point a
  // spec could probe for. Playwright's addLocatorHandler runs the callback
  // whenever the modal turns up and blocks an action, then retries the original
  // action.
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

ImportAssessmentEntityLeader.DEFAULT_FRAMEWORK = DEFAULT_FRAMEWORK;

module.exports = ImportAssessmentEntityLeader;
