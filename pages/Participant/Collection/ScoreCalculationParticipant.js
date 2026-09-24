const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const CollectionPage = require("../../Secure/CollectionPage");
const {
  COLLECTION_PAGE_ENUMS,
  TOASTER_ENUM,
  ANSWER_ENUM,
} = require("../../../constant/enums");

// The collection is the participant's ONLY screen - the role has no management,
// settings or upperdeck access - so a participant session lands straight on the
// framework cards and there is no client/entity navigation to perform first.
//
// This class drives that screen end to end: open the framework card, answer
// every question across every page, then read the score back off the card. It
// composes CollectionPage for the card work rather than re-declaring its
// selectors, and owns the question-answering loop itself because the reviewer
// footer the Secure QuestionEngine waits on does not exist for this role.
class ScoreCalculationParticipant extends BasePage {
  constructor(page) {
    super(page);
    this.collection = new CollectionPage(page);
    this.selectors = {
      questionContainer: "cygov-collection-question-card .question-container",
      questionControlDetail: "cygov-control-details .control-details-comp",
      checkedAnswer:
        'cygov-framework-answers .round-checkbox input[type="radio"]:checked',
      answerLabels: "cygov-framework-answers .round-checkbox label",
      toastSaved: `#toast-container .toast-message:has-text("${TOASTER_ENUM.SAVED}")`,
      entityCardBox: ".entity-card-box",
      nextSetBtn: ".btn-next",
      continueBtn: ".btn-continue",
      mandatoryCommentText: ".mandatory-comment-text",
      commentTextarea: "textarea[cygovuserpermission]",
    };
  }

  // The participant is dropped on the collection by the app itself, so this is
  // an arrival check rather than a navigation step. The card wait is generous
  // because the assessment list is the first authenticated render of the run.
  async verifyOnCollectionScreen(timeoutMs = 120000) {
    console.log("Verifying the participant landed on the collection screen...");
    await expect(this.page).toHaveURL(/\/collection/, { timeout: timeoutMs });
    await this.page
      .locator(this.selectors.entityCardBox)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Participant is on the collection screen.");
  }

  // Reads the framework name off the card and clicks its Open button in one
  // step, because the name is only reliably readable before the card expands.
  // Returns the name so the caller can resolve that framework's answer options.
  async getFrameworkNameAndOpen(index = 0) {
    console.log(`Opening the framework card at index ${index}...`);
    const frameworkName = await this.collection.getFrameworkName(index);
    console.log(`Framework opened: ${frameworkName}`);
    return frameworkName;
  }

  // Question order is the digits before the first dot in the question text.
  async getQuestionOrder(container) {
    const questionSpan = container.locator(".question-content span").first();
    await questionSpan.waitFor({ state: "visible" });
    const text = await questionSpan.innerText();
    const dotIndex = text.indexOf(".");
    return dotIndex !== -1 ? text.substring(0, dotIndex).trim() : null;
  }

  // Severity drives the weighting in calculateScore, so it is captured per
  // question from the control detail panel rather than assumed.
  async getSeverity(detailContainer) {
    return await detailContainer
      .locator("div.inner-body", {
        hasText: COLLECTION_PAGE_ENUMS.SEVERITY_LEVEL,
      })
      .locator("div.lato-16-l-vw")
      .innerText();
  }

  // Some answer options force a comment before the answer will save. The
  // marker sits on the option, not the question, so it is only checkable after
  // the option is picked.
  async fillMandatoryComment(
    container,
    selectedOption,
    comment = COLLECTION_PAGE_ENUMS.DUMMY_COMMENT,
  ) {
    const optionContainer = selectedOption.locator("..");
    const mandatoryComment = optionContainer.locator(
      this.selectors.mandatoryCommentText,
    );
    if ((await mandatoryComment.count()) > 0) {
      const commentTextarea = container.locator(this.selectors.commentTextarea);
      await commentTextarea.fill(comment);
      const addButton = container.getByRole("button", { name: "ADD" });
      await addButton.click();
    }
  }

  // Index 1 is skipped deliberately - it is the "N/A" option, which
  // calculateScore drops from the average and would make the expected score
  // depend on which questions happened to be excluded.
  async selectRandomAnswer(container) {
    const labels = container.locator(this.selectors.answerLabels);
    const count = await labels.count();

    let randomIndex = Math.floor(Math.random() * count);
    randomIndex = randomIndex !== 1 ? randomIndex : 0;

    const selectedOption = labels.nth(randomIndex);
    await selectedOption.scrollIntoViewIfNeeded();
    await selectedOption.click();
    await this.page.waitForTimeout(1000);

    await this.fillMandatoryComment(container, selectedOption);

    // The save toast can appear and clear inside one poll interval, so a miss
    // is not treated as a failure - the reload before the score read is what
    // proves the answers actually persisted.
    try {
      await this.page.waitForSelector(this.selectors.toastSaved, {
        state: "visible",
        timeout: 15000,
      });
      await this.page.waitForSelector(this.selectors.toastSaved, {
        state: "hidden",
        timeout: 15000,
      });
    } catch (e) {
      console.log("Saved toast handled");
    }
    return selectedOption;
  }

  // Walks every page of the assessment, answering anything not already
  // answered, and returns the rows calculateScore expects.
  //
  // status is stamped APPROVE on every row on purpose: calculateScore only
  // accumulates rows whose status is APPROVE and returns 0 for a fully
  // answered assessment otherwise. A participant has no reviewer footer to
  // approve or deny from, so APPROVE is the only state this role can produce.
  async answerAllQuestions() {
    console.log("Answering every question in the participant assessment...");
    const questionAnswerMapper = [];

    let nextVisible = true;
    do {
      await this.page.waitForSelector(this.selectors.questionContainer, {
        state: "visible",
        timeout: 300000,
      });
      const questions = this.page.locator(this.selectors.questionContainer);
      const controlDetail = this.page.locator(
        this.selectors.questionControlDetail,
      );
      const questionCount = await questions.count();
      console.log(`Found ${questionCount} questions on this page`);

      for (let i = 0; i < questionCount; i++) {
        const container = questions.nth(i);
        const detailContainer = controlDetail.nth(i);
        await container.waitFor({ state: "visible" });
        await detailContainer.waitFor({ state: "visible" });
        try {
          await detailContainer.scrollIntoViewIfNeeded({ timeout: 5000 });
        } catch (e) {
          console.log(`Scroll issue for detail container ${i}`);
        }
        await this.page.waitForTimeout(500);

        const questionObj = {};
        questionObj.questionNo = await this.getQuestionOrder(container);
        questionObj.severity = await this.getSeverity(detailContainer);

        const selectedInput = container.locator(this.selectors.checkedAnswer);
        if ((await selectedInput.count()) > 0) {
          // Already answered - record it rather than re-answering, so a retry
          // does not change the score the assertion is built from.
          const selectedLabel = selectedInput.locator("..").locator("label");
          questionObj.answer = await selectedLabel.innerText();
        } else {
          const selectedOption = await this.selectRandomAnswer(container);
          questionObj.answer = await selectedOption.innerText();
        }
        questionObj.status = ANSWER_ENUM.APPROVE;
        console.log(
          `Question ${i + 1}/${questionCount} answered: ${questionObj.answer}`,
        );
        questionAnswerMapper.push(questionObj);
        await this.page.waitForTimeout(500);
      }

      const nextBtn = this.page
        .locator(this.selectors.nextSetBtn)
        .getByText(COLLECTION_PAGE_ENUMS.NEXT_BUTTON);

      nextVisible = await nextBtn.first().isVisible();
      if (nextVisible) {
        await nextBtn.first().click();
        // Moving to the next set can raise a confirmation modal depending on
        // the framework settings; it is optional, not guaranteed.
        const continueBtn = this.page.locator(this.selectors.continueBtn);
        try {
          await continueBtn.waitFor({ state: "visible", timeout: 30000 });
          console.log("Modal appeared - clicking CONTINUE");
          await continueBtn.click();
          await this.page.waitForTimeout(1000);
        } catch (e) {
          console.log("No continue modal - proceeding normally");
        }

        await this.page.waitForSelector(this.selectors.questionContainer, {
          state: "visible",
        });
      }
    } while (nextVisible);

    console.log(`Answered ${questionAnswerMapper.length} questions in total.`);
    return questionAnswerMapper;
  }

  // The card score is rendered from the saved answers, so the screen has to be
  // reloaded before it is read - without this the card still shows the score
  // from before the assessment was answered.
  async reloadForScore() {
    console.log("Reloading the collection so the card score refreshes...");
    await this.page.reload();
    await this.waitForLoad();
    await this.page
      .locator(this.selectors.entityCardBox)
      .first()
      .waitFor({ state: "visible", timeout: 120000 });
    console.log("Collection reloaded and the framework card is visible.");
  }

  // Returns the raw score text from the card; the caller parses it, because
  // only the caller knows how it wants to compare.
  async getScore(index = 0) {
    const selectedCard = await this.collection.fetchFrameworkCard(index);
    const score = await this.collection.fetchScoreByCard(selectedCard);
    console.log(`Score read from the framework card: ${score}`);
    return score;
  }
}

module.exports = ScoreCalculationParticipant;
