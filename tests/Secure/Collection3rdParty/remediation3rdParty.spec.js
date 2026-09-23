const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const Remediation3rdParty = require("../../../pages/Secure/Collection 3rd Party/Remediation3rdParty");
const CollectionPage = require("../../../pages/Secure/CollectionPage");
const QuestionEngine = require("../../../pages/Secure/Collection/QuestionEngine");
const ManagementPage = require("../../../pages/Secure/ManagementPage");
const AddVendorPage = require("../../../pages/Secure/AddVendorPage");
const AddClientPage = require("../../../pages/Secure/AddClientPage");
const { readJsonFileFromRoot } = require("../../../helpers/common/helper");
const {
  getAnswerOptions,
} = require("../../../helpers/collection/answerOptionsHelper");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");
const {
  REMEDIATION_ENUMS,
  FILE_KEYS,
  TEST_DATA_FILE_ENUMS,
} = require("../../../constant/enums");
const TestData = require("../../../constant/testData");

const storageStatePath = path.join(process.cwd(), "storageState.json");
if (fs.existsSync(storageStatePath)) {
  test.use({ storageState: storageStatePath });
}

test.describe.serial("Remediation 3rd Party Module Testing", () => {
  let remediationPage;
  let collectionPage;
  let questionEngine;
  let managementPage;
  let addVendorPage;
  let addClientPage;
  let rootEntityId = "";
  let vendorId = "";

  test.beforeEach(async ({ page }) => {
    test.setTimeout(1200000);
    remediationPage = new Remediation3rdParty(page);
    collectionPage = new CollectionPage(page);
    questionEngine = new QuestionEngine(page);
    managementPage = new ManagementPage(page);
    addVendorPage = new AddVendorPage(page);
    addClientPage = new AddClientPage(page);

    rootEntityId = TestData.getKey(
      FILE_KEYS.ENTITY_ID,
      TEST_DATA_FILE_ENUMS.REMEDIATION_3RD_PARTY,
    );
    vendorId = TestData.getKey(
      FILE_KEYS.VENDOR_UUID,
      TEST_DATA_FILE_ENUMS.REMEDIATION_3RD_PARTY,
    );

    // If both IDs are already saved (setup has run), navigate directly to the gaps page.
    // This applies to RM3P - 01 through RM3P - 05 after RM3P - 00 completes.
    if (rootEntityId && vendorId) {
      await remediationPage.goto(
        `third-party/${rootEntityId}/gaps/${vendorId}`,
      );
      await remediationPage.waitForLoad();
    }
    // For RM3P - 00 (setup), the hook navigates to /clients, so no navigation happens here
  });

  // ─── SMOKE ─────────────────────────────────────────────────────────────────
  // This test is fully standalone: it creates its own client, creates a vendor,
  // answers all questions, and saves both the clientID and vendorID to testData.
  // This data is used by all regression tests below.
  // *** MUST RUN FIRST IN SERIAL MODE ***
  test("RM3P - 00 | @smoke Setup: Create Client, Vendor, and Answer Questions", async ({
    page,
  }) => {
    test.setTimeout(600000);

    // 1. Navigate to clients (setup requires initial navigation)
    await managementPage.goto("/clients");
    await managementPage.waitForLoad();

    // 2. Create a dedicated client for remediation 3rd party tests
    await managementPage.clickAddClientButton();
    await addClientPage.verifyClientPopup();
    const clientName = await addClientPage.createUniqueClientName("VenClient");
    await addClientPage.selectIndustry();
    await addClientPage.enterFirstPartyUrl("");
    await addClientPage.clickAddClientButton();

    // 3. Navigate to the new client and then to vendors
    await managementPage.searchAndClickClient(clientName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickThirdPartySidemenu();
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickVendorSidemenu();
    await addVendorPage.waitForSpinner();

    // 3. Create the vendor
    await addVendorPage.clickAddVendorButton();
    await addVendorPage.waitForSpinner();
    await addVendorPage.verifyAddVendorPopup();
    const vendorName = await addVendorPage.createUniqueVendorName("Vendor");
    TestData.setKey(
      FILE_KEYS.VENDOR_ENTITY_NAME,
      vendorName,
      TEST_DATA_FILE_ENUMS.REMEDIATION_3RD_PARTY,
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

    // 4. Click into the vendor and navigate to collection
    await addVendorPage.verifyVendorVisible(vendorName);
    await addVendorPage.clickVendorByName(vendorName);
    await addVendorPage.waitForSpinner();
    await addVendorPage.clickCollectionSidemenu();
    await addVendorPage.waitForSpinner();

    // 5. Get the framework name (already selected from vendor creation)
    const frameworkName = await collectionPage.getFrameworkName(0);
    console.log("Framework Name:", frameworkName);

    // 6. Extract both UUIDs from the collection URL and save them:
    //    uuids[0] = clientID, uuids[1] = vendorID
    const uuids = fetchPageURL(page.url());
    if (uuids.length > 0) {
      TestData.setKey(
        FILE_KEYS.ENTITY_ID,
        uuids[0],
        TEST_DATA_FILE_ENUMS.REMEDIATION_3RD_PARTY,
      );
    }
    if (uuids.length > 1) {
      TestData.setKey(
        FILE_KEYS.VENDOR_UUID,
        uuids[1],
        TEST_DATA_FILE_ENUMS.REMEDIATION_3RD_PARTY,
      );
    }

    // 7. Answer all questions and save the answers
    await addVendorPage.waitForLoad();
    const answers = await questionEngine.answerAllQuestions();
    TestData.setKey(
      FILE_KEYS.REMIDIATION_3RDPARY_ANSWERS,
      answers,
      TEST_DATA_FILE_ENUMS.REMEDIATION_3RD_PARTY,
    );
  });

  // ─── REGRESSION ────────────────────────────────────────────────────────────
  // Tests below only run AFTER RM3P - 00 completes (serial mode).
  // beforeEach now navigates directly to /third-party/{clientID}/gaps/{vendorID}
  // using the IDs saved by RM3P - 00 setup test.
  // ─────────────────────────────────────────────────────────────────────────

  // Verify task count from REMIDIATION_3RDPARY_ANSWERS against UI risk tasks count
  test("RM3P - 01 | @regression Verify that task count", async () => {
    const count = await remediationPage.getRiskTasksCount();
    console.log("UI Risk Tasks count:", count);

    const data = await readJsonFileFromRoot(
      "testData/Secure/remediation3rdParty.json",
    );
    if (!data) {
      throw new Error("JSON data is empty or invalid");
    }

    const questionData = data[FILE_KEYS.REMIDIATION_3RDPARY_ANSWERS];
    const filterData = questionData.filter(
      (d) => d.answer === "Partial" || d.answer === "No",
    );
    console.log("Filtered JSON data length:", filterData.length);

    expect(
      filterData.length,
      "Mismatch between UI count and JSON filtered data",
    ).toBe(count);
  });

  test("RM3P - 02 | @regression Accept task", async () => {
    const { statusTextLocator, expectedText } =
      await remediationPage.updateTask(REMEDIATION_ENUMS.ACCEPT);
    await expect(statusTextLocator).toHaveText(expectedText, {
      timeout: 60000,
    });
  });

  test("RM3P - 03 | Ignore task", async () => {
    const { severityLocator, statusTextLocator, expectedText, taskData } =
      await remediationPage.updateTask(REMEDIATION_ENUMS.IGNORE);
    console.log("Task Data: ", taskData);
    await Promise.all([
      expect(statusTextLocator).toHaveText(expectedText, { timeout: 60000 }),
      expect(severityLocator).toHaveText("n/a", { timeout: 60000 }),
    ]);

    const questionInfo =
      await remediationPage.searchForSelectedTaskQuestionInCollection(taskData);
    console.log("Question Info after Ignore:", questionInfo);
    expect(questionInfo?.severity?.toLowerCase()).toBe("n/a", {
      timeout: 60000,
    });
  });

  test("RM3P - 04 | Assign task", async () => {
    const questionInfo = await remediationPage.updateTaskExactAssign(
      REMEDIATION_ENUMS.ASSIGN,
    );
    await remediationPage.page.waitForTimeout(120000);
    console.log("Question Info after Assign:", questionInfo.assignment);
    expect(questionInfo.assignment.some((name) => name === "Tasmia")).toBe(
      true,
    );
  });

  test("RM3P - 05 | Remediate task", async () => {
    const { statusTextLocator, expectedText, taskData } =
      await remediationPage.updateTask(REMEDIATION_ENUMS.REMEDIATE);
    await expect(statusTextLocator).toHaveText(expectedText, {
      timeout: 60000,
    });

    const questionInfo =
      await remediationPage.searchForSelectedTaskQuestionInCollection(taskData);
    expect(questionInfo?.answerValue?.toLowerCase()).toBe("yes", {
      timeout: 60000,
    });
  });
});
