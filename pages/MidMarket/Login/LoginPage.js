// MidMarket (application 3) login reuses the identical Secure login flow, but
// must navigate to the MidMarket domain. We inherit all Secure LoginPage methods
// and only route goto() through the MidMarket BasePage so URLs resolve to
// MidMarket.
const SecureLoginPage = require("../../Secure/LoginPage");
const MidMarketBasePage = require("../BasePage");

class LoginPage extends SecureLoginPage {
  async goto(path = "", options = {}) {
    return MidMarketBasePage.prototype.goto.call(this, path, options);
  }
}

module.exports = LoginPage;
