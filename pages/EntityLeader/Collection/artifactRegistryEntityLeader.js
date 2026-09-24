const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const CollectionPage = require("../../Secure/CollectionPage");
const ArtifactRegistry = require("../../Secure/Collection/ArtifactRegistry");

// Drives the Artifacts Registry as the ENTITY LEADER.
//
// The registry screen itself is delegated to the Secure ArtifactRegistry page
// object (`this.registry`): the artifacts table, the upload modal, the
// question-side registry panel and the linked-questions verification are the
// same app components for every role.
//
// WHAT THIS CLASS OWNS is the route, and here it differs from BOTH other roles.
//
//   - Unlike the Secure suite there is no client to create or search for. Its
//     SETUP 00 builds a whole client for these tests; this role is already
//     inside the client ELS - 01 provisioned, and SCEL - 00 has already built
//     the sub-entity, so this suite provisions nothing.
//
//   - Unlike the sub entity leader, the side menu is NOT a safe route to the
//     collection. That role sees exactly one entity, so "collection side menu,
//     then click the first Open button" is unambiguous. An entity leader's
//     client holds many entities by the time this runs - the four UDEL_Entity
//     cards, PolicySubEL, and the SCEL_Entity this suite targets - so the first
//     Open button is whichever entity happens to sort first. Every collection
//     approach here therefore deep links with BOTH UUIDs, which pins the screen
//     to the SCEL sub-entity before any card is clicked.
//
// ON THE TWO IDs: the registry is addressed by the ENTITY id alone
// (/first-party/<entityId>/collection/artifacts-registry) while the assessment
// needs both. That is the same split the Secure spec uses - it stores uuids[0]
// for the registry URL and reaches the questions through the collection - and
// it is what makes AREL - 04 meaningful: an artifact uploaded to the entity's
// registry is the one offered on that entity's sub-entity questions.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() and the chapter-completion modal
// pair also appear in the other EntityLeader page objects. That is this suite's
// deliberate shape - each one owns its own copy so a change made for one flow
// cannot break another. Lifting an EntityLeaderBasePage would be the right
// cleanup, but it would mean altering page-object methods the shipped EL specs
// already depend on, so it is left as a separate decision.
class ArtifactRegistryEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.collection = new CollectionPage(page);
    this.registry = new ArtifactRegistry(page);
    this.selectors = {
      // The upperdeck score ring - the first thing to paint on the landing
      // screen, so it is what arrival waits on.
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      // Framework cards on the collection screen.
      entityCardBox: ".entity-card-box",
      // The registry's own table. Waiting on the table body rather than on a
      // row: AREL - 01 asserts the registry is EMPTY, so a wait needing a row
      // would time out on exactly the case it is there to check.
      artifactsTable: "table.artifacts-table",
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

  // --- registry navigation --------------------------------------------------

  // Deep links straight into the entity's Artifacts Registry.
  //
  // Waits on the table rather than the URL: the route resolves before the
  // registry paints, and both the empty state and the first row render inside
  // this container.
  async openArtifactRegistry(entityId, timeoutMs = 120000) {
    const url = `/first-party/${entityId}/collection/artifacts-registry`;
    console.log(`Navigating directly to the Artifacts Registry: ${url}`);
    await this.goto(url);
    await this.waitForLoad();
    await this.waitForSpinner();
    await this.page
      .locator(this.selectors.artifactsTable)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Artifacts Registry open.");
  }

  // --- registry screen ------------------------------------------------------

  async verifyNoArtifactsFound() {
    console.log("Verifying the registry shows 'No Artifacts Found'...");
    await this.registry.verifyNoArtifactsFound();
  }

  async uploadArtifact(filePath) {
    console.log(`Uploading artifact to the registry: ${filePath}`);
    await this.registry.uploadArtifact(filePath);
    console.log("Artifact uploaded.");
  }

  async verifyUploadedFile(fileName) {
    console.log(`Verifying "${fileName}" is listed in the registry...`);
    await this.registry.verifyUploadedFile(fileName);
  }

  async deleteFirstArtifact() {
    console.log("Deleting the first artifact in the registry...");
    await this.registry.deleteFirstArtifact();
    console.log("Artifact deleted.");
  }

  async getArtifactNames() {
    return await this.registry.getArtifactNames();
  }

  async clickArtifactByName(fileName) {
    console.log(`Opening artifact "${fileName}" from the registry...`);
    await this.registry.clickArtifactByName(fileName);
  }

  // --- collection / question side -------------------------------------------

  // Opens the SCEL sub-entity's assessment so the question-level artifact panel
  // can be reached.
  //
  // Deep links with both UUIDs rather than using the Secure page object's
  // openCollection() (collection side menu, then the first Open button). In a
  // client holding many entities that first button is whichever entity sorts
  // first, which would silently move this flow onto an entity whose registry
  // was never uploaded to - AREL - 04 would then fail looking for an artifact
  // that is in a different entity's registry.
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

    // Now the screen is pinned to this sub-entity, the first card IS one of its
    // framework cards, so opening the first one is deterministic.
    const frameworkName = await this.collection.clickFirstEntityOpen();
    await this.waitForSpinner();
    // This assessment was fully answered by SCEL - 01, which is exactly when
    // the chapter-completion modal surfaces. Left up it intercepts every click
    // on the question upload icon.
    await this.dismissChapterCompletionModalIfPresent();
    console.log(`Collection open on framework: ${frameworkName}`);
    return frameworkName;
  }

  async clickFirstQuestionUploadIcon() {
    console.log("Opening the artifact panel on the first question...");
    await this.registry.clickFirstQuestionUploadIcon();
  }

  async getSideRegistryArtifactNames() {
    return await this.registry.getSideRegistryArtifactNames();
  }

  async getQuestionDetails() {
    return await this.registry.getQuestionDetails();
  }

  // Links a randomly chosen artifact to the open question and returns its name,
  // so the caller can look that same artifact up in the registry afterwards.
  async linkRandomArtifact() {
    return await this.registry.linkRandomArtifact();
  }

  async verifyLinkedQuestionDetails(expectedDetails) {
    console.log("Verifying the linked question details on the artifact...");
    await this.registry.verifyLinkedQuestionDetails(expectedDetails);
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

module.exports = ArtifactRegistryEntityLeader;
