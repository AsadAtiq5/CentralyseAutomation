const BasePage = require("../BasePage");
const { REMEDIATION_ENUMS } = require("../../../constant/enums");
const { findRandomIndex } = require("../../../helpers/common/helper");

// Beacher Remediation flow. The Beacher app reuses the same remediation Angular
// UI as Secure, but a Beacher entity is a single (wizard-created) entity, so
// there is no sub-entity filter step. Navigation to the remediation screen is
// done via the left side menu (not a direct URL).
class RemediationPage extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      // Left side-menu "remediation" item.
      remediationSideMenuButton:
        "//button[contains(@class,'sub-menu-item')][.//span[contains(@class,'menu-item-text') and normalize-space(text())='remediation']]",
      // Remediation screen.
      riskTasks: `//a[contains(@class,'nav-link') and contains(normalize-space(.), '${REMEDIATION_ENUMS.RISK_TASK}')]`,
      appliedFilter: "div.custom-filter-applied-counter",
      remediationTopSection: ".remediation-top",
      cardContainer: "cygov-security-control-card",
      cardLocator: "div.security-control-card",
      statusText: ".status-text",
      // Action buttons + modals.
      remediateModal: "cygov-remediate-modal",
      assignModal: "cygov-assign-to-modal",
      questionCard: "cygov-question-card-ui",
      assignUserSearch: "input#search-manager",
      userRow: ".user-row",
      // The user's display name inside an assign-modal row. Reading the row's
      // innerText instead yields the avatar initial, not the name.
      userRowName: "div.name",
      assignConfirm: "button.btn-confirm",
      // Toasts.
      remediationTaskUpdation:
        '#toast-container .toast-message:has-text("Remediation task has been updated successfully")',
      userAssigned:
        '#toast-container .toast-message:has-text("User Assigned Successfully!")',
      // The app toasts this instead of the success toast when the sampled task
      // is already assigned to the picked user.
      userAlreadyAssigned:
        '#toast-container .toast-message:has-text("User already assigned")',
      // Assigned-user avatar on a card - the initials rendered by the Angular
      // card component's getInitialOfNames().
      assignedUserInitials:
        ".assigned-users-list-container .assigned-user span",
    };
  }

  // Clicks the "remediation" item in the left side menu and waits for the
  // remediation screen to load.
  async clickRemediationSideMenu() {
    console.log("Opening the 'remediation' screen from the side menu...");
    await this.click(this.selectors.remediationSideMenuButton);
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  // Reads the number shown on the "Risk Tasks (N)" tab.
  async getRiskTasksCount() {
    await this.waitForLoad();
    await this.waitForSpinner();

    // The applied-filters counter renders when the task counts populate; wait
    // for it best-effort (it may be absent on a single-entity remediation).
    try {
      await this.page
        .locator(this.selectors.appliedFilter)
        .first()
        .waitFor({ state: "visible", timeout: 30000 });
    } catch (e) {
      console.log("ℹ Applied-filter counter not present; continuing.");
    }

    const riskTasksLocator = this.page.locator(this.selectors.riskTasks);
    await riskTasksLocator.waitFor({ state: "visible", timeout: 60000 });
    const text = (await riskTasksLocator.textContent())?.trim() ?? "";
    console.log("Risk Tasks tab text:", text);

    const match = text.match(/Risk Tasks\s*\((\d+)\)/);
    const count = match ? parseInt(match[1], 10) : 0;
    console.log(`Found ${count} risk task(s).`);
    return count;
  }

  // Selects a random task card and returns its inner card locator.
  async selectRandomCard() {
    await this.waitForLoad();
    await this.waitForSpinner();
    const cards = this.page.locator(this.selectors.cardContainer);
    const total = await cards.count();
    if (total === 0) {
      throw new Error("No remediation task cards found");
    }
    const index = findRandomIndex(total);
    const container = cards.nth(index);
    await container.waitFor({ state: "visible", timeout: 30000 });

    const card = container.locator(this.selectors.cardLocator);
    await card.waitFor({ state: "visible", timeout: 30000 });
    // Select the card via its checkbox label.
    await card.locator("label").click();
    return card;
  }

  // Locates the action button ("Remediate" / "Assign" / ...) by its label.
  async clickActionButton(action) {
    const actionButton = this.page.locator("div.task-actions button", {
      has: this.page.locator("div.action-text", { hasText: action }),
    });
    await actionButton.waitFor({ state: "visible", timeout: 10000 });
    await actionButton.click();
    console.log(`Clicked the "${action}" action button.`);
  }

  // Remediates a random risk task: answers the question "Yes" and saves.
  // Returns the status locator + the expected status text ("Remediated").
  async remediateTask() {
    const card = await this.selectRandomCard();
    await this.clickActionButton(REMEDIATION_ENUMS.REMEDIATE);

    const modal = this.page.locator(this.selectors.remediateModal);
    await modal.waitFor({ state: "visible", timeout: 30000 });

    const questionCard = this.page.locator(this.selectors.questionCard).first();
    await questionCard.waitFor({ state: "visible", timeout: 30000 });
    await questionCard
      .locator(".round-checkbox label", { hasText: "Yes" })
      .click();

    const footer = questionCard.locator(".footer-container");
    const saveBtn = footer.locator("cygov-button").filter({ hasText: "SAVE" });
    await saveBtn.waitFor({ state: "visible", timeout: 20000 });
    await saveBtn.click();

    await this.page.waitForSelector(this.selectors.remediationTaskUpdation, {
      state: "visible",
      timeout: 60000,
    });
    console.log("Task remediated successfully.");

    const statusTextLocator = card.locator(this.selectors.statusText);
    await statusTextLocator.waitFor({ state: "visible", timeout: 30000 });
    return { statusTextLocator, expectedText: "Remediated" };
  }

  // Assigns a random risk task to the first available user (the logged-in
  // Beacher admin on a freshly created single-entity). Returns the status
  // locator, expected status text ("Assigned") and the assigned user's name.
  async assignTask() {
    const card = await this.selectRandomCard();
    await this.clickActionButton(REMEDIATION_ENUMS.ASSIGN);

    const modal = this.page.locator(this.selectors.assignModal);
    await modal.waitFor({ state: "visible", timeout: 30000 });

    const userRows = modal.locator(this.selectors.userRow);
    await userRows.first().waitFor({ state: "visible", timeout: 30000 });

    // Capture the first user's display name (the admin) before selecting it.
    const firstRow = userRows.first();
    const assignedName = (
      await firstRow.locator(this.selectors.userRowName).first().innerText()
    ).trim();
    console.log(`Assigning the task to: ${assignedName}`);

    await firstRow.locator("label.target").click();

    const assignBtn = modal.locator(this.selectors.assignConfirm, {
      hasText: "Assign",
    });
    await assignBtn.click();

    await this.page.waitForSelector(this.selectors.userAssigned, {
      state: "visible",
      timeout: 60000,
    });
    console.log("Task assigned successfully.");

    const statusTextLocator = card.locator(this.selectors.statusText);
    await statusTextLocator.waitFor({ state: "visible", timeout: 30000 });
    return { statusTextLocator, expectedText: "Assigned", assignedName };
  }

  // Mirrors getInitialOfNames() in the Angular security-control-card component:
  // "Asad Atiq" -> "A.A", "Admin" -> "A". Kept here so the expected avatar text
  // is derived the same way the app derives it.
  buildUserInitials(name) {
    const parts = (name ?? "").trim().split(/\s+/);
    const first = parts[0] ? parts[0].charAt(0).toUpperCase() : "";
    const last = parts[1] ? parts[1].charAt(0).toUpperCase() : "";
    return last ? `${first}.${last}` : first;
  }

  // Assigns a random risk task to the first user in the assign modal and returns
  // the locator + expected text for the assigned-user avatar on that card.
  //
  // Supersedes assignTask(): assigning does NOT change a task's status. The app
  // stores only OPEN | REMEDIATED | IGNORED | ACCEPTED (TaskStatusEnum) and
  // onActionAssignTo() never writes status, so ".status-text" stays "Open" and
  // an assertion for "Assigned" can never pass. Assignment surfaces instead as
  // an initials avatar in ".assigned-user", pushed onto the card live via the
  // remediation service's userMapperChanged subscription (no reload needed).
  async assignTaskAndGetAssignee() {
    const card = await this.selectRandomCard();
    await this.clickActionButton(REMEDIATION_ENUMS.ASSIGN);

    const modal = this.page.locator(this.selectors.assignModal);
    await modal.waitFor({ state: "visible", timeout: 30000 });

    const userRows = modal.locator(this.selectors.userRow);
    await userRows.first().waitFor({ state: "visible", timeout: 30000 });

    // Capture the first user's display name (the admin) before selecting it.
    const firstRow = userRows.first();
    const assignedName = (
      await firstRow.locator(this.selectors.userRowName).first().innerText()
    ).trim();
    console.log(`Assigning the task to: ${assignedName}`);

    await firstRow.locator("label.target").click();

    const assignBtn = modal.locator(this.selectors.assignConfirm, {
      hasText: "Assign",
    });
    await assignBtn.click();

    // Accept either toast: a task that already carries this assignee produces
    // "User already assigned!" rather than the success toast, and the avatar is
    // present either way.
    const swallow = (promise) => promise.catch(() => null);
    await Promise.any([
      swallow(
        this.page.waitForSelector(this.selectors.userAssigned, {
          state: "visible",
          timeout: 60000,
        }),
      ),
      swallow(
        this.page.waitForSelector(this.selectors.userAlreadyAssigned, {
          state: "visible",
          timeout: 60000,
        }),
      ),
    ]);
    console.log("Assignment submitted.");

    const expectedInitials = this.buildUserInitials(assignedName);
    const assigneeLocator = card
      .locator(this.selectors.assignedUserInitials)
      .first();
    await assigneeLocator.waitFor({ state: "visible", timeout: 60000 });
    return { assigneeLocator, expectedInitials, assignedName };
  }
}

module.exports = RemediationPage;
