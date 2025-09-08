import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo() {
    return browser.get(browser.baseUrl) as Promise<any>;
  }

  getTitleText() {
    return element(by.css('app-root .content span')).getText() as Promise<string>;
  }

  getCurrentUrl() {
    return browser.getCurrentUrl() as Promise<string>;
  }

  async waitForElement(selector: string, timeout = 5000) {
    const EC = browser.ExpectedConditions;
    const el = element(by.css(selector));
    await browser.wait(EC.presenceOf(el), timeout);
    return el;
  }

  async waitForElementToBeClickable(selector: string, timeout = 5000) {
    const EC = browser.ExpectedConditions;
    const el = element(by.css(selector));
    await browser.wait(EC.elementToBeClickable(el), timeout);
    return el;
  }

  async clearAndSendKeys(selector: string, text: string) {
    const el = await this.waitForElement(selector);
    await el.clear();
    return el.sendKeys(text);
  }

  async clickElement(selector: string) {
    const el = await this.waitForElementToBeClickable(selector);
    return el.click();
  }

  async getElementText(selector: string) {
    const el = await this.waitForElement(selector);
    return el.getText();
  }

  async isElementPresent(selector: string) {
    return element(by.css(selector)).isPresent();
  }

  async isElementDisplayed(selector: string) {
    const el = element(by.css(selector));
    return el.isPresent() && el.isDisplayed();
  }

  async getElementAttribute(selector: string, attribute: string) {
    const el = await this.waitForElement(selector);
    return el.getAttribute(attribute);
  }

  async scrollToElement(selector: string) {
    const el = await this.waitForElement(selector);
    return browser.executeScript('arguments[0].scrollIntoView(true);', el.getWebElement());
  }

  async takeScreenshot(filename: string) {
    return browser.takeScreenshot().then((png) => {
      const fs = require('fs');
      const stream = fs.createWriteStream(`${filename}.png`);
      stream.write(new Buffer(png, 'base64'));
      stream.end();
    });
  }

  async setWindowSize(width: number, height: number) {
    return browser.driver.manage().window().setSize(width, height);
  }

  async getLocalStorageItem(key: string) {
    return browser.executeScript(`return window.localStorage.getItem('${key}');`);
  }

  async setLocalStorageItem(key: string, value: string) {
    return browser.executeScript(`window.localStorage.setItem('${key}', '${value}');`);
  }

  async clearLocalStorage() {
    return browser.executeScript('window.localStorage.clear();');
  }

  async getSessionStorageItem(key: string) {
    return browser.executeScript(`return window.sessionStorage.getItem('${key}');`);
  }

  async clearSessionStorage() {
    return browser.executeScript('window.sessionStorage.clear();');
  }

  async waitForUrlToContain(urlPart: string, timeout = 5000) {
    const EC = browser.ExpectedConditions;
    return browser.wait(EC.urlContains(urlPart), timeout);
  }

  async waitForUrlToBe(url: string, timeout = 5000) {
    const EC = browser.ExpectedConditions;
    return browser.wait(EC.urlIs(url), timeout);
  }

  async switchToFrame(frameLocator: string) {
    const frame = element(by.css(frameLocator));
    return browser.switchTo().frame(frame.getWebElement());
  }

  async switchToDefaultContent() {
    return browser.switchTo().defaultContent();
  }

  async acceptAlert() {
    return browser.switchTo().alert().accept();
  }

  async dismissAlert() {
    return browser.switchTo().alert().dismiss();
  }

  async getAlertText() {
    return browser.switchTo().alert().getText();
  }

  async sendKeysToAlert(text: string) {
    return browser.switchTo().alert().sendKeys(text);
  }

  async isAlertPresent() {
    return browser.switchTo().alert().then(() => true, () => false);
  }

  async executeScript(script: string) {
    return browser.executeScript(script);
  }

  async waitForAngular() {
    return browser.waitForAngular();
  }

  async ignoreSynchronization(flag: boolean) {
    browser.ignoreSynchronization = flag;
  }

  async getNetworkLogs() {
    return browser.manage().logs().get('performance');
  }

  async clearNetworkLogs() {
    return browser.manage().logs().get('performance');
  }

  async enableNetworkLogging() {
    return browser.driver.sendDevToolsCommand('Network.enable', {});
  }

  async disableNetworkLogging() {
    return browser.driver.sendDevToolsCommand('Network.disable', {});
  }
}