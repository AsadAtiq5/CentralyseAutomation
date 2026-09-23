const BasePage = require("../BasePage");

// Beacher Score Calculation flow (client search + open card from /clients).
class ScoreCalculation extends BasePage {
  constructor(page) {
    super(page);
    this.selectors = {
      searchInput:
        "//div[contains(@class,'mid-market-search-wrapper')]//input[@name='search']",
      // Dynamic client card + name: pass the exact client name
      clientCardName:
        "//cygov-beecher-card//div[contains(@class,'beecher-name-text') and normalize-space(text())='{NAME}']",
      clientCard:
        "//cygov-beecher-card[.//div[contains(@class,'beecher-name-text') and normalize-space(text())='{NAME}']]",
      // Collection filters
      filterButton:
        "//div[contains(@class,'filters-popup') and @aria-label='Open filters']",
      filtersModal:
        "//cygov-filters-modal//div[contains(@class,'filters-modal')]",
      // Dynamic Severity option: pass the exact severity label
      severityOption:
        "//div[contains(@class,'inner-body')][.//span[contains(@class,'title') and normalize-space(text())='Severity']]//div[contains(@class,'items-list')][.//span[normalize-space(text())='{SEVERITY}']]//input[@type='checkbox']",
      filterApplyButton:
        "//div[contains(@class,'body-back') and @aria-label='FILTER']",
      filterClearButton:
        "//div[contains(@class,'body-back') and @aria-label='CLEAR']",
      // "Questions (N)" tab that reflects the currently filtered count.
      questionsTab:
        "//li[contains(@class,'tab-view')][contains(normalize-space(.),'Questions')]",
    };
  }

  async clickSearchField() {
    console.log("Clicking the search field...");
    await this.click(this.selectors.searchInput);
  }

  // Types the query character-by-character (does NOT use .fill()) so Angular's
  // live filtering triggers.
  async searchClient(name) {
    console.log(`Searching for client: ${name}`);
    const input = this.page.locator(this.selectors.searchInput);
    await input.click();
    await input.pressSequentially(name, { delay: 50 });
  }

  async waitForClientCard(name) {
    console.log(`Waiting for the filtered client card: ${name}`);
    const selector = this.selectors.clientCardName.replace("{NAME}", name);
    await this.waitForElement(selector);
  }

  async clickClientCard(name) {
    console.log(`Opening the client card: ${name}`);
    const selector = this.selectors.clientCard.replace("{NAME}", name);
    await this.click(selector);
    await this.waitForSpinner();
  }

  async waitForQuestions() {
    console.log("Waiting for the collection questions to load...");
    await this.waitForElement(
      "cygov-collection-question-card .question-container",
    );
  }

  async clickFilterButton() {
    console.log("Clicking the FILTERS button...");
    await this.click(this.selectors.filterButton);
  }

  async verifyFiltersModal() {
    console.log("Verifying the filters modal is displayed...");
    return await this.expectToBeVisible(this.selectors.filtersModal);
  }

  async selectSeverity(severity) {
    console.log(`Selecting severity filter: ${severity}`);
    const selector = this.selectors.severityOption.replace(
      "{SEVERITY}",
      severity,
    );
    await this.click(selector);
  }

  async clickApplyFilter() {
    console.log("Clicking the FILTER (apply) button...");
    await this.click(this.selectors.filterApplyButton);
    await this.waitForSpinner();
  }

  // Reads the collection score shown on the opened client's collection overview.
  async getCollectionScore() {
    console.log("Reading the collection score from the UI...");
    const scoreLocator = this.page
      .locator("div.score span.total-score")
      .first();
    await scoreLocator.waitFor({ state: "visible", timeout: 60000 });
    const scoreText = (await scoreLocator.innerText())?.trim();
    console.log(`UI collection score: ${scoreText}`);
    return scoreText;
  }

  // Reads the number in the "Questions (N)" tab.
  async getQuestionsTabCount() {
    const tab = this.page.locator(this.selectors.questionsTab).first();
    await tab.waitFor({ state: "visible", timeout: 60000 });
    const text = (await tab.innerText())?.trim();
    const match = text.match(/\((\d+)\)/);
    const count = match ? parseInt(match[1], 10) : 0;
    console.log(`Questions tab text: "${text}" -> count ${count}`);
    return count;
  }

  async clickClearFilter() {
    console.log("Clicking the CLEAR filter button...");
    await this.click(this.selectors.filterClearButton);
    await this.waitForSpinner();
  }

  // Filters by a single severity, reads the resulting question count, then clears.
  async getSeverityCount(severity) {
    console.log(`Getting question count for severity: ${severity}`);
    await this.clickFilterButton();
    await this.verifyFiltersModal();
    await this.selectSeverity(severity);
    await this.clickApplyFilter();
    await this.waitForQuestions();
    const count = await this.getQuestionsTabCount();
    // Re-open the filter and clear the selection for the next severity.
    await this.clickFilterButton();
    await this.verifyFiltersModal();
    await this.clickClearFilter();
    return count;
  }

  // Returns the question count per severity: { low, medium, high, critical }.
  async getAllSeverityCounts() {
    // Clear any filter that may already be applied (e.g. from answering).
    await this.clickFilterButton();
    await this.verifyFiltersModal();
    await this.clickClearFilter();

    const severityCounts = {};
    for (const severity of ["Low", "Medium", "High", "Critical"]) {
      severityCounts[severity.toLowerCase()] =
        await this.getSeverityCount(severity);
    }
    console.log("Severity counts:", severityCounts);
    return severityCounts;
  }

  // --- Answer the filtered questions based on the framework CSV isCustomScore ---

  // Reads the leading question order number ("12. ...") from a question card.
  async getQuestionOrderFromContainer(container) {
    const span = container.locator(".question-content span").first();
    await span.waitFor({ state: "visible", timeout: 30000 });
    const text = await span.innerText();
    const dotIndex = text.indexOf(".");
    return dotIndex !== -1 ? text.substring(0, dotIndex).trim() : null;
  }

  // Matches a UI question (by its displayed order number) to its framework CSV
  // row. The UI order is offset by +1 from the CSV questionId, so try
  // questionNo-1 first and fall back to an exact questionId match, preferring
  // the candidate whose impact matches the (Critical) filter.
  findFrameworkRowForQuestion(rowsById, questionNo, severity = "critical") {
    const qno = Number(questionNo);
    const candidates = [
      rowsById.get(String(qno - 1)),
      rowsById.get(String(qno)),
    ].filter(Boolean);
    if (!candidates.length) {
      return null;
    }
    const target = (severity || "").trim().toLowerCase();
    const matched = candidates.find(
      (row) => (row.impact || "").trim().toLowerCase() === target,
    );
    return matched || candidates[0];
  }

  // Selects the answer option whose (exact, trimmed) label text matches the
  // given value ("Yes" / "No"). Returns the selected label locator.
  async selectAnswerByText(container, answerText) {
    const labels = container.locator(
      "cygov-framework-answers .round-checkbox label",
    );
    const count = await labels.count();
    for (let i = 0; i < count; i++) {
      const label = labels.nth(i);
      const text = (await label.innerText()).trim();
      if (text.toLowerCase() === answerText.toLowerCase()) {
        await label.scrollIntoViewIfNeeded();
        await label.click({ force: true });
        return label;
      }
    }
    throw new Error(
      `Answer option "${answerText}" not found on the question card`,
    );
  }

  // Fills the mandatory comment (and clicks ADD) if the selected option requires
  // one. No-op otherwise.
  async fillMandatoryCommentIfRequired(
    container,
    selectedLabel,
    comment = "Automation comment",
  ) {
    const parent = selectedLabel.locator("..");
    const mandatory = parent.locator(".mandatory-comment-text");
    if ((await mandatory.count()) > 0) {
      const textarea = container.locator("textarea[cygovuserpermission]");
      await textarea.scrollIntoViewIfNeeded();
      await textarea.fill(comment);
      const addButton = container.getByRole("button", { name: "ADD" });
      await addButton.click();
    }
  }

  // Answers EVERY currently filtered question (across all "NEXT SET" pages)
  // based on the framework CSV isCustomScore flag:
  //   isCustomScore === true  -> answer "Yes"
  //   isCustomScore === false -> answer "No"
  // Returns [{ questionNo, severity, answer, isCustomScore }].
  async answerQuestionsByCustomScore(frameworkRows, severity = "Critical") {
    const rowsById = new Map(
      (frameworkRows || []).map((row) => [String(row.questionId), row]),
    );
    const results = [];
    const severityKey = (severity || "critical").toLowerCase();

    let nextVisible = true;
    do {
      await this.page.waitForSelector(
        "cygov-collection-question-card .question-container",
        { state: "visible", timeout: 30000 },
      );
      const questions = this.page.locator(
        "cygov-collection-question-card .question-container",
      );
      const count = await questions.count();
      console.log(`Answering ${count} question(s) on this page...`);

      for (let i = 0; i < count; i++) {
        const container = questions.nth(i);
        await this.waitForSpinner();
        await container.scrollIntoViewIfNeeded().catch(() => {});
        await container.waitFor({ state: "visible", timeout: 30000 });

        const questionNo = await this.getQuestionOrderFromContainer(container);
        const row = this.findFrameworkRowForQuestion(
          rowsById,
          questionNo,
          severityKey,
        );
        const isCustomScore = row
          ? String(row.isCustomScore).trim().toLowerCase() === "true"
          : false;
        const answer = isCustomScore ? "Yes" : "No";
        console.log(
          `Q#${questionNo}: isCustomScore=${isCustomScore} -> answering "${answer}"`,
        );

        const selectedLabel = await this.selectAnswerByText(container, answer);
        await this.fillMandatoryCommentIfRequired(container, selectedLabel);

        // Wait for the "Saved Successfully" toast (best-effort).
        try {
          await this.page.waitForSelector(
            "#toast-container .toast-message:has-text('Saved Successfully')",
            { state: "visible", timeout: 20000 },
          );
          await this.page.waitForSelector(
            "#toast-container .toast-message:has-text('Saved Successfully')",
            { state: "hidden", timeout: 20000 },
          );
        } catch (e) {
          console.log("ℹ Saved toast handled");
        }

        results.push({ questionNo, severity, answer, isCustomScore });
        await this.page.waitForTimeout(100);
      }

      // Pagination: advance to the next set of questions if present.
      const nextBtn = this.page.locator(".next-previous-chapter .btn-next");
      nextVisible = await nextBtn
        .first()
        .isVisible()
        .catch(() => false);
      if (nextVisible) {
        console.log("Navigating to the next set of questions...");
        await nextBtn.first().click();
        await this.waitForSpinner();
        await this.page.waitForTimeout(1500);
      }
    } while (nextVisible);

    console.log(`Answered ${results.length} question(s) in total.`);
    return results;
  }
}

module.exports = ScoreCalculation;
