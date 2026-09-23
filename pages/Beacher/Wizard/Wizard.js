const { expect } = require("@playwright/test");
const BasePage = require("../BasePage");
const {
  WIZARD_STEP_ENUMS,
  WIZARD_RISK_SCENARIO_ENUMS,
} = require("../../../constant/enums");

// Beacher "New Entity Wizard" (Step 1 - Organizational/General) page object.
class Wizard extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      // /clients screen
      newButton:
        "//div[contains(@class,'add-new-bnb-btn')]//span[normalize-space(text())='New']",
      // New Entity wizard modal
      wizardModalTitle:
        "//div[contains(@class,'title-wiz') and normalize-space(text())='NEW ENTITY']",
      clientNameInput:
        "//div[contains(@class,'string-input')][.//div[contains(@class,'title-name') and normalize-space(text())='Client Name']]//input",
      primaryRiskContactInput:
        "//div[contains(@class,'string-input')][.//div[contains(@class,'title-name') and normalize-space(text())='Primary Risk Management Contact']]//input",
      // Industry dropdown
      industryDropdown:
        "//div[contains(@class,'industry-selection')]//div[contains(@class,'drop-down-label')]",
      industryList:
        "//div[contains(@class,'expanded-list')]//div[contains(@class,'industry-list') and not(contains(@class,'industry-list-item'))]",
      // Dynamic industry option: pass the exact label text
      industryOption:
        "//div[contains(@class,'industry-list-item')]//span[normalize-space(text())='{INDUSTRY}']",
      // Step 2 - Financial
      financialStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-2')]",
      annualRevenueInput:
        "//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='Annual Revenue']]//input",
      annualCostOfGoodsInput:
        "//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='Annual Cost of Goods and/or Services']]//input",
      // Step 3 - Frameworks
      frameworksStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-3')]",
      // Dynamic Risk Assessment option: pass the exact framework name
      riskAssessmentOption:
        "//div[contains(@class,'risk-name')]//div[contains(@class,'frame-ellipse') and normalize-space(text())='{FRAMEWORK}']",
      // Step 5 - Technical
      technicalStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-5')]",
      numberOfServersInput:
        "//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='Number of Servers']]//input",
      numberOfWorkstationsInput:
        "//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='Number of Workstations']]//input",
      // Step 7 - Account Details
      accountDetailsStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-7')]",
      renewalDateCalendarIcon:
        "//div[contains(@class,'account-details-left')][.//div[contains(@class,'title-name') and normalize-space(text())='Renewal Date']]//div[contains(@class,'calendar-icon-button')]",
      calendarDropdown: "//ngb-datepicker[contains(@class,'dropdown-menu')]",
      calendarToday:
        "//div[contains(@class,'ngb-dp-today')]//div[contains(@class,'custom-day')]",
      // Step 8 - Current/Previous Year
      currentPreviousYearStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-8')]",
      calculateButton:
        "//div[contains(@class,'calculate-btn') and normalize-space(text())='Calculate']",
      completeButton:
        "//div[contains(@class,'body-back') and @aria-label='COMPLETE']",
      entityCreatedToast:
        "//div[contains(@class,'toast-message') and contains(normalize-space(.),'Entity Created Successfully')]",
      // Footer
      nextButton: "//div[contains(@class,'body-back') and @aria-label='NEXT']",

      // --- Added for WIZARD - 02+ -------------------------------------
      // Any step container by number. ".body-back" alone matches SAVE DRAFT too,
      // so every footer button must stay scoped by its aria-label.
      stepByNumber: (stepNumber) =>
        `//div[contains(@class,'outer-border') and contains(@class,'step-${stepNumber}')]`,
      // Step 6 is the one step rendered without the "outer-border" wrapper.
      riskScenariosStep: "//div[contains(@class,'step-6')]",
      previousButton: "//div[contains(@class,'previous-button')]",
      saveDraftButton:
        "//div[contains(@class,'body-back') and @aria-label='SAVE DRAFT']",
      updateButton:
        "//div[contains(@class,'body-back') and @aria-label='UPDATE']",
      infoToast: "//div[contains(@class,'toast-message')]",
      // Text-scoped: a bare .toast-message match grabs whichever toast is up
      // first. SAVE DRAFT fires "Saving draft . . ." before "Draft Saved!", so
      // a generic wait resolves on the wrong one.
      toastByText: (text) =>
        `//div[contains(@class,'toast-message') and contains(normalize-space(.),'${text}')]`,
      // Present in the DOM on Beacher but visually hidden - assert visibility,
      // never presence.
      lineOfBusinessField: "//div[contains(@class,'hide-line-business')]",

      // Step 4 - Data Scope
      dataScopeStep:
        "//div[contains(@class,'outer-border') and contains(@class,'step-4')]",
      // A row is a div.number-input holding both the .title-area (check-box +
      // title-name) and .input-area-numbers > input. Scoping to number-input
      // matters: a bare div[.//title-name] predicate also matches step-4 and
      // left-section, which trips Playwright strict mode.
      dataScopeRowByLabel: (label) =>
        `//div[contains(@class,'step-4')]//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]`,
      // The checkbox is a styled div, not an input - there is no
      // input[type=checkbox] on this step. Checked state is the "checked" class
      // plus an inner .selected-tick svg.
      dataScopeCheckboxByLabel: (label) =>
        `//div[contains(@class,'step-4')]//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//div[contains(@class,'check-box')]`,
      dataScopeInputByLabel: (label) =>
        `//div[contains(@class,'step-4')]//div[contains(@class,'number-input')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//input[contains(@class,'number-input-style')]`,

      // /clients cards. The name lives in .beecher-name-text - matching on
      // "name" alone would also hit the .logo-name wrapper.
      clientCardByName: (name) =>
        `//div[contains(@class,'beecher-name-text') and normalize-space(text())='${name}']`,
      // Scoped to the clients screen wrapper: the wizard's framework search
      // uses the same form-control/search classes.
      clientsSearchInput:
        "//div[contains(@class,'mid-market-search-wrapper')]//input[contains(@class,'search')]",

      // Left rail / upper stepper
      stepRailItem: "//div[contains(@class,'step-info-single')]",
      // Exact class token: contains(@class,'active-color') also matches
      // "inactive-color", which resolves to every rail item instead of one.
      activeStepNumber:
        "//div[contains(@class,'numbering-step') and contains(concat(' ', normalize-space(@class), ' '), ' active-color ')]",
      upperStepperSection: "//div[contains(@class,'bulk-risk-step')]",

      // Step 3 splits into two lists: .upper-section is Risk Assessment (real
      // checkbox inputs, one preselected) and .lower-section is Regulatory
      // Requirements. The Filter By and search controls belong to the LOWER
      // section, so searching never filters the risk assessment list.
      // Scoped to the step: the /clients screen behind the modal has its own
      // search input with the same classes.
      frameworkSearchInput:
        "//div[contains(@class,'step-3')]//div[contains(@class,'lower-section')]//input[contains(@class,'form-control') and contains(@class,'search')]",
      riskItemCheckbox:
        "//div[contains(@class,'step-3')]//input[contains(@class,'risk-item-checkbox')]",
      riskFrameworkName:
        "//div[contains(@class,'step-3')]//div[contains(@class,'upper-section')]//div[contains(@class,'frame-ellipse')]",
      // Compliance rows use .comp-name inside .compliance-list - the
      // .frame-ellipse class is only used by the Risk Assessment list above.
      complianceFrameworkName:
        "//div[contains(@class,'step-3')]//div[contains(@class,'compliance-list')]//div[contains(@class,'comp-name')]",

      // Step 8 - Current/Previous Year result popup
      currentYearTable: "//div[contains(@class,'step-8-table')]",
      // Scoped to step 8 and matched on the exact "popup" class token:
      // contains(@class,'popup') also picks up other components whose class
      // merely contains the word, which trips Playwright strict mode.
      currentYearPopup:
        "//div[contains(@class,'step-8')]//div[contains(concat(' ', normalize-space(@class), ' '), ' popup ')]",
      currentYearPopupClose:
        "//div[contains(@class,'step-8')]//div[contains(concat(' ', normalize-space(@class), ' '), ' popup ')]//div[contains(@class,'cross-btn')]",
    };
  }

  async clickNewButton() {
    console.log("Clicking 'New' button on /clients...");
    await this.click(this.selectors.newButton);
    await this.waitForSpinner();
  }

  async waitForWizardModal() {
    console.log("Waiting for New Entity wizard modal...");
    await this.waitForElement(this.selectors.wizardModalTitle);
  }

  async enterClientName(clientName) {
    console.log(`Entering client name: ${clientName}`);
    await this.fill(this.selectors.clientNameInput, clientName);
  }

  // Generates a unique client name, fills it, and returns it for saving.
  async enterUniqueClientName(prefix) {
    const name = await this.inputUnique(
      this.selectors.clientNameInput,
      prefix,
      60000,
    );
    return name;
  }

  async enterPrimaryRiskManagementContact(contact) {
    console.log(`Entering Primary Risk Management Contact: ${contact}`);
    await this.fill(this.selectors.primaryRiskContactInput, contact);
  }

  async clickIndustryDropdown() {
    console.log("Clicking Industry dropdown...");
    await this.click(this.selectors.industryDropdown);
  }

  async verifyIndustryListVisible() {
    console.log("Verifying Industry list is displayed...");
    return await this.expectToBeVisible(this.selectors.industryList);
  }

  async selectIndustry(industry) {
    console.log(`Selecting industry: ${industry}`);
    const option = this.selectors.industryOption.replace(
      "{INDUSTRY}",
      industry,
    );
    await this.click(option);
  }

  async waitForFinancialStep() {
    console.log("Waiting for Financial step (Step 2)...");
    await this.waitForElement(this.selectors.financialStep);
  }

  async enterAnnualRevenue(amount) {
    console.log(`Entering Annual Revenue: ${amount}`);
    await this.fill(this.selectors.annualRevenueInput, amount);
  }

  async enterAnnualCostOfGoods(amount) {
    console.log(`Entering Annual Cost of Goods and/or Services: ${amount}`);
    await this.fill(this.selectors.annualCostOfGoodsInput, amount);
  }

  async waitForFrameworksStep() {
    console.log("Waiting for Frameworks step (Step 3)...");
    await this.waitForElement(this.selectors.frameworksStep);
  }

  async selectRiskAssessment(framework) {
    console.log(`Selecting Risk Assessment framework: ${framework}`);
    const option = this.selectors.riskAssessmentOption.replace(
      "{FRAMEWORK}",
      framework,
    );
    await this.click(option);
  }

  async waitForTechnicalStep() {
    console.log("Waiting for Technical step (Step 5)...");
    await this.waitForElement(this.selectors.technicalStep);
  }

  async enterNumberOfServers(count) {
    console.log(`Entering Number of Servers: ${count}`);
    await this.fill(this.selectors.numberOfServersInput, count);
  }

  async enterNumberOfWorkstations(count) {
    console.log(`Entering Number of Workstations: ${count}`);
    await this.fill(this.selectors.numberOfWorkstationsInput, count);
  }

  async waitForAccountDetailsStep() {
    console.log("Waiting for Account Details step (Step 7)...");
    await this.waitForElement(this.selectors.accountDetailsStep);
  }

  async clickRenewalDateCalendar() {
    console.log("Opening the Renewal Date calendar...");
    await this.click(this.selectors.renewalDateCalendarIcon);
  }

  async verifyCalendarDisplayed() {
    console.log("Verifying the calendar dropdown is displayed...");
    return await this.expectToBeVisible(this.selectors.calendarDropdown);
  }

  async selectCalendarToday() {
    console.log("Selecting today's date from the calendar...");
    await this.click(this.selectors.calendarToday);
  }

  async waitForCurrentPreviousYearStep() {
    console.log("Waiting for Current/Previous Year step (Step 8)...");
    await this.waitForElement(this.selectors.currentPreviousYearStep);
  }

  async clickCalculateButton() {
    console.log("Clicking 'Calculate' button...");
    await this.click(this.selectors.calculateButton);
  }

  async clickCompleteButton() {
    console.log("Clicking 'COMPLETE' button...");
    await this.click(this.selectors.completeButton);
  }

  async verifyEntityCreatedToast(timeout = 60000) {
    console.log(
      "Waiting for 'Entity Created Successfully!' toast (visible then hidden)...",
    );
    await this.page.waitForSelector(this.selectors.entityCreatedToast, {
      state: "visible",
      timeout,
    });
    await this.page.waitForSelector(this.selectors.entityCreatedToast, {
      state: "hidden",
      timeout,
    });
  }

  async clickNextButton() {
    console.log("Clicking 'NEXT' button...");
    await this.click(this.selectors.nextButton);
    await this.page.waitForTimeout(3000);
  }

  // --- Added for WIZARD - 02+ ----------------------------------------

  // Step 6 has no "outer-border" wrapper, so it needs its own selector.
  stepSelector(stepNumber) {
    return stepNumber === WIZARD_STEP_ENUMS.RISK_SCENARIOS
      ? this.selectors.riskScenariosStep
      : this.selectors.stepByNumber(stepNumber);
  }

  async verifyOnStep(stepNumber) {
    console.log(`Verifying the wizard is on step ${stepNumber}...`);
    await this.expectToBeVisible(this.stepSelector(stepNumber), 60000);
  }

  /**
   * Invalid input never disables NEXT - it raises an info toast and leaves
   * stepNumber unchanged. So a negative case has to assert the message AND that
   * the wizard did not advance; the toast alone would pass even on a wrong advance.
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

  // Fills step 1 with valid data and returns the generated client name.
  async fillOrganizationalStepValid(prefix = "Beacher_Client", industry) {
    const clientName = await this.enterUniqueClientName(prefix);
    await this.enterPrimaryRiskManagementContact("Risk Manager");
    await this.clickIndustryDropdown();
    await this.selectIndustry(industry);
    return clientName;
  }

  async fillFinancialStepValid(revenue, costOfGoods) {
    await this.enterAnnualRevenue(revenue);
    await this.enterAnnualCostOfGoods(costOfGoods);
  }

  async fillTechnicalStepValid(servers, workstations) {
    await this.enterNumberOfServers(servers);
    await this.enterNumberOfWorkstations(workstations);
  }

  /**
   * Walk from step 1 to targetStep filling only what each step requires to
   * advance. Steps 3, 4 and 6 have no mandatory input, so they are just passed
   * through. Callers land ON targetStep without it being filled.
   */
  async advanceToStep(targetStep, options = {}) {
    const {
      prefix = "Beacher_Client",
      industry,
      revenue,
      costOfGoods,
      servers,
      workstations,
    } = options;
    let clientName = "";

    for (
      let step = WIZARD_STEP_ENUMS.ORGANIZATIONAL;
      step < targetStep;
      step++
    ) {
      await this.verifyOnStep(step);
      switch (step) {
        case WIZARD_STEP_ENUMS.ORGANIZATIONAL:
          clientName = await this.fillOrganizationalStepValid(prefix, industry);
          break;
        case WIZARD_STEP_ENUMS.FINANCIAL:
          await this.fillFinancialStepValid(revenue, costOfGoods);
          break;
        case WIZARD_STEP_ENUMS.TECHNICAL:
          await this.fillTechnicalStepValid(servers, workstations);
          break;
        case WIZARD_STEP_ENUMS.ACCOUNT_DETAILS:
          // Renewal Date is the only field to supply - Broker #1 auto-fills
          // with the logged-in user for a new wizard.
          await this.clickRenewalDateCalendar();
          await this.selectCalendarToday();
          break;
        default:
          // Frameworks, Data Scope and Risk Scenarios advance with no input.
          break;
      }
      await this.clickNextButton();
    }

    await this.verifyOnStep(targetStep);
    return clientName;
  }

  // --- Step 4: Data Scope -------------------------------------------

  async verifyDataScopeInputsDisabled() {
    console.log("Verifying unchecked Data Scope inputs are disabled...");
    const inputs = this.page.locator(
      `xpath=${this.selectors.dataScopeStep}//input[contains(@class,'number-input-style')]`,
    );
    const total = await inputs.count();
    expect(total).toBeGreaterThan(0);
    for (let index = 0; index < total; index++) {
      expect(await inputs.nth(index).isDisabled()).toBeTruthy();
    }
    console.log(`All ${total} Data Scope inputs are disabled as expected.`);
  }

  async checkDataScopeRow(label) {
    console.log(`Ticking the Data Scope row: ${label}`);
    await this.click(this.selectors.dataScopeCheckboxByLabel(label));
  }

  async enterDataScopeValue(label, value) {
    await this.fill(this.selectors.dataScopeInputByLabel(label), value);
  }

  async getDataScopeValue(label) {
    return await this.page
      .locator(this.selectors.dataScopeInputByLabel(label))
      .inputValue();
  }

  /**
   * parseInput() masks these fields, so "1500" is stored back as "1,500".
   * Compare on digits only so the caller can pass either form.
   */
  async verifyDataScopeValue(label, expectedValue) {
    const actual = await this.getDataScopeValue(label);
    const digitsOnly = (value) => String(value).replace(/\D/g, "");
    expect(digitsOnly(actual)).toBe(digitsOnly(expectedValue));
  }

  // The tick is a div, so isChecked() does not apply - the state lives in the
  // "checked" class.
  async verifyDataScopeRowChecked(label) {
    const checkbox = this.page.locator(
      this.selectors.dataScopeCheckboxByLabel(label),
    );
    const classes = await checkbox.getAttribute("class");
    expect(classes.split(/\s+/)).toContain("checked");
  }

  // --- Step 6: Risk Scenarios ---------------------------------------

  async verifyRiskScenariosStepDisplayed() {
    console.log("Verifying the Risk Scenarios step...");
    await this.expectToBeVisible(this.selectors.riskScenariosStep, 60000);
  }

  async getRiskScenariosText() {
    return await this.page
      .locator(this.selectors.riskScenariosStep)
      .innerText();
  }

  async verifyRiskScenariosContent() {
    console.log("Verifying the Risk Scenarios table content...");
    const text = await this.getRiskScenariosText();
    for (const scenario of Object.values(WIZARD_RISK_SCENARIO_ENUMS)) {
      expect(text).toContain(scenario);
    }
    console.log("All expected Risk Scenario rows are present.");
  }

  // --- Step 8: Calculate / Complete ---------------------------------

  /**
   * cygov-button renders no "disabled" class - it binds
   * [attr.aria-disabled]="disableClick || fullyDisabled" and sets inline
   * pointer-events:none. Asserting on a class silently passes whatever the real
   * state is, so the aria attribute is the only reliable signal.
   */
  async getCompleteButtonAriaDisabled() {
    const complete = this.page.locator(this.selectors.completeButton);
    await complete.waitFor({ state: "visible", timeout: 60000 });
    return await complete.getAttribute("aria-disabled");
  }

  async verifyCompleteButtonDisabled() {
    console.log("Verifying COMPLETE is disabled...");
    expect(await this.getCompleteButtonAriaDisabled()).toBe("true");
  }

  async verifyCompleteButtonEnabled() {
    console.log("Verifying COMPLETE is enabled...");
    expect(await this.getCompleteButtonAriaDisabled()).toBe("false");
  }

  async verifyCurrentYearPopupDisplayed() {
    await this.expectToBeVisible(this.selectors.currentYearPopup, 60000);
  }

  // Closing the popup re-disables COMPLETE, because toggleCurrentYearPopup()
  // toggles rather than closes.
  async closeCurrentYearPopup() {
    console.log("Closing the Current/Previous Year result popup...");
    await this.click(this.selectors.currentYearPopupClose);
  }

  // --- Left rail / stepper ------------------------------------------

  async getStepRailTitles() {
    const items = this.page.locator(this.selectors.stepRailItem);
    await items.first().waitFor({ state: "visible", timeout: 60000 });
    const raw = await items.allInnerTexts();
    // Each item reads "1\nOrganizational" - keep the title only.
    return raw.map((text) =>
      text
        .replace(/\s+/g, " ")
        .replace(/^\d+\s*/, "")
        .trim(),
    );
  }

  async verifyStepRailTitles(expectedTitles) {
    console.log("Verifying the left rail step titles...");
    const actual = await this.getStepRailTitles();
    console.log(
      `expected ${expectedTitles.join(", ")} | actual ${actual.join(", ")}`,
    );
    expect(actual).toEqual(expectedTitles);
  }

  async getUpperStepperSections() {
    return (
      await this.page
        .locator(this.selectors.upperStepperSection)
        .allInnerTexts()
    ).map((text) => text.replace(/\s+/g, " ").trim());
  }

  async verifyUpperStepperSections(expectedSections) {
    console.log("Verifying the upper stepper sections...");
    const actual = await this.getUpperStepperSections();
    console.log(
      `expected ${expectedSections.join(", ")} | actual ${actual.join(", ")}`,
    );
    expect(actual).toEqual(expectedSections);
  }

  async getActiveStepNumber() {
    const value = await this.page
      .locator(this.selectors.activeStepNumber)
      .innerText();
    return Number(value.trim());
  }

  async verifyActiveStepNumber(expectedStep) {
    const actual = await this.getActiveStepNumber();
    console.log(`expected active step ${expectedStep} | actual ${actual}`);
    expect(actual).toBe(expectedStep);
  }

  // --- Step 3: Frameworks -------------------------------------------

  // A risk framework is preselected (riskFrameWorkOpt[0]), which is why step 3
  // advances even though it has no validation case.
  async verifyRiskFrameworkPreselected() {
    console.log("Verifying a risk framework is preselected...");
    const boxes = this.page.locator(this.selectors.riskItemCheckbox);
    await boxes.first().waitFor({ state: "visible", timeout: 60000 });
    const total = await boxes.count();
    let checkedCount = 0;
    for (let index = 0; index < total; index++) {
      if (await boxes.nth(index).isChecked()) {
        checkedCount++;
      }
    }
    console.log(`expected at least 1 preselected | actual ${checkedCount}`);
    expect(checkedCount).toBeGreaterThan(0);
  }

  async getRiskFrameworkNames() {
    return (
      await this.page.locator(this.selectors.riskFrameworkName).allInnerTexts()
    ).map((text) => text.replace(/\s+/g, " ").trim());
  }

  async getComplianceFrameworkNames() {
    return (
      await this.page
        .locator(this.selectors.complianceFrameworkName)
        .allInnerTexts()
    ).map((text) => text.replace(/\s+/g, " ").trim());
  }

  // The search debounces for 1000ms and only fires above 2 characters.
  async searchFramework(keyword) {
    console.log(`Searching frameworks for: ${keyword}`);
    await this.fill(this.selectors.frameworkSearchInput, keyword);
    await this.page.waitForTimeout(2000);
  }

  // The search belongs to the Regulatory Requirements list, so only the
  // compliance names are expected to narrow.
  async verifyFrameworkSearchResults(keyword) {
    const names = await this.getComplianceFrameworkNames();
    console.log(
      `Search "${keyword}" returned ${names.length} compliance framework(s)`,
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.toLowerCase()).toContain(keyword.toLowerCase());
    }
  }

  // --- Save Draft ---------------------------------------------------

  // SAVE DRAFT leaves the modal open - it emits draftSaved and toasts, it does
  // not navigate or close.
  async clickSaveDraft() {
    console.log("Clicking 'SAVE DRAFT'...");
    await this.click(this.selectors.saveDraftButton);
  }

  // Waits for the specific toast rather than the first one on screen - the
  // preceding "Saving draft . . ." info toast would otherwise satisfy a
  // generic wait.
  async verifyDraftSavedToast(expectedText, timeout = 60000) {
    await this.expectToBeVisible(
      this.selectors.toastByText(expectedText),
      timeout,
    );
    console.log(`Draft saved toast shown: "${expectedText}"`);
  }

  async searchClient(clientName) {
    console.log(`Searching the clients screen for: ${clientName}`);
    await this.clearAndType(this.selectors.clientsSearchInput, clientName);
    await this.page.waitForTimeout(3000);
  }

  /**
   * Searches first rather than scanning the grid: the dev environment already
   * holds 30+ client cards, so a freshly created one is not reliably rendered
   * in the initial view. This passed standalone and failed in a full suite run
   * for exactly that reason.
   */
  async verifyClientCardVisible(clientName) {
    console.log(`Verifying the client card is listed: ${clientName}`);
    await this.searchClient(clientName);
    await this.expectToBeVisible(
      this.selectors.clientCardByName(clientName),
      120000,
    );
  }

  // --- White-label guards -------------------------------------------

  async getStepOneFieldLabels() {
    return (
      await this.page
        .locator(
          `${this.selectors.stepByNumber(WIZARD_STEP_ENUMS.ORGANIZATIONAL)}//div[contains(@class,'title-area')]//div[contains(@class,'title-name')]`,
        )
        .allInnerTexts()
    ).map((text) => text.replace(/\s+/g, " ").trim());
  }

  // Beacher renames several fields (Entity Name -> Client Name, Profit Center
  // Leader -> Primary Risk Management Contact, ...), so this doubles as a
  // white-label regression guard.
  async verifyStepOneFieldLabels(expectedLabels) {
    console.log("Verifying the Beacher step 1 field labels...");
    const actual = await this.getStepOneFieldLabels();
    console.log(
      `expected ${expectedLabels.join(", ")} | actual ${actual.join(", ")}`,
    );
    for (const label of expectedLabels) {
      expect(actual).toContain(label);
    }
  }

  // Line of Business is rendered but display:none on Beacher, so it must be
  // asserted on visibility - it is present in the DOM either way.
  async verifyLineOfBusinessHidden() {
    console.log("Verifying Line of Business is hidden on Beacher...");
    const field = this.page.locator(this.selectors.lineOfBusinessField);
    expect(await field.count()).toBeGreaterThan(0);
    expect(await field.first().isVisible()).toBeFalsy();
  }

  async isFieldMandatory(label) {
    const asterisk = this.page.locator(
      `${this.selectors.stepByNumber(WIZARD_STEP_ENUMS.ORGANIZATIONAL)}//div[contains(@class,'title-area')][.//div[contains(@class,'title-name') and normalize-space(text())='${label}']]//div[contains(@class,'asterisk')]`,
    );
    return (await asterisk.count()) > 0;
  }

  async verifyFieldMandatory(label, expectedMandatory) {
    const actual = await this.isFieldMandatory(label);
    console.log(
      `expected "${label}" mandatory ${expectedMandatory} | actual ${actual}`,
    );
    expect(actual).toBe(expectedMandatory);
  }

  /**
   * Renewal Date cannot be set in the past. Day cells expose their date through
   * aria-label ("Tuesday, September 1, 2026"), so every cell earlier than today
   * must carry the disabled class while today itself stays selectable.
   */
  async verifyRenewalDateMinimumIsToday() {
    console.log("Verifying the Renewal Date calendar disables past dates...");
    const days = await this.page
      .locator(
        `${this.selectors.calendarDropdown}//div[contains(@class,'ngb-dp-day')]`,
      )
      .evaluateAll((cells) =>
        cells.map((cell) => ({
          label: cell.getAttribute("aria-label"),
          disabled: cell.classList.contains("disabled"),
        })),
      );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const dated = days
      .filter((day) => day.label)
      .map((day) => ({ ...day, date: new Date(day.label) }))
      .filter((day) => !Number.isNaN(day.date.getTime()));

    const past = dated.filter((day) => day.date < startOfToday);
    const today = dated.find(
      (day) => day.date.getTime() === startOfToday.getTime(),
    );

    console.log(
      `past days ${past.length} | enabled past days ${past.filter((d) => !d.disabled).length}`,
    );
    expect(past.length).toBeGreaterThan(0);
    expect(past.every((day) => day.disabled)).toBeTruthy();
    expect(today).toBeDefined();
    expect(today.disabled).toBeFalsy();
  }

  // --- Boundary data ------------------------------------------------

  /**
   * BasePage.fill() clicks then types, so it APPENDS to whatever is already in
   * the field - entering "500" twice leaves "500,500". Boundary cases re-enter
   * values into the same field, so they need a genuine replace.
   */
  async clearAndType(selector, text) {
    await this.waitForElement(selector);
    const element = this.page.locator(selector);
    await element.fill("");
    await element.type(text, { delay: 0 });
  }

  async clearAndEnterAnnualRevenue(amount) {
    console.log(`Replacing Annual Revenue with: ${amount}`);
    await this.clearAndType(this.selectors.annualRevenueInput, amount);
  }

  async clearAndEnterClientName(clientName) {
    console.log(`Replacing Client Name (${clientName.length} chars)`);
    await this.clearAndType(this.selectors.clientNameInput, clientName);
  }

  /**
   * Exact comparison, unlike verifyAnnualRevenueValue which compares digits
   * only. Needed to prove the mask actually discarded characters: a
   * digits-only check cannot tell "500" from "-500".
   */
  async verifyAnnualRevenueExact(expectedValue) {
    const actual = await this.getAnnualRevenueValue();
    console.log(`expected exact "${expectedValue}" | actual "${actual}"`);
    expect(actual).toBe(expectedValue);
  }

  async getClientNameValue() {
    return await this.page.locator(this.selectors.clientNameInput).inputValue();
  }

  async verifyClientNameValue(expectedValue) {
    const actual = await this.getClientNameValue();
    console.log(
      `expected client name length ${expectedValue.length} | actual ${actual.length}`,
    );
    expect(actual).toBe(expectedValue);
  }

  // A computed step must never surface a broken number. Guards against
  // overflow/divide-by-zero from extreme inputs.
  async verifyNoInvalidComputedNumbers() {
    console.log("Verifying the computed figures contain no invalid numbers...");
    const text = await this.getRiskScenariosText();
    for (const token of ["NaN", "Infinity", "undefined", "null"]) {
      expect(text).not.toContain(token);
    }
    console.log("No NaN/Infinity/undefined in the computed figures.");
  }

  async getAnnualRevenueValue() {
    return await this.page
      .locator(this.selectors.annualRevenueInput)
      .inputValue();
  }

  // Currency fields are masked, so compare on digits only.
  async verifyAnnualRevenueValue(expectedValue) {
    const actual = await this.getAnnualRevenueValue();
    const digitsOnly = (value) => String(value).replace(/\D/g, "");
    console.log(`expected revenue ${expectedValue} | actual ${actual}`);
    expect(digitsOnly(actual)).toBe(digitsOnly(expectedValue));
  }

  async previousStep() {
    console.log("Clicking 'Previous Step'...");
    await this.click(this.selectors.previousButton);
    await this.page.waitForTimeout(3000);
  }
}

module.exports = Wizard;
