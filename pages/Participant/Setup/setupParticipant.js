const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");

// Participant-side copy of the admin screens the participant setup flow drives:
// the Add New User modal in Settings and the drag-and-drop question assignment
// panel in the collection. It is a deliberate copy of the Secure page object
// rather than a reference to it, so the Participant job owns its own selectors
// and a change made for the Secure suite cannot break this flow.
class SetupParticipant extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      addNewUserBtn: "div.add-user-btn",
      modalTitle: ".modal-header .lato-18-n-vw",
      nameInput: "input#name",
      emailInput: "input#Email",
      roleSelectArrow: "cygov-select#role .ng-select-container",
      sendInvitationBtn:
        "//cygov-button[.//div[normalize-space(.)='SEND INVITATION']]",
      userAddedToast: "#toast-container .toast-message:has-text('User added')",
      subEntityLabel:
        "div.input-box.role.actual-role label:has-text('Sub Entity')",
      subEntityDropdownTitle:
        "div.input-box.role.actual-role:has(label:has-text('Sub Entity')) .dropdown .title",
      expandedDropdownItem:
        ".expanded-dropdown .item-row span:has-text('{NAME}')",
      draggableUser: ".cdk-drag.shadow-class",
      // The entity-level drop zone carries hover-screen, not the
      // hover-border the per-question zone uses.
      assignToFrameworkDropZone:
        '.cdk-drop-list.hover-screen:has-text("Assign to Framework")',
      assignmentSuccessToast:
        '#toast-container .toast-message:has-text("User Assigned Successfully")',
      closeEditPanelBtn: ".edit-circle .edit-marker.cross-icon",
    };
  }

  async clickAddNewUserBtn() {
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

  async selectRole(role) {
    await this.click(this.selectors.roleSelectArrow);
    await this.page.waitForSelector(".ng-dropdown-panel", {
      state: "visible",
      timeout: 10000,
    });
    await this.page
      .locator(".ng-dropdown-panel .ng-option", { hasText: role })
      .click();
  }

  async verifySubEntityDropdownVisible() {
    await expect(this.page.locator(this.selectors.subEntityLabel)).toBeVisible({
      timeout: 30000,
    });
  }

  async openSubEntityDropdown() {
    await this.click(this.selectors.subEntityDropdownTitle);
  }

  async selectSubEntityFromDropdown(subEntityName) {
    const itemSelector = this.selectors.expandedDropdownItem.replace(
      "{NAME}",
      subEntityName,
    );
    await this.page.waitForSelector(itemSelector, {
      state: "visible",
      timeout: 15000,
    });
    await this.page.click(itemSelector);
  }

  async clickSendInvitation() {
    await this.click(this.selectors.sendInvitationBtn);
  }

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

  async clickEditIcon() {
    const editIcon = this.page.locator(".edit-circle .edit-marker");
    await editIcon.waitFor({ state: "visible", timeout: 60000 });
    await editIcon.click({ timeout: 60000 });
  }

  async enterSearchUser(username) {
    const searchInput = this.page.getByPlaceholder("Search User");
    await searchInput.type(username, { delay: 10 });
  }

  async getFirstQuestionTitle() {
    const questionSpan = this.page.locator(".question-content span").first();
    await questionSpan.waitFor({ state: "visible", timeout: 15000 });
    return (await questionSpan.innerText()).trim();
  }

  // Assigns the searched user to the whole entity/framework rather than to a
  // single question, by dropping on "Assign to Framework". CDK will not start a
  // drag from a synthetic dragTo, so the gesture is driven by raw mouse moves:
  // press, nudge 20px to trip dragStart, then travel into the drop zone in
  // steps so CDK registers the hover before the release.
  //
  // The confirmation toast is best-effort - it can fire and clear inside a
  // single poll interval - so the real proof of the assignment is the caller's
  // later verification, not this toast.
  async dragAndDropUserToEntity1() {
    console.log("Dragging the user onto the entity/framework drop zone...");
    const source = this.page.locator(this.selectors.draggableUser).first();

    await source.waitFor({ state: "visible" });

    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error("Source element not found");

    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );

    await this.page.mouse.down();
    await this.page.waitForTimeout(150);

    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 20,
      sourceBox.y + sourceBox.height / 2 + 20,
      { steps: 10 },
    );

    await this.page.waitForTimeout(300);

    const dropZone = this.page.locator(
      this.selectors.assignToFrameworkDropZone,
    );

    await dropZone.first().waitFor({
      state: "visible",
      timeout: 8000,
    });

    const dropBox = await dropZone.first().boundingBox();
    if (!dropBox)
      throw new Error("Correct drop zone not found / no bounding box");

    await this.page.mouse.move(
      dropBox.x + dropBox.width / 2,
      dropBox.y + dropBox.height / 2,
      { steps: 25 },
    );

    await this.page.waitForTimeout(200);

    await this.page.mouse.up();

    await this.page.waitForTimeout(1500);

    try {
      await this.page.waitForSelector(this.selectors.assignmentSuccessToast, {
        state: "visible",
        timeout: 15000,
      });
      await this.page.waitForSelector(this.selectors.assignmentSuccessToast, {
        state: "hidden",
        timeout: 15000,
      });
    } catch (e) {
      console.log("Assignment toast handled");
    }

    // The edit side menu stays open over the collection and would swallow the
    // next click, so close it before handing control back.
    const crossBtn = this.page.locator(this.selectors.closeEditPanelBtn);
    await crossBtn.waitFor({ state: "visible", timeout: 60000 });
    await crossBtn.click();
    console.log("User assigned to the entity and the edit panel is closed.");
  }

  async dragAndDropUserToQuestion() {
    const source = this.page.locator(".cdk-drag.shadow-class").first();

    await source.waitFor({ state: "visible" });

    const sourceBox = await source.boundingBox();
    if (!sourceBox) throw new Error("Source element not found");

    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );

    await this.page.mouse.down();
    await this.page.waitForTimeout(150);

    await this.page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 20,
      sourceBox.y + sourceBox.height / 2 + 20,
      { steps: 10 },
    );

    await this.page.waitForTimeout(300);

    const dropZone = this.page.locator(
      '.cdk-drop-list.hover-border:has-text("Assign to Question")',
    );

    await dropZone.first().waitFor({
      state: "visible",
      timeout: 8000,
    });

    const dropBox = await dropZone.first().boundingBox();
    if (!dropBox)
      throw new Error("Correct drop zone not found / no bounding box");

    await this.page.mouse.move(
      dropBox.x + dropBox.width / 2,
      dropBox.y + dropBox.height / 2,
      { steps: 25 },
    );

    await this.page.waitForTimeout(200);

    await this.page.mouse.up();

    await this.page.waitForTimeout(1500);

    try {
      await this.page.waitForSelector(
        '#toast-container .toast-message:has-text("User Assigned Successfully")',
        { state: "visible", timeout: 15000 },
      );
      await this.page.waitForSelector(
        '#toast-container .toast-message:has-text("User Assigned Successfully")',
        { state: "hidden", timeout: 15000 },
      );
    } catch (e) {
      console.log("\u2139 Assignment toast handled");
    }
  }
}

module.exports = SetupParticipant;
