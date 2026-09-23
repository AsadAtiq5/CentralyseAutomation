const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddEntityPage = require("../../../pages/Secure/AddEntityPage");
const ControlsNavigatorPage = require("../../../pages/Secure/Controls/Navigator");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SHORT: 300000,
};

test.describe("Controls Navigator Tests", () => {
  let managementPage;
  let addClientPage;
  let addEntityPage;
  let navigatorPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addEntityPage = new AddEntityPage(page);
    navigatorPage = new ControlsNavigatorPage(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("CN - 01 | @smoke Controls Navigator - Verify the colors combination", async ({
    page,
  }) => {
    test.setTimeout(TIMEOUTS.SHORT);

    // 1. Add a new client
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("NavClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();
    await managementPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log(`Created client: ${clientName}`);

    // 2. Navigate to the client
    await managementPage.searchAndClickClient(clientName);
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);

    // 3. Add a new MultiEntity with BusinessEmailCompromise
    await addEntityPage.clickMultiEntitySidebar();
    await page.waitForTimeout(2000);
    await addEntityPage.clickNewEntity();
    await page.waitForTimeout(2000);
    const entityName = await addEntityPage.createUniqueEntityName("NavEntity");
    console.log(`Created entity: ${entityName}`);
    await addEntityPage.selectBusinessEmailCompromise();
    await page.waitForTimeout(2000);
    await addEntityPage.selectInitialCollectionMethod();
    await addEntityPage.clickEntityAdd();
    await addEntityPage.waitForToast();
    await addEntityPage.verifyEntityInList(entityName);
    await page.waitForTimeout(2000);
    console.log(`Entity "${entityName}" verified in list.`);

    // 4. Navigate to the collection screen
    await addEntityPage.navigateToCollection();
    await addEntityPage.waitForSpinner();
    await page.waitForTimeout(2000);
    console.log("Navigated to Collection.");

    // 5. Navigate to Controls > Navigator from the side menu
    await navigatorPage.navigateToNavigator();
    await page.waitForTimeout(2000);
    console.log("Navigated to Controls Navigator.");

    // 6. Click on the root score element
    await navigatorPage.clickRootScore();
    await page.waitForTimeout(2000);

    // 7. Verify the color of the score matches the expected color for its value
    await navigatorPage.verifyScoreColorCombination();

    // 8. Click Level 1 node "Protect"
    await navigatorPage.clickLevel1Node("Protect");
    await page.waitForTimeout(2000);

    // 9. Click Level 2 node "Access Controls"
    await navigatorPage.clickLevel2Node("Access Controls");
    await page.waitForTimeout(2000);

    // 10. Click Level 3 node "Multi-Factor Authentication"
    await navigatorPage.clickLevel3Node("Multi-Factor Authentication");
    await page.waitForTimeout(2000);

    // 11. Click Level 4 node "BEC-1.1" and save its current border color
    const bec11Tooltip =
      "Is multi-factor authentication enabled for all email accounts?";
    const bec11Color = await navigatorPage.getNodeBorderColor(
      4,
      bec11Tooltip,
      true,
    );
    console.log(`BEC-1.1 node color saved: ${bec11Color}`);
    await navigatorPage.clickLevel4NodeByPartialTooltip(bec11Tooltip);
    await page.waitForTimeout(2000);

    // 12. Click the "Original Question" button from the side menu
    await navigatorPage.clickOriginalQuestion();
    await page.waitForTimeout(2000);
    console.log('Clicked "Original Question".');

    // 13. Select a random answer from the question panel
    const { answerText, partialMeta } =
      await navigatorPage.selectRandomAnswerInNavigator();
    await page.waitForTimeout(2000);
    console.log(
      `Random answer selected: "${answerText}"${partialMeta ? ` | partialMeta: ${JSON.stringify(partialMeta)}` : ""}`,
    );

    // 14. Click the Save button
    await navigatorPage.clickSaveButton();

    // 15. Wait for "Control Updated!" toast to appear and disappear
    await navigatorPage.waitForControlUpdatedToast();
    await page.waitForTimeout(2000);

    // 16. Determine expected node border color based on selected answer
    const expectedColor = navigatorPage.getExpectedColorForAnswer(
      answerText,
      partialMeta,
    );
    console.log(
      `Expected border color for answer "${answerText}": ${expectedColor}`,
    );

    // 17. Verify the BEC-1.1 node border color reflects the selected answer
    await navigatorPage.verifyNodeBorderColorMatch(
      4,
      bec11Tooltip,
      true,
      expectedColor,
    );
  });
});
