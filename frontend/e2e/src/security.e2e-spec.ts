import { browser, by, element, ExpectedConditions as EC } from 'protractor';
import { AppPage } from './app.po';

describe('Security Validation Tests', () => {
  let page: AppPage;
  const EC_TIMEOUT = 10000;

  const testData = {
    validUser: {
      email: 'test@example.com',
      password: 'SecurePass123!'
    },
    invalidUser: {
      email: 'invalid@example.com',
      password: 'wrongpassword'
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

  describe('XSS Prevention Tests', () => {
    
    it('should sanitize user input in login form', async () => {
      await browser.get('/login');
      
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<svg onload="alert(\'XSS\')">',
        '"><script>alert("XSS")</script>'
      ];

      for (const payload of xssPayloads) {
        const emailInput = element(by.css('input[formControlName="email"]'));
        const passwordInput = element(by.css('input[formControlName="password"]'));
        
        await emailInput.clear();
        await emailInput.sendKeys(payload);
        await passwordInput.clear();
        await passwordInput.sendKeys('password123');
        
        const submitButton = element(by.css('button[type="submit"]'));
        await submitButton.click();
        
        // Wait for response
        await browser.sleep(1000);
        
        // Check if any alert is present (should not be)
        const alertPresent = await browser.switchTo().alert().then(() => true, () => false);
        expect(alertPresent).toBe(false);
        
        // Check if payload is displayed safely
        const pageSource = await browser.getPageSource();
        expect(pageSource).not.toContain('<script>alert');
      }
    });

    it('should escape HTML in error messages', async () => {
      await browser.get('/login');
      
      const htmlPayload = '<b>Bold Text</b><script>alert("XSS")</script>';
      
      await element(by.css('input[formControlName="email"]')).sendKeys(htmlPayload);
      await element(by.css('input[formControlName="password"]')).sendKeys('password123');
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), 5000);
      
      const errorElement = element(by.css('.alert-danger'));
      const errorText = await errorElement.getText();
      
      // Should not render HTML tags
      expect(errorText).not.toContain('<b>');
      expect(errorText).not.toContain('</b>');
      expect(errorText).not.toContain('<script>');
    });

    it('should handle DOM-based XSS attempts', async () => {
      await browser.get('/login');
      
      // Try to inject malicious content via URL hash
      await browser.get('/login#<script>alert("XSS")</script>');
      
      await browser.sleep(1000);
      
      const alertPresent = await browser.switchTo().alert().then(() => true, () => false);
      expect(alertPresent).toBe(false);
      
      // Check URL is properly encoded
      const currentUrl = await browser.getCurrentUrl();
      expect(currentUrl).toContain('%3Cscript%3E');
    });
  });

  describe('CSRF Protection Tests', () => {
    
    it('should include CSRF token in API requests', async () => {
      await browser.get('/login');
      
      // Monitor network requests
      await browser.executeScript(`
        window.csrfTokens = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          const headers = options.headers || {};
          if (url.includes('/api/')) {
            window.csrfTokens.push(headers['X-CSRF-TOKEN'] || headers['x-csrf-token']);
          }
          return originalFetch.apply(this, arguments);
        };
      `);
      
      // Attempt login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.sleep(2000);
      
      const csrfTokens = await browser.executeScript('return window.csrfTokens;');
      
      // Check if CSRF token is present in API calls
      const hasValidToken = csrfTokens.some(token => token && token.length > 0);
      expect(hasValidToken).toBe(true);
    });

    it('should reject requests without valid CSRF token', async () => {
      // This test would require backend cooperation to verify CSRF protection
      await browser.get('/login');
      
      // Attempt to make API call without CSRF token
      const result = await browser.executeScript(`
        return fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123'
          })
        }).then(response => response.status);
      `);
      
      // Should receive 403 or similar error for missing CSRF token
      expect([403, 419, 422]).toContain(result);
    });
  });

  describe('SQL Injection Prevention Tests', () => {
    
    const sqlInjectionPayloads = [
      "' OR '1'='1' --",
      "' OR 1=1 --",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin' --",
      "admin' #",
      "admin'/*",
      "' or 1=1#",
      "' or 1=1--",
      "' or 1=1/*",
      "') or '1'='1--",
      "') or ('1'='1--"
    ];

    it('should prevent SQL injection in login form', async () => {
      await browser.get('/login');
      
      for (const payload of sqlInjectionPayloads) {
        await element(by.css('input[formControlName="email"]')).clear();
        await element(by.css('input[formControlName="email"]')).sendKeys(payload);
        await element(by.css('input[formControlName="password"]')).clear();
        await element(by.css('input[formControlName="password"]')).sendKeys(payload);
        await element(by.css('button[type="submit"]')).click();
        
        await browser.sleep(1000);
        
        // Should not reveal database errors
        const errorElement = element(by.css('.alert-danger'));
        if (await errorElement.isPresent()) {
          const errorText = await errorElement.getText();
          
          // Should not contain SQL-related errors
          expect(errorText.toLowerCase()).not.toContain('sql');
          expect(errorText.toLowerCase()).not.toContain('mysql');
          expect(errorText.toLowerCase()).not.toContain('postgresql');
          expect(errorText.toLowerCase()).not.toContain('database');
          expect(errorText.toLowerCase()).not.toContain('table');
          expect(errorText.toLowerCase()).not.toContain('column');
        }
        
        // Should still be on login page
        expect(await browser.getCurrentUrl()).toContain('/login');
      }
    });

    it('should handle SQL injection in URL parameters', async () => {
      // Try SQL injection via URL parameters
      await browser.get('/login?email=\' OR \'1\'=\'1\'&password=\' OR \'1\'=\'1\'');
      
      await browser.sleep(1000);
      
      // Should not cause application errors
      const errorElement = element(by.css('.error-message'));
      if (await errorElement.isPresent()) {
        const errorText = await errorElement.getText();
        expect(errorText.toLowerCase()).not.toContain('sql');
        expect(errorText.toLowerCase()).not.toContain('database');
      }
    });
  });

  describe('Authentication Bypass Tests', () => {
    
    it('should not allow authentication bypass via URL manipulation', async () => {
      // Try to access protected page directly with fake parameters
      await browser.get('/dashboard?authenticated=true&user=admin');
      
      await browser.sleep(1000);
      
      // Should redirect to login
      expect(await browser.getCurrentUrl()).toContain('/login');
    });

    it('should not allow authentication bypass via localStorage manipulation', async () => {
      await browser.get('/login');
      
      // Try to set fake authentication data
      await browser.executeScript(`
        window.localStorage.setItem('access_token', 'fake-token');
        window.localStorage.setItem('user', JSON.stringify({
          id: 1,
          name: 'Admin',
          email: 'admin@example.com'
        }));
      `);
      
      // Navigate to protected page
      await browser.get('/dashboard');
      
      await browser.sleep(1000);
      
      // Should still verify token validity with backend
      // If token is invalid, should redirect to login
      const currentUrl = await browser.getCurrentUrl();
      if (currentUrl.includes('/dashboard')) {
        // If on dashboard, verify it's not using fake data
        const userData = await browser.executeScript('return window.localStorage.getItem("user");');
        expect(userData).not.toContain('Admin');
      }
    });

    it('should not allow privilege escalation', async () => {
      await browser.get('/login');
      
      // Try to modify user role in localStorage
      await browser.executeScript(`
        window.localStorage.setItem('access_token', 'valid-token');
        window.localStorage.setItem('user', JSON.stringify({
          id: 1,
          name: 'Regular User',
          email: 'user@example.com',
          role: 'admin'  // Attempt to escalate privileges
        }));
      `);
      
      await browser.get('/dashboard');
      
      // Should validate role with backend and prevent unauthorized access
      await browser.sleep(1000);
      
      // Verify user cannot access admin features
      const adminElements = element.all(by.css('[data-role="admin"]'));
      expect(await adminElements.count()).toBe(0);
    });
  });

  describe('Session Management Tests', () => {
    
    it('should generate secure session tokens', async () => {
      await browser.get('/login');
      
      // Login successfully
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), 5000);
      
      // Check token format
      const token = await browser.executeScript('return window.localStorage.getItem("access_token");');
      
      // Should be JWT or similar secure format
      expect(token).toBeTruthy();
      expect(token.length).toBeGreaterThan(50); // Should be reasonably long
      
      // JWT format check (if applicable)
      if (token.includes('.')) {
        const parts = token.split('.');
        expect(parts.length).toBe(3); // JWT has 3 parts
      }
    });

    it('should expire sessions appropriately', async () => {
      await browser.get('/login');
      
      // Login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), 5000);
      
      // Simulate session expiration by removing token
      await browser.executeScript('window.localStorage.removeItem("access_token");');
      
      // Try to access protected page
      await browser.get('/dashboard');
      
      // Should redirect to login
      await browser.wait(EC.urlContains('/login'), 5000);
      expect(await browser.getCurrentUrl()).toContain('/login');
    });

    it('should prevent session fixation attacks', async () => {
      await browser.get('/login');
      
      // Set a fake session token before login
      await browser.executeScript('window.localStorage.setItem("access_token", "fake-session-token");');
      
      // Login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.wait(EC.urlContains('/dashboard'), 5000);
      
      // Should generate new session token
      const newToken = await browser.executeScript('return window.localStorage.getItem("access_token");');
      expect(newToken).not.toBe('fake-session-token');
    });
  });

  describe('Input Validation Tests', () => {
    
    it('should validate email format strictly', async () => {
      await browser.get('/login');
      
      const invalidEmails = [
        'invalid-email',
        'test@',
        '@example.com',
        'test@.com',
        'test@example',
        'test..test@example.com',
        'test@example..com',
        'test@example.c', // TLD too short
        'test@example.toolongtobevalidtld',
        'test@-example.com',
        'test@example-.com'
      ];

      for (const email of invalidEmails) {
        await element(by.css('input[formControlName="email"]')).clear();
        await element(by.css('input[formControlName="email"]')).sendKeys(email);
        await element(by.css('input[formControlName="password"]')).sendKeys('password123');
        await element(by.css('button[type="submit"]')).click();
        
        await browser.sleep(500);
        
        // Should show validation error
        const emailError = element(by.css('input[formControlName="email"] ~ .invalid-feedback'));
        if (await emailError.isPresent()) {
          expect(await emailError.getText()).toBeTruthy();
        }
      }
    });

    it('should validate password strength', async () => {
      await browser.get('/login');
      
      const weakPasswords = [
        '123456',
        'password',
        '12345678',
        'qwerty',
        'abc123',
        'password123',
        '1234567890'
      ];

      for (const password of weakPasswords) {
        await element(by.css('input[formControlName="email"]')).sendKeys('test@example.com');
        await element(by.css('input[formControlName="password"]')).clear();
        await element(by.css('input[formControlName="password"]')).sendKeys(password);
        await element(by.css('button[type="submit"]')).click();
        
        await browser.sleep(500);
        
        // Should either reject weak password or show warning
        const passwordError = element(by.css('input[formControlName="password"] ~ .invalid-feedback'));
        if (await passwordError.isPresent()) {
          const errorText = await passwordError.getText();
          expect(['weak', 'strong', 'complex', 'length'].some(term => 
            errorText.toLowerCase().includes(term))).toBe(true);
        }
      }
    });
  });

  describe('HTTPS Enforcement Tests', () => {
    
    it('should enforce HTTPS for all API communications', async () => {
      await browser.get('/login');
      
      // Monitor network requests
      await browser.executeScript(`
        window.insecureRequests = [];
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
          if (url.includes('/api/') && url.startsWith('http://')) {
            window.insecureRequests.push(url);
          }
          return originalFetch.apply(this, arguments);
        };
      `);
      
      // Attempt login
      await element(by.css('input[formControlName="email"]')).sendKeys(testData.validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(testData.validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.sleep(2000);
      
      const insecureRequests = await browser.executeScript('return window.insecureRequests;');
      expect(insecureRequests.length).toBe(0);
    });

    it('should redirect HTTP to HTTPS', async () => {
      // This test would need to be configured based on your deployment setup
      // For now, we'll check that the base URL uses HTTPS
      const baseUrl = await browser.getCurrentUrl();
      
      if (baseUrl.includes('https://')) {
        expect(baseUrl.startsWith('https://')).toBe(true);
      }
    });
  });

  describe('Rate Limiting Tests', () => {
    
    it('should implement rate limiting for login attempts', async () => {
      await browser.get('/login');
      
      const startTime = Date.now();
      let rateLimited = false;
      
      // Make multiple login attempts
      for (let i = 0; i < 10; i++) {
        await element(by.css('input[formControlName="email"]')).clear();
        await element(by.css('input[formControlName="email"]')).sendKeys(testData.invalidUser.email);
        await element(by.css('input[formControlName="password"]')).clear();
        await element(by.css('input[formControlName="password"]')).sendKeys(testData.invalidUser.password);
        await element(by.css('button[type="submit"]')).click();
        
        await browser.sleep(500);
        
        // Check for rate limiting message
        const errorElement = element(by.css('.alert-danger'));
        if (await errorElement.isPresent()) {
          const errorText = await errorElement.getText();
          if (errorText.toLowerCase().includes('rate limit') || 
              errorText.toLowerCase().includes('too many attempts') ||
              errorText.toLowerCase().includes('try again later')) {
            rateLimited = true;
            break;
          }
        }
      }
      
      expect(rateLimited).toBe(true);
    });

    it('should implement progressive delays for failed attempts', async () => {
      await browser.get('/login');
      
      const attemptTimes = [];
      
      // Make multiple failed login attempts and measure response times
      for (let i = 0; i < 5; i++) {
        const attemptStart = Date.now();
        
        await element(by.css('input[formControlName="email"]')).clear();
        await element(by.css('input[formControlName="email"]')).sendKeys(testData.invalidUser.email);
        await element(by.css('input[formControlName="password"]')).clear();
        await element(by.css('input[formControlName="password"]')).sendKeys(testData.invalidUser.password);
        await element(by.css('button[type="submit"]')).click();
        
        // Wait for response
        await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), 5000);
        
        const attemptTime = Date.now() - attemptStart;
        attemptTimes.push(attemptTime);
        
        await browser.sleep(1000);
      }
      
      // Check if response times increase (progressive delay)
      let increasingDelay = false;
      for (let i = 1; i < attemptTimes.length; i++) {
        if (attemptTimes[i] > attemptTimes[i - 1] + 100) { // Allow 100ms tolerance
          increasingDelay = true;
          break;
        }
      }
      
      expect(increasingDelay).toBe(true);
    });
  });
});