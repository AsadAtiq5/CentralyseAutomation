// Beacher (application 2) login reuses the identical Secure login flow, but must
// navigate to the Beacher domain. We inherit all Secure LoginPage methods and
// only route goto() through the Beacher BasePage so URLs resolve to Beacher.
const SecureLoginPage = require("../../Secure/LoginPage");
const BeacherBasePage = require("../BasePage");

class LoginPage extends SecureLoginPage {
  async goto(path = "", options = {}) {
    return BeacherBasePage.prototype.goto.call(this, path, options);
  }
}

module.exports = LoginPage;
