const SecureReassessment = require("../../Secure/Collection/Reassessment");

// Beacher (application 2) base URL.
const BEACHER_BASE_URL =
  process.env.BASE_URL_BEACHER || "https://secure-cyber-in-site.cygovdev.com";

// Beacher Reassessment. Captured live against the Beacher domain.
//
// The trigger is the same markup as Secure's (.start-reassessment
// button.reassessment-btn inside framework edit mode, alongside Start Fresh and
// Import Assessment), but three things differ:
//  - there is no entity picker and no framework card to select first;
//  - the confirmation modal does not use Secure's .archive-footer wrapper, and
//    it opens on top of the edit-framework modal, so the confirm button has to
//    be scoped to the modal window carrying the Start Reassessment header;
//  - the card does not render a "reassessment" name label the way Secure's
//    does - it grows a third progress bar (Collection / Remediation /
//    Reassessment), which is what proves the reassessment started.
class Reassessment extends SecureReassessment {
  constructor(page) {
    super(page);

    this.selectors = {
      ...this.selectors,
      applicationSidemenu:
        "//button[contains(@class,'sub-menu-item') and .//span[normalize-space(text())='Application']]",
      beacherArchiveSubMenuItem:
        "//button[contains(@class,'sub-menu-sub-item') and .//span[normalize-space(text())='Archive']]",
      collectionOverviewHeading:
        "//span[contains(@class,'first-party-overview-text') and normalize-space(text())='Collection Overview']",
      beacherEditCollectionFrameworkButton:
        "//div[contains(@class,'edit-collection-framework-btn-cont') and @aria-label='Edit collection frameworks']",
      // Confirmation modal, keyed on its own header so the edit-framework modal
      // underneath cannot be matched instead.
      startReassessmentModal: "ngb-modal-window:has-text('Start Reassessment')",
      startReassessmentModalConfirmBtn:
        "ngb-modal-window div.body-back[aria-label='Start Reassessment']",
      // Framework card and its progress bars.
      frameworkCard: ".entity-card-box",
      frameworkCardScore: ".entity-card-box span.total-score",
      progressBarNames: ".entity-card-box .progress-bar-details .name",
      progressBarRows: ".entity-card-box .progress-bar-details",
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

  // --- Navigation ----------------------------------------------------------

  async clickApplicationSidemenu() {
    console.log("Opening the 'Application' side-menu...");
    await this.click(this.selectors.applicationSidemenu);
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  async waitForCollectionOverview(timeoutMs = 120000) {
    console.log("Waiting for the Collection Overview screen...");
    await this.page.waitForSelector(this.selectors.collectionOverviewHeading, {
      state: "visible",
      timeout: timeoutMs,
    });
  }

  // The Start Reassessment trigger only exists once edit mode is open.
  async clickBeacherEditCollectionFrameworkButton(timeoutMs = 60000) {
    console.log("Opening the collection framework edit mode...");
    const btn = this.page.locator(
      this.selectors.beacherEditCollectionFrameworkButton,
    );
    await btn.waitFor({ state: "visible", timeout: timeoutMs });
    await btn.first().click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(2000);
  }

  // --- Card metrics --------------------------------------------------------

  // Reads the framework card's score and each progress bar as
  // { score, collection, remediation, reassessment }. Values are the raw UI
  // strings so they can be compared against the archived card verbatim.
  async getFrameworkCardMetrics(timeoutMs = 60000) {
    const card = this.page.locator(this.selectors.frameworkCard).first();
    await card.waitFor({ state: "visible", timeout: timeoutMs });

    const metrics = await card.evaluate((node) => {
      const score = node.querySelector("span.total-score");
      const bars = {};
      node.querySelectorAll(".progress-bar-details").forEach((row) => {
        const name = row.querySelector(".name");
        const value = row.querySelector(".value, .percentage, span:last-child");
        if (name) {
          bars[(name.innerText || "").trim().toLowerCase()] = value
            ? (value.innerText || "").trim()
            : null;
        }
      });
      return {
        score: score ? (score.innerText || "").trim() : null,
        bars,
      };
    });

    const result = {
      score: metrics.score,
      collection: metrics.bars.collection ?? null,
      remediation: metrics.bars.remediation ?? null,
      reassessment: metrics.bars.reassessment ?? null,
    };
    console.log("Framework card metrics:", JSON.stringify(result));
    return result;
  }

  // --- Start Reassessment --------------------------------------------------

  // The button only renders once the framework's initial assessment is ready on
  // the backend; the edit panel does not live-refresh, so the caller passes a
  // reopen function the way Secure's clickStartReassessmentWhenReady does.
  async isStartReassessmentAvailable(timeoutMs = 10000) {
    const btn = this.page.locator(this.selectors.startReassessmentBtn);
    return await btn
      .first()
      .isVisible({ timeout: timeoutMs })
      .catch(() => false);
  }

  async confirmStartReassessment(timeoutMs = 60000) {
    console.log("Confirming Start Reassessment...");
    await this.page.waitForSelector(this.selectors.startReassessmentModal, {
      state: "visible",
      timeout: timeoutMs,
    });
    const confirm = this.page
      .locator(this.selectors.startReassessmentModalConfirmBtn)
      .first();
    await confirm.waitFor({ state: "visible", timeout: timeoutMs });
    await confirm.click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(5000);
  }

  // Beacher equivalent of the Secure verifyReassessmentLabelVisible(): the card
  // grows a third progress bar once the reassessment is running.
  async verifyReassessmentStarted(timeoutMs = 120000) {
    console.log("Verifying the card shows a Reassessment progress bar...");
    const deadline = Date.now() + timeoutMs;
    let names = [];

    while (Date.now() < deadline) {
      names = await this.page
        .locator(this.selectors.progressBarNames)
        .allInnerTexts()
        .catch(() => []);
      const normalized = names.map((name) => name.trim().toLowerCase());
      if (normalized.includes("reassessment")) {
        console.log(`Card progress bars: ${normalized.join(", ")}`);
        return true;
      }
      await this.page.waitForTimeout(3000);
      await this.page.reload({ waitUntil: "domcontentloaded" });
      await this.waitForSpinner();
      await this.page.waitForTimeout(3000);
    }

    throw new Error(
      `Expected the framework card to show a 'Reassessment' progress bar after starting one, but found: ${names.join(", ") || "no progress bars"}`,
    );
  }

  // Waits for the Reassessment progress bar to reach a given percentage. The
  // bar is what tracks the reassessment cycle; re-answering the framework drives
  // it to 100%.
  async verifyReassessmentPercentage(expected = "100%", timeoutMs = 180000) {
    console.log(`Waiting for the Reassessment bar to reach ${expected}...`);
    const deadline = Date.now() + timeoutMs;
    let actual = null;

    while (Date.now() < deadline) {
      const metrics = await this.getFrameworkCardMetrics();
      actual = metrics.reassessment;
      if (actual === expected) {
        console.log(`Reassessment bar reached ${actual}.`);
        return actual;
      }
      await this.page.waitForTimeout(3000);
      await this.page.reload({ waitUntil: "domcontentloaded" });
      await this.waitForSpinner();
      await this.page.waitForTimeout(3000);
    }

    throw new Error(
      `Expected the Reassessment bar to reach '${expected}', but it settled on '${actual}'`,
    );
  }

  // --- Archive -------------------------------------------------------------

  // Archive stays disabled until an assessment has actually been archived.
  // Starting a reassessment alone does not archive the previous one - unlike
  // Start Fresh, which archives immediately.
  async isArchiveEnabled() {
    const item = this.page
      .locator(this.selectors.beacherArchiveSubMenuItem)
      .first();
    if ((await item.count()) === 0) {
      return false;
    }
    const disabled = await item.evaluate((btn) => btn.disabled);
    console.log(`Archive sub-menu item disabled: ${disabled}`);
    return !disabled;
  }

  async clickBeacherArchiveSubMenuItem(timeoutMs = 60000) {
    console.log("Opening the Archive sub-menu item...");
    await this.click(this.selectors.applicationSidemenu);
    await this.page.waitForTimeout(1500);
    const item = this.page
      .locator(this.selectors.beacherArchiveSubMenuItem)
      .first();
    await item.waitFor({ state: "visible", timeout: timeoutMs });
    if (await item.evaluate((btn) => btn.disabled)) {
      throw new Error(
        "Expected the Archive sub-menu item to be enabled, but it is still disabled - nothing has been archived",
      );
    }
    await item.click();
    await this.waitForSpinner();
    await this.waitForLoad();
    await this.page.waitForTimeout(3000);
  }

  // Verifies the archived card kept the values the live card carried before the
  // reassessment was started.
  async verifyArchivedCardMetrics(expected, timeoutMs = 60000) {
    console.log(
      `Verifying the archived card kept: ${JSON.stringify(expected)}`,
    );
    const actual = await this.getFrameworkCardMetrics(timeoutMs);

    const mismatches = ["score", "collection", "remediation"]
      .filter((key) => expected[key] != null && actual[key] !== expected[key])
      .map(
        (key) => `${key}: expected '${expected[key]}', got '${actual[key]}'`,
      );

    if (mismatches.length > 0) {
      throw new Error(
        `Archived card does not match the pre-reassessment values - ${mismatches.join("; ")}`,
      );
    }
    console.log("Archived card matches the pre-reassessment values.");
  }
}

module.exports = Reassessment;
