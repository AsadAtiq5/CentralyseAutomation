const path = require("path");
const SecureImportAssessment = require("../../Secure/ImportAssessment/ImportAssessment");

// Beacher (application 2) base URL.
const BEACHER_BASE_URL =
  process.env.BASE_URL_BEACHER || "https://secure-cyber-in-site.cygovdev.com";

// Beacher Import Assessment. Captured live against the Beacher domain.
//
// The modal itself is the same component as Secure's (cygov-import-collection-modal
// with NEXT / ADD / success-OK), but Beacher reaches it differently: there is no
// entity picker and no framework card to select first - the Import Assessment
// button lives inside the collection framework edit mode. The selectors below
// are the ones already proven by the Beacher lock-assessment spec.
class ImportAssessment extends SecureImportAssessment {
  constructor(page) {
    super(page);

    this.selectors = {
      ...this.selectors,
      applicationSidemenu:
        "//button[contains(@class,'sub-menu-item') and .//span[normalize-space(text())='Application']]",
      // "Collection Overview" heading on the application/questions screen.
      collectionOverviewHeading:
        "//span[contains(@class,'first-party-overview-text') and normalize-space(text())='Collection Overview']",
      // Edit icon beside that heading - the Import Assessment button only
      // renders once this edit mode is open.
      editCollectionFrameworkButton:
        "//div[contains(@class,'edit-collection-framework-btn-cont') and @aria-label='Edit collection frameworks']",
      beacherImportAssessmentButton:
        "//button[contains(@class,'reassessment-btn')]//span[normalize-space(text())='Import Assessment']",
      beacherModalNextButton:
        "//div[contains(@class,'modal-content-footer')]//div[contains(@class,'body-back') and @aria-label='NEXT']",
      beacherUploadFileInput:
        "//cygov-upload-file//input[@type='file' and @id='file']",
      beacherModalAddButton:
        "//div[contains(@class,'modal-content-footer')]//div[contains(@class,'body-back') and @aria-label='ADD']",
      beacherImportSuccessMessage:
        "//span[contains(@class,'text-center') and contains(normalize-space(.),'The Assessment has been imported successfully')]",
      beacherImportSuccessOkButton:
        "//div[contains(@class,'modal-content-footer')]//div[contains(@class,'body-back') and @aria-label='OK']",
      // Preview table inside the import modal, before ADD is pressed.
      importPreviewRows: "cygov-import-collection-modal table tbody tr",
      // Framework card score on the collection overview.
      frameworkCardScore: ".entity-card-box span.total-score",
      // Question paging on the collection screen.
      nextSetButton: "#next-prev .btn-next",
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

  // The Import Assessment button only exists once framework edit mode is open.
  async clickEditCollectionFrameworkButton(timeoutMs = 60000) {
    console.log("Opening the collection framework edit mode...");
    const btn = this.page.locator(this.selectors.editCollectionFrameworkButton);
    await btn.waitFor({ state: "visible", timeout: timeoutMs });
    await btn.first().click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(2000);
  }

  // --- Import modal --------------------------------------------------------

  async clickBeacherImportAssessmentButton(timeoutMs = 60000) {
    console.log("Clicking 'Import Assessment'...");
    const btn = this.page.locator(this.selectors.beacherImportAssessmentButton);
    await btn.waitFor({ state: "visible", timeout: timeoutMs });
    await btn.first().click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(1500);
  }

  async clickBeacherNextButton(timeoutMs = 60000) {
    console.log("Clicking 'NEXT' in the Import Assessment modal...");
    const btn = this.page.locator(this.selectors.beacherModalNextButton);
    await btn.waitFor({ state: "visible", timeout: timeoutMs });
    await btn.first().click();
    await this.page.waitForTimeout(1500);
  }

  async uploadBeacherAssessmentFile(filePath) {
    console.log(`Uploading assessment file: ${filePath}`);
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);
    await this.page.setInputFiles(
      this.selectors.beacherUploadFileInput,
      absolutePath,
    );
    await this.waitForSpinner();
    // The ADD button becomes actionable once the file has been parsed.
    await this.page.waitForSelector(this.selectors.beacherModalAddButton, {
      state: "visible",
      timeout: 120000,
    });
    await this.page.waitForTimeout(2000);
  }

  // The modal previews every mapped answer before ADD is pressed; the row count
  // is the clearest evidence the file was parsed rather than silently ignored.
  async getImportPreviewRowCount() {
    const count = await this.page
      .locator(this.selectors.importPreviewRows)
      .count();
    console.log(`Import preview rows: ${count}`);
    return count;
  }

  // Secure's IA1-02 asserts a red error border on rows the import cannot map.
  // Kept here so the same check is available on Beacher once a fixture with
  // unmappable answers exists - the current template imports cleanly.
  async getImportErrorBorderCount() {
    const count = await this.page
      .locator(this.selectors.importErrorBorderCell)
      .count();
    console.log(`Import rows flagged with an error border: ${count}`);
    return count;
  }

  async clickBeacherAddButton(timeoutMs = 60000) {
    console.log("Clicking 'ADD' in the Import Assessment modal...");
    const btn = this.page.locator(this.selectors.beacherModalAddButton);
    await btn.waitFor({ state: "visible", timeout: timeoutMs });
    await btn.first().click();
    await this.waitForSpinner();
  }

  async verifyBeacherImportSuccessModal(timeoutMs = 180000) {
    console.log("Waiting for the import success confirmation...");
    await this.page.waitForSelector(
      this.selectors.beacherImportSuccessMessage,
      { state: "visible", timeout: timeoutMs },
    );
  }

  async clickBeacherImportSuccessOk(timeoutMs = 60000) {
    console.log("Clicking 'OK' on the import success modal...");
    const btn = this.page.locator(this.selectors.beacherImportSuccessOkButton);
    await btn.waitFor({ state: "visible", timeout: timeoutMs });
    await btn.first().click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(3000);
  }

  // Full import in one call, mirroring the order the modal enforces.
  async importAssessmentFile(filePath) {
    await this.clickEditCollectionFrameworkButton();
    await this.clickBeacherImportAssessmentButton();
    await this.clickBeacherNextButton();
    await this.uploadBeacherAssessmentFile(filePath);
  }

  // --- Verification --------------------------------------------------------

  async getFrameworkCardScore(timeoutMs = 60000) {
    const score = this.page.locator(this.selectors.frameworkCardScore).first();
    await score.waitFor({ state: "visible", timeout: timeoutMs });
    const value = (await score.innerText()).trim();
    console.log(`Framework card score: ${value}`);
    return value;
  }

  async verifyFrameworkCardScore(expectedScore, timeoutMs = 60000) {
    const actual = await this.getFrameworkCardScore(timeoutMs);
    const expected = (expectedScore ?? "").toString().trim();
    if (actual !== expected) {
      throw new Error(
        `Expected the framework score to be '${expected}' after the import, but got '${actual}'`,
      );
    }
    console.log(`Framework score matches the imported file: ${actual}`);
  }

  // Polls the framework card score until it matches the expected value. The
  // score is recalculated server-side after an import, so the card can still be
  // showing the pre-import value for a few seconds.
  async verifyFrameworkScoreMatches(expectedScore, timeoutMs = 120000) {
    const expected = Number(expectedScore);
    console.log(`Waiting for the framework score to settle at ${expected}...`);
    const deadline = Date.now() + timeoutMs;
    let actual = null;

    while (Date.now() < deadline) {
      actual = parseFloat(await this.getFrameworkCardScore());
      if (actual === expected) {
        console.log(`Framework score matches the calculated value: ${actual}`);
        return actual;
      }
      await this.page.waitForTimeout(3000);
      await this.page.reload({ waitUntil: "domcontentloaded" });
      await this.waitForSpinner();
      await this.page.waitForTimeout(3000);
    }

    throw new Error(
      `Expected the framework score to be '${expected}' (Beacher weighted model) after the import, but the UI settled on '${actual}'`,
    );
  }

  // Reads every imported answer off the collection, walking each question page.
  // Returns [{ questionNo, answer }] in the shape calculateBeacherScore()
  // expects, so the expected score can be derived from the Beacher weighted
  // model rather than hardcoded. Severity is not rendered on the question card;
  // the helper only uses it to disambiguate CSV rows and falls back to the
  // questionId match without it - the weight itself comes from the CSV row.
  async readAnsweredQuestions(timeoutMs = 120000) {
    console.log("Reading the imported answers off the collection...");
    const answers = [];
    let pageIndex = 1;
    let nextVisible = true;

    do {
      await this.page.waitForSelector(this.selectors.questionCard, {
        state: "visible",
        timeout: timeoutMs,
      });

      const pageAnswers = await this.page.evaluate(() => {
        return Array.from(
          document.querySelectorAll("cygov-collection-question-card"),
        ).map((card) => {
          const numberSpan = card.querySelector(".question-content span");
          const text = numberSpan ? (numberSpan.innerText || "").trim() : "";
          const dotIndex = text.indexOf(".");
          const checked = card.querySelector(
            "cygov-framework-answers .answer-list input[type='radio']:checked",
          );
          const label = checked ? checked.closest(".round-checkbox") : null;
          return {
            questionNo:
              dotIndex !== -1 ? text.substring(0, dotIndex).trim() : null,
            answer: label ? (label.innerText || "").trim() : null,
          };
        });
      });

      pageAnswers
        .filter((entry) => entry.questionNo && entry.answer)
        .forEach((entry) => answers.push(entry));
      console.log(
        `Question page ${pageIndex}: read ${pageAnswers.length} card(s).`,
      );

      const nextBtn = this.page.locator(this.selectors.nextSetButton).first();
      nextVisible = await nextBtn.isVisible().catch(() => false);
      if (nextVisible) {
        await nextBtn.click();
        await this.waitForSpinner();
        await this.page.waitForTimeout(2000);
        pageIndex += 1;
      }
    } while (nextVisible);

    console.log(`Read ${answers.length} answered question(s).`);
    return answers;
  }

  // Beacher equivalent of the Secure verifyAllQuestionsAnsweredYes().
  //
  // The Secure fixtures are single-answer files ("all Yes" / "all No"), so that
  // check asserts one literal answer. The Beacher Insurance Application template
  // carries a mix of Yes / No / Not Applicable, so the meaningful assertion is
  // that the import left no question unanswered.
  async verifyAllQuestionsAnswered(timeoutMs = 120000) {
    console.log("Verifying every imported question carries an answer...");
    let pageIndex = 1;
    let totalQuestions = 0;
    let nextVisible = true;

    do {
      await this.page.waitForSelector(this.selectors.questionCard, {
        state: "visible",
        timeout: timeoutMs,
      });

      const cards = await this.page
        .locator(this.selectors.questionCard)
        .count();
      const answered = await this.page
        .locator(this.selectors.selectedAnswer)
        .count();
      console.log(`Question page ${pageIndex}: ${answered}/${cards} answered.`);

      if (answered !== cards) {
        throw new Error(
          `Expected all ${cards} questions on page ${pageIndex} to be answered after the import, but only ${answered} were`,
        );
      }
      totalQuestions += cards;

      const nextBtn = this.page.locator(this.selectors.nextSetButton).first();
      nextVisible = await nextBtn.isVisible().catch(() => false);
      if (nextVisible) {
        await nextBtn.click();
        await this.waitForSpinner();
        await this.page.waitForTimeout(2000);
        pageIndex += 1;
      }
    } while (nextVisible);

    console.log(
      `All ${totalQuestions} imported question(s) across ${pageIndex} page(s) are answered.`,
    );
    return totalQuestions;
  }
}

module.exports = ImportAssessment;
