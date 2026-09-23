const SecureArtifactRegistry = require("../../Secure/Collection/ArtifactRegistry");

// Beacher (application 2) base URL.
const BEACHER_BASE_URL =
  process.env.BASE_URL_BEACHER || "https://secure-cyber-in-site.cygovdev.com";

// Beacher Artifact Registry. The flow is identical to the Secure Artifact
// Registry, so all behaviour is inherited; only navigation is overridden so it
// targets the Beacher domain instead of Secure.
class ArtifactRegistry extends SecureArtifactRegistry {
  constructor(page) {
    super(page);
    // In Beacher the side-menu is labelled "Application" (same component/flow
    // as Secure's "Collection"). Keep a Beacher-specific selector so the Secure
    // page object stays untouched.
    this.selectors = {
      ...this.selectors,
      applicationSidemenu:
        "//button[contains(@class,'sub-menu-item') and .//span[normalize-space(text())='Application']]",
    };
  }

  // Beacher equivalent of the Secure openCollection() flow: open the
  // "Application" side-menu. No separate "Open" button is needed here.
  async clickApplicationSidemenu() {
    await this.click(this.selectors.applicationSidemenu);
  }

  async openApplication() {
    await this.clickApplicationSidemenu();
  }

  // Beacher equivalent of the Secure navigateToArtifactRegistryFromSideMenu()
  // flow: it opens the "Application" side-menu (Secure uses "collection") and
  // then the Artifacts Registry sub-menu.
  async navigateToArtifactRegistryFromSideMenu() {
    await this.clickApplicationSidemenu();
    await this.click(this.selectors.artifactsRegistrySubMenu);
    await this.waitForLoad();
    await this.waitForNetworkIdle();
  }

  async goto(path = "", options = {}) {
    const baseURL = BEACHER_BASE_URL.replace(/\/$/, "");
    const url = path
      ? `${baseURL}${path.startsWith("/") ? path : "/" + path}`
      : baseURL;

    console.log(`Navigating to: ${url}`);
    try {
      await this.page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: options.timeout || 30000,
        ...options,
      });
      console.log(`Successfully navigated to: ${url}`);
    } catch (error) {
      if (error.message.includes("ERR_NAME_NOT_RESOLVED")) {
        throw new Error(
          `DNS resolution failed for ${url}. Check network connectivity, VPN, or domain accessibility.`,
        );
      }
      throw error;
    }
  }
}

module.exports = ArtifactRegistry;
