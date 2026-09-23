const path = require("path");
const BasePage = require("../BasePage");

// Beacher Lock Assessment flow. Also covers the Application screen's
// "Collection Overview" edit collection frameworks action.
class LockAssessment extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      // "Collection Overview" heading shown on the application/questions screen.
      collectionOverviewHeading:
        "//span[contains(@class,'first-party-overview-text') and normalize-space(text())='Collection Overview']",
      // Edit icon next to the Collection Overview heading.
      editCollectionFrameworkButton:
        "//div[contains(@class,'edit-collection-framework-btn-cont') and @aria-label='Edit collection frameworks']",
      // Import Assessment flow.
      importAssessmentButton:
        "//button[contains(@class,'reassessment-btn')]//span[normalize-space(text())='Import Assessment']",
      importAssessmentModal:
        "//div[contains(@class,'modal-content')]//cygov-upload-file | //div[contains(@class,'modal-content-footer')]//div[@aria-label='NEXT']",
      modalNextButton:
        "//div[contains(@class,'modal-content-footer')]//div[contains(@class,'body-back') and @aria-label='NEXT']",
      uploadFileInput:
        "//cygov-upload-file//input[@type='file' and @id='file']",
      modalAddButton:
        "//div[contains(@class,'modal-content-footer')]//div[contains(@class,'body-back') and @aria-label='ADD']",
      importSuccessMessage:
        "//span[contains(@class,'text-center') and contains(normalize-space(.),'The Assessment has been imported successfully')]",
      importSuccessOkButton:
        "//div[contains(@class,'modal-content-footer')]//div[contains(@class,'body-back') and @aria-label='OK']",
      // Collection question edit mode (side menu) flow.
      editMarkerButton:
        "//div[contains(@class,'edit-circle')]//div[contains(@class,'edit-marker')]",
      editModeSideMenu: "cygov-collection-question-edit-mode",
      addUserIcon:
        "//cygov-collection-question-edit-mode//div[contains(@class,'right-section-buttons')]//div[contains(@class,'status-circle')]",
      // Add User modal.
      addUserModal: "cygov-add-participant-modal",
      addUserFullNameInput: "//cygov-add-participant-modal//input[@id='name']",
      addUserEmailInput: "//cygov-add-participant-modal//input[@id='Email']",
      addUserRoleDropdown:
        "//cygov-add-participant-modal//cygov-select[@id='role']//div[contains(@class,'arrow-wrapper')]",
      addUserRoleDropdownPanel: "ng-dropdown-panel",
      // Dynamic role option: pass the exact (lowercase) role label.
      addUserRoleOption:
        "//ng-dropdown-panel//div[contains(@class,'ng-option')]//span[normalize-space(text())='{ROLE}']",
      sendInvitationButton:
        "//cygov-add-participant-modal//button[contains(@class,'add-participant-btn')]",
      userAddedToast: "#toast-container .toast-message:has-text('User added')",
      // Drag & drop the created user from the side menu onto the collection.
      sideMenuSearchUserInput:
        "cygov-collection-question-edit-mode input[placeholder='Search User']",
      draggableUser: ".cdk-drag.shadow-class",
      assignDropZone:
        ".cdk-drop-list.hover-screen:has-text('Assign to Framework')",
      userAssignedToast:
        "#toast-container .toast-message:has-text('User Assigned Successfully')",
      sideMenuCloseButton: ".edit-circle .edit-marker.cross-icon",
      // Lock assessment.
      lockButton:
        "//button[contains(@class,'lock-btn')][.//span[normalize-space(text())='Lock']]",
      assessmentLockedToast:
        "#toast-container .toast-message:has-text('Assessment Locked Successfully')",
      // Locked assessment view (invited user perspective).
      // "Application" item in the left side menu.
      applicationSideMenuButton:
        "//button[contains(@class,'sub-menu-item')][.//span[contains(@class,'menu-item-text') and normalize-space(text())='Application']]",
      // "Logs" label shown on the locked collection.
      logsButton:
        "//div[contains(@class,'logs-btn') and normalize-space(text())='Logs']",
      // "REQUEST TO UNLOCK" button shown on the locked collection.
      requestToUnlockButton:
        "//button[contains(@class,'request-to-unlock-btn')][.//span[normalize-space(text())='REQUEST TO UNLOCK']]",
      // Disabled question card markers (present when the assessment is locked).
      disabledQuestionCardAnswers:
        "//div[contains(@class,'question-container')]//cygov-framework-answers[contains(@class,'disable-item')]",
      disabledQuestionCardAddButton:
        "//div[contains(@class,'question-container')]//div[contains(@class,'textarea-container')]//button[contains(@class,'btn-primary') and @disabled]",
      // Each rendered question card on the collection page.
      questionCard: "cygov-collection-question-card",
      // Per-card marker proving the card is locked/non-interactive.
      questionCardDisabledMarker: ".disable-item",
      // Pagination: "NEXT SET >" control (present only when more pages exist).
      nextSetButton: ".next-previous-chapter .btn-next",

      // --- Answer a single question (invited-user perspective) ---
      answerOptionLabels:
        "cygov-collection-question-card cygov-framework-answers .round-checkbox label",
      answerOptionRadios:
        "cygov-collection-question-card cygov-framework-answers .round-checkbox input[type='radio']",
      answerSavedToast:
        "#toast-container .toast-message:has-text('Saved Successfully')",

      // --- Finalize & Sign flow ---
      finalizeAndSignButton:
        "//button[contains(@class,'finalize-sign-btn') and normalize-space(text())='FINALIZE & SIGN']",
      signatureModalHeading:
        "//span[contains(@class,'message') and normalize-space(text())='SIGNATURE']",
      // Title/Print-name modal inputs. The title input is the plain e-sign-input;
      // the print-name input additionally carries the 'print-name' class.
      signatureTitleInput:
        "//div[contains(@class,'form-section')]//input[contains(@class,'e-sign-input') and not(contains(@class,'print-name'))]",
      signaturePrintNameInput:
        "//div[contains(@class,'form-section')]//input[contains(@class,'e-sign-input') and contains(@class,'print-name')]",
      // OK/SIGN footer buttons: target the enabled (aria-disabled='false') one.
      signatureOkButton:
        "//div[contains(@class,'modal-content-footer')]//div[@role='button' and @aria-label='OK' and @aria-disabled='false']",
      signatureTextTab:
        "//a[contains(@class,'nav-link') and normalize-space(text())='Text']",
      signatureTextArea:
        "//div[contains(@class,'textbox-container')]//textarea[contains(@class,'textbox-input')]",
      signatureConsentCheckbox:
        "//div[contains(@class,'modal-content-body')]//div[contains(@class,'checkbox-with-text')]//input[@type='checkbox']",
      signatureSignButton:
        "//div[contains(@class,'modal-content-footer')]//div[@role='button' and @aria-label='SIGN' and @aria-disabled='false']",
      assessmentFinalizedToast:
        "#toast-container .toast-message:has-text('Assessment Finalized Successfully')",
      // "Last Signed By: <name> |" label shown after finalizing.
      lastSignedByLabel: "//span[contains(@class,'sign-by-name')]",
      // Signature logs modal.
      signatureLogsHeading:
        "//div[contains(@class,'heading') and normalize-space(text())='Signature Logs']",
      signatureLogItem:
        "//ul[contains(@class,'clients-logs-list')]//li[contains(@class,'logs-item')]",
      signatureLogsCloseButton:
        "//div[contains(@class,'body-2')]//div[contains(@class,'close-icon')]",
    };
  }

  async waitForCollectionOverview() {
    console.log("Waiting for the Collection Overview heading...");
    await this.waitForElement(this.selectors.collectionOverviewHeading);
  }

  async clickEditCollectionFramework() {
    console.log("Clicking the edit collection frameworks icon...");
    await this.click(this.selectors.editCollectionFrameworkButton);
    await this.waitForSpinner();
  }

  async clickImportAssessment() {
    console.log("Clicking the 'Import Assessment' button...");
    await this.click(this.selectors.importAssessmentButton);
    await this.waitForSpinner();
  }

  async verifyImportAssessmentPopup() {
    console.log("Verifying the Import Assessment popup is displayed...");
    return await this.expectToBeVisible(this.selectors.importAssessmentModal);
  }

  async clickModalNextButton() {
    console.log("Clicking the 'NEXT' button in the Import Assessment popup...");
    await this.click(this.selectors.modalNextButton);
    await this.page.waitForTimeout(2000);
  }

  async uploadAssessmentFile(filePath) {
    console.log(`Uploading assessment file: ${filePath}`);
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    await this.page.setInputFiles(this.selectors.uploadFileInput, absolutePath);
  }

  async waitForFileUploaded() {
    console.log("Waiting for the file to finish uploading...");
    await this.waitForSpinner();
    // The ADD button becomes actionable once the file is uploaded.
    await this.waitForElement(this.selectors.modalAddButton);
    await this.page.waitForTimeout(2000);
  }

  async clickModalAddButton() {
    console.log("Clicking the 'ADD' button in the Import Assessment popup...");
    await this.click(this.selectors.modalAddButton);
    await this.waitForSpinner();
  }

  async verifyImportSuccessModal(timeout = 120000) {
    console.log(
      "Waiting for the 'Assessment imported successfully' confirmation modal...",
    );
    await this.page.waitForSelector(this.selectors.importSuccessMessage, {
      state: "visible",
      timeout,
    });
    return await this.expectToBeVisible(this.selectors.importSuccessMessage);
  }

  async clickImportSuccessOk() {
    console.log("Clicking 'OK' on the import success modal...");
    await this.click(this.selectors.importSuccessOkButton);
    await this.waitForSpinner();
  }

  async waitForLoadingComplete() {
    console.log("Waiting for the collection to finish loading...");
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  async clickEditMarker() {
    console.log("Clicking the edit (pencil) marker button...");
    await this.click(this.selectors.editMarkerButton);
    await this.waitForSpinner();
  }

  async verifyEditModeSideMenu() {
    console.log("Verifying the edit mode side menu is displayed...");
    return await this.expectToBeVisible(this.selectors.editModeSideMenu);
  }

  async clickAddUserIcon() {
    console.log("Clicking the '+' add user icon in the side menu...");
    await this.click(this.selectors.addUserIcon);
    await this.page.waitForTimeout(2000);
  }

  async verifyAddUserModal() {
    console.log("Verifying the 'Add User' modal is displayed...");
    return await this.expectToBeVisible(this.selectors.addUserModal);
  }

  async enterUserFullName(fullName) {
    console.log(`Entering user full name: ${fullName}`);
    await this.fill(this.selectors.addUserFullNameInput, fullName);
  }

  async enterUserEmail(email) {
    console.log(`Entering user email: ${email}`);
    await this.fill(this.selectors.addUserEmailInput, email);
  }

  async clickRoleDropdown() {
    console.log("Opening the role dropdown...");
    await this.click(this.selectors.addUserRoleDropdown);
    await this.waitForElement(this.selectors.addUserRoleDropdownPanel);
  }

  async selectUserRole(role) {
    console.log(`Selecting user role: ${role}`);
    await this.clickRoleDropdown();
    const option = this.selectors.addUserRoleOption.replace("{ROLE}", role);
    await this.waitForElement(option);
    await this.click(option);
  }

  async clickSendInvitation() {
    console.log("Clicking the 'Send invitation' button...");
    await this.click(this.selectors.sendInvitationButton);
  }

  async waitForUserAddedToast(timeout = 60000) {
    console.log("Waiting for the 'User added' toast (visible then hidden)...");
    await this.page.waitForSelector(this.selectors.userAddedToast, {
      state: "visible",
      timeout,
    });
    await this.page.waitForSelector(this.selectors.userAddedToast, {
      state: "hidden",
      timeout,
    });
  }

  async searchUserInSideMenu(username) {
    console.log(`Searching the side menu for user: ${username}`);
    const searchInput = this.page.locator(
      this.selectors.sideMenuSearchUserInput,
    );
    await searchInput.waitFor({ state: "visible", timeout: 60000 });
    await searchInput.click();
    await searchInput.type(username, { delay: 10 });
    await this.page.waitForTimeout(1000);
  }

  // Drags the created user card from the side menu list onto the collection
  // "Assign to Framework" drop zone, then closes the edit side menu.
  async dragAndDropUserToCollection() {
    console.log("Dragging the user onto the collection...");
    const source = this.page.locator(this.selectors.draggableUser).first();
    await source.waitFor({ state: "visible", timeout: 60000 });

    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error("Source user element not found");

    // Move to the source center and press.
    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await this.page.mouse.down();
    await this.page.waitForTimeout(150);

    // Nudge to trigger the CDK drag start.
    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 20,
      sourceBox.y + sourceBox.height / 2 + 20,
      { steps: 10 },
    );
    await this.page.waitForTimeout(300);

    // Locate the drop zone and move into its center.
    const dropZone = this.page.locator(this.selectors.assignDropZone).first();
    await dropZone.waitFor({ state: "visible", timeout: 8000 });
    const dropBox = await dropZone.boundingBox();
    if (!dropBox)
      throw new Error("Assign drop zone not found / no bounding box");

    await this.page.mouse.move(
      dropBox.x + dropBox.width / 2,
      dropBox.y + dropBox.height / 2,
      { steps: 25 },
    );
    await this.page.waitForTimeout(200);
    await this.page.mouse.up();
    await this.page.waitForTimeout(1500);

    // Handle the assignment success toast (best-effort).
    try {
      await this.page.waitForSelector(this.selectors.userAssignedToast, {
        state: "visible",
        timeout: 15000,
      });
      await this.page.waitForSelector(this.selectors.userAssignedToast, {
        state: "hidden",
        timeout: 15000,
      });
    } catch (e) {
      console.log("ℹ Assignment toast handled");
    }
  }

  async clickLockButton() {
    console.log("Clicking the 'Lock' button...");
    await this.click(this.selectors.lockButton);
  }

  async waitForAssessmentLockedToast(timeout = 60000) {
    console.log(
      "Waiting for the 'Assessment Locked Successfully.' toast (visible then hidden)...",
    );
    await this.page.waitForSelector(this.selectors.assessmentLockedToast, {
      state: "visible",
      timeout,
    });
    await this.page.waitForSelector(this.selectors.assessmentLockedToast, {
      state: "hidden",
      timeout,
    });
  }

  async clickApplicationSideMenu() {
    console.log("Clicking the 'Application' item in the side menu...");
    await this.click(this.selectors.applicationSideMenuButton);
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  // After opening the Application screen the locked assessment view loads its
  // question content asynchronously (the question panel shows a spinner for a
  // while). The "Logs" / "REQUEST TO UNLOCK" banner and the disabled question
  // cards only render once that content has loaded, so wait for a question card
  // to appear (and the spinner to clear) before asserting on those elements.
  async waitForLockedAssessmentLoaded(timeout = 120000) {
    console.log("Waiting for the locked assessment view to finish loading...");
    await this.waitForSpinner();
    await this.waitForLoad();
    await this.page
      .locator(this.selectors.questionCard)
      .first()
      .waitFor({ state: "visible", timeout });
    await this.waitForSpinner();
  }

  async verifyLogsButtonVisible() {
    console.log("Verifying the 'Logs' button is displayed...");
    return await this.expectToBeVisible(this.selectors.logsButton);
  }

  async verifyRequestToUnlockButtonVisible() {
    console.log("Verifying the 'REQUEST TO UNLOCK' button is displayed...");
    return await this.expectToBeVisible(this.selectors.requestToUnlockButton);
  }

  // Verifies the question card is locked/disabled so the user cannot interact
  // with it: the answers section carries the 'disable-item' class and the
  // comment 'ADD' button is disabled.
  async verifyQuestionCardDisabled() {
    console.log("Verifying the question card is disabled...");
    await this.expectToBeVisible(this.selectors.disabledQuestionCardAnswers);
    const addButton = this.page
      .locator(this.selectors.disabledQuestionCardAddButton)
      .first();
    await addButton.waitFor({ state: "visible", timeout: 30000 });
    if (!(await addButton.isDisabled())) {
      throw new Error("Expected the question card 'ADD' button to be disabled");
    }
    return true;
  }

  // Verifies every question card currently rendered on the collection page is
  // locked/disabled (each card contains a 'disable-item' marker).
  async verifyQuestionsOnCurrentPageDisabled() {
    const cards = this.page.locator(this.selectors.questionCard);
    await cards.first().waitFor({ state: "visible", timeout: 60000 });
    const count = await cards.count();
    if (count === 0) {
      throw new Error("No question cards found on the collection page");
    }
    console.log(`Verifying ${count} question card(s) are disabled...`);
    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const disabledMarkers = card.locator(
        this.selectors.questionCardDisabledMarker,
      );
      if ((await disabledMarkers.count()) === 0) {
        throw new Error(
          `Question card #${i + 1} is not disabled (no 'disable-item' marker found)`,
        );
      }
    }
    return count;
  }

  // Verifies all question cards are disabled on the current page and iterates
  // through every subsequent page (via the "NEXT SET >" control) verifying each.
  async verifyAllQuestionsDisabledAcrossPages() {
    let pageIndex = 1;
    // Guard against an unexpected infinite loop on the pagination control.
    const maxPages = 100;
    while (pageIndex <= maxPages) {
      console.log(`Verifying disabled questions on page ${pageIndex}...`);
      await this.verifyQuestionsOnCurrentPageDisabled();

      const nextButton = this.page.locator(this.selectors.nextSetButton);
      const hasNext = await nextButton
        .first()
        .isVisible()
        .catch(() => false);
      if (!hasNext) {
        console.log(`No more pages after page ${pageIndex}.`);
        break;
      }

      console.log("Navigating to the next set of questions...");
      await nextButton.first().click();
      await this.waitForSpinner();
      await this.page.waitForTimeout(1500);
      pageIndex++;
    }
    return pageIndex;
  }

  // Waits for the (non-locked) collection question cards to finish rendering.
  async waitForQuestionCardsLoaded(timeout = 120000) {
    console.log("Waiting for the collection question cards to load...");
    await this.waitForSpinner();
    await this.waitForLoad();
    await this.page
      .locator(this.selectors.questionCard)
      .first()
      .waitFor({ state: "visible", timeout });
    await this.waitForSpinner();
  }

  // Reads which answer option is currently selected on the first question card
  // and selects a different one to prove the invited user can answer it. Waits
  // for the "Saved Successfully" toast confirming the answer persisted.
  async answerSingleQuestion() {
    console.log(
      "Answering the single question (updating the selected answer)...",
    );
    const card = this.page.locator(this.selectors.questionCard).first();
    await card.waitFor({ state: "visible", timeout: 60000 });

    const labels = this.page.locator(this.selectors.answerOptionLabels);
    const radios = this.page.locator(this.selectors.answerOptionRadios);
    const count = await labels.count();
    if (count === 0) {
      throw new Error("No answer options found on the question card");
    }

    // Detect the currently selected option (if any).
    let selectedIndex = -1;
    for (let i = 0; i < count; i++) {
      if (await radios.nth(i).isChecked()) {
        selectedIndex = i;
        break;
      }
    }
    console.log(`Currently selected answer index: ${selectedIndex}`);

    // Pick the first option that differs from the current selection.
    let targetIndex = 0;
    for (let i = 0; i < count; i++) {
      if (i !== selectedIndex) {
        targetIndex = i;
        break;
      }
    }
    console.log(`Selecting answer option index: ${targetIndex}`);

    const target = labels.nth(targetIndex);
    await target.scrollIntoViewIfNeeded();
    await target.click();

    // Confirm the answer was saved.
    try {
      await this.page.waitForSelector(this.selectors.answerSavedToast, {
        state: "visible",
        timeout: 30000,
      });
      await this.page.waitForSelector(this.selectors.answerSavedToast, {
        state: "hidden",
        timeout: 30000,
      });
    } catch (e) {
      console.log("ℹ Answer saved toast handled");
    }
    return targetIndex;
  }

  async clickFinalizeAndSign() {
    console.log("Clicking the 'FINALIZE & SIGN' button...");
    await this.click(this.selectors.finalizeAndSignButton);
  }

  async verifySignatureModal() {
    console.log("Verifying the SIGNATURE modal is displayed...");
    return await this.expectToBeVisible(this.selectors.signatureModalHeading);
  }

  async enterSignatureTitle(title) {
    console.log(`Entering signature title: ${title}`);
    await this.fill(this.selectors.signatureTitleInput, title);
  }

  async enterSignaturePrintName(name) {
    console.log(`Entering signature print name: ${name}`);
    await this.fill(this.selectors.signaturePrintNameInput, name);
  }

  async clickSignatureOk() {
    console.log("Clicking 'OK' on the signature title/print-name modal...");
    await this.click(this.selectors.signatureOkButton);
    await this.page.waitForTimeout(1000);
  }

  async clickSignatureTextTab() {
    console.log("Selecting the 'Text' signature tab...");
    await this.click(this.selectors.signatureTextTab);
  }

  async enterSignatureText(text) {
    console.log(`Entering signature text: ${text}`);
    await this.fill(this.selectors.signatureTextArea, text);
  }

  async checkSignatureConsent() {
    console.log("Checking the signature consent checkbox...");
    const checkbox = this.page
      .locator(this.selectors.signatureConsentCheckbox)
      .first();
    await checkbox.waitFor({ state: "visible", timeout: 30000 });
    await checkbox.check({ force: true });
  }

  async clickSignButton() {
    console.log("Clicking the 'SIGN' button...");
    await this.click(this.selectors.signatureSignButton);
  }

  async waitForAssessmentFinalizedToast(timeout = 60000) {
    console.log(
      "Waiting for the 'Assessment Finalized Successfully.' toast (visible then hidden)...",
    );
    await this.page.waitForSelector(this.selectors.assessmentFinalizedToast, {
      state: "visible",
      timeout,
    });
    await this.page.waitForSelector(this.selectors.assessmentFinalizedToast, {
      state: "hidden",
      timeout,
    });
  }

  // Verifies the "Last Signed By: <name> |" label contains the expected name.
  async verifyLastSignedBy(name) {
    console.log(`Verifying 'Last Signed By' shows: ${name}`);
    const el = this.page.locator(this.selectors.lastSignedByLabel).first();
    await el.waitFor({ state: "visible", timeout: 60000 });
    const text = (await el.innerText()).trim();
    if (!text.includes(name)) {
      throw new Error(
        `Expected 'Last Signed By' to contain "${name}", but got "${text}"`,
      );
    }
    return text;
  }

  async clickLogsButton() {
    console.log("Clicking the 'Logs' button...");
    await this.click(this.selectors.logsButton);
  }

  // Verifies the signature logs modal is shown and contains a log entry for the
  // given name.
  async verifySignatureLog(name) {
    console.log(`Verifying the signature log for: ${name}`);
    await this.expectToBeVisible(this.selectors.signatureLogsHeading);
    const items = this.page.locator(this.selectors.signatureLogItem);
    await items.first().waitFor({ state: "visible", timeout: 30000 });
    const count = await items.count();
    for (let i = 0; i < count; i++) {
      const text = (await items.nth(i).innerText()).trim();
      if (text.includes(name)) {
        console.log(`Found signature log entry: "${text}"`);
        return text;
      }
    }
    throw new Error(`No signature log entry found containing "${name}"`);
  }

  async closeSignatureLogsModal() {
    console.log("Closing the signature logs modal...");
    await this.click(this.selectors.signatureLogsCloseButton);
  }
}

module.exports = LockAssessment;
