const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../pages/Secure/ManagementPage");
const InstanceSettingsPage = require("../../pages/Secure/InstanceSettingsPage");
const AddClientPage = require("../../pages/Secure/AddClientPage");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

const TIMEOUTS = {
  SHORT: 120000,
  LONG: 180000,
  DEFAULT: 60000,
};

test.describe("Instance Settings Verification Tests", () => {
  let managementPage;
  let instanceSettingsPage;
  let addClientPage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    instanceSettingsPage = new InstanceSettingsPage(page);
    addClientPage = new AddClientPage(page);
    await managementPage.goto("/clients");
    await page
      .waitForLoadState("networkidle", { timeout: 60000 })
      .catch(() => {});
  });

  async function openInstanceSettings() {
    await managementPage.waitForSpinnerHidden(".spinner", TIMEOUTS.DEFAULT);
    await managementPage.clickProfileIcon();
    await instanceSettingsPage.clickInstanceSettings();
    await instanceSettingsPage.verifyInstancePopup();
  }

  async function saveInstanceSettingsAndOpenClientPopup() {
    await instanceSettingsPage.clickInstancePopupSaveButton();
    await managementPage.waitForHidden(
      '#toast-container .toast-message:has-text("Saving Settings...")',
      TIMEOUTS.DEFAULT,
    );
    await managementPage.waitForNetworkIdle();
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
  }

  test("IS - 01 | @regression Verify randomly selected risks from instance settings appear in add client popup", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await openInstanceSettings();
    await instanceSettingsPage.unselectAllRisks();
    const selectedRisks = await instanceSettingsPage.randomlySelectSubtab();
    console.log("Selected Risks:", selectedRisks);
    await saveInstanceSettingsAndOpenClientPopup();
    await addClientPage.verifyRiskSelectionsInClientPopup(selectedRisks);
  });

  test("IS - 02 | @regression Verify randomly selected compliances from instance settings appear in add client popup", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await openInstanceSettings();
    await instanceSettingsPage.clickComplianceTab();
    await instanceSettingsPage.unselectAllCompliances();
    const selectedCompliances =
      await instanceSettingsPage.randomlySelectSubtab();
    console.log("Selected Compliances:", selectedCompliances);
    await saveInstanceSettingsAndOpenClientPopup();
    await addClientPage.clickComplianceTab();
    await addClientPage.verifyComplianceSelectionsInClientPopup(
      selectedCompliances,
    );
  });

  // test.skip("@regression Verify randomly selected custom risks and compliances from instance settings appear in add client popup", async () => {
  //   test.setTimeout(TIMEOUTS.LONG);
  //   await openInstanceSettings();
  //   await instanceSettingsPage.clickCustomTab();
  //   await instanceSettingsPage.unselectAllCustomItems();
  //   await managementPage.waitForNetworkIdle();
  //   await managementPage.page.waitForTimeout(2000);
  //   const randmomRisks = await instanceSettingsPage.randomlySelectRisk();
  //   console.log('Selected Risks:', randmomRisks);
  //   const randomCompliances = await instanceSettingsPage.randomlySelectCompliance();
  //   console.log('Selected Compliances:', randomCompliances);
  //   await saveInstanceSettingsAndOpenClientPopup();
  //   await addClientPage.clickCustomTab();
  //   await addClientPage.verifyFrameworkSelectionsInClientPopup("Risk", randmomRisks);
  //   await addClientPage.verifyFrameworkSelectionsInClientPopup("Compliance", randomCompliances);
  // });

  test("IS - 03 | @regression Setting All risk and compliances", async () => {
    test.setTimeout(TIMEOUTS.LONG);
    await openInstanceSettings();
    await instanceSettingsPage.selectAll();
    await instanceSettingsPage.clickInstancePopupSaveButton();
    await instanceSettingsPage.waitForFrameworkSettingsSavedToast();
  });
});
