const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const { REMEDIATION_ENUMS } = require("../../../constant/enums");

// The remediation screen as a PARTICIPANT sees it.
//
// The app gates this screen heavily for the role. In remediation.component.html
// the Risk Tasks, Compliance Tasks and Additional Tasks tabs all carry
// *ngIf="!isParticipant && !isVendorUser", and fetchAndFilterTasks() returns
// early for those three tabs, so a participant only ever has My Tasks. The
// management tools ("Connect to" Jira / ServiceNow) and the Simulate
// Remediation button are hidden for the role as well.
//
// A participant has no management or upperdeck access, so this page reaches
// remediation by URL from the entity the app already redirected them into.
class RemediationParticipantPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      remediationTopSection: ".remediation-top",
      tabByName: (tabName) =>
        `//a[contains(@class,'nav-link') and contains(normalize-space(.), '${tabName}')]`,
      managementToolsContainer: ".managementToolsContainer",
      simulateRemediationWrapper: ".simulate-remediation-wrapper",
      entityDropdown: ".entity-dropdown cygov-select",
      cardContainer: "cygov-security-control-card",
      notFoundMessage: ".not-found-msg",
    };
  }

  // Opens remediation for the entity the participant is already scoped to.
  async openRemediation(entityId) {
    console.log(`Opening remediation for participant entity ${entityId}...`);
    await this.goto(`/first-party/${entityId}/remediation`);
    await this.waitForSpinner();
    await this.waitForLoad();
    await this.expectToBeVisible(this.selectors.remediationTopSection);
  }

  // My Tasks is the only tab a participant gets.
  async verifyMyTasksTabVisible() {
    console.log("Verifying the My Tasks tab is available...");
    await this.expectToBeVisible(
      this.selectors.tabByName(REMEDIATION_ENUMS.MY_TASK),
    );
  }

  // Asserts a tab is entirely absent from the DOM, not merely hidden - the app
  // removes it with *ngIf rather than styling it away.
  async verifyTabNotRendered(tabName) {
    console.log(`Verifying the "${tabName}" tab is not rendered...`);
    await expect(
      this.page.locator(this.selectors.tabByName(tabName)),
    ).toHaveCount(0, { timeout: 30000 });
  }

  // The "Connect to" integrations block is admin-only.
  async verifyManagementToolsNotRendered() {
    console.log("Verifying the management tools block is not rendered...");
    await expect(
      this.page.locator(this.selectors.managementToolsContainer),
    ).toHaveCount(0, { timeout: 30000 });
  }

  // Simulate Remediation is hidden for participants even with a selection.
  async verifySimulateRemediationNotRendered() {
    console.log("Verifying Simulate Remediation is not offered...");
    await expect(
      this.page.locator(this.selectors.simulateRemediationWrapper),
    ).toHaveCount(0, { timeout: 30000 });
  }

  async getMyTasksCount() {
    const tab = this.page.locator(
      this.selectors.tabByName(REMEDIATION_ENUMS.MY_TASK),
    );
    await tab.waitFor({ state: "visible", timeout: 60000 });
    const text = (await tab.textContent())?.trim() ?? "";
    const match = text.match(/\((\d+)\)/);
    const count = match ? parseInt(match[1], 10) : 0;
    console.log(`Participant My Tasks count: ${count}`);
    return count;
  }
}

module.exports = RemediationParticipantPage;
