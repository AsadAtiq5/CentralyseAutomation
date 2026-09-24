const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const AddVendorPage = require("../../Secure/AddVendorPage");

// Drives 3rd Party > Vendors as the ENTITY LEADER.
//
// Everything on the vendor screens themselves is delegated to the Secure
// AddVendorPage (`this.vendors`): the Add Vendor wizard, the requirement
// upload, the delete modal, the questionnaire popup and the download menu are
// the same app components for every role, and none of their selectors carries
// a client or a role. Confirmed live against this role before porting - the
// side menu, the "ADD SINGLE VENDOR" popup, the framework cards, the download
// icon and the delete icon all resolve unchanged.
//
// WHAT THIS CLASS OWNS
//
//   - Arrival and the route to the vendors screen. The Secure spec creates a
//     CLIENT per flow and reaches the screen through /clients ->
//     searchAndClickClient -> 3rd Party -> Vendors. This role has no /clients
//     screen at all: the restored session lands it inside the one client
//     ELS - 01 provisioned, so the client is a given and the only thing to
//     work out is its id.
//
//   - Deriving that client id from the URL. The Secure spec reads it off the
//     vendor COLLECTION url after the first vendor exists, which means it
//     cannot navigate directly until VE - 01 has finished. The entity leader's
//     landing url already carries it - /first-party/<clientId>/upperdeck, and
//     the third-party screens reuse the same id - so it is available before
//     any vendor is created.
//
//   - Composing the Add Vendor wizard into whole flows, because every test in
//     the ported spec walks the same seven steps and only VEEL - 03 inserts
//     anything in the middle.
//
// NOTE ON THE DUPLICATION: ensureOnUpperdeck() also appears in the other
// EntityLeader page objects. That is this suite's deliberate shape - each one
// owns its own copy so a change made for one flow cannot break another.

// Framework every vendor this suite creates is provisioned with. The Secure
// spec picks the same card in all four of its creation flows.
const DEFAULT_VENDOR_FRAMEWORK = "AI Governance (vendor)";

// Vendor names are capped at 20 characters by the app, so this suite always
// goes through createUniqueVendorNameShort(). The Secure VE - 01 uses the
// unbounded createUniqueVendorName() instead; that is the one place this port
// deliberately diverges, because a name that long is rejected on some builds
// and the failure surfaces as an unexplained wizard that will not advance.
const VENDOR_NAME_MAX_LENGTH = 20;

class AddVendorEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.vendors = new AddVendorPage(page);
    this.selectors = {
      // The upperdeck score ring - the first thing to paint on the landing
      // screen, so it is what arrival waits on.
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      // Presence of the Add Vendor button is what proves the vendors screen
      // finished rendering. The vendor LIST is empty on a fresh client, so it
      // cannot be used as the readiness signal.
      addVendorButton: this.vendors.selectors.addVendorButton,
      thirdPartySidemenu: this.vendors.selectors.thirdPartySidemenu,
      vendorSidemenu: this.vendors.selectors.vendorSidemenu,
    };
  }

  // --- arrival ---------------------------------------------------------------

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

  // Reads the client UUID out of whatever URL the page is on.
  //
  // /first-party/<clientId>/... and /third-party/<clientId>/... carry the SAME
  // id for this role, so either screen can supply it. Returns null rather than
  // throwing, so a caller can fall back to navigating.
  getClientIdFromUrl() {
    const match = this.page
      .url()
      .match(
        /\/(?:first|third)-party\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
      );
    return match ? match[1] : null;
  }

  // --- route to the vendors screen -------------------------------------------

  // Navigates straight to the vendors list for a known client id. Used by the
  // spec's beforeEach once VEEL - 01 has stored the id, exactly as the Secure
  // spec does - it skips the sidemenu walk for every test after the first.
  async openVendorsScreen(clientId) {
    console.log(`Opening the vendors screen for client: ${clientId}`);
    await this.goto(`/third-party/${clientId}/vendors`);
    await this.waitForLoad();
    await this.waitForSpinner();
  }

  // 3rd Party -> Vendors through the side menu.
  //
  // "3rd Party" is matched as a TOP-LEVEL menu item on purpose. The Training
  // Center block further down the menu carries its own "3rd Party" entry as a
  // sub-menu-item, so a selector that did not exclude sub-menus would be
  // ambiguous for this role - the Secure selector already excludes them, which
  // is why it ports unchanged.
  async navigateToVendorsViaSideMenu() {
    console.log("Navigating to 3rd Party > Vendors...");
    await this.vendors.clickThirdPartySidemenu();
    await this.waitForSpinner();
    await this.vendors.clickVendorSidemenu();
    await this.waitForSpinner();
    console.log("Vendors screen open.");
  }

  // Waits until the vendors list has actually rendered its toolbar.
  async ensureOnVendorsScreen(timeoutMs = 120000) {
    await expect(this.page).toHaveURL(/\/third-party\/[^/]+\/vendors/, {
      timeout: timeoutMs,
    });
    await this.page
      .locator(this.selectors.addVendorButton)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
  }

  // Gets this role onto its client's vendors screen from wherever it currently
  // is, and returns the client id.
  //
  // Written to be re-entrant because the spec's beforeEach behaves differently
  // on a first run and a re-run: with no stored client id it lands on the
  // upperdeck, and with one it is already on the vendors screen. Asserting
  // either state would break the other.
  async openVendorsForThisClient() {
    if (/\/third-party\/[^/]+\/vendors/.test(this.page.url())) {
      await this.ensureOnVendorsScreen();
      const clientId = this.getClientIdFromUrl();
      console.log(`Already on the vendors screen for client: ${clientId}`);
      return clientId;
    }

    await this.ensureOnUpperdeck();
    const clientId = this.getClientIdFromUrl();
    if (!clientId) {
      throw new Error(
        `Could not read a client id from the landing URL "${this.page.url()}". ` +
          "The entity leader session should land on /first-party/<clientId>/upperdeck.",
      );
    }
    await this.navigateToVendorsViaSideMenu();
    await this.ensureOnVendorsScreen();
    return clientId;
  }

  // --- the Add Vendor wizard -------------------------------------------------

  // Opens the wizard and fills its first page. Returns the vendor name, which
  // is random and therefore cannot be re-derived by a later test.
  async openAddVendorPopupAndFillDetails(prefix) {
    console.log("Opening the Add Vendor popup...");
    await this.vendors.clickAddVendorButton();
    await this.waitForSpinner();
    await this.vendors.verifyAddVendorPopup();

    const vendorName = await this.vendors.createUniqueVendorNameShort(
      prefix,
      VENDOR_NAME_MAX_LENGTH,
    );
    await this.vendors.createUniquePOCName("POC");
    await this.vendors.createUniquePOCEmail(vendorName);
    console.log(`Vendor details filled - name: ${vendorName}`);
    return vendorName;
  }

  // Page one -> framework page, pick the framework, framework page -> page
  // three (requirements and domains).
  async selectFrameworkAndContinue() {
    console.log(`Selecting the "${DEFAULT_VENDOR_FRAMEWORK}" framework...`);
    await this.vendors.clickNextButton();
    await this.vendors.selectAIGovernanceFramework();
    await this.vendors.clickNextButton();
  }

  // Adds a domain and submits the wizard, then waits out the provisioning the
  // backend does after the popup closes.
  //
  // waitForInProgressVendorStatusHidden() is the real gate here: the vendor row
  // appears immediately with an "In Progress" state and nothing on it can be
  // opened until that clears, so every caller has to wait for it rather than
  // for the popup alone.
  async addDomainAndComplete() {
    await this.vendors.clickAddDomainButton();
    const domain = await this.vendors.createUniqueDomainName("domain");
    console.log(`Domain added: ${domain}`);

    await this.vendors.clickCompleteButton();
    await this.waitForSpinner();
    await this.vendors.waitForAddVendorPopupHidden();
    console.log("Add Vendor popup closed - waiting for provisioning...");
    // waitForInProgressVendorStatusHidden() is called for parity with the
    // Secure flow, but do NOT treat it as the provisioning gate: it looks for
    // the status text "In Progress" and this build renders "In process", so it
    // matches nothing and returns immediately. ensureVendorVisible() below is
    // what actually waits for the vendor to exist.
    await this.vendors.waitForInProgressVendorStatusHidden();
    return domain;
  }

  // Waits for a vendor row to appear in the list, reloading the screen between
  // attempts.
  //
  // A bare wait is not enough. The list refetches ONCE when the wizard closes,
  // and a vendor whose backend record is not ready at that moment never turns
  // up on its own - the list simply settles without it and stays that way.
  // Observed live: the same createVendor() flow passed for two vendors and then
  // left a third missing after a full 60s, with the other rows rendered around
  // the gap. There is nothing left to wait for at that point, so refetching the
  // screen is the only way through. Same shape as ensureTableRowsVisible() in
  // the Controls port, for the same reason.
  //
  // The assertion is unchanged - the vendor still has to be there at the end.
  async ensureVendorVisible(
    vendorName,
    { attempts = 3, perAttemptTimeout = 60000 } = {},
  ) {
    const row = this.page
      .locator(
        `//div[contains(@class,'company-name') and .//span[normalize-space(text())='${vendorName}']]`,
      )
      .first();

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const visible = await row
        .waitFor({ state: "visible", timeout: perAttemptTimeout })
        .then(() => true)
        .catch(() => false);

      if (visible) {
        console.log(
          `Vendor "${vendorName}" is listed (attempt ${attempt}/${attempts}).`,
        );
        return;
      }

      if (attempt === attempts) {
        break;
      }

      console.log(
        `Vendor "${vendorName}" not listed yet (attempt ${attempt}/${attempts}) - reloading...`,
      );
      await this.page.reload();
      await this.waitForLoad();
      await this.waitForSpinner();
      await this.ensureOnVendorsScreen();
    }

    // Fall through to the page object's own assertion so the failure reads the
    // same as every other missing-vendor failure in this suite.
    await this.vendors.verifyVendorVisible(vendorName);
  }

  // The whole wizard, for the flows that add nothing in the middle. Returns the
  // vendor name, already verified as visible in the list.
  async createVendor(prefix) {
    const vendorName = await this.openAddVendorPopupAndFillDetails(prefix);
    await this.selectFrameworkAndContinue();
    await this.addDomainAndComplete();
    await this.ensureVendorVisible(vendorName);
    console.log(`Vendor created: ${vendorName}`);
    return vendorName;
  }

  // --- requirements ----------------------------------------------------------

  // Adds one custom requirement with an uploaded file, on the wizard's third
  // page. Returns the requirement name so the Artifacts assertion can find it.
  //
  // The two waits after the upload are both confirmations rather than pauses:
  // the "File uploaded" toast proves the file reached the backend, and the
  // spinner after UPLOAD covers the requirement being attached to the vendor.
  async addRequirementWithFile(prefix, filePath) {
    console.log("Adding a new requirement to the vendor...");
    await this.vendors.clickAddNewRequirementButton();
    const requirementName = await this.vendors.fillRequirementName(prefix);
    console.log(`Requirement name: ${requirementName}`);

    await this.vendors.uploadRequirementFile(filePath);
    await this.vendors.waitForFileUploadedToast();
    console.log("Requirement file uploaded.");

    await this.vendors.clickRequirementCompleteButton();
    await this.vendors.selectDefaultSettingsRadio();
    await this.vendors.clickModalUploadButton();
    await this.waitForSpinner();
    console.log("Requirement saved with default settings.");
    return requirementName;
  }

  // Vendor -> Artifacts tab, and asserts the requirement is listed there.
  async verifyRequirementInArtifacts(requirementName) {
    console.log(
      `Verifying the requirement "${requirementName}" in the Artifacts list...`,
    );
    await this.vendors.clickArtifactsTab();
    await this.waitForSpinner();
    await this.vendors.verifyRequirementInArtifactsList(requirementName);
    console.log("Requirement found in the Artifacts list.");
  }

  // --- opening a vendor ------------------------------------------------------

  async openVendorByName(vendorName) {
    console.log(`Opening the vendor: ${vendorName}`);
    await this.ensureVendorVisible(vendorName);
    await this.vendors.clickVendorByName(vendorName);
    await this.waitForSpinner();
  }

  // Vendor -> Collection. Used both to reach the questions and to read the
  // client/vendor UUIDs off the resulting URL.
  async openVendorCollection() {
    console.log("Opening the vendor's Collection...");
    await this.vendors.clickCollectionSidemenu();
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  // Waits until the vendor's collection has actually produced a framework card.
  //
  // This is the one place the port needed a wait the Secure spec does not have.
  // A freshly created vendor lands on its collection showing "Loading
  // Collection Overview" with no card, while the backend builds the assessment
  // from the framework picked in the wizard. Two traps in that screen:
  //
  //   - waitForSpinner() does not cover it. The loader here is not div.spinner,
  //     and the spinner flickers in and out while the card is still missing.
  //
  //   - The "Loading Collection Overview" label is NOT a usable signal either:
  //     it stays in the DOM after the card renders, so waiting for it to
  //     disappear waits forever. Observed live - the card appeared while that
  //     span was still present.
  //
  // So the Open button is the condition, and it needs longer than the 30s that
  // BasePage.click() allows: the collection took roughly 10s to build for an
  // existing vendor and had not finished within 30s for a brand new one, which
  // is what failed the first run of this spec.
  async waitForVendorCollectionReady(timeoutMs = 180000) {
    console.log("Waiting for the vendor collection to build its card...");
    await this.page
      .locator(this.vendors.selectors.openButton)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Vendor collection card is ready.");
  }

  // Opens the collection's framework card and returns how many questions it
  // holds. The count is the derived value the spec asserts on.
  async getCollectionQuestionCount() {
    await this.waitForVendorCollectionReady();
    await this.vendors.clickOpenButton();
    const count = await this.vendors.getQuestionCount();
    console.log(`Vendor collection question count: ${count}`);
    return count;
  }

  // --- update ----------------------------------------------------------------

  // Renames the open vendor and waits for the toast that names the NEW name -
  // which is what proves the rename was persisted rather than just typed.
  // Returns the new name for the caller to store.
  async renameOpenVendor(prefix) {
    console.log("Renaming the vendor...");
    await this.vendors.clickEditVendorIcon();
    const updatedName = await this.vendors.updateVendorName(prefix);
    await this.vendors.clickSaveVendorButton();
    await this.vendors.waitForVendorUpdatedToast(updatedName);
    console.log(`Vendor renamed to: ${updatedName}`);
    return updatedName;
  }

  // --- delete ----------------------------------------------------------------

  // Selects a vendor by its checkbox and deletes it through the confirm modal.
  //
  // CONFIRM is clicked TWICE on purpose - the modal asks a second time - and
  // the fixed wait between the two clicks is inherited from the Secure VE - 04.
  // It is a genuine fixed wait rather than a lazy one: the second modal reuses
  // the same markup as the first, so there is no element state that separates
  // "the first confirm is still showing" from "the second one is", and
  // clickDeleteConfirmButton()'s own pointer-events check passes on both.
  async deleteVendorByName(vendorName, waitBetweenConfirms = 5000) {
    console.log(`Deleting the vendor: ${vendorName}`);
    await this.vendors.checkVendorByName(vendorName);
    await this.waitForSpinner();

    await this.vendors.clickDeleteIcon();
    await this.vendors.verifyDeleteVendorModal();
    await this.vendors.enterDeleteConfirmation();
    await this.vendors.clickDeleteConfirmButton();

    await this.page.waitForTimeout(waitBetweenConfirms);
    await this.vendors.clickDeleteConfirmButton();

    await this.vendors.waitForVendorDeletedToast();
    console.log(`Vendor deleted: ${vendorName}`);
  }

  async verifyVendorNotVisible(vendorName) {
    await this.vendors.verifyVendorNotVisible(vendorName);
    console.log(`Confirmed the vendor is gone from the list: ${vendorName}`);
  }

  // --- questionnaire ---------------------------------------------------------

  // Adds one randomly chosen framework to the open vendor's questionnaire and
  // returns its name. Random because the available set differs per vendor - the
  // frameworks already on it are filtered out of the picker.
  async addRandomQuestionnaireFramework() {
    console.log("Opening the vendor's Questionnaire tab...");
    await this.vendors.clickQuestionnaireTab();
    await this.vendors.verifyQuestionnaireHeader();

    await this.vendors.clickAddNewFrameworkButton();
    await this.waitForSpinner();

    const frameworkName = await this.vendors.selectRandomFramework();
    console.log(`Framework selected: ${frameworkName}`);

    // Three NEXT clicks walk Artifacts -> Manager -> Final; none of those pages
    // needs input for this flow.
    await this.vendors.clickPopupNextButton();
    await this.vendors.clickPopupNextButton();
    await this.vendors.clickPopupNextButton();
    await this.vendors.clickPopupAddButton();

    await this.vendors.waitForFrameworkCreatedToast();
    console.log(`Framework added to the questionnaire: ${frameworkName}`);
    return frameworkName;
  }

  // Vendor -> Collection, and asserts the framework now has a card there.
  async verifyFrameworkInVendorCollection(frameworkName) {
    await this.openVendorCollection();
    await this.vendors.verifyFrameworkVisibleInCollection(frameworkName);
    console.log(`Framework card visible in the collection: ${frameworkName}`);
  }

  // --- reports ---------------------------------------------------------------

  // Picks one option from the download menu. Split from the toast wait because
  // the two families of option raise DIFFERENT toasts - see the two methods
  // below.
  async selectDownloadOption(optionText) {
    console.log(`Downloading: ${optionText}`);
    await this.vendors.clickDownloadButton();
    await this.vendors.waitForDownloadDropdownVisible();
    await this.vendors.clickDownloadOption(optionText);
  }

  // The General Report and Current View options are generated server-side, so
  // they confirm with "Report is generated successfully".
  async downloadGeneratedReport(optionText) {
    await this.selectDownloadOption(optionText);
    await this.vendors.waitForReportGeneratedToast();
    console.log(`Report generated: ${optionText}`);
  }

  // Executive Summary is built in the browser, so it confirms with "Report
  // downloaded successfully" instead.
  async downloadExecutiveSummary() {
    await this.selectDownloadOption("Executive Summary");
    await this.vendors.waitForReportDownloadedToast();
    console.log("Executive Summary downloaded.");
  }

  // Single Vendor Report needs a vendor SELECTED first - the option is inert
  // otherwise. No toast is asserted here, matching the Secure VE - 06: this
  // option opens a report builder rather than completing on its own.
  async downloadSingleVendorReport(vendorName) {
    await this.vendors.checkVendorByName(vendorName);
    await this.waitForSpinner();
    await this.selectDownloadOption("Single Vendor Report");
    console.log(`Single Vendor Report requested for: ${vendorName}`);
  }
}

module.exports = AddVendorEntityLeader;
module.exports.DEFAULT_VENDOR_FRAMEWORK = DEFAULT_VENDOR_FRAMEWORK;
