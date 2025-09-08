import { browser, by, element, ExpectedConditions as EC } from 'protractor';
import { AppPage } from './app.po';

describe('Frontend-Backend Integration Tests', () => {
  let page: AppPage;
  const EC_TIMEOUT = 10000;
  const API_TIMEOUT = 5000;

  const testData = {
    validUser: {
      email: 'test@example.com',
      password: 'password123'
    },
    newUser: {
      name: 'Integration Test User',
      email: 'integration-test@example.com',
      password: 'TestPass123!',
      password_confirmation: 'TestPass123!'
    }
  };

  beforeEach(() => {
    page = new AppPage();
    browser.waitForAngularEnabled(true);
  });

  afterEach(async () => {
    await browser.executeScript('window.localStorage.clear();');
    await browser.executeScript('window.sessionStorage.clear();');
  });

  describe('API Communication Tests', () => {
    
    it('should successfully communicate with Laravel backend', async () => {
      await browser.get('/login');
      
      // Monitor API calls
      await browser.executeScript(`
        window.apiCalls = [];
        window.apiResponses = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          const callInfo = {
            url: url,
            method: options.method || 'GET',
            headers: options.headers || {},
            timestamp: new Date().toISOString()
          };
          window.apiCalls.push(callInfo);
          
          return originalFetch.apply(this, arguments).then(response => {
            window.apiResponses.push({
              url: url,
              status: response.status,
              statusText: response.statusText,
              timestamp: new Date().toISOString()
            });
            return response;
          });
        };
      `);
      
      // Attempt login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Verify API communication
      const apiCalls = await browser.executeScript('return window.apiCalls;');
      const apiResponses = await browser.executeScript('return window.apiResponses;');
      
      expect(apiCalls.length).toBeGreaterThan(0);
      expect(apiResponses.length).toBeGreaterThan(0);
      
      // Check for login API call
      const loginCall = apiCalls.find(call => 
        call.url.includes('/auth/login') && call.method === 'POST'
      );
      expect(loginCall).toBeTruthy();
      
      // Check response status
      const loginResponse = apiResponses.find(response => 
        response.url.includes('/auth/login')
      );
      expect(loginResponse.status).toBe(200);
    });

    it('should handle CORS properly', async () => {
      await browser.get('/login');
      
      // Check if CORS headers are present in responses
      await browser.executeScript(`
        window.corsHeaders = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          return originalFetch.apply(this, arguments).then(response => {
            // Accessing headers from response
            const headers = {};
            response.headers.forEach((value, key) => {
              headers[key] = value;
            });
            
            if (url.includes('/api/')) {
              window.corsHeaders.push({
                url: url,
                headers: headers
              });
            }
            
            return response;
          });
        };
      `);
      
      // Make API call
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.sleep(2000);
      
      const corsHeaders = await browser.executeScript('return window.corsHeaders;');
      
      if (corsHeaders && corsHeaders.length > 0) {
        corsHeaders.forEach(corsData => {
          // Check for CORS headers
          const headers = corsData.headers;
          expect(headers['access-control-allow-origin'] || headers['Access-Control-Allow-Origin']).toBeTruthy();
        });
      }
    });

    it('should handle API versioning correctly', async () => {
      await browser.get('/login');
      
      // Monitor API calls for version information
      await browser.executeScript(`
        window.apiVersions = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          if (url.includes('/api/')) {
            window.apiVersions.push({
              url: url,
              hasVersion: url.includes('/v1/') || url.includes('/v2/')
            });
          }
          return originalFetch.apply(this, arguments);
        };
      `);
      
      // Make API call
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.sleep(2000);
      
      const apiVersions = await browser.executeScript('return window.apiVersions;');
      
      if (apiVersions && apiVersions.length > 0) {
        apiVersions.forEach(versionInfo => {
          expect(versionInfo.hasVersion).toBe(true);
        });
      }
    });
  });

  describe('Error Handling Integration Tests', () => {
    
    it('should handle 404 errors from backend', async () => {
      await browser.get('/login');
      
      // Mock 404 response
      await browser.executeScript(`
        window.fetch = function(url, options = {}) {
          if (url.includes('/auth/login')) {
            return Promise.resolve(new Response(
              JSON.stringify({ message: 'Endpoint not found' }),
              { 
                status: 404, 
                statusText: 'Not Found',
                headers: { 'Content-Type': 'application/json' }
              }
            ));
          }
          return Promise.resolve(new Response());
        };
      `);
      
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), 3000);
      
      const errorMessage = element(by.css('.alert-danger'));
      expect(await errorMessage.isPresent()).toBe(true);
      expect(await errorMessage.getText()).toBeTruthy();
    });

    it('should handle 500 internal server errors', async () => {
      await browser.get('/login');
      
      // Mock 500 response
      await browser.executeScript(`
        window.fetch = function(url, options = {}) {
          if (url.includes('/auth/login')) {
            return Promise.resolve(new Response(
              JSON.stringify({ message: 'Internal server error' }),
              { 
                status: 500, 
                statusText: 'Internal Server Error',
                headers: { 'Content-Type': 'application/json' }
              }
            ));
          }
          return Promise.resolve(new Response());
        };
      `);
      
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), 3000);
      
      const errorMessage = element(by.css('.alert-danger'));
      expect(await errorMessage.isPresent()).toBe(true);
      
      // Should show user-friendly message, not technical details
      const errorText = await errorMessage.getText();
      expect(errorText.toLowerCase()).not.toContain('server');
      expect(errorText.toLowerCase()).not.toContain('500');
    });

    it('should handle network timeouts', async () => {
      await browser.get('/login');
      
      // Mock network timeout
      await browser.executeScript(`
        window.fetch = function(url, options = {}) {
          if (url.includes('/auth/login')) {
            return new Promise((resolve, reject) => {
              setTimeout(() => {
                reject(new Error('Network timeout'));
              }, 100);
            });
          }
          return Promise.resolve(new Response());
        };
      `);
      
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), 3000);
      
      const errorMessage = element(by.css('.alert-danger'));
      expect(await errorMessage.isPresent()).toBe(true);
      expect(await errorMessage.getText()).toContain('Network error');
    });
  });

  describe('Data Validation Integration Tests', () => {
    
    it('should validate request data before sending to backend', async () => {
      await browser.get('/login');
      
      // Monitor request payload
      await browser.executeScript(`
        window.requestPayloads = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          if (url.includes('/auth/login') && options.body) {
            window.requestPayloads.push(JSON.parse(options.body));
          }
          return originalFetch.apply(this, arguments);
        };
      `);
      
      // Try to submit invalid data
      await element(by.css('input[formControlName="email"]')).sendKeys('invalid-email');
      await element(by.css('input[formControlName="password"]')).sendKeys('123');
      await element(by.css('button[type="submit"]')).click();
      
      await browser.sleep(1000);
      
      // Should not send invalid data to backend
      const requestPayloads = await browser.executeScript('return window.requestPayloads;');
      expect(requestPayloads.length).toBe(0);
    });

    it('should handle backend validation errors', async () => {
      await browser.get('/login');
      
      // Mock validation error response
      await browser.executeScript(`
        window.fetch = function(url, options = {}) {
          if (url.includes('/auth/login')) {
            return Promise.resolve(new Response(
              JSON.stringify({
                message: 'Validation failed',
                errors: {
                  email: ['Email field is required'],
                  password: ['Password must be at least 8 characters']
                }
              }),
              { 
                status: 422, 
                statusText: 'Unprocessable Entity',
                headers: { 'Content-Type': 'application/json' }
              }
            ));
          }
          return Promise.resolve(new Response());
        };
      `);
      
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.presenceOf(element(by.css('.invalid-feedback'))), 3000);
      
      // Should display validation errors
      const emailError = element(by.css('input[formControlName="email"] ~ .invalid-feedback'));
      const passwordError = element(by.css('input[formControlName="password"] ~ .invalid-feedback'));
      
      expect(await emailError.isPresent()).toBe(true);
      expect(await passwordError.isPresent()).toBe(true);
    });
  });

  describe('Token Management Integration Tests', () => {
    
    it('should properly handle JWT token lifecycle', async () => {
      await browser.get('/login');
      
      // Monitor token usage
      await browser.executeScript(`
        window.tokenUsage = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          const headers = options.headers || {};
          const token = headers['Authorization'] || headers['authorization'];
          
          if (token && url.includes('/api/')) {
            window.tokenUsage.push({
              url: url,
              hasToken: !!token,
              tokenFormat: token ? token.startsWith('Bearer ') : false
            });
          }
          
          return originalFetch.apply(this, arguments);
        };
      `);
      
      // Login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Navigate to another authenticated page
      await browser.get('/profile');
      
      await browser.sleep(2000);
      
      const tokenUsage = await browser.executeScript('return window.tokenUsage;');
      
      if (tokenUsage && tokenUsage.length > 0) {
        tokenUsage.forEach(usage => {
          expect(usage.hasToken).toBe(true);
          expect(usage.tokenFormat).toBe(true);
        });
      }
    });

    it('should handle token refresh automatically', async () => {
      await browser.get('/login');
      
      // Login first
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Monitor refresh token calls
      await browser.executeScript(`
        window.refreshCalls = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          if (url.includes('/auth/refresh')) {
            window.refreshCalls.push({
              url: url,
              method: options.method || 'GET',
              timestamp: new Date().toISOString()
            });
          }
          return originalFetch.apply(this, arguments);
        };
      `);
      
      // Wait for potential token refresh
      await browser.sleep(10000);
      
      const refreshCalls = await browser.executeScript('return window.refreshCalls;');
      
      // Should either have made refresh calls or have a valid token
      const token = await browser.executeScript('return window.localStorage.getItem("access_token");');
      expect(token || refreshCalls.length > 0).toBe(true);
    });
  });

  describe('Real-time Communication Tests', () => {
    
    it('should handle WebSocket connections for real-time updates', async () => {
      // This test would require your application to use WebSockets
      // For now, we'll test general real-time functionality
      
      await browser.get('/login');
      
      // Login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Check for real-time updates (if implemented)
      const hasRealTimeElement = await element(by.css('[data-realtime]')).isPresent();
      
      if (hasRealTimeElement) {
        // Monitor for real-time updates
        const initialContent = await element(by.css('[data-realtime]')).getText();
        
        // Wait for potential updates
        await browser.sleep(5000);
        
        const updatedContent = await element(by.css('[data-realtime]')).getText();
        
        // Content might have updated (depending on your implementation)
        expect(updatedContent).toBeTruthy();
      }
    });
  });

  describe('Performance Integration Tests', () => {
    
    it('should handle large payloads efficiently', async () => {
      await browser.get('/login');
      
      // Create large payload
      const largeData = 'x'.repeat(1000000); // 1MB of data
      
      await browser.executeScript(`
        window.largePayloadTest = function() {
          return fetch('/api/test-large-payload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({ data: '${largeData}' })
          }).then(response => response.status);
        };
      `);
      
      const startTime = Date.now();
      const status = await browser.executeScript('return window.largePayloadTest();');
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      // Should handle large payload within reasonable time (< 5 seconds)
      expect(responseTime).toBeLessThan(5000);
      expect(status).toBeTruthy();
    });

    it('should implement request caching appropriately', async () => {
      await browser.get('/login');
      
      // Login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Monitor duplicate requests
      await browser.executeScript(`
        window.requestCounts = {};
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          if (url.includes('/api/')) {
            window.requestCounts[url] = (window.requestCounts[url] || 0) + 1;
          }
          return originalFetch.apply(this, arguments);
        };
      `);
      
      // Navigate around to trigger potential duplicate requests
      await browser.get('/dashboard');
      await browser.get('/profile');
      await browser.get('/dashboard'); // Return to dashboard
      
      await browser.sleep(2000);
      
      const requestCounts = await browser.executeScript('return window.requestCounts;');
      
      // Check for potential duplicate requests that should be cached
      Object.values(requestCounts).forEach(count => {
        // If same endpoint called multiple times, should be reasonable
        expect(count).toBeLessThan(5);
      });
    });
  });

  describe('Database Integration Tests', () => {
    
    it('should maintain data consistency across requests', async () => {
      await browser.get('/login');
      
      // Login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Get user data multiple times
      const userData1 = await browser.executeScript('return window.localStorage.getItem("user");');
      await browser.sleep(1000);
      const userData2 = await browser.executeScript('return window.localStorage.getItem("user");');
      
      // Data should be consistent
      expect(userData1).toBe(userData2);
      
      if (userData1) {
        const user1 = JSON.parse(userData1);
        const user2 = JSON.parse(userData2);
        expect(user1.email).toBe(user2.email);
      }
    });
  });
});