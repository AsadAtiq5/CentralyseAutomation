const BasePage = require("../../Secure/BasePage");
const RiskRegisterRisks = require("../../Secure/RiskRegister/RiskRegisterRisks");
const TableEntityLeader = require("../Controls/tableEntityLeader");

// Drives the Risk Register > Risks screen as the ENTITY LEADER.
//
// Every risk operation is delegated to the Secure RiskRegisterRisks page object
// (`this.risks`): the table, the New Risk popup, the severity badges, the
// comments panel, the financial calculator and the
// archive/reactivate/delete flows are the same app components for every role,
// and none of their selectors carries a client or entity name.
//
// Arrival, sub-entity creation, the collection route and the framework card
// come from the sibling TableEntityLeader (`this.entities`) - the same
// composition the Controls filter and navigator ports use, so the
// EntityLeader-specific navigation lives in one place.
//
// WHAT THIS CLASS OWNS is scoping the risk register to one sub-entity.
//
// This is the difference that matters most for this role. The Secure spec
// builds a client holding exactly ONE entity, so the risks screen shows only
// that entity's risks and its "Total" badge equals the framework's own risk
// count - which is what RRR - 02 asserts. An entity leader's client accumulates
// a sub-entity from nearly every spec in the job, almost all of them on
// Business Email Compromise, so the unscoped Total is that count multiplied by
// however many entities happen to exist when the test runs. Scoped to one
// entity the figure is comparable again.
//
// The scoping itself needs nothing new: the Secure page object already has
// selectAllRisksFromDropDown(), which opens the risk-register dropdown and
// picks a sub-entity by exact name, reloading first if the dropdown has not
// rendered.

// Framework the entity this suite builds is provisioned with. Doubles as the
// value the backend risk-count check is keyed on - the Secure spec stores the
// identical string, returned by AddEntityPage.selectBusinessEmailCompromise().
const DEFAULT_FRAMEWORK = "Business Email Compromise";

class RiskRegisterRiskEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.risks = new RiskRegisterRisks(page);
    this.entities = new TableEntityLeader(page);
  }

  // --- arrival and setup ----------------------------------------------------

  async ensureOnUpperdeck(timeoutMs = 120000) {
    await this.entities.ensureOnUpperdeck(timeoutMs);
  }

  async navigateToMultiEntity() {
    await this.entities.navigateToMultiEntity();
  }

  // Creates the sub-entity this whole suite works inside, and returns its name.
  //
  // Business Email Compromise is what gives the entity risks at all, and it is
  // the framework RRREL - 02 compares the UI count against.
  async createEntityWithBEC(prefix = "RRREL_Entity") {
    return await this.entities.createEntityWithBEC(prefix);
  }

  async openEntityCollection(entityName) {
    await this.entities.openEntityCollection(entityName);
  }

  // Opens the framework card on that entity's collection, by name.
  async openFrameworkCard(frameworkName = DEFAULT_FRAMEWORK) {
    return await this.entities.openFrameworkByName(frameworkName);
  }

  // Answers every question on the open assessment and returns the answer map.
  //
  // On a brand new entity this ANSWERS the questions, exactly as the Secure
  // RRR - 00 does. The map is what RRREL - 04 derives the expected residual
  // from, and it cannot be re-derived later - the answers are random.
  async captureCollectionAnswers() {
    console.log("Answering every question and capturing the answers...");
    const answers = await this.risks.answerAllQuestions();
    console.log(`Captured ${answers.length} answer(s).`);
    return answers;
  }

  // --- navigation -----------------------------------------------------------

  // Opens Risk Register from the side menu.
  async navigateToRisks() {
    console.log("Navigating to Risk Register > Risks...");
    await this.risks.navigateToRiskRegisterRisks();
    await this.waitForSpinner();
    console.log("Risks screen open.");
  }

  async verifyRisksTitleVisible() {
    await this.risks.assertRisksTitleVisible();
  }

  // Narrows the risks screen to ONE sub-entity through the risk-register
  // dropdown, which defaults to "All - Risks".
  //
  // Called after every navigateToRisks(), not just before the count checks: the
  // dropdown resets on each visit, and leaving it on "All" would mean the
  // severity badges, the row count and the search all span every entity in the
  // client. The delegate reloads first when the dropdown has not rendered yet.
  async scopeRisksToEntity(entityName) {
    console.log(`Scoping the risks screen to entity: ${entityName}`);
    await this.risks.selectAllRisksFromDropDown(entityName);
    console.log(`Risks screen scoped to: ${entityName}`);
  }

  // Opens Risk Register > Archive.
  //
  // The item renders DISABLED until the entity actually has an archived risk,
  // which is why the archive tests have to create one first.
  async navigateToArchiveRisks() {
    console.log("Navigating to Risk Register > Archive...");
    await this.risks.navigateToArchiveRisks();
    console.log("Archive screen open.");
  }

  // --- table ----------------------------------------------------------------

  async getTableRowsCount() {
    return await this.risks.getTableRowsCount();
  }

  async getSeverityCount(severityName) {
    return await this.risks.getSeverityCount(severityName);
  }

  async searchRisk(riskName) {
    console.log(`Searching for risk: "${riskName}"`);
    await this.risks.searchRisk(riskName);
    await this.page.waitForTimeout(2000);
  }

  async verifyRiskVisible(riskName) {
    await this.risks.verifyRiskVisible(riskName);
  }

  async verifyNoDataAvailable() {
    await this.risks.verifyNoDataAvailable();
  }

  async openRisk(riskName) {
    console.log(`Opening risk: "${riskName}"`);
    await this.risks.clickSearchedRisk(riskName);
    await this.page.waitForTimeout(2000);
  }

  // --- create ---------------------------------------------------------------

  // Opens the New Risk popup on the Automatic tab, waiting for the controls
  // table to populate - it renders empty if the popup mounts before the
  // entity's controls have finished loading.
  async openAutomaticRiskPopup() {
    console.log("Opening the New Risk popup on the Automatic tab...");
    await this.risks.openAutomaticRiskPopupWithControls();
  }

  async createUniqueRiskName(prefix) {
    return await this.risks.createUniqueRiskName(prefix);
  }

  // Picks `count` random controls and returns id/name/impact/probability for
  // each, which the residual calculation is derived from.
  async selectRandomControls(count = 2) {
    const controls = await this.risks.selectRandomControlsFromPopup(count);
    console.log(`Selected ${controls.length} control(s).`);
    return controls;
  }

  async selectRandomImpact() {
    return await this.risks.selectRandomImpact();
  }

  async selectRandomProbability() {
    return await this.risks.selectRandomProbability();
  }

  // Saves the new risk and waits for the popup to close and the toast to show.
  async saveRiskAndWaitForToast() {
    console.log("Saving the risk...");
    await this.risks.clickSaveRiskButton();
    await this.risks.waitForNewRiskPopupHidden();
    await this.risks.waitForRiskCreatedToast();
    console.log("Risk created.");
  }

  // Opens the Manual tab and fills the whole form, returning the risk name it
  // generated.
  async createManualRisk(prefix) {
    console.log("Creating a manual risk...");
    await this.risks.clickAddRiskButton();
    await this.risks.clickManualButton();
    const manualRiskName = await this.risks.fillManualForm(prefix);
    await this.risks.waitForRiskCreatedToast();
    console.log(`Manual risk created: ${manualRiskName}`);
    return manualRiskName;
  }

  // --- risk detail ----------------------------------------------------------

  async getEffectivenessValue() {
    return await this.risks.getEffectivenessValue();
  }

  async getResidualProbability() {
    return await this.risks.getResidualProbability();
  }

  async getResidualImpact() {
    return await this.risks.getResidualImpact();
  }

  async addCommentToRisk(comment) {
    console.log(`Adding a comment to the risk: "${comment}"`);
    await this.risks.clickCommentsSection();
    await this.page.waitForTimeout(1000);
    await this.risks.addComment(comment);
    await this.page.waitForTimeout(2000);
  }

  async verifyComment(comment) {
    await this.risks.verifyComment(comment);
  }

  // --- financial exposure ---------------------------------------------------

  // Enters edit mode, turns on Financial Exposure and opens the calculator in
  // Basic mode, ready for the slider.
  async openFinancialCalculator() {
    console.log("Opening the financial exposure calculator...");
    await this.risks.clickEditRiskButton();
    await this.risks.enableFinancialExposureToggle();
    await this.risks.clickCalculatorButton();
    await this.page.waitForTimeout(1000);
    await this.risks.clickBasicToggle();
    console.log("Calculator open in Basic mode.");
  }

  async setMostLikelySlider() {
    return await this.risks.setBasicMostLikelySlider();
  }

  async getPrimaryLossValue() {
    return await this.risks.getPrimaryLossValue();
  }

  // Saves the calculator, then the risk, and waits for the update toast.
  async saveFinancialExposure() {
    console.log("Saving the calculator and the risk...");
    await this.risks.clickCalculatorSaveButton();
    await this.page.waitForTimeout(1000);
    await this.risks.clickRiskEditSaveButton();
    await this.risks.waitForRiskUpdatedToast();
    console.log("Financial exposure saved.");
  }

  async getFinancialResidualValue() {
    return await this.risks.getFinancialResidualValue();
  }

  // --- archive / reactivate / delete ----------------------------------------

  async archiveRisk() {
    console.log("Archiving the risk...");
    await this.risks.clickArchiveRiskButton();
    await this.risks.clickArchiveRiskConfirmButton();
    await this.risks.waitForRiskArchivedToast();
    console.log("Risk archived.");
  }

  async reactivateRisk() {
    console.log("Reactivating the risk...");
    await this.risks.clickReactivateButton();
    await this.risks.clickReactivateConfirmButton();
    await this.risks.waitForRiskReactivatedToast();
    console.log("Risk reactivated.");
  }

  async deleteRisk() {
    console.log("Deleting the risk...");
    await this.risks.clickDeleteRiskButton();
    await this.risks.typeDeleteRiskConfirmation();
    await this.risks.clickDeleteRiskConfirmButton();
    await this.risks.waitForRiskDeletedToast();
    console.log("Risk deleted.");
  }

  // --- chapter completion modal ---------------------------------------------

  // Armed by the spec before navigating. RRREL - 00 answers a full assessment,
  // which is when this modal surfaces, and it intercepts every click underneath
  // it.
  async registerChapterCompletionModalHandler() {
    await this.entities.registerChapterCompletionModalHandler();
  }

  async dismissChapterCompletionModalIfPresent(probeMs = 5000) {
    return await this.entities.dismissChapterCompletionModalIfPresent(probeMs);
  }
}

RiskRegisterRiskEntityLeader.DEFAULT_FRAMEWORK = DEFAULT_FRAMEWORK;

module.exports = RiskRegisterRiskEntityLeader;
