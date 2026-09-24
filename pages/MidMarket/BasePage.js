const SecureBasePage = require("../Secure/BasePage");

// MidMarket (application 3) base URL. All MidMarket page objects should extend
// this BasePage so navigation always targets the MidMarket domain instead of
// Secure. UtilsService.isMidMarket in the app keys off the subdomain, so a run
// pointed at the wrong host silently gets the Secure UI rather than failing.
const MIDMARKET_BASE_URL =
  process.env.BASE_URL_MIDMARKET || "https://midmarket.cygovdev.com";

class BasePage extends SecureBasePage {
  // Override goto() so relative paths resolve against the MidMarket domain.
  async goto(path = "", options = {}) {
    const baseURL = MIDMARKET_BASE_URL.replace(/\/$/, "");
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

module.exports = BasePage;
