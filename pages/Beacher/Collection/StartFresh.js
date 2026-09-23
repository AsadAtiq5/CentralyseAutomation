const SecureStartFresh = require("../../Secure/Collection/StartFresh");

// Beacher (application 2) base URL.
const BEACHER_BASE_URL =
  process.env.BASE_URL_BEACHER || "https://secure-cyber-in-site.cygovdev.com";

// Beacher Start Fresh. Captured live: the Start Fresh trigger (.start-fresh
// button) and the confirmation modal's footer button are the same markup as
// Secure's, so those behaviours are inherited. What differs is how the screen is
// reached - Beacher has no Multi Entity + entity picker, the collection is the
// "Application" side-menu item, and Archive is a sub-item under it.
class StartFresh extends SecureStartFresh {
  constructor(page) {
    super(page);

    this.selectors = {
      ...this.selectors,
      applicationSidemenu:
        "//button[contains(@class,'sub-menu-item') and .//span[normalize-space(text())='Application']]",
      archiveSubMenuItem:
        "//button[contains(@class,'sub-menu-sub-item') and .//span[normalize-space(text())='Archive']]",
      // Edit icon beside the "Collection Overview" heading - the Start Fresh
      // trigger only renders once this edit mode is open.
      editCollectionFrameworkButton:
        "//div[contains(@class,'edit-collection-framework-btn-cont') and @aria-label='Edit collection frameworks']",
      // Framework card on the collection overview and its score.
      frameworkCard: ".entity-card-box",
      frameworkCardScore: ".entity-card-box span.total-score",
      // The Start Fresh confirmation modal, keyed on its own header so it is not
      // confused with the edit-framework modal it opens on top of.
      startFreshModal: "ngb-modal-window:has-text('Start Fresh')",
      startFreshModalConfirmBtn:
        "ngb-modal-window div.body-back[aria-label='Start Fresh']",
    };
  }

  // Beacher page objects must resolve relative paths against the Beacher domain.
  async goto(path = "", options = {}) {
    const baseURL = BEACHER_BASE_URL.replace(/\/$/, "");
    const url = path
      ? `${baseURL}${path.startsWith("/") ? path : "/" + path}`
      : baseURL;

    console.log(`Navigating to: ${url}`);
    try {
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: options.timeout || 30000,
        ...options,
      });
      console.log(`Successfully navigated to: ${url}`);
    } catch (error) {
      if (error.message.includes("ERR_NAME_NOT_RESOLVED")) {
        throw new Error(
          `DNS resolution failed for ${url}. Check network connectivity, VPN, or domain accessibility.`,
        );
      }
      throw error;
    }
  }

  // Beacher's collection screen: the side-menu entry is labelled "Application".
  async clickApplicationSidemenu() {
    console.log("Opening the 'Application' side-menu...");
    await this.click(this.selectors.applicationSidemenu);
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  // Archive is a sub-item under Application on Beacher, not a top-level entry.
  async clickArchiveSubMenuItem() {
    console.log("Opening the Archive sub-menu item...");
    await this.click(this.selectors.applicationSidemenu);
    await this.page.waitForTimeout(1000);
    await this.click(this.selectors.archiveSubMenuItem);
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  // Reads the framework card's score from the collection overview, which is the
  // value the archived card must still carry after the reset.
  async getFrameworkCardScore(timeoutMs = 60000) {
    const score = this.page.locator(this.selectors.frameworkCardScore).first();
    await score.waitFor({ state: "visible", timeout: timeoutMs });
    const value = (await score.innerText()).trim();
    console.log(`Framework card score: ${value}`);
    return value;
  }

  // The Start Fresh trigger only exists once the framework edit mode is open.
  async clickEditCollectionFrameworkButton(timeoutMs = 60000) {
    console.log("Opening the collection framework edit mode...");
    const btn = this.page.locator(this.selectors.editCollectionFrameworkButton);
    await btn.waitFor({ state: "visible", timeout: timeoutMs });
    await btn.first().click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(2000);
  }

  // Beacher confirmation modal. The inherited clickStartFreshConfirmButton()
  // scopes to .modal-content-footer .archive-footer, which the Beacher modal
  // does not use - this scopes to the modal window carrying the Start Fresh
  // header instead, so it cannot pick up the edit-framework modal underneath.
  async confirmStartFresh(timeoutMs = 60000) {
    console.log("Confirming Start Fresh...");
    await this.page.waitForSelector(this.selectors.startFreshModal, {
      state: "visible",
      timeout: timeoutMs,
    });
    const confirm = this.page
      .locator(this.selectors.startFreshModalConfirmBtn)
      .first();
    await confirm.waitFor({ state: "visible", timeout: timeoutMs });
    await confirm.click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(3000);
  }

  // Counts the answers currently selected on the visible question page. The
  // spec uses this to prove there was something for Start Fresh to clear -
  // otherwise "all answers removed" passes trivially on an untouched client.
  async getCheckedAnswerCount() {
    const count = await this.page
      .locator(this.selectors.selectedAnswer)
      .count();
    console.log(`Checked answers on this page: ${count}`);
    return count;
  }

  // Verifies the framework was archived and still carries its pre-reset score.
  async verifyArchivedFrameworkScore(expectedScore, timeoutMs = 60000) {
    console.log(`Verifying the archived card still scores ${expectedScore}...`);
    const card = this.page.locator(this.selectors.frameworkCard).first();
    await card.waitFor({ state: "visible", timeout: timeoutMs });
    const score = card.locator("span.total-score").first();
    await score.waitFor({ state: "visible", timeout: timeoutMs });
    const actual = (await score.innerText()).trim();
    const expected = (expectedScore ?? "").toString().trim();
    if (actual !== expected) {
      throw new Error(
        `Expected the archived framework score to be '${expected}', but got '${actual}'`,
      );
    }
    console.log(`Archived framework score matches: ${actual}`);
  }
}

module.exports = StartFresh;
