const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const NavigatorEntityLeader = require("../../../pages/EntityLeader/Controls/navigatorEntityLeader");

const TIMEOUTS = {
  // Larger than the Secure spec's 300000 because this spec also provisions its
  // own sub-entity before it can reach the Navigator.
  LONG: 600000,
};

const ENTITY_PREFIX = "CNEL_Entity";

// The node path down to a single Business Email Compromise question. That is
// the framework this spec provisions its entity with, so these tooltips resolve
// here exactly as they do for an admin.
const BEC_NODES = {
  LEVEL_1: "Protect",
  LEVEL_2: "Access Controls",
  LEVEL_3: "Multi-Factor Authentication",
  // Level 4 is matched on a PARTIAL tooltip - the node renders the question
  // text, not the "BEC-1.1" control id.
  LEVEL_4_PARTIAL:
    "Is multi-factor authentication enabled for all email accounts?",
};

const storageStatePath = path.join(
  process.cwd(),
  "storageState.entityLeader.json",
);

test.describe("Entity Leader Controls Navigator Tests", () => {
  // Runs as the ENTITY LEADER, reusing the session ELS - 01 saved. That spec is
  // this app's login step, so it has to have completed before this one runs -
  // without the file the run lands on the login screen, not the upperdeck.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // THIS SPEC CHANGES ONE ANSWER, and that is why it builds its own entity.
  //
  // Step 7 answers the BEC-1.1 question through the Navigator and saves it,
  // because the whole point of the case is that the node recolours to match.
  // The Secure CN - 01 can do that freely: it creates its own client and
  // answers a question nothing else looks at. This role has no client to
  // create, so the equivalent isolation is a sub-entity of its own -
  // answering on SCEL_Entity instead would rewrite an answer AFEL - 01 checks.
  //
  // The dedicated entity also disambiguates the node lookup. The Secure page
  // object takes the FIRST level-4 node whose tooltip matches, and by now the
  // client holds a dozen-odd Business Email Compromise sub-entities that each
  // have a BEC-1.1 node with this exact tooltip - see scopeToEntity() in the
  // page object for how that is narrowed, and for what happens if the Navigator
  // turns out not to offer the entity dropdown that Controls > Table does.
  //
  // Nothing is stored: the Secure spec stores nothing either, and the one value
  // that crosses steps - the answer just selected - is used inside the same
  // test.
  let navigatorEntityLeader;

  test.beforeEach(async ({ page }) => {
    navigatorEntityLeader = new NavigatorEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for an entity leader the app routes to the client's upperdeck.
    await navigatorEntityLeader.goto("/");
    await navigatorEntityLeader.waitForLoad();
  });

  test("CNEL - 01 | @smoke Controls Navigator - Verify the colors combination", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1. Arrival, not navigation - the session puts this role on the upperdeck.
    //    This replaces the Secure spec's /clients navigation and client
    //    creation entirely.
    await navigatorEntityLeader.ensureOnUpperdeck();

    // 2/3. Create the sub-entity this spec answers a question on, on Business
    //      Email Compromise - the framework the node path below belongs to.
    await navigatorEntityLeader.navigateToMultiEntity();
    const entityName =
      await navigatorEntityLeader.createEntityWithBEC(ENTITY_PREFIX);

    // 4. Visit the collection. Also not decoration: the Controls side-menu item
    //    only resolves once the app is inside the entity.
    await navigatorEntityLeader.openEntityCollection(entityName);

    // 5. Collection -> Controls -> Navigator, then narrow it to this entity so
    //    the node walked below is this entity's and not another spec's.
    await navigatorEntityLeader.navigateToNavigator();
    await navigatorEntityLeader.scopeToEntity(entityName);

    // 6. Open the root score and check it is rendered in the colour band its
    //    value falls into. The page object owns the assertion.
    await navigatorEntityLeader.clickRootScore();
    await navigatorEntityLeader.verifyScoreColorCombination();

    // 7. Walk down to the BEC-1.1 question node.
    await navigatorEntityLeader.clickLevel1Node(BEC_NODES.LEVEL_1);
    await navigatorEntityLeader.clickLevel2Node(BEC_NODES.LEVEL_2);
    await navigatorEntityLeader.clickLevel3Node(BEC_NODES.LEVEL_3);

    // 8. Save the node's colour BEFORE answering, then open it. Read first so
    //    the run can show the colour actually moved rather than happening to
    //    already match.
    const colorBefore = await navigatorEntityLeader.getNodeBorderColor(
      4,
      BEC_NODES.LEVEL_4_PARTIAL,
      true,
    );
    console.log(`Node colour before answering: ${colorBefore}`);
    await navigatorEntityLeader.clickLevel4NodeByPartialTooltip(
      BEC_NODES.LEVEL_4_PARTIAL,
    );

    // 9. Answer the question from the Navigator's own question panel and save.
    //    The toast is waited on inside the page object - the node recolours
    //    off the saved value, so reading the border first would race the save.
    await navigatorEntityLeader.clickOriginalQuestion();
    const { answerText, partialMeta } =
      await navigatorEntityLeader.selectRandomAnswer();
    await navigatorEntityLeader.saveAndWaitForToast();

    // 10. Derive the colour that answer should produce. A pure lookup, never
    //     read off the screen the assertion is about to check.
    const expectedColor = navigatorEntityLeader.getExpectedColorForAnswer(
      answerText,
      partialMeta,
    );
    console.log(
      `Node colour - before ${colorBefore} | expected after "${answerText}" ${expectedColor}`,
    );

    // 11. The node border has to now carry that colour. The page object reloads
    //     first: the Navigator does not repaint a node in place after a save.
    await navigatorEntityLeader.verifyNodeBorderColorMatch(
      4,
      BEC_NODES.LEVEL_4_PARTIAL,
      true,
      expectedColor,
    );
  });
});
