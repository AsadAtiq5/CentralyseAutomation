const { test, expect } = require("@playwright/test");
const LoginPage = require("../../../pages/Beacher/Login/LoginPage");
const MailinatorHelper = require("../../../helpers/common/mailinatorHelper");
const StorageHelper = require("../../../helpers/common/storageHelper");
const { NEGATIVE_SCENARIO } = require("../../../constant/enums");

test.describe("Beacher Login Tests", () => {
  // Always target the Beacher domain, regardless of the APP env var, so this
  // spec hits the correct app when run directly (not just in the Beacher CI job).
  test.use({
    baseURL:
      process.env.BASE_URL_BEACHER ||
      "https://secure-cyber-in-site.cygovdev.com/",
    // Login tests must start unauthenticated. Ignore any saved storageState so
    // page.goto("/") lands on the real login screen instead of auto-logging in.
    storageState: { cookies: [], origins: [] },
  });

  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto("/");
  });

  test("BEACHER LOGIN - 01 | @regression Verify the required field error message on login screen", async ({
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

  test("BEACHER LOGIN - 02 | @regression Verify login with invalid credentials", async ({
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

  test("BEACHER LOGIN - 03 | @regression Verify the forgot password error toast when leaving the field empty", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await loginPage.navigate();
    await loginPage.clickForgotPassword();
    await loginPage.expectToastMessageToContain(
      loginPage.selectors.errorToast,
      "Please fill email address",
      90000,
    );
  });

  test("BEACHER LOGIN - 04 | @regression Verify No registered user error toast", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await loginPage.navigate();
    await loginPage.enterEmail(NEGATIVE_SCENARIO.INVALID_EMAIL);
    await loginPage.clickForgotPassword();
    await loginPage.waitForNotRegisterUserToaster();
  });

  test("BEACHER LOGIN - 05 | @regression Verify success toast when navigating to the OTP screen", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await loginPage.navigate();
    await loginPage.enterEmail(process.env.USER_EMAIL);
    await loginPage.enterPassword(process.env.USER_PASSWORD);
    await loginPage.clickLoginButton();
    await loginPage.waitForURL(/\/code/, 60000);
  });

  test("BEACHER LOGIN - 06 | @regression Verify OTP with invalid code", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await loginPage.navigate();
    await loginPage.enterEmail(process.env.USER_EMAIL);
    await loginPage.enterPassword(process.env.USER_PASSWORD);
    await loginPage.clickLoginButton();
    await loginPage.enterOtp(["1", "2", "3", "4", "5", "6"]);
    await loginPage.clickVerifyOTPButton();
    await loginPage.waitForInvalidOtpToaster();
  });

  test("BEACHER LOGIN - 07 | @regression Verify incomplete OTP error", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await loginPage.navigate();
    await loginPage.enterEmail(process.env.USER_EMAIL);
    await loginPage.enterPassword(process.env.USER_PASSWORD);
    await loginPage.clickLoginButton();
    await loginPage.fill(loginPage.selectors.otpInput1, "1");
    await loginPage.clickVerifyOTPButton();
    await loginPage.waitForIncompleteOtpToaster();
  });

  test("BEACHER LOGIN - 08 | @regression Verify success toast on resend otp", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await loginPage.navigate();
    await loginPage.enterEmail(process.env.USER_EMAIL);
    await loginPage.enterPassword(process.env.USER_PASSWORD);
    await loginPage.clickLoginButton();
    await loginPage.clickDidntGetCodeBtn();
    await loginPage.waitForResendOtpToaster();
  });

  test("BEACHER LOGIN - 09 | @smoke Verify successful login", async ({
    page,
    context,
  }) => {
    test.setTimeout(3000000);
    await loginPage.login(process.env.USER_EMAIL, process.env.USER_PASSWORD);
    console.log("Username or password entered");
    const mailinatorEmail = MailinatorHelper.extractMailinatorInput(
      process.env.MAILINATOR_ADDRESS,
    );
    console.log("mailinator id entered");
    const otp = await MailinatorHelper.getOTPFromMailinator(
      context,
      mailinatorEmail,
    );
    console.log("otp received " + otp);
    await page.bringToFront();
    await loginPage.verifyOTP(otp);
    await loginPage.waitForURL(/\/clients/, 3000000);
    try {
      await StorageHelper.saveStorage(context, "storageState.beacher.json");
    } catch (err) {
      throw new Error(`Failed to save storage state: ${err.message}`);
    }
    expect(page.url()).toMatch(/\/clients/);
  });
});
