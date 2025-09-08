#!/usr/bin/env node

/**
 * E2E Test Setup Validation Script
 * This script validates that the E2E testing environment is properly configured
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Validating E2E Test Setup...\n');

// File structure validation
const requiredFiles = [
  'protractor.conf.js',
  'e2e/tsconfig.json',
  'e2e/src/auth.e2e-spec.ts',
  'e2e/src/security.e2e-spec.ts',
  'e2e/src/integration.e2e-spec.ts',
  'e2e/src/app.po.ts',
  'e2e/README.md'
];

console.log('📁 Checking file structure...');
let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
    allFilesExist = false;
  }
});

// Package.json validation
console.log('\n📦 Checking package.json scripts...');
const packageJsonPath = path.join(__dirname, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const requiredScripts = [
  'e2e',
  'protractor', 
  'webdriver:update',
  'e2e:auth',
  'e2e:security',
  'e2e:integration',
  'e2e:all'
];

let allScriptsExist = true;

requiredScripts.forEach(script => {
  if (packageJson.scripts && packageJson.scripts[script]) {
    console.log(`  ✅ ${script}: ${packageJson.scripts[script]}`);
  } else {
    console.log(`  ❌ ${script} - MISSING`);
    allScriptsExist = false;
  }
});

// Dependencies validation
console.log('\n🔧 Checking dependencies...');
const requiredDependencies = [
  'protractor',
  'webdriver-manager',
  '@types/jasminewd2',
  'jasmine-spec-reporter'
];

let allDependenciesExist = true;

requiredDependencies.forEach(dep => {
  const isInDevDeps = packageJson.devDependencies && packageJson.devDependencies[dep];
  const isInDeps = packageJson.dependencies && packageJson.dependencies[dep];
  
  if (isInDevDeps || isInDeps) {
    console.log(`  ✅ ${dep}`);
  } else {
    console.log(`  ❌ ${dep} - MISSING`);
    allDependenciesExist = false;
  }
});

// Angular configuration validation
console.log('\n⚙️  Checking Angular configuration...');
const angularJsonPath = path.join(__dirname, 'angular.json');
const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));

const hasE2EConfig = angularJson.projects.frontend.architect.e2e;
if (hasE2EConfig) {
  console.log('  ✅ E2E configuration in angular.json');
  console.log(`  ✅ Protractor config: ${hasE2EConfig.options.protractorConfig}`);
} else {
  console.log('  ❌ E2E configuration missing in angular.json');
}

// Test TypeScript configuration
console.log('\n📝 Checking TypeScript configuration...');
const tsConfigPath = path.join(__dirname, 'e2e/tsconfig.json');
if (fs.existsSync(tsConfigPath)) {
  console.log('  ✅ e2e/tsconfig.json exists');
  
  const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
  const hasRequiredTypes = tsConfig.compilerOptions && 
    tsConfig.compilerOptions.types && 
    tsConfig.compilerOptions.types.includes('jasmine') &&
    tsConfig.compilerOptions.types.includes('jasminewd2');
    
  if (hasRequiredTypes) {
    console.log('  ✅ Required types (jasmine, jasminewd2) configured');
  } else {
    console.log('  ❌ Required types not configured');
  }
} else {
  console.log('  ❌ e2e/tsconfig.json missing');
}

// Try to check WebDriver status
console.log('\n🌐 Checking WebDriver status...');
try {
  const webdriverStatus = execSync('npx webdriver-manager status', { encoding: 'utf8', stdio: 'pipe' });
  console.log('  ✅ WebDriver manager available');
  if (webdriverStatus.includes('chromedriver') && webdriverStatus.includes('geckodriver')) {
    console.log('  ✅ Chrome and Firefox drivers detected');
  } else {
    console.log('  ⚠️  Some drivers may need updating');
  }
} catch (error) {
  console.log('  ⚠️  WebDriver manager not initialized (run: npm run webdriver:update)');
}

// Summary
console.log('\n📊 Validation Summary:');
console.log('=' .repeat(50));

const allChecksPass = allFilesExist && allScriptsExist && allDependenciesExist && hasE2EConfig;

if (allChecksPass) {
  console.log('🎉 All validation checks PASSED!');
  console.log('\n🚀 Next steps:');
  console.log('  1. Run: npm run webdriver:update');
  console.log('  2. Start your Angular app: npm start');
  console.log('  3. In another terminal, run: npm run e2e:all');
  console.log('\n📚 For more information, see: e2e/README.md');
} else {
  console.log('❌ Some validation checks FAILED!');
  console.log('\n🔧 Please fix the issues above before running tests.');
  console.log('\n📚 For setup instructions, see: e2e/README.md');
}

console.log('\n✨ E2E Test Setup Validation Complete!');