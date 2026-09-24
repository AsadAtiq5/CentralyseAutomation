const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");

// Entity-Leader-side copy of the admin screens the setup flow drives: the Add
// New User modal in Settings, and the upperdeck the invited leader is dropped
// on. It is a deliberate copy of pages/Secure/Settings/AddEntityLeader rather
// than a reference to it, so the EntityLeader job owns its own selectors and a
// change made for the Secure suite cannot break this flow - the same split the
// SubEntityLeader job uses.
//
// What differs from the SubEntityLeader setup: this role is scoped to the whole
// client rather than to one sub-entity, so the modal shows no Sub Entity
// dropdown and there is nothing to assign. The landing screen differs too - an
// entity leader is routed to /first-party/<id>/upperdeck, not /multi-entity.
class SetupEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      addNewUserBtn: "div.add-user-btn",
      modalTitle: ".modal-header .lato-18-n-vw",
      nameInput: "input#name",
      emailInput: "input#Email",
      roleSelectArrow: "cygov-select#role .ng-select-container",
      // DO NOT USE - kept only so nothing referencing the key breaks.
      // ":has-text()" is a SUBSTRING match, so 'entity leader' also matches
      // "Super Entity Leader" and "Sub-Entity Leader". The panel lists Super
      // Entity Leader first, so this selected the wrong role and the invitation
      // went out as a Super Entity Leader. Use roleOptionList + an anchored
      // regex instead (see selectRole).
      roleOption: ".ng-dropdown-panel .ng-option-label:has-text('{ROLE}')",
      // All role options in the open panel, filtered to an exact match in
      // selectRole.
      roleOptionList: ".ng-dropdown-panel .ng-option-label",
      sendInvitationBtn:
        "//cygov-button[.//div[normalize-space(.)='SEND INVITATION']]",
      userAddedToast: "#toast-container .toast-message:has-text('User added')",
      // Client name label on the upperdeck the leader lands on.
      entityNameLabel: "span.lato-20-n-vw.entity-name-ellipsis",
    };
  }

  async clickAddNewUserBtn() {
    console.log("Opening the Add New User modal...");
    await this.click(this.selectors.addNewUserBtn);
  }

  async verifyAddNewUserModal() {
    await this.expectToHaveText(
      this.selectors.modalTitle,
      "ADD NEW USER",
      30000,
    );
  }

  async fillName(name) {
    await this.fill(this.selectors.nameInput, name);
  }

  async fillEmail(email) {
    await this.fill(this.selectors.emailInput, email);
  }

  // Selects a role by EXACT label, case-insensitively.
  //
  // The role list contains overlapping labels - "Entity Leader",
  // "Super Entity Leader" and "Sub-Entity Leader" - so a substring match picks
  // whichever comes first in the panel (Super Entity Leader), and the invitation
  // silently goes out with the wrong role. The panel pads its labels with
  // whitespace and renders its own casing, hence the anchored, case-insensitive
  // regex rather than :text-is().
  async selectRole(role) {
    console.log(`Selecting the role: ${role}`);
    await this.click(this.selectors.roleSelectArrow);
    await this.page.waitForSelector(".ng-dropdown-panel", {
      state: "visible",
      timeout: 10000,
    });

    const escaped = role.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const option = this.page
      .locator(this.selectors.roleOptionList)
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`, "i") });

    await option.first().waitFor({ state: "visible", timeout: 10000 });

    // A label that still matches more than once means the role list changed -
    // fail with what was on screen rather than clicking the wrong one.
    const matches = await option.count();
    if (matches !== 1) {
      const available = await this.page
        .locator(this.selectors.roleOptionList)
        .allInnerTexts();
      throw new Error(
        `Expected exactly one '${role}' option in the role dropdown, but matched ${matches}. Options on screen: ${available
          .map((text) => text.trim())
          .join(", ")}`,
      );
    }

    await option.first().click();
    console.log(`Role selected: ${role}`);
  }

  async clickSendInvitation() {
    console.log("Sending the invitation...");
    await this.click(this.selectors.sendInvitationBtn);
  }

  // Waits for the toast to appear AND to clear. Waiting for it to go matters:
  // the toast overlays the top of the screen, and the next step in the flow
  // closes the browser context out from under it.
  async waitForUserAddedToast(timeout = 60000) {
    await this.page.waitForSelector(this.selectors.userAddedToast, {
      state: "visible",
      timeout,
    });
    await this.page.waitForSelector(this.selectors.userAddedToast, {
      state: "hidden",
      timeout,
    });
  }

  // Asserts the upperdeck is showing the client this leader was invited into.
  // This is the EntityLeader equivalent of the SubEntityLeader setup's assigned
  // sub-entity card check: proof the invite landed on the right scope, not just
  // that a login succeeded.
  async verifyClientNameDisplayed(clientName) {
    console.log(`Verifying the client name on the upperdeck: ${clientName}`);
    const label = this.page.locator(this.selectors.entityNameLabel);
    await label.waitFor({ state: "visible", timeout: 60000 });
    await expect(label).toHaveText(clientName);
  }
}

module.exports = SetupEntityLeader;
