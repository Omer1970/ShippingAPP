// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const { SpecReporter, StacktraceOption } = require('jasmine-spec-reporter');

/**
 * @type { import("protractor").Config }
 */
exports.config = {
  allScriptsTimeout: 11000,
  specs: [
    './e2e/src/**/*.e2e-spec.ts'
  ],
  capabilities: {
    browserName: 'chrome',
    chromeOptions: {
      args: [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    }
  },
  directConnect: true,
  SELENIUM_PROMISE_MANAGER: false,
  baseUrl: 'http://localhost:4200/',
  framework: 'jasmine',
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    print: function() {}
  },
  onPrepare() {
    require('ts-node').register({
      project: require('path').join(__dirname, './tsconfig.json')
    });
    jasmine.getEnv().addReporter(new SpecReporter({
      spec: {
        displayStacktrace: StacktraceOption.PRETTY
      }
    }));
  },
  // Multi-browser testing configuration
  multiCapabilities: [
    {
      browserName: 'chrome',
      chromeOptions: {
        args: ['--headless', '--disable-gpu', '--no-sandbox', '--window-size=1920,1080']
      },
      name: 'Chrome'
    },
    {
      browserName: 'firefox',
      'moz:firefoxOptions': {
        args: ['--headless', '--width=1920', '--height=1080']
      },
      name: 'Firefox'
    }
  ],
  // Performance testing configuration
  plugins: [{
    package: 'protractor-console-plugin',
    failOnWarning: false,
    failOnError: true,
    logWarnings: true,
    exclude: []
  }]
};