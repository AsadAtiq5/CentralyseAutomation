const { test } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const NavigatorSubEntityLeader = require("../../../pages/SubEntityLeader/Controls/navigatorSubEntityLeader");

const TIMEOUTS = {
  // Larger than the Secure spec's 300000 because this role reaches the
  // Navigator through the session redirect chain rather than a direct URL.
  LONG: 600000,
};

// The node path down to a single Business Email Compromise question. That is
// the framework SSEL - 01 provisions this role's entity with, so these tooltips
// resolve here exactly as they do for an admin.
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
  "storageState.subEntityLeader.json",
);

test.describe("Sub Entity Leader Controls Navigator Tests", () => {
  // Runs as the SUB ENTITY LEADER, reusing the session SSEL - 01 saved. That
  // spec is this suite's login step, so it has to have completed before this
  // one runs - without the file the run lands on the login screen, not the
  // multi entity screen.
  if (fs.existsSync(storageStatePath)) {
    test.use({ storageState: storageStatePath });
  }

  // ORDERING - this spec CHANGES ONE ANSWER.
  //
  // Step 6 answers the BEC-1.1 question through the Navigator and saves it,
  // because the whole point of the case is that the node recolours to match the
  // answer. On this role that answer lands on the one assigned entity, which
  // every spec in the suite shares, so it desynchronises that single question
  // from the answer set SCSEL - 01 stored and AFSEL - 01 reads back. It has to
  // run after both.
  //
  // The Secure CN - 01 needs no such caveat: it creates its own client and
  // entity and answers a question nothing else looks at.
  //
  // It is otherwise far less destructive than the Start Fresh and import specs -
  // one answer rather than the whole assessment - so it sits ahead of them.
  let navigatorSubEntityLeader;

  test.beforeEach(async ({ page }) => {
    navigatorSubEntityLeader = new NavigatorSubEntityLeader(page);
    // "/" is enough: the restored session decides where this role lands, and
    // for a sub entity leader the app routes to the multi entity screen.
    await navigatorSubEntityLeader.goto("/");
    await navigatorSubEntityLeader.waitForLoad();
  });

  test("CNSEL - 01 | @smoke Controls Navigator - Verify the colors combination as the sub entity leader", async () => {
    test.setTimeout(TIMEOUTS.LONG);

    // 1) Get to the collection from wherever the restored session landed. This
    //    replaces the whole of the Secure spec's Step 1-4 setup, but the step
    //    itself still matters: the Controls side-menu item only resolves once
    //    the app is inside the entity.
    await navigatorSubEntityLeader.ensureOnCollection();

    // 2) Collection -> Controls -> Navigator.
    await navigatorSubEntityLeader.navigateToNavigator();

    // 3) Open the root score and check it is rendered in the colour band its
    //    value falls into. The page object owns the assertion.
    await navigatorSubEntityLeader.clickRootScore();
    await navigatorSubEntityLeader.verifyScoreColorCombination();

    // 4) Walk down to the BEC-1.1 question node.
    await navigatorSubEntityLeader.clickLevel1Node(BEC_NODES.LEVEL_1);
    await navigatorSubEntityLeader.clickLevel2Node(BEC_NODES.LEVEL_2);
    await navigatorSubEntityLeader.clickLevel3Node(BEC_NODES.LEVEL_3);

    // 5) Save the node's colour BEFORE answering, then open it. This is read
    //    first so the run can show the colour actually moved rather than
    //    happening to already match.
    const colorBefore = await navigatorSubEntityLeader.getNodeBorderColor(
      4,
      BEC_NODES.LEVEL_4_PARTIAL,
      true,
    );
    console.log(`Node colour before answering: ${colorBefore}`);
    await navigatorSubEntityLeader.clickLevel4NodeByPartialTooltip(
      BEC_NODES.LEVEL_4_PARTIAL,
    );

    // 6) Answer the question from the Navigator's own question panel and save.
    //    The toast is waited on inside the page object - the node recolours off
    //    the saved value, so reading the border before that would race the save.
    await navigatorSubEntityLeader.clickOriginalQuestion();
    const { answerText, partialMeta } =
      await navigatorSubEntityLeader.selectRandomAnswer();
    await navigatorSubEntityLeader.saveAndWaitForToast();

    // 7) Derive the colour that answer should produce. This is a pure lookup,
    //    never read off the screen the assertion is about to check.
    const expectedColor = navigatorSubEntityLeader.getExpectedColorForAnswer(
      answerText,
      partialMeta,
    );
    console.log(
      `Node colour - before ${colorBefore} | expected after "${answerText}" ${expectedColor}`,
    );

    // 8) The node border has to now carry that colour.
    await navigatorSubEntityLeader.verifyNodeBorderColorMatch(
      4,
      BEC_NODES.LEVEL_4_PARTIAL,
      true,
      expectedColor,
    );
  });
});
