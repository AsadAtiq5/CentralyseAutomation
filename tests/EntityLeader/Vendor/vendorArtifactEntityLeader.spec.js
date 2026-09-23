const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const VendorArtifactEntityLeader = require("../../../pages/EntityLeader/Vendor/vendorArtifactEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

// VAEL - 01 and VAEL - 05 both build a vendor AND wait out the artifact list
// rebuild, which is a fixed three minutes inside waitForAssignmentsToast().
const TIMEOUTS = {
  LONG: 900000,
  MEDIUM: 600000,
};

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_VENDOR_ARTIFACT;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

// Prefixes for the two vendors this suite builds. Short because the vendor name
// field caps at 20 characters and the generator appends a timestamp.
const PREFIXES = {
  DOCUMENT_VENDOR: "ArtVEL",
  UPLOAD_VENDOR: "UpArtVEL",
  ARTIFACT: "TestDocument",
  UPLOAD_ARTIFACT: "UploadArt",
};

const ARTIFACT_FILE = "filesTest/Files/testFile.pdf";

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
      `Missing "${key}" in ${FILE}. Run ${producer} in tests/EntityLeader/Vendor/vendorArtifactEntityLeader.spec.js before this spec.`,
    );
  }
  return value;
};

test.describe("Entity Leader Vendor Artifacts Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // HOW THIS PORT DIFFERS FROM tests/Secure/Vendor/vendorArtifacts.spec.js
  //
  //   - NO CLIENTS ARE CREATED. The Secure spec builds TWO clients, one per
  //     stream. This role has no /clients screen, so the same separation is kept
  //     one level down as TWO VENDORS in the client ELS - 01 provisioned:
  //       * ArtVEL   - VAEL - 01 / 02 / 03 / 04, documents added via "Add New"
  //       * UpArtVEL - VAEL - 05 / 06, a manually uploaded artifact
  //     Keeping them apart is not tidiness: VAEL - 06 deletes a row, and
  //     VAEL - 02 and VAEL - 04 both act on "the first artifact row", so one
  //     shared vendor would let the delete reach a row those tests depend on.
  //
  //   - EVERY TEST DEEP LINKS. The Secure navigateToVendorArtifacts() walks the
  //     clients list and needs three page objects passed in; this role goes
  //     straight to /third-party/<clientId>/vendors and clicks in from there.
  //
  // ORDERING - VAEL - 02 / 03 / 04 need the vendor and artifact from VAEL - 01;
  // VAEL - 06 needs the vendor and upload from VAEL - 05. All in the SAME run:
  // ELS - 01 provisions a brand new client on every invocation, so a vendor name
  // left over from a previous run points at a client this session's leader
  // cannot reach.
  let vendorArtifacts;

  test.beforeEach(async ({ page }) => {
    vendorArtifacts = new VendorArtifactEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck. Each test
    // navigates on from there itself.
    await vendorArtifacts.goto("/");
    await vendorArtifacts.waitForLoad();
  });

  test("VAEL - 01 | @smoke Vendor Artifacts - Add new artifact", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Arrival, not client creation.
    const clientId = await vendorArtifacts.openVendorsForThisClient();
    console.log(`Operating on client: ${clientId}`);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VA_CLIENT_ID,
      clientId,
      FILE,
      SCOPE,
    );

    // 2) Build the document stream's vendor.
    const vendorName = await vendorArtifacts.createVendorForArtifacts(
      PREFIXES.DOCUMENT_VENDOR,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VA_VENDOR_NAME,
      vendorName,
      FILE,
      SCOPE,
    );

    // 3) Into the vendor's Artifacts tab, with the Documents section selected.
    await vendorArtifacts.openVendorArtifacts(clientId, vendorName);

    // 4) Count before, purely so the log shows what the vendor started with.
    const countBefore = await vendorArtifacts.getDocumentsCount();
    console.log(`Documents count before upload: ${countBefore}`);

    // 5) Add the artifact and confirm it is listed.
    const artifactName = await vendorArtifacts.addArtifact(
      PREFIXES.ARTIFACT,
      ARTIFACT_FILE,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VA_ARTIFACT_NAME,
      artifactName,
      FILE,
      SCOPE,
    );
    await vendorArtifacts.verifyArtifactInList(artifactName);
  });

  test("VAEL - 02 | @regression Vendor Artifacts - Verify the artifact gap status", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientId = required(
      FILE_KEYS.ENTITY_LEADER_VA_CLIENT_ID,
      "VAEL - 01",
    );
    const vendorName = required(
      FILE_KEYS.ENTITY_LEADER_VA_VENDOR_NAME,
      "VAEL - 01",
    );

    await vendorArtifacts.openVendorArtifacts(clientId, vendorName);
    await vendorArtifacts.gapFirstArtifact("Automated gap comment");
    await vendorArtifacts.verifyFirstArtifactStatus("Excluded");
  });

  // PARKED, mirroring the Secure VA - 03, which is skipped in
  // tests/Secure/Vendor/vendorArtifacts.spec.js. The body is kept in full and
  // the number is kept so VAEL - 04 still lines up with VA - 04.
  //
  // This port does NOT un-park it: doing so would be a change to what the suite
  // asserts, taken on the back of a test nobody has run recently, and the
  // approve flow has never been exercised as this role. Un-park it together with
  // the Secure one, not on its own.
  test.skip("VAEL - 03 | @regression Vendor Artifacts - Verify the artifact approve status", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    const clientId = required(
      FILE_KEYS.ENTITY_LEADER_VA_CLIENT_ID,
      "VAEL - 01",
    );
    const vendorName = required(
      FILE_KEYS.ENTITY_LEADER_VA_VENDOR_NAME,
      "VAEL - 01",
    );

    await vendorArtifacts.openVendorArtifacts(clientId, vendorName);

    // A fresh artifact to approve, so this test does not depend on the status
    // VAEL - 02 left on the existing row.
    const artifactName = await vendorArtifacts.addArtifact(
      "ApproveDocument",
      ARTIFACT_FILE,
    );
    await vendorArtifacts.verifyArtifactInList(artifactName);

    await vendorArtifacts.approveFirstArtifact();
    await vendorArtifacts.verifyFirstArtifactStatus("Approved");
  });

  test("VAEL - 04 | @regression Vendor Artifacts - Verify the artifact deny status", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientId = required(
      FILE_KEYS.ENTITY_LEADER_VA_CLIENT_ID,
      "VAEL - 01",
    );
    const vendorName = required(
      FILE_KEYS.ENTITY_LEADER_VA_VENDOR_NAME,
      "VAEL - 01",
    );

    await vendorArtifacts.openVendorArtifacts(clientId, vendorName);
    await vendorArtifacts.denyFirstArtifact("Automated deny comment");
    await vendorArtifacts.verifyFirstArtifactStatus("Excluded");
  });

  test("VAEL - 05 | @smoke Vendor Artifacts - Upload Artifact", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // Reuses the client id VAEL - 01 stored when it is there, and resolves it
    // itself otherwise, so this stream can be run on its own.
    const storedClientId = TestData.getKey(
      FILE_KEYS.ENTITY_LEADER_VA_CLIENT_ID,
      FILE,
      SCOPE,
    );
    const clientId =
      storedClientId || (await vendorArtifacts.openVendorsForThisClient());
    if (!storedClientId) {
      TestData.setKey(
        FILE_KEYS.ENTITY_LEADER_VA_CLIENT_ID,
        clientId,
        FILE,
        SCOPE,
      );
    } else {
      await vendorArtifacts.openVendorsForThisClient();
    }
    console.log(`Operating on client: ${clientId}`);

    // Build the upload stream's own vendor - see the note on the two streams.
    const vendorName = await vendorArtifacts.createVendorForArtifacts(
      PREFIXES.UPLOAD_VENDOR,
    );
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_VA_UPLOAD_VENDOR_NAME,
      vendorName,
      FILE,
      SCOPE,
    );

    await vendorArtifacts.openVendorArtifacts(clientId, vendorName);
    await vendorArtifacts.uploadManualArtifact(
      PREFIXES.UPLOAD_ARTIFACT,
      ARTIFACT_FILE,
    );
    await vendorArtifacts.verifyManuallyUploadedArtifact();

    // And again after a full reload. The row above renders optimistically, so
    // without this the test can pass on an upload that never reached the
    // backend - which then fails VAEL - 06 instead, pointing at the wrong step.
    await vendorArtifacts.verifyManualArtifactPersisted(clientId, vendorName);
  });

  test("VAEL - 06 | @regression Vendor Artifacts - Delete uploaded artifact", async () => {
    test.setTimeout(TIMEOUTS.MEDIUM);

    const clientId = required(
      FILE_KEYS.ENTITY_LEADER_VA_CLIENT_ID,
      "VAEL - 01 or VAEL - 05",
    );
    const vendorName = required(
      FILE_KEYS.ENTITY_LEADER_VA_UPLOAD_VENDOR_NAME,
      "VAEL - 05",
    );

    await vendorArtifacts.openVendorArtifacts(clientId, vendorName);
    await vendorArtifacts.deleteManualArtifact();
    await vendorArtifacts.verifyManuallyUploadedArtifactGone();
  });
});
