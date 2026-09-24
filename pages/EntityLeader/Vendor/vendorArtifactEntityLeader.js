const BasePage = require("../../Secure/BasePage");
const VendorArtifactsPage = require("../../Secure/Vendor/VendorArtifacts");
const AddVendorEntityLeader = require("./addVendorEntityLeader");

// Drives the Artifacts tab on a VENDOR as the ENTITY LEADER: create documents,
// upload manual artifacts, move them through gap / approve / deny, and delete
// them.
//
// DELEGATION
//   - The vendor half goes to AddVendorEntityLeader (`this.vendorLeader`),
//     which already owns this role's route to 3rd Party > Vendors, the client-id
//     derivation, the Add Vendor wizard and the reload-retry that waits for a
//     new vendor to appear in the list.
//   - The artifacts screen goes to the Secure VendorArtifactsPage
//     (`this.artifacts`): the Documents panel, the two upload modals, the
//     action bar and the status assertions are the same app components for
//     every role.
//
// WHAT THIS CLASS OWNS
//   - Arrival. The Secure VA - 01 and VA - 05 each create a CLIENT of their
//     own; this role has no /clients screen and is already inside the client
//     ELS - 01 provisioned, so each stream builds only its own vendor.
//   - The route to the Artifacts tab. The Secure spec's
//     navigateToVendorArtifacts() takes three page objects as arguments and
//     walks the clients list; openVendorArtifacts() below replaces it with a
//     deep link plus the two clicks that are actually role-independent.
//
// WHY THE VENDORS SCREEN IS ALWAYS REOPENED FIRST: a click on a vendor row can
// be swallowed when the list is in a post-action state - the click reports
// success, the app stays put, and the next wait then hangs until the whole test
// times out, because Playwright Test leaves actionTimeout at 0 and
// BasePage.waitForElement() has no bound of its own. Reopening the list is the
// same remedy the ESE port needed after publishing an event.
class VendorArtifactEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.vendorLeader = new AddVendorEntityLeader(page);
    this.artifacts = new VendorArtifactsPage(page);
  }

  // --- arrival and the vendor ------------------------------------------------

  // Gets this role onto its client's vendors screen and returns the client id.
  // Replaces the Secure spec's /clients navigation, client creation and
  // client-card click.
  async openVendorsForThisClient() {
    return await this.vendorLeader.openVendorsForThisClient();
  }

  // Creates a vendor for one of this suite's two streams. Returns its name.
  //
  // Two vendors are built rather than one because the Secure spec builds two
  // CLIENTS: VA - 01/02/04 work on documents created through "Add New", and
  // VA - 05/06 work on a manually uploaded artifact. Sharing one vendor would
  // let the delete in VA - 06 reach a row the gap and deny tests depend on.
  async createVendorForArtifacts(prefix) {
    const vendorName = await this.vendorLeader.createVendor(prefix);
    console.log(`Vendor created for the artifacts flow: ${vendorName}`);
    return vendorName;
  }

  // --- route to the artifacts tab --------------------------------------------

  // Vendors list -> vendor -> Artifacts tab -> Documents section.
  //
  // The Documents click is part of the route rather than a separate step: the
  // artifact TABLE only loads once that section is selected, so every test that
  // reads or acts on a row needs it.
  async openVendorArtifacts(clientId, vendorName) {
    console.log(`Opening the Artifacts tab for vendor: ${vendorName}`);
    await this.vendorLeader.openVendorsScreen(clientId);
    await this.vendorLeader.ensureOnVendorsScreen();
    await this.vendorLeader.openVendorByName(vendorName);
    await this.artifacts.clickArtifactsTab();
    await this.artifacts.clickDocumentsSection();
    console.log("Artifacts tab open with the Documents section selected.");
  }

  // Documents count from the panel label, e.g. "Documents (3)" -> 3.
  async getDocumentsCount() {
    const count = await this.artifacts.getDocumentsCount();
    console.log(`Documents count: ${count}`);
    return count;
  }

  // --- creating artifacts ----------------------------------------------------

  // Adds one document through the "Add New" modal and returns its name.
  //
  // waitForAssignmentsToast() carries a THREE MINUTE fixed wait of its own after
  // the toast clears - the artifact list rebuilds asynchronously and nothing on
  // screen reports when that finishes. That is inherited from the Secure page
  // object, not added here, and it is why this flow needs a long test timeout.
  async addArtifact(prefix, filePath = "filesTest/Files/testFile.pdf") {
    console.log("Adding a new artifact through the Add New modal...");
    await this.artifacts.clickAddNewButton();
    const artifactName = await this.artifacts.fillArtifactName(prefix);
    await this.artifacts.uploadFile(filePath);
    await this.artifacts.clickCompleteButton();
    await this.artifacts.waitForAssignmentsToast();
    console.log(`Artifact created: ${artifactName}`);
    return artifactName;
  }

  // Asserts the artifact is listed. The app uppercases the name and truncates it
  // at the first underscore in the Type column, which the delegated method
  // already accounts for.
  async verifyArtifactInList(artifactName) {
    await this.artifacts.verifyArtifactInList(artifactName);
  }

  // --- artifact status actions -----------------------------------------------

  // Marks the first artifact row as a gap, which lands it in "Excluded".
  //
  // The comment is typed with pressSequentially rather than filled: the CONFIRM
  // button is gated on Angular change detection, and a programmatic fill does
  // not trigger it. That is handled inside the delegated methods.
  async gapFirstArtifact(comment = "Automated gap comment") {
    console.log("Marking the first artifact as a gap...");
    await this.artifacts.selectFirstArtifact();
    await this.artifacts.clickGapButton();
    await this.artifacts.fillGapComment(comment);
    await this.artifacts.clickGapConfirmButton();
    console.log("Gap confirmed.");
  }

  // Denies the first artifact row, which also lands it in "Excluded".
  async denyFirstArtifact(comment = "Automated deny comment") {
    console.log("Denying the first artifact...");
    await this.artifacts.selectFirstArtifact();
    await this.artifacts.clickDenyButton();
    await this.artifacts.fillDenyComment(comment);
    await this.artifacts.clickDenyConfirmButton();
    await this.artifacts.waitForSavedSuccessfullyToast();
    console.log("Deny confirmed.");
  }

  // Approves the first artifact row. No comment is required, so CONFIRM is
  // enabled immediately.
  //
  // Only reached by the PARKED VAEL - 03; kept because that test carries its
  // full body, as this repo requires of a parked test.
  async approveFirstArtifact() {
    console.log("Approving the first artifact...");
    await this.artifacts.selectFirstArtifact();
    await this.artifacts.clickApproveButton();
    await this.artifacts.clickApproveConfirmButton();
    await this.artifacts.waitForSavedSuccessfullyToast();
    console.log("Approve confirmed.");
  }

  // Asserts the Status column of the first row. The assertion lives in the
  // delegated method, so the spec needs none of its own.
  async verifyFirstArtifactStatus(expectedStatus) {
    await this.artifacts.verifyFirstArtifactStatus(expectedStatus);
  }

  // --- manual artifact upload and delete -------------------------------------

  // Uploads a manual artifact through the "Upload Artifact" modal and returns
  // its name.
  //
  // The wait before COMPLETE is inherited from the Secure VA - 05 and is a
  // genuine fixed wait: this modal renders no progress state and no filename
  // chip once the file is set, so there is no element to wait for - COMPLETE is
  // clickable immediately and completing too early drops the file. Sized to the
  // Secure spec's proven value rather than padded.
  async uploadManualArtifact(
    prefix,
    filePath = "filesTest/Files/testFile.pdf",
    settleMs = 30000,
  ) {
    console.log("Uploading a manual artifact...");
    await this.artifacts.clickUploadArtifactButton();
    const artifactName = await this.artifacts.fillUploadArtifactName(prefix);
    await this.artifacts.uploadArtifactFile(filePath);
    await this.page.waitForTimeout(settleMs);
    await this.artifacts.clickUploadCompleteButton();
    await this.artifacts.waitForManualArtifactToast();
    console.log(`Manual artifact uploaded: ${artifactName}`);
    return artifactName;
  }

  // Asserts at least one row carries the "Manually uploaded" status, on the
  // table as it currently stands.
  async verifyManuallyUploadedArtifact() {
    await this.artifacts.verifyManuallyUploadedArtifact();
  }

  // Asserts the manual artifact SURVIVED a full reload of the screen.
  //
  // This is the assertion that matters, and it is stronger than the Secure
  // VA - 05's. The row renders optimistically the moment the "Manual Artifact
  // Added" toast fires, so verifyManuallyUploadedArtifact() above can pass on an
  // upload that never reached the backend - observed live: a run went green on
  // it and the artifact was simply absent afterwards, with every left-panel
  // section reading (0). The failure then surfaced one test later, on the delete,
  // pointing at a missing row rather than at the upload that did not happen.
  //
  // Retries with a fresh navigation rather than one long wait: the artifact list
  // is rebuilt server-side and the screen does not repaint on its own, which is
  // the same reason ensureVendorVisible() reloads.
  async verifyManualArtifactPersisted(
    clientId,
    vendorName,
    { attempts = 3, settleMs = 15000 } = {},
  ) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
      await this.openVendorArtifacts(clientId, vendorName);
      await this.page.waitForTimeout(settleMs);

      const found = await this.page
        .locator("span.manually-uploaded-status")
        .first()
        .waitFor({ state: "visible", timeout: 30000 })
        .then(() => true)
        .catch(() => false);

      if (found) {
        console.log(
          `Manual artifact persisted (attempt ${attempt}/${attempts}).`,
        );
        return;
      }

      console.log(
        `Manual artifact not listed yet (attempt ${attempt}/${attempts})...`,
      );
    }

    throw new Error(
      `The manually uploaded artifact is not present on vendor "${vendorName}" after ` +
        `${attempts} reloads. The upload did not persist - the "Manual Artifact Added" ` +
        "toast fires before the backend has stored anything, so this is an upload " +
        "failure rather than a missing-row problem in the delete test.",
    );
  }

  // Deletes the manually uploaded artifact, confirming with the typed "confirm".
  async deleteManualArtifact() {
    console.log("Deleting the manually uploaded artifact...");
    await this.artifacts.selectManuallyUploadedArtifact();
    await this.artifacts.clickDeleteButton();
    await this.artifacts.fillDeleteConfirm();
    await this.artifacts.clickDeleteConfirmButton();
    await this.artifacts.waitForManualArtifactDeletedToast();
    console.log("Manual artifact deleted.");
  }

  // Asserts no "Manually uploaded" row remains.
  async verifyManuallyUploadedArtifactGone() {
    await this.artifacts.verifyManuallyUploadedArtifactGone();
  }
}

module.exports = VendorArtifactEntityLeader;
