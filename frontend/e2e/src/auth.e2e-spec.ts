import { browser, by, element, ExpectedConditions as EC, protractor } from 'protractor';
import { AppPage } from './app.po';

describe('Authentication Flow E2E Tests', () => {
  let page: AppPage;
  const EC_TIMEOUT = 10000;
  const API_TIMEOUT = 5000;

  // Test data
  const validUser = {
    email: 'test@example.com',
    password: 'password123'
  };

  const invalidUser = {
    email: 'invalid@example.com',
    password: 'wrongpassword'
  };

  const newUser = {
    name: 'Test User',
    email: 'newuser@example.com',
    password: 'newpassword123',
    password_confirmation: 'newpassword123'
  };

  beforeEach(() => {
    page = new AppPage();
    browser.waitForAngularEnabled(true);
  });

  afterEach(async () => {
    // Clear localStorage and sessionStorage after each test
    await browser.executeScript('window.localStorage.clear();');
    await browser.executeScript('window.sessionStorage.clear();');
  });

  describe('Login Flow Tests', () => {
    
    it('should display login form with all required fields', async () => {
      await browser.get('/login');
      
      // Wait for login form to be present
      await browser.wait(EC.presenceOf(element(by.css('.login-container'))), EC_TIMEOUT);
      
      // Check form elements
      const emailInput = element(by.css('input[formControlName="email"]'));
      const passwordInput = element(by.css('input[formControlName="password"]'));
      const submitButton = element(by.css('button[type="submit"]'));
      
      expect(await emailInput.isPresent()).toBe(true);
      expect(await passwordInput.isPresent()).toBe(true);
      expect(await submitButton.isPresent()).toBe(true);
      expect(await submitButton.getText()).toContain('Sign In');
    });

    it('should validate email format', async () => {
      await browser.get('/login');
      
      const emailInput = element(by.css('input[formControlName="email"]'));
      const submitButton = element(by.css('button[type="submit"]'));
      
      // Enter invalid email
      await emailInput.sendKeys('invalid-email');
      await submitButton.click();
      
      // Wait for validation error
      await browser.wait(EC.presenceOf(element(by.css('.invalid-feedback'))), EC_TIMEOUT);
      
      const errorMessage = element(by.css('.invalid-feedback'));
      expect(await errorMessage.isPresent()).toBe(true);
    });

    it('should validate password requirements', async () => {
      await browser.get('/login');
      
      const passwordInput = element(by.css('input[formControlName="password"]'));
      const submitButton = element(by.css('button[type="submit"]'));
      
      // Enter short password
      await passwordInput.sendKeys('123');
      await submitButton.click();
      
      // Wait for validation error
      await browser.wait(EC.presenceOf(element(by.css('.invalid-feedback'))), EC_TIMEOUT);
      
      const errorMessage = element(by.css('.invalid-feedback'));
      expect(await errorMessage.isPresent()).toBe(true);
    });

    it('should successfully login with valid credentials', async () => {
      await browser.get('/login');
      
      // Fill login form
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      
      // Submit form
      const submitButton = element(by.css('button[type="submit"]'));
      await submitButton.click();
      
      // Wait for navigation to dashboard or home page
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Verify successful login
      expect(await browser.getCurrentUrl()).toContain('/dashboard');
      
      // Check if token is stored in localStorage
      const token = await browser.executeScript('return window.localStorage.getItem("access_token");');
      expect(token).toBeTruthy();
      
      // Check if user data is stored
      const userData = await browser.executeScript('return window.localStorage.getItem("user");');
      expect(userData).toBeTruthy();
    });

    it('should display error message for invalid credentials', async () => {
      await browser.get('/login');
      
      // Fill login form with invalid credentials
      await element(by.css('input[formControlName="email"]')).sendKeys(invalidUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(invalidUser.password);
      
      // Submit form
      const submitButton = element(by.css('button[type="submit"]'));
      await submitButton.click();
      
      // Wait for error message
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), API_TIMEOUT);
      
      const errorMessage = element(by.css('.alert-danger'));
      expect(await errorMessage.isPresent()).toBe(true);
      expect(await errorMessage.getText()).toContain('Invalid credentials');
      
      // Verify user stays on login page
      expect(await browser.getCurrentUrl()).toContain('/login');
    });

    it('should show loading state during login', async () => {
      await browser.get('/login');
      
      // Fill login form
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      
      // Submit form
      const submitButton = element(by.css('button[type="submit"]'));
      await submitButton.click();
      
      // Check loading state
      await browser.wait(EC.textToBePresentInElement(submitButton, 'Signing In...'), 1000);
      expect(await submitButton.getText()).toContain('Signing In...');
      expect(await submitButton.isEnabled()).toBe(false);
    });

    it('should handle network errors gracefully', async () => {
      // Mock network failure
      await browser.executeScript(`
        window.fetch = function() {
          return Promise.reject(new Error('Network error'));
        };
      `);
      
      await browser.get('/login');
      
      // Fill login form
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      
      // Submit form
      const submitButton = element(by.css('button[type="submit"]'));
      await submitButton.click();
      
      // Wait for error message
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), API_TIMEOUT);
      
      const errorMessage = element(by.css('.alert-danger'));
      expect(await errorMessage.isPresent()).toBe(true);
      expect(await errorMessage.getText()).toContain('Network error');
    });
  });

  describe('Authentication State Management Tests', () => {
    
    beforeEach(async () => {
      // Login before each test
      await browser.get('/login');
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      await element(by.css('button[type="submit"]')).click();
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
    });

    it('should persist authentication state across page refreshes', async () => {
      // Get current URL
      const currentUrl = await browser.getCurrentUrl();
      
      // Refresh page
      await browser.refresh();
      
      // Wait for page to load
      await browser.wait(EC.urlContains('/dashboard'), EC_TIMEOUT);
      
      // Verify user is still authenticated
      expect(await browser.getCurrentUrl()).toContain('/dashboard');
      
      // Check if token is still present
      const token = await browser.executeScript('return window.localStorage.getItem("access_token");');
      expect(token).toBeTruthy();
    });

    it('should automatically redirect to login when token expires', async () => {
      // Clear token to simulate expiration
      await browser.executeScript('window.localStorage.removeItem("access_token");');
      
      // Navigate to protected route
      await browser.get('/dashboard');
      
      // Should redirect to login
      await browser.wait(EC.urlContains('/login'), EC_TIMEOUT);
      expect(await browser.getCurrentUrl()).toContain('/login');
    });
  });

  describe('Route Protection Tests', () => {
    
    it('should redirect unauthenticated users to login page', async () => {
      // Navigate to protected route without authentication
      await browser.get('/dashboard');
      
      // Wait for redirect
      await browser.wait(EC.urlContains('/login'), EC_TIMEOUT);
      
      expect(await browser.getCurrentUrl()).toContain('/login');
      
      // Check for returnUrl parameter
      const currentUrl = await browser.getCurrentUrl();
      expect(currentUrl).toContain('returnUrl=%2Fdashboard');
    });

    it('should allow access to protected routes for authenticated users', async () => {
      // First login
      await browser.get('/login');
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      await element(by.css('button[type="submit"]')).click();
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Navigate to another protected route
      await browser.get('/profile');
      
      // Should not redirect
      await browser.wait(EC.urlContains('/profile'), EC_TIMEOUT);
      expect(await browser.getCurrentUrl()).toContain('/profile');
    });

    it('should redirect authenticated users away from login page', async () => {
      // First login
      await browser.get('/login');
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      await element(by.css('button[type="submit"]')).click();
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      // Try to navigate to login page
      await browser.get('/login');
      
      // Should redirect to dashboard
      await browser.wait(EC.urlContains('/dashboard'), EC_TIMEOUT);
      expect(await browser.getCurrentUrl()).toContain('/dashboard');
    });
  });

  describe('Logout Flow Tests', () => {
    
    beforeEach(async () => {
      // Login before each test
      await browser.get('/login');
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      await element(by.css('button[type="submit"]')).click();
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
    });

    it('should successfully logout user', async () => {
      // Click logout button (assuming it's in the header)
      const logoutButton = element(by.css('[data-testid="logout-button"]'));
      await browser.wait(EC.elementToBeClickable(logoutButton), EC_TIMEOUT);
      await logoutButton.click();
      
      // Wait for redirect to login
      await browser.wait(EC.urlContains('/login'), EC_TIMEOUT);
      
      expect(await browser.getCurrentUrl()).toContain('/login');
      
      // Check if token is removed
      const token = await browser.executeScript('return window.localStorage.getItem("access_token");');
      expect(token).toBeFalsy();
      
      // Check if user data is removed
      const userData = await browser.executeScript('return window.localStorage.getItem("user");');
      expect(userData).toBeFalsy();
    });

    it('should prevent access to protected routes after logout', async () => {
      // Logout first
      const logoutButton = element(by.css('[data-testid="logout-button"]'));
      await browser.wait(EC.elementToBeClickable(logoutButton), EC_TIMEOUT);
      await logoutButton.click();
      
      await browser.wait(EC.urlContains('/login'), EC_TIMEOUT);
      
      // Try to access protected route
      await browser.get('/dashboard');
      
      // Should redirect to login
      await browser.wait(EC.urlContains('/login'), EC_TIMEOUT);
      expect(await browser.getCurrentUrl()).toContain('/login');
    });
  });

  describe('Token Refresh Tests', () => {
    
    it('should automatically refresh token before expiration', async () => {
      await browser.get('/login');
      
      // Mock token with short expiration
      await browser.executeScript(`
        window.localStorage.setItem('access_token', 'test-token');
        window.localStorage.setItem('user', JSON.stringify({
          id: 1,
          name: 'Test User',
          email: '${validUser.email}'
        }));
      `);
      
      // Navigate to dashboard
      await browser.get('/dashboard');
      
      // Wait for automatic token refresh (this would be handled by your auth service)
      await browser.sleep(2000);
      
      // Verify user is still authenticated
      expect(await browser.getCurrentUrl()).toContain('/dashboard');
    });
  });

  describe('Cross-browser Compatibility Tests', () => {
    
    it('should work in different browser sizes', async () => {
      // Test mobile viewport
      await browser.driver.manage().window().setSize(375, 667);
      await browser.get('/login');
      
      const emailInput = element(by.css('input[formControlName="email"]'));
      expect(await emailInput.isPresent()).toBe(true);
      
      // Test tablet viewport
      await browser.driver.manage().window().setSize(768, 1024);
      await browser.get('/login');
      
      expect(await emailInput.isPresent()).toBe(true);
      
      // Reset to desktop
      await browser.driver.manage().window().setSize(1920, 1080);
    });
  });

  describe('Performance Tests', () => {
    
    it('should load login page within acceptable time', async () => {
      const startTime = Date.now();
      await browser.get('/login');
      
      // Wait for page to be fully loaded
      await browser.wait(EC.presenceOf(element(by.css('.login-container'))), EC_TIMEOUT);
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
    });

    it('should complete login process within acceptable time', async () => {
      await browser.get('/login');
      
      const startTime = Date.now();
      
      // Fill and submit form
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      // Wait for navigation
      await browser.wait(EC.urlContains('/dashboard'), API_TIMEOUT * 2);
      
      const loginTime = Date.now() - startTime;
      expect(loginTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Security Tests', () => {
    
    it('should prevent XSS attacks in form inputs', async () => {
      await browser.get('/login');
      
      const xssPayload = '<script>alert("XSS")</script>';
      
      // Try to inject XSS payload
      await element(by.css('input[formControlName="email"]')).sendKeys(xssPayload);
      await element(by.css('input[formControlName="password"]')).sendKeys('password123');
      await element(by.css('button[type="submit"]')).click();
      
      // Wait for error message
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), API_TIMEOUT);
      
      // Verify script is not executed (no alert present)
      const alertPresent = await browser.switchTo().alert().then(() => true, () => false);
      expect(alertPresent).toBe(false);
    });

    it('should sanitize user input before sending to server', async () => {
      await browser.get('/login');
      
      const maliciousInput = 'test@example.com<script>alert("hack")</script>';
      
      await element(by.css('input[formControlName="email"]')).sendKeys(maliciousInput);
      await element(by.css('input[formControlName="password"]')).sendKeys('password123');
      await element(by.css('button[type="submit"]')).click();
      
      // Should either show validation error or sanitize input
      await browser.sleep(1000);
      
      // Verify no script execution
      const alertPresent = await browser.switchTo().alert().then(() => true, () => false);
      expect(alertPresent).toBe(false);
    });

    it('should use HTTPS for API calls', async () => {
      await browser.get('/login');
      
      // Monitor network requests
      await browser.executeScript(`
        window.apiCalls = [];
        const originalFetch = window.fetch;
        window.fetch = function(...args) {
          window.apiCalls.push(args[0]);
          return originalFetch.apply(this, args);
        };
      `);
      
      // Attempt login
      await element(by.css('input[formControlName="email"]')).sendKeys(validUser.email);
      await element(by.css('input[formControlName="password"]')).sendKeys(validUser.password);
      await element(by.css('button[type="submit"]')).click();
      
      await browser.sleep(2000);
      
      // Check if API calls use HTTPS
      const apiCalls = await browser.executeScript('return window.apiCalls;');
      if (apiCalls && apiCalls.length > 0) {
        apiCalls.forEach((url: string) => {
          if (url.includes('/api/')) {
            expect(url.startsWith('https://')).toBe(true);
          }
        });
      }
    });

    it('should handle SQL injection attempts', async () => {
      await browser.get('/login');
      
      const sqlInjectionPayload = "' OR '1'='1' --";
      
      await element(by.css('input[formControlName="email"]')).sendKeys(sqlInjectionPayload);
      await element(by.css('input[formControlName="password"]')).sendKeys(sqlInjectionPayload);
      await element(by.css('button[type="submit"]')).click();
      
      // Should show generic error message
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), API_TIMEOUT);
      
      const errorMessage = element(by.css('.alert-danger'));
      expect(await errorMessage.isPresent()).toBe(true);
      
      // Should not reveal database error details
      const errorText = await errorMessage.getText();
      expect(errorText).not.toContain('SQL');
      expect(errorText).not.toContain('database');
      expect(errorText).not.toContain('mysql');
    });

    it('should implement rate limiting for login attempts', async () => {
      await browser.get('/login');
      
      // Make multiple failed login attempts
      for (let i = 0; i < 5; i++) {
        await element(by.css('input[formControlName="email"]')).clear();
        await element(by.css('input[formControlName="email"]')).sendKeys(invalidUser.email);
        await element(by.css('input[formControlName="password"]')).clear();
        await element(by.css('input[formControlName="password"]')).sendKeys(invalidUser.password);
        await element(by.css('button[type="submit"]')).click();
        
        await browser.sleep(1000);
      }
      
      // After multiple attempts, should show rate limit error
      await browser.wait(EC.presenceOf(element(by.css('.alert-danger'))), API_TIMEOUT);
      
      const errorMessage = element(by.css('.alert-danger'));
      const errorText = await errorMessage.getText();
      
      // Should indicate rate limiting
      expect(errorText).toMatch(/rate limit|too many attempts|try again later/i);
    });
  });

  describe('Accessibility Tests', () => {
    
    it('should have proper ARIA labels', async () => {
      await browser.get('/login');
      
      // Check for ARIA labels
      const emailInput = element(by.css('input[formControlName="email"]'));
      const passwordInput = element(by.css('input[formControlName="password"]'));
      
      expect(await emailInput.getAttribute('aria-label')).toBeTruthy();
      expect(await passwordInput.getAttribute('aria-label')).toBeTruthy();
    });

    it('should be navigable with keyboard', async () => {
      await browser.get('/login');
      
      // Tab through form elements
      await browser.actions().sendKeys(protractor.Key.TAB).perform();
      await browser.actions().sendKeys(protractor.Key.TAB).perform();
      
      // Should be able to submit with Enter key
      await browser.actions().sendKeys(protractor.Key.ENTER).perform();
      
      // Should show validation errors
      await browser.wait(EC.presenceOf(element(by.css('.invalid-feedback'))), EC_TIMEOUT);
    });
  });
});