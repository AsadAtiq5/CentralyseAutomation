const SecureTable = require("../../Secure/Controls/Table");

// Beacher (application 2) base URL.
const BEACHER_BASE_URL =
  process.env.BASE_URL_BEACHER || "https://secure-cyber-in-site.cygovdev.com";

// Beacher Controls Table. Captured live against the Beacher domain: the screen
// is the same shared break-down-list component as Secure's, and every selector
// the Secure page object uses resolves identically here - table.risk-tbl rows,
// the edit icon, the Dynamic Labels panel (.dlsp-container), the td.editMode
// drop cells, the save button and the "Assign To All The Controls" area. Only
// navigation differs, so that is all this subclass overrides.
class Table extends SecureTable {
  constructor(page) {
    super(page);

    this.selectors = {
      ...this.selectors,
      // In Beacher the collection screen is reached through "Application"
      // (same component as Secure's "collection"), used by the tag-in-collection
      // verification.
      applicationSidemenu:
        "//button[contains(@class,'sub-menu-item') and .//span[normalize-space(text())='Application']]",
    };
  }

  // Beacher page objects must resolve relative paths against the Beacher domain.
  // Table extends the Secure page object rather than Beacher/BasePage, so the
  // override is repeated here (same shape as Beacher/Application/ArtifactRegistry).
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

  // The table renders 300+ rows, so waiting on the container alone can pass
  // before a single row exists. Wait for the rows themselves.
  async waitForControlsTableLoaded(timeoutMs = 120000) {
    console.log("Waiting for the controls table rows to render...");
    await this.waitForSpinner();
    await this.page.waitForSelector(this.selectors.tableRows, {
      state: "visible",
      timeout: timeoutMs,
    });
    const count = await this.page.locator(this.selectors.tableRows).count();
    console.log(`Controls table rendered ${count} row(s).`);
    return count;
  }

  // Beacher equivalent of the Secure openCollection() flow: the side-menu entry
  // is labelled "Application".
  async clickApplicationSidemenu() {
    console.log("Opening the 'Application' side-menu...");
    await this.click(this.selectors.applicationSidemenu);
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  // Confirms a freshly created label exists in the Dynamic Labels panel.
  // The inherited verifyTagInPanel() looks for span.inner-tag, which is the tag
  // chip rendered inside a table row - the panel itself renders
  // .dlsp-label-item / .dlsp-label-text, so that check never matches here.
  async verifyTagInLabelsPanel(tagName) {
    console.log(`Verifying the label '${tagName}' is in the labels panel...`);
    const label = this.page
      .locator(this.selectors.tagLabelItem)
      .filter({ hasText: tagName });
    await label.first().waitFor({ state: "visible", timeout: 30000 });
    const count = await label.count();
    if (count === 0) {
      throw new Error(
        `Expected the label '${tagName}' to be listed in the labels panel, but it was not found`,
      );
    }
  }

  // Beacher equivalent of the Secure verifyTagInAllQuestionsSettings().
  //
  // Secure verifies an assign-to-all by opening each question's Settings panel
  // in the collection, but the Beacher collection renders no per-question
  // settings icon at all, so that check has nothing to click. The table itself
  // carries the same evidence - every row's Dynamic Labels cell - and reading it
  // covers all rows at once instead of one modal at a time.
  async verifyTagOnAllTableRows(tagName) {
    console.log(`Verifying the label '${tagName}' is on every table row...`);
    await this.waitForControlsTableLoaded();

    const result = await this.page.evaluate(
      ({ tagName, rowSelector }) => {
        const rows = Array.from(document.querySelectorAll(rowSelector));
        const missing = [];
        rows.forEach((row, index) => {
          if (!(row.innerText || "").includes(tagName)) {
            missing.push(index + 1);
          }
        });
        return {
          total: rows.length,
          missing: missing.slice(0, 10),
          missingCount: missing.length,
        };
      },
      { tagName, rowSelector: this.selectors.tableRows },
    );

    if (result.total === 0) {
      throw new Error(
        "Expected the controls table to have rows to verify, but found none",
      );
    }
    if (result.missingCount > 0) {
      throw new Error(
        `Expected the label '${tagName}' on all ${result.total} rows, but ${result.missingCount} are missing it (rows: ${result.missing.join(", ")})`,
      );
    }
    console.log(`Label '${tagName}' present on all ${result.total} row(s).`);
    return result.total;
  }
}

module.exports = Table;
