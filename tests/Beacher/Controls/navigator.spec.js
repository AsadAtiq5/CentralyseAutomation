const { test } = require("@playwright/test");
const Navigator = require("../../../pages/Beacher/Controls/Navigator");
const ScoreCalculation = require("../../../pages/Beacher/Application/ScoreCalculation");
const Wizard = require("../../../pages/Beacher/Wizard/Wizard");

// Scope this spec's test data to the Beacher app (testData/Beacher/).
process.env.APP = "Beacher";

const TIMEOUTS = {
  SHORT: 600000,
};

// Creates a brand-new Beacher entity via the New Entity wizard so this spec is
// self-contained and does not depend on any other Beacher spec having run
// first. Beacher has no Add Client + Multi Entity flow - the wizard is the only
// way in - so this replaces steps 1-3 of the Secure CN-01 flow.
async function createBeacherClient(page) {
  const wizard = new Wizard(page);

  await wizard.goto("/clients");
  await wizard.waitForSpinner();

  // Step 1 - Organizational/General.
  await wizard.clickNewButton();
  await wizard.waitForWizardModal();
  const clientName = await wizard.enterUniqueClientName("Beacher_Nav");
  await wizard.enterPrimaryRiskManagementContact("Risk Manager");
  await wizard.clickIndustryDropdown();
  await wizard.verifyIndustryListVisible();
  await wizard.selectIndustry("FINANCIAL SERVICES");
  await wizard.clickNextButton();

  // Step 2 - Financial.
  await wizard.waitForFinancialStep();
  await wizard.enterAnnualRevenue("1000000");
  await wizard.enterAnnualCostOfGoods("500000");
  await wizard.clickNextButton();

  // Step 3 - Frameworks.
  await wizard.waitForFrameworksStep();
  await wizard.selectRiskAssessment("Insurance Application");
  await wizard.clickNextButton();
  await wizard.clickNextButton();

  // Step 5 - Technical.
  await wizard.waitForTechnicalStep();
  await wizard.enterNumberOfServers("10");
  await wizard.enterNumberOfWorkstations("50");
  await wizard.clickNextButton();
  await wizard.clickNextButton();

  // Step 7 - Account Details.
  await wizard.waitForAccountDetailsStep();
  await wizard.clickRenewalDateCalendar();
  await wizard.verifyCalendarDisplayed();
  await wizard.selectCalendarToday();
  await wizard.clickNextButton();

  // Step 8 - Current/Previous Year: calculate and complete.
  await wizard.waitForCurrentPreviousYearStep();
  await wizard.clickCalculateButton();
  await wizard.clickCompleteButton();
  await wizard.verifyEntityCreatedToast();

  return clientName;
}

test.describe("Beacher Controls Navigator", () => {
  // Target the Beacher domain and auto-login using the saved Beacher session.
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    storageState: "storageState.beacher.json",
  });

  let navigatorPage;
  let scoreCalculation;

  test.beforeEach(async ({ page }) => {
    navigatorPage = new Navigator(page);
    scoreCalculation = new ScoreCalculation(page);
  });

  test("BCN - 01 | @smoke Controls Navigator - Verify the colors combination", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Create a new Beacher client through the New Entity wizard
    const clientName = await createBeacherClient(page);
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client
    await scoreCalculation.goto("/clients");
    await scoreCalculation.waitForSpinner();
    await scoreCalculation.clickSearchField();
    await scoreCalculation.searchClient(clientName);
    await scoreCalculation.waitForClientCard(clientName);
    await scoreCalculation.clickClientCard(clientName);
    await scoreCalculation.waitForLoad();
    await page.waitForTimeout(2000);

    // 3. Navigate to Controls > Navigator from the side menu
    await navigatorPage.navigateToNavigator();
    await navigatorPage.waitForNavigatorLoaded();
    console.log("Navigated to Controls Navigator.");

    // 4. Verify the root score colour matches the Beecher band for its value.
    // Beacher routes through getBeecherScoreColor (<7 red, <10 amber, >=10
    // green), not the Secure <3.33 bands, so this uses the Beecher map.
    await navigatorPage.verifyBeecherScoreColorCombination();

    // 5. Drill root -> level 1 -> 2 -> 3 -> 4. Secure's CN-01 hardcodes the NIST
    // node names ("Protect", "Access Controls", "Multi-Factor Authentication",
    // "BEC-1.1"); Beacher's Insurance Application tree has entirely different
    // nodes, so the path is discovered from the rendered chart. Each ring is
    // transparent until its parent is selected, so the hops cannot be skipped.
    // The drill also skips N/A-severity questions - the app draws no score
    // colour for those, so answering one could never repaint its arc.
    const questionNode = await navigatorPage.drillFromRootToQuestionNode();
    console.log(
      `Question node: "${questionNode.text}" | severity: ${questionNode.severity}`,
    );

    // The control panel only populates once a level-4 (question) node is
    // selected - levels 1-3 just reveal the next ring.
    await navigatorPage.verifyControlPanelPopulated();

    // 6. Save the question node's current border colour before answering
    const initialColor = await navigatorPage.getNodeComputedBorderColor(
      4,
      questionNode.tooltip,
      true,
    );
    console.log(`Question node "${questionNode.text}" colour: ${initialColor}`);

    // 7. Click the "Original Question" button from the side panel
    await navigatorPage.clickOriginalQuestion();
    await page.waitForTimeout(2000);
    console.log('Clicked "Original Question".');

    // 8. Add the mandatory comment. This framework refuses the save with
    // "Comments are mandatory for question N" until a comment is committed with
    // ADD, so it has to happen before the answer is saved.
    await navigatorPage.addAnswerComment(`Automation ${Date.now()}`);

    // 9. Select a random answer from the question panel
    const { answerText, partialMeta } =
      await navigatorPage.selectRandomAnswerInNavigator();
    await page.waitForTimeout(2000);
    console.log(
      `Random answer selected: "${answerText}"${partialMeta ? ` | partialMeta: ${JSON.stringify(partialMeta)}` : ""}`,
    );

    // 10. Click the Save button
    await navigatorPage.clickSaveButton();

    // 11. Wait for the "Control Updated!" toast. The inherited helper swallows a
    // missing toast, which turns a save that never happened into a confusing
    // colour mismatch later - this one fails where the failure actually is.
    await navigatorPage.waitForControlUpdatedToastStrict();
    await page.waitForTimeout(2000);

    // 12. Determine the expected node border colour for the selected answer.
    // On Beacher a Partial 50% answer scores 5, which is still RED - the Secure
    // helper would call the same answer amber.
    const expectedColor = navigatorPage.getExpectedBeecherColorForAnswer(
      answerText,
      partialMeta,
    );
    console.log(
      `Expected border colour for answer "${answerText}": ${expectedColor}`,
    );

    // 13. Verify the question node's border colour reflects the selected answer.
    // The inherited reader looks at the inline style.fill, which is always empty
    // on Beacher (the colour lives in the computed style), so it reports "" for
    // every node - this reads the computed fill and re-drills after the reload.
    await navigatorPage.verifyBeecherNodeBorderColorMatch(
      4,
      questionNode.tooltip,
      true,
      expectedColor,
    );
  });
});
