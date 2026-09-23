// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// Which application this run targets. Each app logs in separately and reuses
// its own session file so the two sessions never collide. Defaults to "Secure".
const APP = process.env.APP || "Secure";

// Per-app session file. Keyed by APP so a participant session is never handed
// to a Secure or Beacher run - that would silently drop those runs to
// participant permissions instead of failing loudly.
// The annotation keeps @ts-check happy: APP is a plain string, so indexing a
// fixed-key literal would otherwise be an implicit-any error (TS7053).
/** @type {Record<string, string>} */
const storageStateByApp = {
  Secure: "storageState.json",
  Beacher: "storageState.beacher.json",
  MidMarket: "storageState.midmarket.json",
  Participant: "storageState.participant.json",
  SubEntityLeader: "storageState.subEntityLeader.json",
  EntityLeader: "storageState.entityLeader.json",
  MSSP: "storageState.mssp.json",
};

const storageStatePath = path.join(
  __dirname,
  storageStateByApp[APP] || storageStateByApp.Secure,
);
const storageState = fs.existsSync(storageStatePath)
  ? storageStatePath
  : undefined;

// Per-app base URL. Beacher and MidMarket each have their own domain; Secure
// keeps the existing one. Kept as a map (rather than nested ternaries) so a
// third app never has to re-shape the expression.
// The annotation keeps @ts-check happy for the same reason as storageStateByApp.
/** @type {Record<string, string>} */
const baseURLByApp = {
  Beacher:
    process.env.BASE_URL_BEACHER ||
    "https://secure-cyber-in-site.cygovdev.com/",
  MidMarket:
    process.env.BASE_URL_MIDMARKET || "https://midmarket.cygovdev.com/",
};

const baseURL =
  baseURLByApp[APP] || process.env.BASE_URL || "http://localhost:3000";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: "./tests",
  /* Maximum time one test can run for. */
  timeout: process.env.CI ? 600000 : 300000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 30000,
  },
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only: re-run any failed or timed-out test up to 2 times */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI and locally for sequential flow. */
  workers: 1,
  /* Maximum number of test failures. 0 means no limit - run all tests regardless of failures */
  maxFailures: 0,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [["html"], ["allure-playwright"], ["github"]]
    : [["html"], ["allure-playwright"]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ...(storageState && { storageState }),
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        headless: true,
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-popup-blocking",
          ],
        },
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://127.0.0.1:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
