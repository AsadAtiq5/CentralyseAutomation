const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/MidMarket/Login/LoginPage");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const StorageHelper = require("../../../helpers/common/storageHelper");
const {
  NEGATIVE_SCENARIO,
  MIDMARKET_USER,
} = require("../../../constant/enums");

// Scope this spec's test data to the MidMarket app so it saves under
// testData/MidMarket/ (TestData resolves the folder from process.env.APP).
process.env.APP = "MidMarket";

const MIDMARKET_BASE_URL =
  process.env.BASE_URL_MIDMARKET || "https://midmarket.cygovdev.com/";

test.describe("MidMarket Login Tests", () => {
  // Always target the MidMarket domain, regardless of the APP env var, so this
  // spec hits the correct app when run directly (not just in a MidMarket CI job).
  test.use({
    baseURL: MIDMARKET_BASE_URL,
    // Login tests must start unauthenticated. Ignore any saved storageState so
    // page.goto("/") lands on the real login screen instead of auto-logging in.
    storageState: { cookies: [], origins: [] },
  });

  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto("/");
  });

  test("MMLOGIN - 01 | @regression Verify the required field error message on login screen", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await loginPage.navigate();
    await loginPage.clickLoginButton();
    await loginPage.expectToastMessageToContain(
      loginPage.selectors.emailRequiredError,
      "Email is required",
      60000,
    );
    await loginPage.expectToastMessageToContain(
      loginPage.selectors.passwordRequiredError,
      "Password is required",
      60000,
    );
  });

  test("MMLOGIN - 02 | @regression Verify login with invalid credentials", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await loginPage.navigate();
    await loginPage.enterEmail(NEGATIVE_SCENARIO.INVALID_EMAIL);
    await loginPage.enterPassword(NEGATIVE_SCENARIO.INVALID_PASSWORD);
    await loginPage.clickLoginButton();
    await loginPage.expectToastMessageToContain(
      loginPage.selectors.errorToast,
      "Invalid credentials",
      60000,
    );
  });

  test("MMLOGIN - 03 | @regression Verify success toast when navigating to the OTP screen", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await loginPage.navigate();
    await loginPage.enterEmail(MIDMARKET_USER.EMAIL);
    await loginPage.enterPassword(MIDMARKET_USER.PASSWORD);
    await loginPage.clickLoginButton();
    await loginPage.waitForURL(/\/code/, 60000);
  });

  test("MMLOGIN - 04 | @regression Verify OTP with invalid code", async ({
    page,
  }) => {
    test.setTimeout(60000);

    await loginPage.navigate();
    await loginPage.enterEmail(MIDMARKET_USER.EMAIL);
    await loginPage.enterPassword(MIDMARKET_USER.PASSWORD);
    await loginPage.clickLoginButton();
    await loginPage.enterOtp(["1", "2", "3", "4", "5", "6"]);
    await loginPage.clickVerifyOTPButton();
    await loginPage.waitForInvalidOtpToaster();
  });

  /**
   * Seeds storageState.midmarket.json. Every other MidMarket spec reuses this
   * session, so it must run first in any MidMarket group - there is no
   * globalSetup in this repo.
   *
   * The broker lands on /clients, which for MidMarket renders the bnbFlow
   * branch of the clients screen (cygov-bnb-card), not the Beecher one.
   */
  test("MMLOGIN - 05 | @smoke Verify successful login", async ({
    page,
    context,
  }) => {
    test.setTimeout(3000000);

    await loginPage.login(MIDMARKET_USER.EMAIL, MIDMARKET_USER.PASSWORD);
    console.log("Username and password entered");

    // OTP is read from S3 (public/AUTOMATION/{email}/OTP.txt), not from email.
    // MIDMARKET_USER.EMAIL is the shared mailinator address, so this strips it
    // to the inbox id and getOTPPath re-appends @mailinator.com - the same
    // single S3 path the Secure and Beacher runs read.
    const otpInbox = MailinatorHelper.extractMailinatorInput(
      MIDMARKET_USER.EMAIL,
    );
    const otp = await MailinatorHelper.getOTPFromMailinator(context, otpInbox);
    console.log("otp received " + otp);

    await page.bringToFront();
    await loginPage.verifyOTP(otp);
    await loginPage.waitForURL(/\/clients/, 3000000);

    try {
      await StorageHelper.saveStorage(context, "storageState.midmarket.json");
    } catch (err) {
      throw new Error(`Failed to save storage state: ${err.message}`);
    }

    expect(page.url()).toMatch(/\/clients/);
  });
});
