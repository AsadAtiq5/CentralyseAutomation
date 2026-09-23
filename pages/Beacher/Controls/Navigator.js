const SecureNavigator = require("../../Secure/Controls/Navigator");

// Beacher (application 2) base URL.
const BEACHER_BASE_URL =
  process.env.BASE_URL_BEACHER || "https://secure-cyber-in-site.cygovdev.com";

// Beacher Controls Navigator. The screen is the same Angular component as
// Secure's (src/app/break-down), so navigation, SVG-node helpers and the
// question/answer flow are inherited. What genuinely differs on Beacher is the
// score-to-colour banding: the app routes isBnBCyberSite to getBeecherScoreColor
// (<7 bad, <10 medium, >=10 best) instead of the standard <3.33 / <10 / >=10.
// Everything Beacher-specific here is added as a NEW member so the Secure page
// object keeps working unchanged for CN/CNEL/CNMS/CNSEL.
class Navigator extends SecureNavigator {
  constructor(page) {
    super(page);

    this.selectors = {
      ...this.selectors,
      // Page shell and chart container.
      breakDownContainer: ".break-down-container",
      sunburst: "#sunburst",
      sunburstHeader: ".sunburst-container .header",
      // Header controls: entity picker, risk picker, weightage percentage.
      entityDropdown: ".header .drop-downs cygov-select:not(.risk-dropdown)",
      riskDropdown: ".header .drop-downs cygov-select.risk-dropdown",
      riskDropdownClear: ".header .risk-dropdown .ng-clear-wrapper",
      dropdownOption: ".ng-dropdown-panel .ng-option",
      dropdownOptionLabel: ".ng-dropdown-panel .ng-option-label",
      subEntityPercentage: ".header .sub-entity-percentage .percentage-text",
      // Right-hand control panel and its three states.
      controlPanel: ".main-right",
      taskActions: "cygov-task-actions",
      questionDetails: "cygov-question-details",
      severitySection: "cygov-question-details .severity-section",
      controlPanelPlaceholder: ".main-right-placeholder .content",
      panelExpandIcon: ".right-collapsed-section .expand-icon",
      // Question panel opened from the control panel's "Original Question".
      questionWrapper: ".question-container-wrapper",
      answerCommentBox: ".question-container-wrapper textarea.explain-answer",
      commentAddedToast:
        "#toast-container .toast-message:has-text('Comment added successfully')",
      controlUpdatedSaveToast:
        "#toast-container .toast-message:has-text('Control Updated!')",
      // List view is a separate component, reached via the "table" sub-menu or
      // the fromPillars/domain query params - there is no in-page toggle.
      breakDownList: "cygov-break-down-list",
      tableSubMenuItem:
        "//button[contains(@class,'sub-menu-sub-item') and .//span[normalize-space(text())='table']]",
      // Every drawn arc carries a g.node.lvlN class; lvl0 is the root.
      arcNodes: "g.node",
    };

    // Beecher/Mid-Market score bands, mirroring getBeecherScoreColor and
    // getRootColor in sunburst.service.ts. Colours come from
    // SunburstConstant.COLORS.rootColors / .lines, which are identical values.
    // Deliberately a separate map from the parent's scoreColorMap - the Secure
    // thresholds (3.33) and this one (7) are different by design.
    this.beecherScoreColorMap = [
      { max: 6.999999, color: "rgb(247, 95, 87)" }, // #f75f57 bad
      { max: 9.999999, color: "rgb(247, 216, 87)" }, // #f7d857 medium
      { max: 10, color: "rgb(27, 217, 100)" }, // #1bd964 best
    ];
  }

  // Beacher page objects must resolve relative paths against the Beacher domain.
  // Navigator extends the Secure page object rather than Beacher/BasePage, so the
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

  // --- Load / render -------------------------------------------------------

  // The chart has no empty state: an empty tree leaves #sunburst silently blank,
  // which is indistinguishable from "still loading". Always wait on a drawn arc
  // and on the root score, never on the container alone.
  async waitForNavigatorLoaded(timeoutMs = 120000) {
    console.log("Waiting for the navigator chart to render...");
    await this.waitForSpinner();
    await this.page.waitForSelector(this.selectors.sunburst, {
      state: "visible",
      timeout: timeoutMs,
    });
    await this.page.waitForSelector(this.selectors.rootScore, {
      state: "visible",
      timeout: timeoutMs,
    });
    await this.page
      .locator(this.selectors.arcNodes)
      .first()
      .waitFor({ state: "attached", timeout: timeoutMs });
    console.log("Navigator chart rendered.");
  }

  async verifyNavigatorUrl(timeoutMs = 60000) {
    console.log("Verifying the navigator URL...");
    await this.page.waitForURL(/\/break-down\/navigator/, {
      timeout: timeoutMs,
    });
  }

  // Asserts the chart actually drew arcs, not just the container.
  async verifyChartRendered() {
    console.log("Verifying the sunburst drew at least one arc...");
    const count = await this.page.locator(this.selectors.arcNodes).count();
    if (count === 0) {
      throw new Error(
        "Expected the sunburst to render at least one arc node, but found 0",
      );
    }
    console.log(`Sunburst rendered ${count} arc node(s).`);
  }

  async verifyHeaderControlsVisible() {
    console.log("Verifying the navigator header controls...");
    await this.expectToBeVisible(this.selectors.entityDropdown);
    await this.expectToBeVisible(this.selectors.riskDropdown);
    await this.expectToBeVisible(this.selectors.subEntityPercentage);
  }

  // --- Root score ----------------------------------------------------------

  // Reads the score base from the "/10" suffix span rather than assuming 10:
  // ScoreService resolves the base per entity and only BnB is hard-wired to 5.
  async getScoreBase() {
    const el = this.page.locator(this.selectors.fromScore).first();
    await el.waitFor({ state: "visible", timeout: 30000 });
    const raw = (await el.innerText()).trim();
    const base = parseFloat(raw.replace("/", ""));
    console.log(`Score base read from the UI: ${base} (raw "${raw}")`);
    return base;
  }

  async verifyScoreBase(expectedBase) {
    const actual = await this.getScoreBase();
    if (actual !== expectedBase) {
      throw new Error(
        `Expected the navigator score base to be '${expectedBase}', but got '${actual}'`,
      );
    }
  }

  // Beecher banding: <7 red, <10 amber, >=10 green.
  getExpectedBeecherColorForScore(score) {
    for (const entry of this.beecherScoreColorMap) {
      if (score <= entry.max) return entry.color;
    }
    return this.beecherScoreColorMap[this.beecherScoreColorMap.length - 1]
      .color;
  }

  // Root-score colour check against the Beecher bands. Kept separate from the
  // inherited verifyScoreColorCombination(), which uses the Secure thresholds.
  async verifyBeecherScoreColorCombination() {
    const score = await this.getScoreValue();
    const actualColor = await this.getScoreColor();
    const expectedColor = this.getExpectedBeecherColorForScore(score);

    console.log(
      `Beecher colour band -> score: ${score} | expected: ${expectedColor} | actual: ${actualColor}`,
    );

    if (actualColor !== expectedColor) {
      throw new Error(
        `Expected score ${score} to render colour '${expectedColor}', but got '${actualColor}'`,
      );
    }
    return { score, actualColor, expectedColor };
  }

  // --- Arcs ----------------------------------------------------------------

  // Chart chrome, not score colours: an arc painted with any of these is
  // unanswered/undrawn rather than banded. Captured live on the Beacher
  // navigator - the Secure reader only knows about rgb(18, 21, 33).
  get beecherArcBackgroundColours() {
    return ["rgb(1, 9, 23)", "rgb(18, 21, 33)", "rgb(46, 50, 64)", "none", ""];
  }

  // Beacher replacement for the inherited getNodeBorderColor().
  //
  // The Secure reader walks path.border and reads `style.fill` - the INLINE
  // style. On Beacher the arcs carry no inline fill at all, so that reader
  // returns "" for every node, which is what produces
  // `Node border color should be "rgb(...)" but got ""`. The colour only exists
  // in the computed style, so this reads that instead and skips the chrome
  // colours above.
  async getNodeComputedBorderColor(level, tooltip, partial = false) {
    console.log(`Reading the computed colour of the lvl${level} node...`);
    const colour = await this.page.evaluate(
      ({ level, tooltip, partial, background }) => {
        const node = Array.from(
          document.querySelectorAll(`g.node.lvl${level}`),
        ).find((n) => {
          const attr =
            n.getAttribute("ngbTooltip") || n.getAttribute("ngbtooltip") || "";
          return partial ? attr.includes(tooltip) : attr === tooltip;
        });
        if (!node) return null;
        const paths = Array.from(node.querySelectorAll("path.border"));
        for (let i = paths.length - 1; i >= 0; i--) {
          const fill = getComputedStyle(paths[i]).fill;
          if (fill && !background.includes(fill)) return fill;
        }
        return "";
      },
      {
        level,
        tooltip,
        partial,
        background: this.beecherArcBackgroundColours,
      },
    );

    if (colour === null) {
      throw new Error(
        `Expected to find a lvl${level} node matching tooltip '${tooltip}', but none was rendered`,
      );
    }
    console.log(`Node computed colour: '${colour}'`);
    return colour;
  }

  // Beacher replacement for the inherited verifyNodeBorderColorMatch(). Same
  // reload-then-poll shape (the chart does not repaint a node in place after a
  // save), but it re-drills after the reload - on Beacher every ring is hidden
  // again on load - and reads the computed colour.
  async verifyBeecherNodeBorderColorMatch(
    level,
    tooltip,
    partial,
    expectedColor,
    timeoutMs = 30000,
  ) {
    console.log(`Verifying the node repainted as '${expectedColor}'...`);
    await this.page.reload({ waitUntil: "domcontentloaded" });
    await this.waitForLoad();
    await this.waitForNavigatorLoaded();
    await this.drillFromRootToQuestionNode();

    const deadline = Date.now() + timeoutMs;
    let actualColor = await this.getNodeComputedBorderColor(
      level,
      tooltip,
      partial,
    );
    while (actualColor !== expectedColor && Date.now() < deadline) {
      await this.page.waitForTimeout(1000);
      actualColor = await this.getNodeComputedBorderColor(
        level,
        tooltip,
        partial,
      );
    }

    if (actualColor !== expectedColor) {
      throw new Error(
        `Expected the node border colour to be '${expectedColor}', but got '${actualColor}'`,
      );
    }
    console.log(`Node border colour verified: '${actualColor}'`);
  }

  // Beacher replacement for the inherited waitForControlUpdatedToast().
  //
  // The Secure version swallows a missing toast in a try/catch and logs
  // "handled", so a save that never happened looks like a pass and only shows up
  // later as a colour mismatch. This one fails at the real point of failure.
  async waitForControlUpdatedToastStrict(timeoutMs = 60000) {
    console.log("Waiting for the 'Control Updated!' toast...");
    try {
      await this.page.waitForSelector(this.selectors.controlUpdatedSaveToast, {
        state: "visible",
        timeout: timeoutMs,
      });
    } catch {
      const shown = await this.page
        .locator(this.selectors.controlUpdatedToast)
        .allInnerTexts()
        .catch(() => []);
      throw new Error(
        `Expected the 'Control Updated!' toast after saving, but it never appeared. Toasts shown: ${
          shown.length ? shown.join(" | ") : "none"
        }`,
      );
    }
    await this.page.waitForSelector(this.selectors.controlUpdatedSaveToast, {
      state: "hidden",
      timeout: timeoutMs,
    });
  }

  // Reads every drawn arc's score (from its ngbTooltip/score attributes where
  // present) plus its rendered fill, so a single test can assert the whole
  // chart obeys the Beecher bands instead of sampling one node.
  async getArcColourSnapshot() {
    console.log("Collecting arc colours from the sunburst...");
    const snapshot = await this.page.evaluate(() => {
      const rows = [];
      document.querySelectorAll("g.node").forEach((node) => {
        const tooltip =
          node.getAttribute("ngbTooltip") ||
          node.getAttribute("ngbtooltip") ||
          "";
        const arc =
          node.querySelector("path.borderArc") ||
          node.querySelector("path.border");
        rows.push({
          tooltip,
          level: (node.getAttribute("class") || "").match(/lvl(\d+)/)?.[1],
          // The arcs carry no inline fill - the colour only shows up in the
          // computed style, so style.fill would read empty for every node.
          fill: arc ? getComputedStyle(arc).fill : "",
        });
      });
      return rows;
    });
    console.log(`Collected ${snapshot.length} arc(s).`);
    return snapshot;
  }

  // Asserts no arc is painted with a colour outside the Beecher palette. A wrong
  // threshold shows up here as a Secure-only colour (e.g. amber on a score of 5).
  async verifyArcColoursWithinBeecherPalette() {
    console.log(
      "Verifying every arc uses a colour from the Beecher palette...",
    );
    const allowed = [
      ...this.beecherScoreColorMap.map((entry) => entry.color),
      "rgb(88, 102, 109)", // lines.fade - unselected/faded arcs (dark theme)
      "rgb(203, 213, 225)", // lines.fade - light theme
      "", // zero-weight / N/A-impact nodes render with no fill
    ];

    const snapshot = await this.getArcColourSnapshot();
    const offenders = snapshot.filter((arc) => !allowed.includes(arc.fill));

    if (offenders.length > 0) {
      throw new Error(
        `Expected all arcs to use the Beecher palette, but found ${offenders.length} with other fills: ` +
          offenders
            .slice(0, 5)
            .map((arc) => `lvl${arc.level} "${arc.tooltip}" -> ${arc.fill}`)
            .join(", "),
      );
    }
    console.log(`All ${snapshot.length} arc(s) use the Beecher palette.`);
  }

  // Clicks one node at the given sunburst level and returns what it picked.
  //
  // Captured live against the Beacher navigator - three traps this works around:
  //  1) A ring is drawn but transparent (opacity 0, pointer-events none) until
  //     its parent is selected, so only the currently revealed level is
  //     clickable. The root score must be clicked first to reveal lvl1.
  //  2) An arc is a ring segment, so the centre of its bounding box (what a
  //     plain Playwright click targets) falls in empty space and the click
  //     silently lands on the page behind it. The reliable target is the arc's
  //     own HTML label (div.nodeName inside its foreignObject).
  //  3) Even a label can sit behind the chart's other layers, so each candidate
  //     is hit-tested with elementFromPoint before clicking.
  // `skipLabels` lets a caller walk the siblings at a level instead of always
  // taking the first one - needed to skip N/A-severity questions.
  async clickNodeAtLevel(level, skipLabels = []) {
    console.log(`Selecting a level-${level} node in the sunburst...`);
    const target = await this.page.evaluate(
      ({ level, skipLabels }) => {
        for (const node of document.querySelectorAll(`g.node.lvl${level}`)) {
          if (getComputedStyle(node).opacity === "0") continue;
          const label = node.querySelector("div.nodeName");
          if (!label) continue;
          if (skipLabels.includes((label.textContent || "").trim())) continue;
          const box = label.getBoundingClientRect();
          if (!box.width || !box.height) continue;
          const x = box.x + box.width / 2;
          const y = box.y + box.height / 2;
          if (y < 0 || y > innerHeight) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit && node.contains(hit)) {
            return {
              x,
              y,
              text: (label.textContent || "").trim(),
              tooltip: node.getAttribute("ngbTooltip") || "",
            };
          }
        }
        return null;
      },
      { level, skipLabels },
    );

    if (!target) {
      return null;
    }

    await this.page.mouse.click(target.x, target.y);
    await this.waitForSpinner();
    await this.page.waitForTimeout(2000);
    console.log(`Selected level-${level} node: "${target.text}"`);
    return target;
  }

  // Walks the chart from the root down to a question node and returns it.
  // The control panel only populates at level 4 (the question ring) - levels 1-3
  // just reveal the next ring. Level 1 is a pass-through layer whose labels
  // duplicate level 2 (the component's skipLevel behaviour), so all four hops
  // are needed.
  //
  // Questions with an N/A severity are skipped: the app draws no score colour
  // for them (isZeroWeightOrImpactNA returns an empty fill), so answering one
  // can never repaint its arc. The first branch's first question is often
  // exactly that, which is why the drill has to look before it settles.
  async drillFromRootToQuestionNode() {
    console.log("Drilling from the root score down to a scored question...");
    await this.clickRootScore();

    await this.clickNodeAtLevel(1);
    await this.clickNodeAtLevel(2);

    const triedBranches = [];
    // Each level-3 branch holds a handful of questions; if every one of them is
    // N/A, back out and try the next branch.
    for (let branch = 0; branch < 4; branch++) {
      const level3 = await this.clickNodeAtLevel(3, triedBranches);
      if (!level3) break;
      triedBranches.push(level3.text);

      const triedQuestions = [];
      for (let question = 0; question < 8; question++) {
        const node = await this.clickNodeAtLevel(4, triedQuestions);
        if (!node) break;
        triedQuestions.push(node.text);

        const severity = await this.getSelectedQuestionSeverity();
        if (severity && severity !== "n/a") {
          console.log(
            `Reached scored question "${node.text}" (severity: ${severity}).`,
          );
          return { ...node, severity };
        }
        console.log(
          `Skipping "${node.text}" - severity is N/A, it never colours.`,
        );
      }
    }

    throw new Error(
      "Expected to find a question node with a severity other than N/A, but every candidate was N/A",
    );
  }

  // Reads the severity shown for the currently selected question, lower-cased
  // ("n/a", "low", "medium", "high", "critical").
  async getSelectedQuestionSeverity() {
    const section = this.page.locator(this.selectors.severitySection).first();
    try {
      await section.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      console.log("Severity section not rendered for this node.");
      return null;
    }
    const text = (await section.innerText()).replace(/\s+/g, " ").trim();
    const severity = text.split(":").pop().trim().toLowerCase();
    console.log(`Selected question severity: '${severity}'`);
    return severity;
  }

  // --- Control panel -------------------------------------------------------

  // On Beacher the right-hand panel starts collapsed (only .right-collapsed-section
  // is rendered), so the placeholder does not exist until it is expanded.
  // Selecting a node populates the panel either way - this is only needed when a
  // test asserts the empty state.
  async expandControlPanel() {
    const expandIcon = this.page.locator(this.selectors.panelExpandIcon);
    if ((await expandIcon.count()) > 0) {
      console.log("Expanding the collapsed control panel...");
      await expandIcon.first().click();
      await this.page.waitForTimeout(1500);
    }
  }

  async verifyControlPanelPlaceholder() {
    console.log("Verifying the 'Please select a Task' placeholder...");
    await this.expandControlPanel();
    await this.expectToHaveText(
      this.selectors.controlPanelPlaceholder,
      "Please select a Task",
    );
  }

  async verifyControlPanelPopulated() {
    console.log("Verifying the control panel shows the selected control...");
    await this.expectToBeVisible(this.selectors.taskActions);
    await this.expectToBeVisible(this.selectors.questionDetails);
  }

  // --- Comments ------------------------------------------------------------

  // The Insurance Application framework rejects a save with "Comments are
  // mandatory for question N" until a comment has been added through the ADD
  // button - typing in the box alone is not enough, the comment must be
  // committed first.
  async addAnswerComment(comment) {
    console.log(`Adding the mandatory answer comment: "${comment}"`);
    const box = this.page.locator(this.selectors.answerCommentBox).first();
    await box.waitFor({ state: "visible", timeout: 30000 });
    await box.click();
    await box.type(comment, { delay: 25 });
    await this.page.waitForTimeout(1000);

    const addButton = this.page
      .locator(this.selectors.questionWrapper)
      .getByText("ADD", { exact: true })
      .first();
    await addButton.click({ force: true });
    await this.page.waitForSelector(this.selectors.commentAddedToast, {
      state: "visible",
      timeout: 30000,
    });
    await this.page.waitForSelector(this.selectors.commentAddedToast, {
      state: "hidden",
      timeout: 30000,
    });
    await this.page.waitForTimeout(1500);
  }

  // --- Filters -------------------------------------------------------------

  async clickEntityDropdown() {
    console.log("Opening the Entity dropdown...");
    await this.click(this.selectors.entityDropdown);
    await this.page.waitForTimeout(500);
  }

  async clickRiskDropdown() {
    console.log("Opening the Risk dropdown...");
    await this.click(this.selectors.riskDropdown);
    await this.page.waitForTimeout(500);
  }

  // Picks a random option from whichever dropdown panel is open and returns the
  // chosen label so the spec can assert against it.
  async selectRandomDropdownOption() {
    const options = this.page.locator(
      `${this.selectors.dropdownOption}:not(.ng-option-disabled)`,
    );
    await options.first().waitFor({ state: "visible", timeout: 15000 });
    const count = await options.count();
    const randomIndex = Math.floor(Math.random() * count);
    const selected = options.nth(randomIndex);
    const text = (
      await selected.locator(".ng-option-label").textContent()
    ).trim();
    await selected.click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(2000);
    console.log(`Selected dropdown option: "${text}"`);
    return text;
  }

  async getRiskDropdownValue() {
    const el = this.page.locator(this.selectors.riskDropdown).first();
    await el.waitFor({ state: "visible", timeout: 30000 });
    const text = (await el.innerText()).trim();
    console.log(`Risk dropdown value: "${text}"`);
    return text;
  }

  // The risk picker is the only one of the two that is clearable (the entity
  // picker sets clearable:false), so clearing is risk-specific.
  async clearRiskFilter() {
    console.log("Clearing the Risk filter...");
    const clear = this.page.locator(this.selectors.riskDropdownClear).first();
    await clear.waitFor({ state: "visible", timeout: 15000 });
    await clear.click();
    await this.waitForSpinner();
    await this.page.waitForTimeout(2000);
  }

  async getSubEntityPercentage() {
    const el = this.page.locator(this.selectors.subEntityPercentage).first();
    await el.waitFor({ state: "visible", timeout: 30000 });
    const text = (await el.innerText()).trim();
    console.log(`Sub-entity weightage: ${text}`);
    return text;
  }

  // --- List view -----------------------------------------------------------

  // There is no chart/list toggle inside the navigator: the list is its own
  // route ("table" in the sub-menu) and the fromPillars/domain query params.
  async navigateToControlsTable() {
    console.log("Opening the Controls table (list) view...");
    await this.clickControlsSidemenu();
    await this.click(this.selectors.tableSubMenuItem);
    await this.waitForSpinner();
    await this.waitForLoad();
  }

  async verifyListViewRendered(timeoutMs = 120000) {
    console.log("Verifying the break-down list rendered...");
    await this.page.waitForSelector(this.selectors.breakDownList, {
      state: "visible",
      timeout: timeoutMs,
    });
  }

  // Arriving with a domain query param opens list view directly and skips the
  // chart entirely - a behaviour that reads as a broken chart if unexpected.
  async verifyChartNotRendered() {
    console.log("Verifying the sunburst chart is not rendered...");
    const count = await this.page.locator(this.selectors.arcNodes).count();
    if (count > 0) {
      throw new Error(
        `Expected the sunburst not to render, but found ${count} arc node(s)`,
      );
    }
  }

  // --- Answer round-trip ---------------------------------------------------

  // Beecher variant of the inherited getExpectedColorForAnswer(): the bands are
  // different, so a Partial 50% answer (score 5) is RED here where Secure would
  // call it amber.
  getExpectedBeecherColorForAnswer(answerText, partialMeta = null) {
    const answer = answerText.toLowerCase().trim();

    if (answer === "yes" || answer === "not applicable") {
      return this.getExpectedBeecherColorForScore(10);
    }
    if (answer === "no") {
      return this.getExpectedBeecherColorForScore(0);
    }

    if (answer === "partial") {
      let percentage = 0;
      if (partialMeta) {
        if (partialMeta.partialKey) {
          const match = partialMeta.partialKey.match(/PARTIAL_(\d+)/);
          if (match) percentage = parseInt(match[1], 10);
        } else if (partialMeta.percentage != null) {
          percentage = partialMeta.percentage;
        }
      }
      return this.getExpectedBeecherColorForScore(percentage / 10);
    }

    return this.getExpectedBeecherColorForScore(0);
  }
}

module.exports = Navigator;
