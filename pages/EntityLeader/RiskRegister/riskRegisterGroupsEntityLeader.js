const BasePage = require("../../Secure/BasePage");
const RiskRegisterGroup = require("../../Secure/RiskRegister/RiskRegisterGroup");
const RiskRegisterRisks = require("../../Secure/RiskRegister/RiskRegisterRisks");
const TableEntityLeader = require("../Controls/tableEntityLeader");

// Drives the Risk Register > Groups screen as the ENTITY LEADER.
//
// Every group operation is delegated to the Secure RiskRegisterGroup page
// object (`this.groups`): the table, the New Group popup, the severity badges,
// the status dropdown, the comments panel and the delete/archive flows are the
// same app components for every role, and none of their selectors carries a
// client, entity or framework name.
//
// Arrival and sub-entity creation come from the sibling TableEntityLeader
// (`this.entities`), the same composition the other EntityLeader ports use.
//
// `this.risks` is the Secure RISKS page object, held for one method only:
// selectAllRisksFromDropDown(). Despite the name it is a generic risk-register
// dropdown helper - it clicks `div.arrow-wrapper.drop-down-arrow`, which is the
// identical selector the groups screen uses, picks a sub-entity by exact name,
// and reloads first if the dropdown has not rendered. Reusing it beats
// duplicating that logic and its reload fallback here.
//
// WHAT THIS CLASS OWNS is scoping the groups screen to one sub-entity, for the
// same reason the risks port does. The dropdown defaults to "All - Risk
// Groups". The Secure client holds exactly one entity, so scoped and unscoped
// are the same view there; this client accumulates a sub-entity from nearly
// every spec in the job, so unscoped the severity badges and the table span all
// of them - and RRGEL - 03, which compares those badges against ONE framework's
// group counts, would be comparing against a client-wide total.

// Framework the entity this suite builds is provisioned with. Doubles as the
// value the backend group counts are keyed on - the Secure spec stores the
// identical string, returned by AddEntityPage.selectBusinessEmailCompromise().
const DEFAULT_FRAMEWORK = "Business Email Compromise";

class RiskRegisterGroupsEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.groups = new RiskRegisterGroup(page);
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

  // Creates the sub-entity this suite reads groups from, and returns its name.
  //
  // Business Email Compromise is what generates the automatic risk groups at
  // all, and it is the framework RRGEL - 03 compares the badge counts against.
  async createEntityWithBEC(prefix = "RRGEL_Entity") {
    return await this.entities.createEntityWithBEC(prefix);
  }

  // --- navigation -----------------------------------------------------------

  // Risk Register -> Groups.
  async navigateToRiskGroups() {
    console.log("Navigating to Risk Register > Groups...");
    await this.groups.navigateToRiskRegisterGroups();
    console.log("Risk Groups screen open.");
  }

  async verifyRiskGroupsTitleVisible() {
    await this.groups.assertRiskGroupsTitleVisible();
  }

  // Narrows the groups screen to ONE sub-entity through the risk-register
  // dropdown, which defaults to "All - Risk Groups".
  //
  // Called after every navigateToRiskGroups(): the dropdown resets on each
  // visit, and leaving it on "All" would mean the badges, the table and the
  // search span every entity in the client.
  async scopeGroupsToEntity(entityName) {
    console.log(`Scoping the groups screen to entity: ${entityName}`);
    await this.risks.selectAllRisksFromDropDown(entityName);
    console.log(`Groups screen scoped to: ${entityName}`);
  }

  // Asserts the groups table actually carries groups.
  async verifyRiskGroupsVisible() {
    console.log("Verifying the risk groups table is populated...");
    await this.groups.assertRiskGroupsVisible();
  }

  // Risk Register -> Archive. The shared selector filters on not(@disabled), so
  // this matches nothing until the entity actually has an archived group.
  async navigateToArchiveSection() {
    console.log("Navigating to Risk Register > Archive...");
    await this.groups.navigateToArchiveSection();
    console.log("Archive screen open.");
  }

  async selectAllRiskGroupsFromDropdown() {
    await this.groups.selectAllRiskGroupsFromDropdown();
  }

  async verifyArchivedGroupInTable(groupName) {
    await this.groups.assertArchivedGroupInTable(groupName);
  }

  // --- severity badges ------------------------------------------------------

  async getSeverityCount(severityName) {
    return await this.groups.getSeverityCount(severityName);
  }

  // Applies one severity filter and returns the row count it leaves behind.
  // emptyStateCheck() returns 0 for the no-data state rather than throwing,
  // which is what makes a legitimately empty band comparable.
  async applySeverityFilterAndCountRows(severityName) {
    const clickBySeverity = {
      Total: () => this.groups.clickTotal(),
      Critical: () => this.groups.clickCritical(),
      High: () => this.groups.clickHigh(),
      Medium: () => this.groups.clickMedium(),
      Low: () => this.groups.clickLow(),
    };
    const click = clickBySeverity[severityName];
    if (!click) {
      throw new Error(`Unknown severity band: "${severityName}"`);
    }
    await click();
    const rows = await this.groups.emptyStateCheck();
    console.log(`${severityName} filter applied - ${rows} row(s).`);
    return rows;
  }

  // --- create ---------------------------------------------------------------

  async openNewGroupPopup() {
    console.log("Opening the New Group popup...");
    await this.groups.clickNewGroupButton();
    await this.groups.verifyNewGroupPopup();
  }

  async createUniqueGroupName(prefix) {
    return await this.groups.createUniqueGroupName(prefix);
  }

  // Ticks a random set of risks in the popup and returns their names, so the
  // caller can check the same set on the group's detail table afterwards.
  async selectRandomRisks() {
    const names = await this.groups.selectRandomRisksFromPopup();
    console.log(`Selected ${names.length} risk(s) for the group.`);
    return names;
  }

  async createGroupAndWaitForToast() {
    console.log("Creating the group...");
    await this.groups.clickCreateGroupButton();
    await this.groups.waitForGroupCreatedToast();
    console.log("Group created.");
  }

  // --- table ----------------------------------------------------------------

  async searchGroup(groupName) {
    console.log(`Searching for group: "${groupName}"`);
    await this.groups.searchGroup(groupName);
  }

  async verifyGroupVisible(groupName) {
    await this.groups.verifyGroupVisible(groupName);
  }

  async openGroup(groupName) {
    console.log(`Opening group: "${groupName}"`);
    await this.groups.clickSearchedGroup(groupName);
    await this.page.waitForTimeout(2000);
  }

  // Opens a group without searching for it first, and returns its name.
  async openRandomGroupAndGetName() {
    return await this.groups.clickRandomGroupFromTableAndGetName();
  }

  async openRandomGroup() {
    await this.groups.clickRandomGroupFromTable();
  }

  // --- group detail ---------------------------------------------------------

  async openRisksBox() {
    console.log("Opening the Risks box on the group...");
    await this.groups.clickRisksBox();
  }

  async verifyRisksInDetailTable(expectedRiskNames = []) {
    await this.groups.assertRisksDetailTableVisible(expectedRiskNames);
  }

  // Enters edit mode and picks a random status, returning what it picked so the
  // caller can assert the saved value against it.
  async selectRandomRiskStatus() {
    console.log("Editing the group status...");
    await this.groups.clickEditIcon();
    const status = await this.groups.selectRandomRiskStatus();
    console.log(`Status selected: ${status}`);
    return status;
  }

  async saveGroup() {
    await this.groups.clickSaveButton();
  }

  async getRiskStatusText() {
    return await this.groups.getRiskStatusText();
  }

  async addCommentToGroup(comment) {
    console.log(`Adding a comment to the group: "${comment}"`);
    await this.groups.clickCommentsSection();
    await this.page.waitForTimeout(1000);
    await this.groups.addComment(comment);
    await this.page.waitForTimeout(2000);
  }

  async verifyComment(comment) {
    await this.groups.verifyComment(comment);
  }

  // --- delete / archive -----------------------------------------------------

  // Runs the delete flow to completion and waits for the refusal toast.
  //
  // Automatic groups are generated by the app rather than created by a user,
  // and the app declines to delete them - so the toast IS the assertion here,
  // not a failure path.
  async attemptDeleteAndExpectRefusal() {
    console.log("Attempting to delete an automatic group...");
    await this.groups.clickDeleteButton();
    await this.groups.verifyDeleteGroupPopup();
    await this.groups.typeDeleteConfirmation();
    await this.groups.clickDeleteConfirmButton();
    await this.groups.waitForAutomaticGroupDeleteToast();
    console.log("Automatic group deletion was refused, as expected.");
  }

  async archiveGroup() {
    console.log("Archiving the group...");
    await this.groups.clickArchiveButton();
    await this.groups.verifyArchiveGroupPopup();
    await this.groups.clickArchiveConfirmButton();
    await this.groups.waitForGroupArchivedToast();
    console.log("Group archived.");
  }
}

RiskRegisterGroupsEntityLeader.DEFAULT_FRAMEWORK = DEFAULT_FRAMEWORK;

module.exports = RiskRegisterGroupsEntityLeader;
