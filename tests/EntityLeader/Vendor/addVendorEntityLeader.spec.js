const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const AddVendorEntityLeader = require("../../../pages/EntityLeader/Vendor/addVendorEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");
const { fetchPageURL } = require("../../../helpers/common/fetchPageURL");

const TIMEOUTS = {
  SHORT: 180000,
  MEDIUM: 240000,
  LONG: 300000,
};

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_VENDOR;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

// Vendor name prefixes. All are short because the app caps a vendor name at 20
// characters and the page object appends a timestamp to whatever it is given.
const PREFIXES = {
  MAIN: "VenEL",
  UPDATED: "UpdEL",
  REQUIREMENT: "ReqEL",
  DELETE: "DelEL",
};

// The requirement upload fixture, shared with the Secure VE - 03.
const REQUIREMENT_FILE = path.join(
  process.cwd(),
  "filesTest/Files/testFile.pdf",
);

// Download options that finish with "Report is generated successfully". Kept
// separate from Executive Summary, which raises a different toast, and from
// Single Vendor Report, which raises none.
const GENERATED_REPORT_OPTIONS = [
  "General Report (XLS)",
  "General Report (CSV)",
  "Current View (XLS)",
  "Current View (CSV)",
];

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

// Reads a key this suite stored, naming the producer when it is missing - a
// missing key means an earlier test has not run, not a bug in this one.
const required = (key, producer) => {
  const value = TestData.getKey(key, FILE, SCOPE);
  if (value === undefined || value === null || value === "") {
    throw new Error(
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Vendor/addVendorEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Vendor Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // HOW THIS PORT DIFFERS FROM tests/Secure/addVendor.spec.js
  //
  //   - NO CLIENT IS CREATED. The Secure VE - 01 and VE - 03 each build a
  //     client of their own (VendorClient / ReqCertClient) through /clients.
  //     This role has no /clients screen - the restored session lands it inside
  //     the single client ELS - 01 provisioned - so every test here works in
  //     that one client and VEEL - 03 creates only the vendor it needs.
  //
  //   - THE CLIENT ID IS AVAILABLE UP FRONT. The Secure spec can only learn it
  //     from the vendor collection URL, after VE - 01 has created a vendor.
  //     This role's landing URL already carries it, so VEEL - 01 stores it
  //     before creating anything and every later test navigates straight to
  //     /third-party/<clientId>/vendors.
  //
  //   - VENDOR NAMES ARE ALWAYS SHORT. See the note in the page object.
  //
  // ORDERING - VEEL - 02 renames the vendor VEEL - 01 created and stores the
  // new name under the same key; VEEL - 05 and VEEL - 06 then read that name.
  // VEEL - 03 and VEEL - 04 own the vendors they create and hand nothing on.
  let vendorPage;

  test.beforeEach(async ({ page }) => {
    vendorPage = new AddVendorEntityLeader(page);

    // Once VEEL - 01 has stored the client id, go straight to the vendors
    // list - that skips the upperdeck arrival and the sidemenu walk for every
    // test after the first. With no id yet, "/" is enough: the restored session
    // decides where this role lands, and for an entity leader the app routes to
    // the client's upperdeck.
    const clientId = TestData.getKey(
      FILE_KEYS.ENTITY_LEADER_VENDOR_CLIENT_ID,
      FILE,
      SCOPE,
    );
    if (clientId) {
      await vendorPage.openVendorsScreen(clientId);
    } else {
      await vendorPage.goto("/");
    }
    await vendorPage.waitForLoad();
    await vendorPage.waitForSpinner();
  });

  // ─── SMOKE ─────────────────────────────────────────────────────────────────

  test("VEEL - 01 | @smoke Add Vendor", async ({ page }) => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Arrival, not client creation - this replaces the whole of the Secure
    //    VE - 01's client setup. Re-entrant, so a re-run that already has the
    //    stored client id and starts on the vendors screen still works.
    const clientId = await vendorPage.openVendorsForThisClient();
    console.log(`Operating on client: ${clientId}`);

    // 2) Store the client id first. Every later test's beforeEach reads it, and
    //    it is knowable here whether or not the vendor creation below succeeds.
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VENDOR_CLIENT_ID,
      clientId,
      FILE,
      SCOPE,
    );

    // 3) Create the vendor the rest of the suite operates on.
    const vendorName = await vendorPage.createVendor(PREFIXES.MAIN);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VENDOR_NAME,
      vendorName,
      FILE,
      SCOPE,
    );

    // 4) Into the vendor, then to its collection.
    await vendorPage.openVendorByName(vendorName);
    await vendorPage.openVendorCollection();

    // 5) The collection URL carries both UUIDs: uuids[0] = clientID,
    //    uuids[1] = vendorID. The client id is read again here rather than
    //    trusted from step 2 - if the two ever disagreed, the navigation
    //    shortcut in beforeEach would be pointing at the wrong client.
    const uuids = fetchPageURL(page.url());
    console.log(`UUIDs on the collection URL: ${JSON.stringify(uuids)}`);
    expect(uuids.length).toBeGreaterThan(1);
    expect(uuids[0]).toBe(clientId);
    TestData.setKey(FILE_KEYS.ENTITY_LEADER_VENDOR_UUID, uuids[1], FILE, SCOPE);

    // 6) The vendor is only usable once its framework produced questions.
    const questionCount = await vendorPage.getCollectionQuestionCount();
    console.log(`Question count - expected > 0 | actual ${questionCount}`);
    expect(questionCount).toBeGreaterThan(0);
  });

  // ─── REGRESSION ────────────────────────────────────────────────────────────
  // beforeEach already navigates to /third-party/<clientId>/vendors, so these
  // tests only need to find the vendor and act on it.

  test("VEEL - 02 | @regression Update Vendor Information from vendor details", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    const vendorName = required(
      FILE_KEYS.ENTITY_LEADER_VENDOR_NAME,
      "VEEL - 01",
    );

    await vendorPage.openVendorByName(vendorName);
    const updatedVendorName = await vendorPage.renameOpenVendor(
      PREFIXES.UPDATED,
    );

    // Overwrites the SAME key: VEEL - 05 and VEEL - 06 have to find the vendor
    // under its current name, and the old one no longer exists in the list.
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VENDOR_NAME,
      updatedVendorName,
      FILE,
      SCOPE,
    );
  });

  test("VEEL - 03 | @regression Verify a new requirement is listed in the vendor Artifacts", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    // The Secure VE - 03 creates a dedicated ReqCertClient for this flow. This
    // role cannot create a client, so the vendor is built in the shared one -
    // which is safe here because nothing in this test reads a client-wide
    // figure; it only ever asserts on the vendor it just made.
    await vendorPage.ensureOnVendorsScreen();

    const vendorName = await vendorPage.openAddVendorPopupAndFillDetails(
      PREFIXES.REQUIREMENT,
    );
    await vendorPage.selectFrameworkAndContinue();

    // The requirement is added on the wizard's third page, before the domain.
    const requirementName = await vendorPage.addRequirementWithFile(
      PREFIXES.REQUIREMENT,
      REQUIREMENT_FILE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VENDOR_REQUIREMENT_NAME,
      requirementName,
      FILE,
      SCOPE,
    );

    await vendorPage.addDomainAndComplete();

    await vendorPage.openVendorByName(vendorName);
    await vendorPage.verifyRequirementInArtifacts(requirementName);
  });

  test("VEEL - 04 | @regression Delete Vendor", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    // Creates its own vendor to delete rather than removing the one VEEL - 01
    // made - that one is still needed by VEEL - 05 and VEEL - 06.
    await vendorPage.ensureOnVendorsScreen();
    const vendorName = await vendorPage.createVendor(PREFIXES.DELETE);

    await vendorPage.deleteVendorByName(vendorName);
    await vendorPage.verifyVendorNotVisible(vendorName);
  });

  test("VEEL - 05 | @regression Verify user can add questionnaire", async () => {
    test.setTimeout(TIMEOUTS.SHORT);

    const vendorName = required(
      FILE_KEYS.ENTITY_LEADER_VENDOR_NAME,
      "VEEL - 01 (renamed by VEEL - 02)",
    );

    await vendorPage.openVendorByName(vendorName);
    const selectedFramework =
      await vendorPage.addRandomQuestionnaireFramework();
    await vendorPage.verifyFrameworkInVendorCollection(selectedFramework);
  });

  test("VEEL - 06 | @regression Download Vendor Report", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const vendorName = required(
      FILE_KEYS.ENTITY_LEADER_VENDOR_NAME,
      "VEEL - 01 (renamed by VEEL - 02)",
    );

    // Options that confirm with "Report is generated successfully".
    for (const option of GENERATED_REPORT_OPTIONS) {
      await vendorPage.downloadGeneratedReport(option);
    }

    // Executive Summary confirms with "Report downloaded successfully".
    await vendorPage.downloadExecutiveSummary();

    // Single Vendor Report needs a vendor selected first.
    await vendorPage.downloadSingleVendorReport(vendorName);
  });
});
