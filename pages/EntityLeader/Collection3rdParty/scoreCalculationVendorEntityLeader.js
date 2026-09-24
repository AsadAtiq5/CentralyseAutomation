const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const CollectionPage = require("../../Secure/CollectionPage");
const QuestionEngine = require("../../Secure/Collection/QuestionEngine");
const AddVendorEntityLeader = require("../Vendor/addVendorEntityLeader");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

// Drives the THIRD PARTY score calculation flow as the ENTITY LEADER: create a
// vendor inside the leader's own client, answer its questionnaire end to end,
// then read the score back off the framework card.
//
// This is the third-party twin of scoreCalculationEntityLeader.js. The scoring
// half is deliberately the same shape - open the card, answer every question,
// reopen the collection, read the card score - because the collection screen is
// the same component on both sides of the app. What differs is everything
// before it: the thing being scored is a VENDOR, not a sub-entity.
//
// DELEGATION
//   - The vendor half goes to AddVendorEntityLeader (`this.vendorLeader`),
//     which already owns this role's route to 3rd Party > Vendors, the client-id
//     derivation and the Add Vendor wizard, all verified live for this role.
//     Re-implementing them here would mean two copies of the same wizard drifting
//     apart.
//   - The collection half goes to CollectionPage (`this.collection`) and
//     QuestionEngine (`this.questionEngine`), exactly as the first-party port
//     does.
//
// WHAT THIS CLASS OWNS, and why the Secure ScoreCalculationThirdParty page
// object could not simply be reused:
//   - There is no client to create or search for. The Secure SC3P - 00 opens
//     /clients, creates a client and clicks its card; this role has no client
//     picker at all and is already inside the client ELS - 01 provisioned.
//   - The collection deep link. The Secure spec re-walks
//     client -> 3rd Party -> Vendors -> vendor -> Collection at the start of
//     SC3P - 01. This role can navigate straight to
//     /third-party/<clientId>/collection/<vendorId>, which is both faster and
//     one fewer list to race with. Confirmed live: that URL renders the cards.
//   - Refreshing for the score. The Secure spec reads the score straight after
//     the last question, which assumes the app has already walked back to the
//     card list. This class navigates back to the deep link instead - true
//     wherever the question loop left the page.
//   - The chapter-completion modal, which surfaces once an assessment has been
//     fully answered. Same treatment as the first-party port.

// Framework the vendor is provisioned with. AI Governance is deliberate and
// must match the Secure SC3P - 00: getAnswerOptions() resolves the answer enum
// from the framework name, so a different framework changes the expected score.
const DEFAULT_VENDOR_FRAMEWORK = "AI Governance (vendor)";

class ScoreCalculationVendorEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.vendorLeader = new AddVendorEntityLeader(page);
    this.collection = new CollectionPage(page);
    this.questionEngine = new QuestionEngine(page);
    this.selectors = {
      // Framework cards on the collection screen. Same value CollectionPage
      // uses; kept here so this class can wait on them without reaching into
      // another page object's selector map.
      entityCardBox: ".entity-card-box",
      chapterCompletionModal: ".chapter-completion-modal",
    };
  }

  // --- arrival and the vendor ------------------------------------------------

  // Gets this role onto its client's vendors screen and returns the client id.
  // Replaces the whole of the Secure SC3P - 00's /clients navigation, client
  // creation and client-card click.
  async openVendorsForThisClient() {
    return await this.vendorLeader.openVendorsForThisClient();
  }

  // Creates the vendor whose questionnaire this suite scores, on the framework
  // the expected score is derived from. Returns its name.
  //
  // The name goes through the SHORT generator: the vendor name field caps at 20
  // characters, so a longer name would not match what the app actually saved -
  // the same reason the Secure SC3P - 00 gives.
  async createVendorForScoreCalculation(prefix) {
    const vendorName = await this.vendorLeader.createVendor(prefix);
    console.log(
      `Vendor created for the third party score calculation flow: ${vendorName}`,
    );
    return vendorName;
  }

  // Opens the vendor by name and lands on its Collection, so the UUIDs can be
  // read off the URL. This is the only route available before they are known.
  async openVendorCollectionByName(vendorName) {
    await this.vendorLeader.openVendorByName(vendorName);
    await this.vendorLeader.openVendorCollection();
    await this.waitForCollectionCards();
  }

  // --- collection ------------------------------------------------------------

  // Waits for the framework cards to paint.
  //
  // The timeout is long on purpose. A vendor created moments earlier lands on
  // its collection with no card at all while the backend builds the
  // questionnaire, and the "Loading Collection Overview" label is NOT a usable
  // signal - it stays in the DOM after the card renders, so waiting for it to
  // disappear waits forever. The card is the condition.
  async waitForCollectionCards(timeoutMs = 180000) {
    await this.page
      .locator(this.selectors.entityCardBox)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Collection open with the framework cards rendered.");
  }

  // Returns the [clientId, vendorId] pair off the current collection URL.
  //
  // The vendor id is not rendered anywhere on screen, and the vendors LIST URL
  // carries it only as a query parameter, which fetchPageURL does not read - it
  // parses path segments. So the collection URL is the one place both ids can be
  // taken from, which is why the setup test has to land here before storing them.
  async getCollectionIds() {
    const uuids = fetchPageURL(this.page.url());
    console.log(`UUIDs found in the collection URL: ${uuids.join(", ")}`);
    return uuids;
  }

  // Deep links straight into one vendor's collection.
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
    await this.waitForCollectionCards(timeoutMs);
  }

  // Reads the framework name off the card and opens it in one step, because the
  // name is only reliably readable before the card expands. Returns the name so
  // the caller can resolve that framework's answer options.
  //
  // Index 0 is safe here, unlike in the Controls port: the vendor this suite
  // creates carries exactly one framework, because nothing else in this spec
  // adds one to it.
  async getFrameworkNameAndOpen(index = 0) {
    console.log(`Opening the framework card at index ${index}...`);
    const frameworkName = await this.collection.getFrameworkName(index);
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // Brings the collection card list back up so the score can be read.
  //
  // The score is rendered from the SAVED answers, so this step is not optional -
  // without it the card still shows the score from before the questionnaire was
  // answered. The Secure SC3P - 01 reads the score with no refresh at all, which
  // only holds while the question loop happens to leave the page on the card
  // list; navigating to the deep link is true regardless.
  async refreshCollectionForScore(clientId, vendorId, timeoutMs = 180000) {
    console.log(
      "Reopening the vendor collection so the card score refreshes...",
    );
    await this.openCollectionByIds(clientId, vendorId, timeoutMs);
    await this.dismissChapterCompletionModalIfPresent();
  }

  // Returns the raw score text from the card; the caller parses it, because only
  // the caller knows how it wants to compare.
  async getScore(index = 0) {
    const selectedCard = await this.collection.fetchFrameworkCard(index);
    const score = await this.collection.fetchScoreByCard(selectedCard);
    console.log(`Score read from the framework card: ${score}`);
    return score;
  }

  // --- chapter completion modal ----------------------------------------------

  // Registers an auto-dismiss handler for the "Awesome! You've just finished
  // another chapter" modal, for the lifetime of this page.
  //
  // Why a handler and not a one-off check: the modal does NOT appear when the
  // framework is opened - a probe at that moment reports nothing - it surfaces
  // seconds later, part-way through the question work. So there is no single
  // point in the flow at which it can reliably be dismissed. Playwright's
  // addLocatorHandler runs the callback whenever the modal turns up and blocks an
  // action, then retries the original action.
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
  // Why this exists alongside the handler: once a questionnaire is fully
  // answered, reopening the collection can raise the modal. It is an
  // ngb-modal-window overlaying the whole page, so it silently intercepts
  // pointer events and any read underneath it fails with "subtree intercepts
  // pointer events" rather than anything naming the modal.
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

module.exports = ScoreCalculationVendorEntityLeader;
module.exports.DEFAULT_VENDOR_FRAMEWORK = DEFAULT_VENDOR_FRAMEWORK;
