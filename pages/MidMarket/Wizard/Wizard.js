const { expect } = require("@playwright/test");
const BasePage = require("../BasePage");
const {
  MIDMARKET_WIZARD_STEP_ENUMS,
  MIDMARKET_WIZARD_STEP_CONTAINER_ENUMS,
  MIDMARKET_WIZARD_FIELD_ENUMS,
  MIDMARKET_ACCOUNT_DETAILS_FIELD_ENUMS,
  MIDMARKET_DATA_SCOPE_FIELD_ENUMS,
  MIDMARKET_WIZARD_BUTTON_ENUMS,
} = require("../../../constant/enums");

/**
 * MidMarket "NEW ENTITY" wizard - broker/admin side (3 steps).
 *
 * This is MidmarketWizardPopUpComponent, a different component from the Beacher
 * wizard, so none of pages/Beacher/Wizard/Wizard.js is reused. Two structural
 * differences matter more than anything else here:
 *
 *  1. The rendered "step-N" class does NOT match the logical step number.
 *     Only step 1 interpolates its own number; dataScopeArea hardcodes "step-4"
 *     and accountDetailsArea renders a .step2-parent wrapping "step-7" and
 *     "step-8". See MIDMARKET_WIZARD_STEP_CONTAINER_ENUMS.
 *  2. Step 2 has no validation at all (checkValidation case 2 is commented out
 *     in the app), so NEXT always advances from Account Details.
 */
class Wizard extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      // --- /clients screen ---
      // MidMarket falls through to the bnbFlow branch (it is not
      // isBnBCyberSite), so the cards are cygov-bnb-card inside .bnb-main.
      newButton:
        "//div[contains(@class,'add-new-bnb-btn')]//span[normalize-space(text())='New']",
      // Scoped to the MidMarket wrapper: the wizard renders its own search
      // inputs with the same form-control/search classes.
      clientsSearchInput:
        "//div[contains(@class,'mid-market-search-wrapper')]//input[contains(@class,'search')]",
      // The name lives in .name.text-ellipsis - matching on "name" alone would
      // also hit the .logo-name wrapper.
      clientCardByName: (name) =>
        `//div[contains(@class,'bnb-client-card')]//div[contains(@class,'name') and contains(@class,'text-ellipsis') and normalize-space(text())='${name}']`,
      // A draft card renders an extra .draft-ui banner above the card front.
      draftCardByName: (name) =>
        `//div[contains(@class,'bnb-client-card')][.//div[contains(@class,'name') and contains(@class,'text-ellipsis') and normalize-space(text())='${name}']]//div[contains(@class,'draft-ui')]`,

      // --- Wizard modal shell ---
      wizardModalTitle:
        "//div[contains(@class,'title-wiz') and normalize-space(text())='NEW ENTITY']",
      wizardCloseIcon:
        "//div[contains(@class,'title-cross')]//div[contains(@class,'cross-svg')]",
      // Upper stepper. Each entry is .bulk-risk-step; the tick's opacity is
      // bound to step.completed, so it is always in the DOM.
      stepperItem: "//div[contains(@class,'bulk-risk-step')]",
      stepperItemByTitle: (title) =>
        `//div[contains(@class,'bulk-risk-step')][.//div[contains(@class,'round-checkbox-label')]//span[normalize-space(text())='${title}']]`,
      stepperRadio:
        "//div[contains(@class,'bulk-risk-step')]//div[contains(@class,'round-checkbox')]//input[@type='radio']",
      mandatoryLabel: "//div[contains(@class,'mandatory-label')]",

      // --- Step containers ---
      // Never build these from the logical step number - see the class comment.
      organizationalStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-1')]",
      accountDetailsStep: "//div[contains(@class,'step2-parent')]",
      accountDetailsLeftPanel:
        "//div[contains(@class,'outer-border') and contains(@class,'step-7')]",
      currentYearPanel:
        "//div[contains(@class,'outer-border') and contains(@class,'step-8')]",
      dataScopeStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-4')]",

      // --- Step 1: Organizational ---
      // The three mandatory strings all share the .string-input shape, so they
      // are located by their .title-name label rather than by index.
      stringInputByLabel: (label) =>
        `//div[contains(@class,'string-input')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//input[contains(@class,'string-input-style')]`,
      // isBeecher is hardcoded true in the component, so the industry control is
      // always the custom #industryDropDown template, never cygov-select.
      industryDropdown:
        "//div[contains(@class,'industry-selection')]//div[contains(@class,'drop-down-label')]",
      industryList:
        "//div[contains(@class,'expanded-list')]//div[contains(@class,'industry-list') and not(contains(@class,'industry-list-item'))]",
      industryOption: (industry) =>
        `//div[contains(@class,'industry-list-item')]//span[normalize-space(text())='${industry}']`,
      industrySelectedLabel:
        "//div[contains(@class,'industry-selection')]//div[contains(@class,'label-value')]",
      // cygov-toggle-button hides its checkbox behind a label; id is 'stand-wizard'.
      activeScanCheckbox: "//input[@id='stand-wizard']",
      activeScanToggleLabel:
        "//label[contains(@class,'toggle-button-switch-click-handler') and @for='stand-wizard']",
      domainInput:
        "//div[contains(@class,'domain-listings')]//input[contains(@class,'input-domain-styling')]",
      aiCreditsInput:
        "//div[contains(@class,'ai-credits-row')]//input[contains(@class,'counter-value')]",
      aiCreditsIncrement:
        "//div[contains(@class,'ai-credits-row')]//div[contains(@class,'incrementor')]",
      aiCreditsDecrement:
        "//div[contains(@class,'ai-credits-row')]//div[contains(@class,'decrementor')]",
      // Step 1 also carries the cost constants (right section) and the
      // framework radios. Both use .number-input / .framework-options.
      numberInputByLabel: (label) =>
        `//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//input[contains(@class,'number-input-style')]`,
      // Only frameworkList.slice(0, 5) is rendered, and the <input> is visually
      // replaced by its <label>, so the label is what must be clicked.
      frameworkRadioLabel: (name) =>
        `//div[contains(@class,'framework-options')]//label[normalize-space(text())='${name}']`,
      frameworkRadioInput: (name) =>
        `//div[contains(@class,'framework-options')]//input[@id='frameworkLabel-${name}']`,
      frameworkOptionLabels:
        "//div[contains(@class,'framework-options')]//label[contains(@class,'label')]",

      // --- Step 2: Account Details ---
      accountTypeDropdown:
        "//div[contains(@class,'account-details-left')][.//div[contains(@class,'title-name') and normalize-space(text())='Account Type']]//div[contains(@class,'drop-down-label')]",
      accountTypeOption: (value) =>
        `//div[contains(@class,'custom-drop-down')]//div[contains(@class,'expanded-list-item')]//span[normalize-space(text())='${value}']`,
      accountTypeValue:
        "//div[contains(@class,'account-details-left')][.//div[contains(@class,'title-name') and normalize-space(text())='Account Type']]//div[contains(@class,'drop-down-label')]",
      // The date inputs are [disabled]="true" - the only way in is the icon.
      calendarIconByLabel: (label) =>
        `//div[contains(@class,'account-details-left')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//div[contains(@class,'calendar-icon-button')]`,
      calendarDateInputByLabel: (label) =>
        `//div[contains(@class,'account-details-left')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//input[contains(@class,'input-date')]`,
      calendarArea: "//div[contains(@class,'calendar-area')]",
      calendarToday:
        "//div[contains(@class,'ngb-dp-today')]//div[contains(@class,'custom-day')]",
      accountDetailsLeftInputByLabel: (label) =>
        `//div[contains(@class,'account-details-left')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//input[@type='text' and not(contains(@class,'input-date'))]`,
      accountDetailsRightInputByLabel: (label) =>
        `//div[contains(@class,'account-details-right')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//input[@type='text']`,
      notesTextarea:
        "//div[contains(@class,'account-details-right')]//textarea",
      assignBrokerListing:
        "//div[contains(@class,'right-section')]//cygov-user-listing",

      // --- Step 3: Data Scope ---
      // Scoped to step-4: .number-input is also used by step 1's cost fields,
      // which would trip Playwright strict mode on a page-level match.
      dataScopeInputByLabel: (label) =>
        `//div[contains(@class,'step-4')]//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//input[contains(@class,'number-input-style')]`,
      dataScopeTitleByLabel: (label) =>
        `//div[contains(@class,'step-4')]//div[contains(@class,'title-name') and normalize-space(text())='${label}']`,

      // --- Footer buttons ---
      // cygov-button renders div.body-back with the label as aria-label and
      // aria-disabled bound to disableClick. ".body-back" alone matches SAVE
      // DRAFT too, so every footer button stays scoped by its aria-label.
      buttonByLabel: (label) =>
        `//div[contains(@class,'body-back') and @aria-label='${label}']`,
      nextButton: `//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.NEXT}']`,
      completeButton: `//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.COMPLETE}']`,
      updateButton: `//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.UPDATE}']`,
      saveDraftButton: `//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.SAVE_DRAFT}']`,
      sendToClientButton: `//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.SEND_TO_CLIENT}']`,
      previousButton: "//div[contains(@class,'previous-button')]",
      deleteDraftIcon:
        "//div[contains(@class,'delete-button')]//div[contains(@class,'action-disabled')] | //div[contains(@class,'delete-button')]/div",

      // --- Confirmation modals ---
      sendConfirmBody: "//div[contains(@class,'send-body')]",
      sendConfirmButton: `//div[contains(@class,'send-footer')]//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.CONFIRM}']`,
      sendCancelButton: `//div[contains(@class,'send-footer')]//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.CANCEL}']`,
      deleteConfirmBody: "//div[contains(@class,'delete-pop-body')]",
      deleteConfirmButton: `//div[contains(@class,'delete-pop-footer')]//div[contains(@class,'body-back') and @aria-label='${MIDMARKET_WIZARD_BUTTON_ENUMS.CONFIRM}']`,

      // --- Toasts ---
      infoToast: "//div[contains(@class,'toast-message')]",
      // Text-scoped: a bare .toast-message match grabs whichever toast is up
      // first. SAVE DRAFT fires "Saving Draft . . ." before "Draft Saved!", and
      // COMPLETE fires "Creating Entity..." before "Entity Created
      // Successfully!", so a generic wait resolves on the wrong one.
      toastByText: (text) =>
        `//div[contains(@class,'toast-message') and contains(normalize-space(.),'${text}')]`,
    };

    // Maps a logical step number to the container that actually renders for it.
    // Built once here so no caller has to remember the step-1/7+8/4 mismatch.
    this.stepContainerByNumber = {
      [MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL]:
        this.selectors.organizationalStep,
      [MIDMARKET_WIZARD_STEP_ENUMS.ACCOUNT_DETAILS]:
        this.selectors.accountDetailsStep,
      [MIDMARKET_WIZARD_STEP_ENUMS.DATA_SCOPE]: this.selectors.dataScopeStep,
    };
  }

  // --- /clients screen ------------------------------------------------

  async clickNewButton() {
    console.log("Clicking 'New' button on /clients...");
    await this.click(this.selectors.newButton);
    await this.waitForSpinner();
  }

  async searchClient(name) {
    console.log(`Searching /clients for: ${name}`);
    await this.fill(this.selectors.clientsSearchInput, name);
    await this.waitForSpinner();
  }

  async verifyClientCardVisible(name) {
    console.log(`Verifying the client card is listed: ${name}`);
    return await this.expectToBeVisible(
      this.selectors.clientCardByName(name),
      60000,
    );
  }

  async verifyDraftCardVisible(name) {
    console.log(`Verifying '${name}' is listed as a draft card...`);
    return await this.expectToBeVisible(
      this.selectors.draftCardByName(name),
      60000,
    );
  }

  // Opens an existing card back into the wizard (edit / resume-draft flow).
  async openClientCard(name) {
    console.log(`Opening the client card: ${name}`);
    await this.click(this.selectors.clientCardByName(name));
    await this.waitForSpinner();
  }

  // --- Wizard shell ---------------------------------------------------

  async waitForWizardModal() {
    console.log("Waiting for the NEW ENTITY wizard modal...");
    await this.waitForElement(this.selectors.wizardModalTitle);
  }

  stepSelector(stepNumber) {
    const selector = this.stepContainerByNumber[stepNumber];
    if (!selector) {
      throw new Error(
        `No MidMarket wizard container mapped for step ${stepNumber}. ` +
          `Valid broker steps are 1-3 (see MIDMARKET_WIZARD_STEP_ENUMS).`,
      );
    }
    return selector;
  }

  async verifyOnStep(stepNumber) {
    console.log(`Verifying the wizard is on step ${stepNumber}...`);
    await this.expectToBeVisible(this.stepSelector(stepNumber), 60000);
  }

  // The stepper is 2 entries for a broker ("Administrative", "Account Details")
  // even though the flow has 3 steps - the app never adds a third chip.
  async getStepperCount() {
    return await this.page.locator(this.selectors.stepperItem).count();
  }

  async clickNextButton() {
    console.log("Clicking 'NEXT' button...");
    await this.click(this.selectors.nextButton);
    // Every NEXT fires a silent saveWizardDraft() before advancing, so the
    // step swap lags the click by a network round trip.
    await this.page.waitForTimeout(3000);
  }

  async clickPreviousButton() {
    console.log("Clicking 'Previous Step'...");
    await this.click(this.selectors.previousButton);
    await this.page.waitForTimeout(2000);
  }

  async clickSaveDraft() {
    console.log("Clicking 'SAVE DRAFT' button...");
    await this.click(this.selectors.saveDraftButton);
  }

  async clickCompleteButton() {
    console.log("Clicking 'COMPLETE' button...");
    await this.click(this.selectors.completeButton);
  }

  async clickUpdateButton() {
    console.log("Clicking 'UPDATE' button...");
    await this.click(this.selectors.updateButton);
  }

  /**
   * The footer button on the last step is labelled UPDATE when the wizard
   * already has a rootEntity and COMPLETE when it does not. That label is the
   * cleanest signal of create-vs-edit mode, so assert it rather than inferring
   * from the data.
   */
  async verifyFinalButtonLabel(expectedLabel) {
    console.log(
      `Verifying the final footer button reads '${expectedLabel}'...`,
    );
    await this.expectToBeVisible(
      this.selectors.buttonByLabel(expectedLabel),
      60000,
    );
  }

  // --- Step 1: Organizational -----------------------------------------

  async enterClientName(clientName) {
    console.log(`Entering Client Name: ${clientName}`);
    await this.fill(
      this.selectors.stringInputByLabel(
        MIDMARKET_WIZARD_FIELD_ENUMS.CLIENT_NAME,
      ),
      clientName,
    );
  }

  // Generates a unique client name, fills it, and returns it for saving.
  // Client Name is capped at 20 characters by checkValidation, and
  // inputUnique appends "_<13-digit epoch>" (14 chars), so a prefix longer
  // than 6 characters produces a name the wizard will reject.
  async enterUniqueClientName(prefix) {
    if (prefix.length > 6) {
      throw new Error(
        `Prefix '${prefix}' is ${prefix.length} chars; inputUnique adds 14 more ` +
          `and Client Name is capped at 20. Use a prefix of 6 characters or fewer.`,
      );
    }
    const name = await this.inputUnique(
      this.selectors.stringInputByLabel(
        MIDMARKET_WIZARD_FIELD_ENUMS.CLIENT_NAME,
      ),
      prefix,
      60000,
    );
    return name;
  }

  async enterPrimaryPocName(name) {
    console.log(`Entering Primary PoC Name: ${name}`);
    await this.fill(
      this.selectors.stringInputByLabel(
        MIDMARKET_WIZARD_FIELD_ENUMS.PRIMARY_POC_NAME,
      ),
      name,
    );
  }

  async enterPrimaryPocEmail(email) {
    console.log(`Entering Primary PoC Email: ${email}`);
    await this.fill(
      this.selectors.stringInputByLabel(
        MIDMARKET_WIZARD_FIELD_ENUMS.PRIMARY_POC_EMAIL,
      ),
      email,
    );
  }

  async getStringFieldValue(label) {
    return await this.page
      .locator(this.selectors.stringInputByLabel(label))
      .inputValue();
  }

  // These are <input> elements, so BasePage.expectToHaveText (which reads
  // textContent) would always see "" - the value has to come from inputValue().
  async verifyStringFieldValue(label, expectedValue) {
    const actual = await this.getStringFieldValue(label);
    if (actual !== expectedValue) {
      throw new Error(
        `Expected ${label} to be '${expectedValue}', but got '${actual}'`,
      );
    }
    console.log(`${label} is '${actual}' as expected.`);
  }

  async clickIndustryDropdown() {
    console.log("Opening the Industry dropdown...");
    await this.click(this.selectors.industryDropdown);
  }

  async verifyIndustryListVisible() {
    console.log("Verifying the Industry list is displayed...");
    return await this.expectToBeVisible(this.selectors.industryList);
  }

  async selectIndustry(industry) {
    console.log(`Selecting industry: ${industry}`);
    await this.click(this.selectors.industryOption(industry));
  }

  async verifySelectedIndustry(expectedIndustry) {
    const actual = (
      await this.getText(this.selectors.industrySelectedLabel)
    ).trim();
    if (actual !== expectedIndustry) {
      throw new Error(
        `Expected the selected industry to be '${expectedIndustry}', but got '${actual}'`,
      );
    }
  }

  // The checkbox itself is visually hidden behind the toggle label, so the
  // label is clicked and the checkbox is only read for state.
  async toggleActiveScan() {
    console.log("Toggling 'Active Scan'...");
    await this.click(this.selectors.activeScanToggleLabel);
  }

  async isActiveScanEnabled() {
    return await this.page
      .locator(this.selectors.activeScanCheckbox)
      .isChecked();
  }

  async enterDomain(domain) {
    console.log(`Entering Active Scan domain: ${domain}`);
    await this.fill(this.selectors.domainInput, domain);
  }

  async getAiCredits() {
    return await this.page.locator(this.selectors.aiCreditsInput).inputValue();
  }

  async clickAiCreditsIncrement() {
    console.log("Incrementing AI credits...");
    await this.click(this.selectors.aiCreditsIncrement);
  }

  // Costs are prefilled (Cost Per Employee 2,000 / Server 15,000 /
  // Workstation 2,000 / PR and Response Expenses 20,149), so this is only for
  // overriding a default.
  async enterCostField(label, value) {
    console.log(`Entering ${label}: ${value}`);
    await this.fill(this.selectors.numberInputByLabel(label), value);
  }

  async getCostField(label) {
    return await this.page
      .locator(this.selectors.numberInputByLabel(label))
      .inputValue();
  }

  async selectFramework(frameworkName) {
    console.log(`Selecting framework: ${frameworkName}`);
    await this.click(this.selectors.frameworkRadioLabel(frameworkName));
  }

  async verifyFrameworkSelected(frameworkName) {
    const radio = this.page.locator(
      this.selectors.frameworkRadioInput(frameworkName),
    );
    await radio.waitFor({ state: "attached", timeout: 30000 });
    expect(await radio.isChecked()).toBeTruthy();
  }

  // Step 1 renders frameworkList.slice(0, 5), so this should always be 5 once
  // applyFrameworkSettings() has pinned the MidMarket frameworks to the top.
  async getFrameworkOptionCount() {
    return await this.page
      .locator(this.selectors.frameworkOptionLabels)
      .count();
  }

  // --- Step 2: Account Details ----------------------------------------

  async clickAccountTypeDropdown() {
    console.log("Opening the Account Type dropdown...");
    await this.click(this.selectors.accountTypeDropdown);
  }

  async selectAccountType(value) {
    console.log(`Selecting Account Type: ${value}`);
    await this.clickAccountTypeDropdown();
    await this.click(this.selectors.accountTypeOption(value));
    return value;
  }

  async getAccountType() {
    return (await this.getText(this.selectors.accountTypeValue)).trim();
  }

  async openCalendar(label) {
    console.log(`Opening the ${label} calendar...`);
    await this.click(this.selectors.calendarIconByLabel(label));
  }

  async verifyCalendarDisplayed() {
    console.log("Verifying the calendar is displayed...");
    return await this.expectToBeVisible(this.selectors.calendarArea);
  }

  async selectCalendarToday() {
    console.log("Selecting today's date from the calendar...");
    await this.click(this.selectors.calendarToday);
  }

  // Composite: open the calendar for a date field and pick today.
  async setDateToToday(label) {
    await this.openCalendar(label);
    await this.verifyCalendarDisplayed();
    await this.selectCalendarToday();
  }

  async getDateFieldValue(label) {
    return await this.page
      .locator(this.selectors.calendarDateInputByLabel(label))
      .inputValue();
  }

  async enterProducer(value) {
    console.log(`Entering Producer: ${value}`);
    await this.fill(
      this.selectors.accountDetailsLeftInputByLabel(
        MIDMARKET_ACCOUNT_DETAILS_FIELD_ENUMS.PRODUCER,
      ),
      value,
    );
  }

  async enterRiskAnalystEmail(email) {
    console.log(`Entering Risk Analyst Email: ${email}`);
    await this.fill(
      this.selectors.accountDetailsRightInputByLabel(
        MIDMARKET_ACCOUNT_DETAILS_FIELD_ENUMS.RISK_ANALYST_EMAIL,
      ),
      email,
    );
  }

  async enterNotes(text) {
    console.log("Entering Account Details notes...");
    await this.fill(this.selectors.notesTextarea, text);
  }

  async verifyAssignBrokerVisible() {
    console.log("Verifying the Assign Broker listing is displayed...");
    return await this.expectToBeVisible(this.selectors.assignBrokerListing);
  }

  // The Current/Previous Year grid renders beside Account Details in the same
  // step, inside the .step-8 panel.
  async verifyCurrentYearPanelVisible() {
    console.log("Verifying the Current/Previous Year panel is displayed...");
    return await this.expectToBeVisible(this.selectors.currentYearPanel);
  }

  // --- Step 3: Data Scope ---------------------------------------------

  async enterDataScopeValue(label, value) {
    console.log(`Entering ${label}: ${value}`);
    await this.fill(this.selectors.dataScopeInputByLabel(label), value);
  }

  async getDataScopeValue(label) {
    return await this.page
      .locator(this.selectors.dataScopeInputByLabel(label))
      .inputValue();
  }

  /**
   * parseInput() masks these fields, so "1000000" is stored back as "1,000,000"
   * and the revenue columns also gain a "$". Compare on digits only so the
   * caller can pass either form.
   */
  async verifyDataScopeValue(label, expectedValue) {
    const actual = await this.getDataScopeValue(label);
    const digitsOnly = (value) => String(value).replace(/\D/g, "");
    expect(digitsOnly(actual)).toBe(digitsOnly(expectedValue));
  }

  async fillDataScopeStep(revenue, costOfGoods, servers, workstations) {
    await this.enterDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.ANNUAL_REVENUE,
      revenue,
    );
    await this.enterDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.ANNUAL_COST_OF_GOODS,
      costOfGoods,
    );
    await this.enterDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.NUMBER_OF_SERVERS,
      servers,
    );
    await this.enterDataScopeValue(
      MIDMARKET_DATA_SCOPE_FIELD_ENUMS.NUMBER_OF_WORKSTATIONS,
      workstations,
    );
  }

  // --- SEND TO CLIENT --------------------------------------------------

  /**
   * SEND TO CLIENT is bound to [disableClick]="enableClientBtn", which
   * cygov-button surfaces as aria-disabled. It only enables once Client Name,
   * Primary PoC Name and a regex-valid Primary PoC Email are all present, and
   * enableClientButton() runs on keyup - so the assertion must follow a real
   * keystroke, not a programmatic value set.
   */
  async isSendToClientEnabled() {
    const button = this.page.locator(this.selectors.sendToClientButton);
    await button.waitFor({ state: "visible", timeout: 30000 });
    return (await button.getAttribute("aria-disabled")) === "false";
  }

  async verifySendToClientDisabled() {
    const enabled = await this.isSendToClientEnabled();
    if (enabled) {
      throw new Error(
        "Expected 'SEND TO CLIENT' to be disabled, but aria-disabled was 'false'",
      );
    }
    console.log("'SEND TO CLIENT' is disabled as expected.");
  }

  async verifySendToClientEnabled() {
    const enabled = await this.isSendToClientEnabled();
    if (!enabled) {
      throw new Error(
        "Expected 'SEND TO CLIENT' to be enabled, but aria-disabled was 'true'",
      );
    }
    console.log("'SEND TO CLIENT' is enabled as expected.");
  }

  async clickSendToClient() {
    console.log("Clicking 'SEND TO CLIENT'...");
    await this.click(this.selectors.sendToClientButton);
  }

  async verifySendConfirmationModal() {
    console.log("Verifying the send-to-client confirmation modal...");
    return await this.expectToBeVisible(this.selectors.sendConfirmBody);
  }

  async confirmSendToClient() {
    console.log("Confirming the send-to-client invitation...");
    await this.click(this.selectors.sendConfirmButton);
  }

  // Full invite flow: click, confirm, wait for the invite toast.
  async sendWizardToClient() {
    await this.clickSendToClient();
    await this.verifySendConfirmationModal();
    await this.confirmSendToClient();
  }

  // --- Toasts ----------------------------------------------------------

  async waitForToastByText(text, timeout = 90000) {
    console.log(`Waiting for the '${text}' toast (visible then hidden)...`);
    const selector = this.selectors.toastByText(text);
    await this.page.waitForSelector(selector, { state: "visible", timeout });
    await this.page.waitForSelector(selector, { state: "hidden", timeout });
  }

  async verifyToastByText(text, timeout = 90000) {
    await this.expectToastMessageToContain(
      this.selectors.toastByText(text),
      text,
      timeout,
    );
  }

  /**
   * Invalid input never disables NEXT - checkValidation() raises an info toast
   * and leaves stepNumber unchanged. So a negative case has to assert the
   * message AND that the wizard did not advance; the toast alone would pass
   * even on a wrong advance.
   */
  async verifyStepBlockedWithToast(stepNumber, expectedToastText) {
    await this.click(this.selectors.nextButton);
    await this.expectToastMessageToContain(
      this.selectors.infoToast,
      expectedToastText,
      60000,
    );
    await this.verifyOnStep(stepNumber);
    console.log(
      `Blocked on step ${stepNumber} as expected: "${expectedToastText}"`,
    );
  }

  // --- Composite step fills --------------------------------------------

  /**
   * Fills step 1 with valid data and returns the generated client name.
   * Frameworks are left alone: the first entry of frameworkList is preselected
   * for a brand-new wizard, so step 1 is already valid without touching them.
   */
  async fillOrganizationalStepValid(prefix, industry, pocName, pocEmail) {
    const clientName = await this.enterUniqueClientName(prefix);
    await this.enterPrimaryPocName(pocName);
    await this.enterPrimaryPocEmail(pocEmail);
    await this.clickIndustryDropdown();
    await this.selectIndustry(industry);
    return clientName;
  }

  /**
   * Walk from step 1 to targetStep, filling only what each step needs to
   * advance. Step 2 has no validation at all, so it is passed straight through.
   * Callers land ON targetStep without it being filled.
   */
  async advanceToStep(targetStep, options = {}) {
    const {
      prefix = "MMW",
      industry,
      pocName = "MidMarket PoC",
      pocEmail = "midmarket.poc@mailinator.com",
    } = options;
    let clientName = "";

    for (
      let step = MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL;
      step < targetStep;
      step++
    ) {
      await this.verifyOnStep(step);
      if (step === MIDMARKET_WIZARD_STEP_ENUMS.ORGANIZATIONAL) {
        clientName = await this.fillOrganizationalStepValid(
          prefix,
          industry,
          pocName,
          pocEmail,
        );
      }
      // Account Details needs no input to advance - checkValidation case 2 is
      // commented out in the app, so NEXT always succeeds there.
      await this.clickNextButton();
    }

    await this.verifyOnStep(targetStep);
    return clientName;
  }
}

module.exports = Wizard;
