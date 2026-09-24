const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const ManagementPage = require("../../Secure/ManagementPage");
const AddEntityPage = require("../../Secure/AddEntityPage");
const ArtifactRegistry = require("../../Secure/Collection/ArtifactRegistry");
const PolicyManagement = require("../../Secure/PolicyManagement/PolicyManagement");
const PolicyManagementPolicies = require("../../Secure/PolicyManagement/PolicyManagementPolicies");

// Drives Policy Management as the ENTITY LEADER.
//
// This class deliberately owns very little. The Secure suite drives these
// screens with TWO page objects side by side - PolicyManagement for the
// creation wizard and PolicyManagementPolicies for the tables and dashboard -
// and neither carries a client or entity name in any selector. Wrapping all
// ~70 of their methods would add a translation layer with nothing to translate,
// and would make the ported spec harder to diff against the original.
//
// So they are exposed as public collaborators (`this.policyManagement`,
// `this.policies`, plus `this.entities` and `this.artifactRegistry` for the
// copy-to-registry case) and the spec drives them exactly as the Secure spec
// does. What this class owns is the part that genuinely differs: how this role
// ARRIVES at Policy Management.
//
// Confirmed live against this role before porting:
//   - The session lands on /first-party/<id>/upperdeck.
//   - "Policy Management" is a SIDEBAR item, and ManagementPage's
//     policyManagementButton already resolves the sidebar entry rather than
//     anything on the client-card screen - so it works for this role unchanged.
//   - Multi Entity is enabled and "New Entity" is present, which the
//     copy-to-artifacts-registry case needs.
//
// IMPORTANT - the sidebar item renders DISABLED unless the Policy Management
// solution was enabled on the client at creation time. ELS - 01 now selects it
// via AddClientPage.selectPolicyManagement(), so a client provisioned by the
// current setup spec has it. A session saved before that change will land on a
// client where this menu item is dead.
class PolicyManagementPoliciesEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.management = new ManagementPage(page);
    this.policyManagement = new PolicyManagement(page);
    this.policies = new PolicyManagementPolicies(page);
    this.entities = new AddEntityPage(page);
    this.artifactRegistry = new ArtifactRegistry(page);
    this.selectors = {
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      policyManagementSidebar:
        "//button[contains(@class,'sub-menu-item')][.//span[normalize-space(text())='Policy Management']]",
    };
  }

  // Confirms the session landed on the client's upperdeck. An arrival check,
  // not navigation: the app routes this role there once the saved session is
  // restored. Generous timeout - this is the first authenticated render.
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

  // Opens Policy Management from the side menu, landing on the Overview.
  //
  // This replaces the Secure spec's whole beforeEach preamble - goto /clients,
  // search the client, click its card, then click Policy Management. This role
  // is already inside its client, so only the last click survives.
  //
  // The enabled check is deliberate: without the solution on the client the item
  // is present but disabled, and a plain click would burn its full timeout and
  // report a missing element rather than a missing solution.
  async openPolicyManagement(timeoutMs = 120000) {
    console.log("Opening Policy Management from the side menu...");
    const item = this.page
      .locator(this.selectors.policyManagementSidebar)
      .first();
    await item.waitFor({ state: "visible", timeout: timeoutMs });
    await expect(
      item,
      "The Policy Management side-menu item is disabled. The solution was not enabled on this client - re-run ELS - 01, which selects it at client creation.",
    ).toBeEnabled({ timeout: timeoutMs });

    await this.management.clickPolicyManagementButton();
    await this.waitForSpinner();
    console.log("Policy Management open.");
  }

  // --- category creation ----------------------------------------------------

  // Creates a category section and a selectable sub-category under it.
  //
  // Delegates to the shared addPolicyCategoryWhenSettled(), which confirms each
  // add once the dropdown list has stopped scrolling. The plain
  // addPolicyCategory() fails on the sub-category confirm - the list clips the
  // row carrying the Add button, so the hit test resolves to the list and
  // Playwright reports "intercepts pointer events". See that method for the
  // measured detail.
  async addPolicyCategory(section, subCategory) {
    await this.policies.addPolicyCategoryWhenSettled(section, subCategory);
  }
}

module.exports = PolicyManagementPoliciesEntityLeader;
