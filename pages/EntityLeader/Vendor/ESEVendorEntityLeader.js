const BasePage = require("../../Secure/BasePage");
const EmergingSecurityContent = require("../../Secure/Vendor/EmergingSecurityContent");
const AddVendorEntityLeader = require("./addVendorEntityLeader");

// Drives the Emerging Security Event (ESE) flow on a VENDOR as the ENTITY
// LEADER: build an ad-hoc questionnaire from the vendors screen, publish it to
// the vendor, then verify the question it created on that vendor's collection.
//
// DELEGATION
//   - The vendor half goes to AddVendorEntityLeader (`this.vendorLeader`),
//     which already owns this role's route to 3rd Party > Vendors, the client-id
//     derivation, the Add Vendor wizard and the reload-retry that waits for a
//     new vendor to appear in the list. Re-implementing them here would mean two
//     copies of the same wizard drifting apart.
//   - The ESE builder goes to the Secure EmergingSecurityContent (`this.ese`):
//     the chooser modal, the event form, the question table and the collection
//     assertions are the same app components for every role. Confirmed live for
//     this role before porting - the ESE icon renders on the vendors screen.
//
// WHAT THIS CLASS OWNS
//   - Arrival. The Secure ESE - 01 opens /clients, creates a client and clicks
//     its card; this role has no client picker at all and is already inside the
//     client ELS - 01 provisioned.
//   - Composing the builder into whole steps, because the Secure spec drives
//     fifteen page-object calls inline and the seams between them are where the
//     waits belong.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() lives in AddVendorEntityLeader
// and is reached through it here rather than copied, because this class already
// depends on that page object for the rest of the vendor route.

// Framework the ESE vendor is provisioned with, matching the Secure ESE - 01.
const DEFAULT_VENDOR_FRAMEWORK = "AI Governance (vendor)";

class ESEVendorEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.vendorLeader = new AddVendorEntityLeader(page);
    this.ese = new EmergingSecurityContent(page);
    this.selectors = {
      // Framework cards on the vendor collection screen.
      entityCardBox: ".entity-card-box",
    };
  }

  // --- arrival and the vendor ------------------------------------------------

  // Gets this role onto its client's vendors screen and returns the client id.
  // Replaces the whole of the Secure ESE - 01's /clients navigation, client
  // creation and client-card click.
  async openVendorsForThisClient() {
    return await this.vendorLeader.openVendorsForThisClient();
  }

  // Creates the vendor the ESE event is published to, on the same framework the
  // Secure spec picks. Returns its name.
  //
  // The name goes through the SHORT generator inside createVendor(): the vendor
  // name field caps at 20 characters. The Secure ESE - 01 uses the unbounded
  // createUniqueVendorName() instead - that is the one place this port
  // deliberately diverges, for the reason the vendor suite documents.
  async createVendorForEse(prefix) {
    const vendorName = await this.vendorLeader.createVendor(prefix);
    console.log(`Vendor created for the ESE flow: ${vendorName}`);
    return vendorName;
  }

  // Ticks the vendor's checkbox, which is what arms the ESE icon - the builder
  // publishes to the SELECTED vendors, so without this it has no target.
  //
  // ensureVendorVisible() rather than a bare assertion: the vendor list refetches
  // once when the wizard closes and can settle without a vendor whose backend
  // record was not ready at that moment. The Secure spec open-codes a
  // reload-if-not-visible guard here for the same reason; this is that guard,
  // with retries.
  async selectVendorByName(vendorName) {
    console.log(`Selecting the vendor for the ESE event: ${vendorName}`);
    await this.vendorLeader.ensureVendorVisible(vendorName);
    await this.vendorLeader.vendors.checkVendorByName(vendorName);
    await this.waitForSpinner();
  }

  // --- the ESE builder -------------------------------------------------------

  // Opens the ESE icon and picks Build in the chooser modal.
  //
  // The Build step is not optional: the icon opens a chooser (Upload / Build /
  // Template) and the questionnaire builder only renders after Build is picked.
  // Skipping it leaves verifyEsePopup() waiting out its full timeout on a
  // heading that exists one screen later.
  async openEseBuilder() {
    console.log("Opening the ESE builder...");
    await this.ese.clickEseIcon();
    await this.waitForSpinner();
    await this.ese.clickEseBuildOption();
    await this.ese.verifyEsePopup();
    console.log("ESE builder open.");
  }

  // Fills the event header and adds one question row.
  //
  // The due date is today, picked through the calendar rather than typed - the
  // input is bound to the datepicker, so a typed value does not register.
  async buildEseEvent(eventName, questionData) {
    console.log(`Building the ESE event: ${eventName}`);
    await this.ese.enterEventName(eventName);
    await this.ese.selectDueDate();

    await this.ese.clickAddQuestion();
    await this.ese.fillQuestionRow(questionData);
    console.log("ESE question row filled.");
  }

  // Saves the questionnaire, completes it and clears the acknowledgement popup.
  //
  // Save and Complete are two separate actions on this screen: Save persists the
  // question table, Complete publishes the event to the selected vendors. The
  // success popup is what proves the publish reached the backend rather than
  // that the button was merely clicked.
  async saveAndCompleteEseEvent() {
    console.log("Saving the ESE questionnaire...");
    await this.ese.clickSaveButton();
    await this.waitForSpinner();

    console.log("Completing the ESE event...");
    await this.ese.clickCompleteButton();
    await this.waitForSpinner();

    await this.ese.waitForSuccessPopup();
    await this.ese.clickOkButton();
    await this.waitForSpinner();
    console.log("ESE event published.");
  }

  // --- verification on the collection ----------------------------------------

  // Opens the vendor's collection and then the ESE event card on it.
  //
  // The ESE card is found by its "ESE:" name prefix rather than by index: this
  // vendor also carries the framework it was created with, so the ESE event is
  // not the only card on the list.
  //
  // The card can take a moment to appear after the publish - the collection is
  // rebuilt with the new event - so the card list is waited on with the same
  // long timeout the vendor suite uses for a freshly built questionnaire.
  //
  // THE VENDORS SCREEN IS REOPENED FIRST, and that is not tidiness. Straight
  // after the ESE acknowledgement popup is cleared, a click on the vendor row
  // is SWALLOWED: the click itself reports success, the app stays on the list
  // and the vendor sub-menu never renders, so the Collection click then waits
  // for an element that will never exist. Playwright Test leaves actionTimeout
  // at 0, so BasePage.waitForElement() has no bound of its own and that wait
  // runs until the whole test times out - a ten minute failure that names the
  // Collection selector rather than the click that actually failed.
  //
  // Verified live that the row click navigates normally on a freshly loaded
  // list, with the checkbox still ticked - so it is the post-publish state of
  // the screen that is at fault, not the selection. Refetching the screen is
  // the same remedy ensureVendorVisible() uses for the list settling stale.
  async openEseEventOnCollection(
    vendorName,
    clientId = null,
    timeoutMs = 180000,
  ) {
    console.log(
      `Opening the ESE event on the vendor collection: ${vendorName}`,
    );
    const id = clientId || this.vendorLeader.getClientIdFromUrl();
    if (!id) {
      throw new Error(
        "Could not resolve the client id needed to reopen the vendors screen after the ESE publish.",
      );
    }
    await this.vendorLeader.openVendorsScreen(id);
    await this.vendorLeader.ensureOnVendorsScreen();
    await this.vendorLeader.openVendorByName(vendorName);
    await this.vendorLeader.openVendorCollection();
    await this.page
      .locator(this.selectors.entityCardBox)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    await this.ese.openEseEventCard();
    await this.waitForSpinner();
    console.log("ESE event card open.");
  }

  // Asserts the question the builder created renders on the collection with the
  // function, category, sub category and control name in its header, and the
  // question text in the card. The assertion lives in the delegated method, so
  // the spec needs none of its own.
  async verifyQuestionData(questionData) {
    console.log("Verifying the ESE question data on the collection...");
    await this.ese.verifyQuestionData(questionData);
    console.log("ESE question data verified.");
  }
}

module.exports = ESEVendorEntityLeader;
module.exports.DEFAULT_VENDOR_FRAMEWORK = DEFAULT_VENDOR_FRAMEWORK;
