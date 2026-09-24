const { expect } = require("@playwright/test");
const BasePage = require("../../Secure/BasePage");
const Upperdeck = require("../../Secure/Upperdeck/Upperdeck");
const AddEntityPage = require("../../Secure/AddEntityPage");
const CollectionPage = require("../../Secure/CollectionPage");
const QuestionEngine = require("../../Secure/Collection/QuestionEngine");

// Drives the Upperdeck as the ENTITY LEADER.
//
// Everything on the screens themselves is delegated: the Upperdeck widgets to
// the Secure Upperdeck page object (`this.upperdeck`), entity creation to
// AddEntityPage (`this.entities`), and the collection walk to CollectionPage +
// QuestionEngine. None of their selectors carries a client or entity name -
// they address the sidebar by text and the cards by class - so nothing needed a
// role-specific rewrite.
//
// Confirmed live against this role before porting:
//   - The restored session lands on /first-party/<id>/upperdeck directly.
//   - The Upperdeck renders the overall score ring, the download-report icon
//     and the risk filters container, and the entity-name label shows the
//     client ELS - 01 created.
//   - Multi Entity is enabled, routes to /multi-entity, and the "New Entity"
//     button is present - matching AddEntityPage's existing selector - so this
//     role really can create sub-entities.
//   - The client starts with ZERO entity cards, which is what lets this suite
//     create its own and know exactly what it is averaging over.
//
// What this class owns is arrival: an entity leader is dropped on the upperdeck
// by the session redirect rather than navigating there, so ensureOnUpperdeck()
// is an arrival check, not a navigation step.
class UpperDeckEntityLeader extends BasePage {
  constructor(page) {
    super(page);
    this.upperdeck = new Upperdeck(page);
    this.entities = new AddEntityPage(page);
    this.collection = new CollectionPage(page);
    this.questionEngine = new QuestionEngine(page);
    this.selectors = {
      overallScoreBox: ".overall .circular-progress-tm-and-t20",
      entityCard: ".entity-card",
      entityNameLabel: "span.lato-20-n-vw.entity-name-ellipsis",
    };
  }

  // --- arrival --------------------------------------------------------------

  // Confirms the session landed on the client's upperdeck. This is an arrival
  // check, not navigation: the app routes this role there by itself once the
  // saved session is restored. The wait is generous because this is the first
  // authenticated render of the run.
  async ensureOnUpperdeck(timeoutMs = 120000) {
    console.log("Verifying the entity leader landed on the upperdeck...");
    await expect(this.page).toHaveURL(/\/upperdeck/, { timeout: timeoutMs });
    await this.waitForSpinner();
    await this.page
      .locator(this.selectors.overallScoreBox)
      .first()
      .waitFor({ state: "visible", timeout: timeoutMs });
    console.log("Entity leader is on the upperdeck.");
  }

  // Returns the client name shown on the upperdeck, so a spec can log which
  // client it is operating on without having created it.
  async getClientName() {
    const label = this.page.locator(this.selectors.entityNameLabel).first();
    await label.waitFor({ state: "visible", timeout: 60000 });
    return (await label.innerText()).trim();
  }

  // --- multi entity ---------------------------------------------------------

  async navigateToMultiEntity() {
    console.log("Navigating to the Multi Entity screen...");
    await this.upperdeck.clickMultiEntitySidebar();
    console.log("Multi Entity screen open.");
  }

  // Creates one sub-entity on Business Email Compromise, user-based collection,
  // and returns its name.
  //
  // This is the capability that separates this role from the sub entity leader:
  // an entity leader is scoped to the whole client and can add entities to it,
  // which is why this suite can build the set it later averages over.
  async createEntityWithBEC(prefix = "UDEL_Entity") {
    await this.entities.clickNewEntity();
    const entityName = await this.entities.createUniqueEntityName(prefix);
    await this.entities.addEntityWithBusinessEmailCompromiseUserBased();
    await this.entities.waitForToast();
    await this.entities.verifyEntityInList(entityName);
    console.log(`Entity created: ${entityName}`);
    return entityName;
  }

  // How many entity cards the multi entity screen is currently showing.
  async getEntityCardCount() {
    const cards = this.page.locator(this.selectors.entityCard);
    await cards.first().waitFor({ state: "visible", timeout: 120000 });
    const count = await cards.count();
    console.log(`Entity cards on screen: ${count}`);
    return count;
  }

  // Reads every entity card's name and score in one pass.
  async getMultiEntityScores() {
    return await this.upperdeck.getMultiEntityScores();
  }

  // --- collection -----------------------------------------------------------

  // Opens one entity's collection and answers the whole assessment. Only one
  // entity is answered on purpose - the rest stay at zero, which is what makes
  // the averaged upperdeck score a meaningful figure rather than a flat one.
  async answerEntityCollection(entityName) {
    console.log(`Answering the collection for entity: ${entityName}`);
    await this.entities.navigateToCollection();
    await this.entities.selectEntityAndNavigate(entityName);
    await this.collection.getFrameworkName(0);
    const answers = await this.questionEngine.answerAllQuestions();
    console.log(`Answered ${answers.length} question(s).`);
    return answers;
  }

  // --- upperdeck ------------------------------------------------------------

  // Reloads and lets the page settle. The upperdeck score is recomputed on the
  // backend from the entity scores, so the screen has to be refetched before it
  // is read.
  async reloadAndSettle() {
    console.log("Reloading so the aggregated figures refresh...");
    await this.page.reload();
    await this.waitForLoad();
    await this.waitForSpinner();
  }

  async openUpperdeck() {
    console.log("Opening the Upperdeck from the side menu...");
    await this.upperdeck.clickUpperdeckMenu();
  }

  async getUpperdeckScore() {
    return await this.upperdeck.getUpperdeckScore();
  }

  async getTotalRiskCount() {
    return await this.upperdeck.getTotalRiskCount();
  }

  async downloadMasterReport() {
    console.log("Downloading the master report...");
    await this.upperdeck.downloadMasterReport();
  }
}

module.exports = UpperDeckEntityLeader;
