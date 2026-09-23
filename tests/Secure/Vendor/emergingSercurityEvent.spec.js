const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const EmergingSecurityContent = require("../../../pages/Secure/Vendor/EmergingSecurityContent");
const TestData = require("../../../constant/testData");
const { TEST_DATA_FILE_ENUMS, FILE_KEYS } = require("../../../constant/enums");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe("Emerging Security Event Tests", () => {
  let managementPage;
  let addClientPage;
  let addVendorPage;
  let esePage;

  test.beforeEach(async ({ page }) => {
    managementPage = new ManagementPage(page);
    addClientPage = new AddClientPage(page);
    addVendorPage = new AddVendorPage(page);
    esePage = new EmergingSecurityContent(page);
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();
    await managementPage.waitForSpinner();
  });

  test("ESE - 01 | @smoke Add ESE Client and Vendor", async () => {
    test.setTimeout(180000);

    // 1. Create a new client with name prefix "ESE" and go to vendor screen
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("ESE");
    TestData.setKey(
      FILE_KEYS.ESE_CLIENT_NAME,
      clientName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();

    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();

    // 2. Create a new vendor
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName = await addVendorPage.createUniqueVendorName("ESE");
    TestData.setKey(
      FILE_KEYS.ESE_VENDOR_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await addVendorPage.createUniquePOCName("POC");
    await addVendorPage.createUniquePOCEmail(vendorName);
    await addVendorPage.clickNextButton();
    await addVendorPage.selectAIGovernanceFramework();
    await addVendorPage.clickNextButton();
    await addVendorPage.clickAddDomainButton();
    await addVendorPage.createUniqueDomainName("domain");
    await addVendorPage.clickCompleteButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.waitForAddVendorPopupHidden();
    await addVendorPage.waitForInProgressVendorStatusHidden();

    // 3. Select the vendor from the list via checkbox
    const vendorLocator = addVendorPage.page.locator(
      `//div[contains(@class,'company-name') and .//span[normalize-space(text())='${vendorName}']]`,
    );
    const isVisible = await vendorLocator.isVisible().catch(() => false);
    if (!isVisible) {
      await addVendorPage.page.reload();
      await addVendorPage.waitForSpinner();
    }
    await addVendorPage.verifyVendorVisible(vendorName);
    await addVendorPage.checkVendorByName(vendorName);
    await addVendorPage.waitForSpinner();

    // 4. Click the ESE icon
    await esePage.clickEseIcon();
    await esePage.waitForSpinner();

    // 5. Choose Build in the chooser modal, then verify the ESE popup is opened
    await esePage.clickEseBuildOption();
    await esePage.verifyEsePopup();

    // 6. Enter event name and due date
    const eventName = `ESE_Event_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.ESE_EVENT_NAME,
      eventName,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );
    await esePage.enterEventName(eventName);
    await esePage.selectDueDate();

    // 7. Click Add Question and fill the question row
    await esePage.clickAddQuestion();
    const questionData = {
      function: "Security",
      category: "ESE Category",
      subCategory: "ESE Sub",
      controlName: "ESE Control",
      controlLabel: "ESE Label",
      question: "Is your organization prepared for emerging security threats?",
      remediationTask: "Implement security controls and monitoring",
      supplementedGuide: "Review security guidelines",
      severity: "Critical",
      mandatoryArtifacts: "True",
      mandatoryComments: "True",
    };
    await esePage.fillQuestionRow(questionData);
    TestData.setKey(
      FILE_KEYS.ESE_QUESTION_DATA,
      questionData,
      TEST_DATA_FILE_ENUMS.VENDOR,
    );

    // 8. Click Save
    await esePage.clickSaveButton();
    await esePage.waitForSpinner();

    // 9. Click Complete
    await esePage.clickCompleteButton();
    await esePage.waitForSpinner();

    // 10. Wait for success popup and click OK
    await esePage.waitForSuccessPopup();
    await esePage.clickOkButton();
    await addVendorPage.waitForSpinner();

    // 11. Click on the vendor and go to its collection screen
    await addVendorPage.waitForInProgressVendorStatusHidden();
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();

    // 12. Open the ESE event card from the collection list
    await esePage.openEseEventCard();
    await addVendorPage.waitForSpinner();

    // 13. Verify the question data on the collection screen
    await esePage.verifyQuestionData(questionData);
  });
});
