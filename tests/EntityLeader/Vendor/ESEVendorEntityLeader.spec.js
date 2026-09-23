const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const ESEVendorEntityLeader = require("../../../pages/EntityLeader/Vendor/ESEVendorEntityLeader");
const TestData = require("../../../constant/testData");
const {
  TEST_DATA_FILE_ENUMS,
  FILE_KEYS,
  APP_SCOPE,
} = require("../../../constant/enums");

const TIMEOUTS = {
  LONG: 600000,
};

const FILE = TEST_DATA_FILE_ENUMS.ENTITY_LEADER_ESE;
const SCOPE = APP_SCOPE.ENTITY_LEADER;

// Prefix for the vendor this spec builds, so it is identifiable in a client
// that also carries the vendor and score calculation suites' vendors. Short
// because the vendor name field caps at 20 characters and the generator appends
// a timestamp.
const VENDOR_PREFIX = "ESEVen";

// The question the ESE event publishes. Kept as one object so the same values
// drive both the form fill and the assertion on the collection - the test is
// only meaningful if those two cannot drift apart.
const QUESTION_DATA = {
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

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

test.describe("Entity Leader Emerging Security Event Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // HOW THIS PORT DIFFERS FROM
  // tests/Secure/Vendor/emergingSercurityEvent.spec.js
  //
  //   - NO CLIENT IS CREATED. The Secure ESE - 01 builds a dedicated ESE client
  //     so the vendor it publishes to is the only one on it. An entity leader
  //     has no /clients screen, so this port gets the same isolation one level
  //     down: a brand new VENDOR of its own, which is also what keeps the ESE
  //     event off every other vendor in the shared client - the builder
  //     publishes to whichever vendors are TICKED, so the selection in step 3
  //     is what bounds the blast radius.
  //
  //   - THE VENDOR NAME IS SHORT. See the note in the page object.
  //
  // NO DEPENDENCY ON ANY OTHER SPEC - this one builds everything it needs, so
  // it can run anywhere in the job after the login step.
  let esePage;

  test.beforeEach(async ({ page }) => {
    esePage = new ESEVendorEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck. The test
    // navigates on from there itself.
    await esePage.goto("/");
    await esePage.waitForLoad();
  });

  test("ESEEL - 01 | @smoke Add ESE event on a vendor as the entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Arrival, not client creation - the session puts this role inside its
    //    client, so the only thing to work out is the client id.
    const clientId = await esePage.openVendorsForThisClient();
    console.log(`Operating on client: ${clientId}`);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_ESE_CLIENT_ID,
      clientId,
      FILE,
      SCOPE,
    );

    // 2) Build the dedicated vendor the event is published to.
    const vendorName = await esePage.createVendorForEse(VENDOR_PREFIX);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_ESE_VENDOR_NAME,
      vendorName,
      FILE,
      SCOPE,
    );

    // 3) Tick it. The ESE builder publishes to the SELECTED vendors, so this is
    //    both what arms the flow and what stops the event reaching any other
    //    vendor in this shared client.
    await esePage.selectVendorByName(vendorName);

    // 4) Open the builder - the ESE icon, then Build in the chooser modal.
    await esePage.openEseBuilder();

    // 5) Fill the event header and one question row.
    const eventName = `ESE_Event_${Date.now()}`;
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_ESE_EVENT_NAME,
      eventName,
      FILE,
      SCOPE,
    );
    await esePage.buildEseEvent(eventName, QUESTION_DATA);
    TestData.setKey(
      FILE_KEYS.ENTITY_LEADER_ESE_QUESTION_DATA,
      QUESTION_DATA,
      FILE,
      SCOPE,
    );

    // 6) Save, complete and clear the acknowledgement popup.
    await esePage.saveAndCompleteEseEvent();

    // 7) The event only counts if it reached the vendor, so it is verified where
    //    a user would see it: on that vendor's own collection, not on the
    //    builder that created it.
    await esePage.openEseEventOnCollection(vendorName, clientId);
    await esePage.verifyQuestionData(QUESTION_DATA);
  });
});
