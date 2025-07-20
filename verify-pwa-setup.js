#!/usr/bin/env node

/**
 * PWA Setup Verification Script
 * 
 * This script verifies that the PWA configuration is properly set up
 * by checking for required files and configurations.
 */

import fs from 'fs';
import path from 'path';

const checks = [];

// Check 1: Verify vite.config.ts has PWA plugin configured
function checkViteConfig() {
  try {
    const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
    const hasPWAPlugin = viteConfig.includes('VitePWA');
    const hasWorkboxConfig = viteConfig.includes('workbox:');
    const hasManifest = viteConfig.includes('manifest:');
    
    checks.push({
      name: 'Vite PWA Plugin Configuration',
      passed: hasPWAPlugin && hasWorkboxConfig && hasManifest,
      details: `PWA Plugin: ${hasPWAPlugin}, Workbox: ${hasWorkboxConfig}, Manifest: ${hasManifest}`
    });
  } catch (error) {
    checks.push({
      name: 'Vite PWA Plugin Configuration',
      passed: false,
      details: `Error reading vite.config.ts: ${error.message}`
    });
  }
}

// Check 2: Verify PWA service exists
function checkPWAService() {
  const servicePath = 'src/services/pwa/PWAService.ts';
  const exists = fs.existsSync(servicePath);
  
  if (exists) {
    const content = fs.readFileSync(servicePath, 'utf8');
    const hasWorkboxImport = content.includes('workbox-window');
    const hasServiceClass = content.includes('class PWAService');
    
    checks.push({
      name: 'PWA Service Implementation',
      passed: hasWorkboxImport && hasServiceClass,
      details: `File exists: ${exists}, Workbox import: ${hasWorkboxImport}, Service class: ${hasServiceClass}`
    });
  } else {
    checks.push({
      name: 'PWA Service Implementation',
      passed: false,
      details: 'PWAService.ts file not found'
    });
  }
}

// Check 3: Verify PWA hooks exist
function checkPWAHooks() {
  const hooksPath = 'src/hooks/usePWA.ts';
  const exists = fs.existsSync(hooksPath);
  
  if (exists) {
    const content = fs.readFileSync(hooksPath, 'utf8');
    const hasUsePWA = content.includes('export function usePWA');
    const hasUseNetworkStatus = content.includes('export function useNetworkStatus');
    
    checks.push({
      name: 'PWA React Hooks',
      passed: hasUsePWA && hasUseNetworkStatus,
      details: `File exists: ${exists}, usePWA hook: ${hasUsePWA}, useNetworkStatus hook: ${hasUseNetworkStatus}`
    });
  } else {
    checks.push({
      name: 'PWA React Hooks',
      passed: false,
      details: 'usePWA.ts file not found'
    });
  }
}

// Check 4: Verify PWA components exist
function checkPWAComponents() {
  const components = [
    'src/components/pwa/PWAUpdateNotification.tsx',
    'src/components/pwa/PWAInstallPrompt.tsx',
    'src/components/pwa/NetworkStatusIndicator.tsx'
  ];
  
  const existingComponents = components.filter(comp => fs.existsSync(comp));
  
  checks.push({
    name: 'PWA React Components',
    passed: existingComponents.length === components.length,
    details: `Found ${existingComponents.length}/${components.length} components: ${existingComponents.map(c => path.basename(c)).join(', ')}`
  });
}

// Check 5: Verify HTML has PWA meta tags
function checkHTMLMetaTags() {
  try {
    const html = fs.readFileSync('index.html', 'utf8');
    const hasThemeColor = html.includes('theme-color');
    const hasAppleMobileWebApp = html.includes('apple-mobile-web-app');
    const hasDescription = html.includes('name="description"');
    
    checks.push({
      name: 'HTML PWA Meta Tags',
      passed: hasThemeColor && hasAppleMobileWebApp && hasDescription,
      details: `Theme color: ${hasThemeColor}, Apple meta tags: ${hasAppleMobileWebApp}, Description: ${hasDescription}`
    });
  } catch (error) {
    checks.push({
      name: 'HTML PWA Meta Tags',
      passed: false,
      details: `Error reading index.html: ${error.message}`
    });
  }
}

// Check 6: Verify package.json has required dependencies
function checkDependencies() {
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const devDeps = packageJson.devDependencies || {};
    
    const hasVitePWA = 'vite-plugin-pwa' in devDeps;
    const hasWorkboxWindow = 'workbox-window' in devDeps;
    
    checks.push({
      name: 'PWA Dependencies',
      passed: hasVitePWA && hasWorkboxWindow,
      details: `vite-plugin-pwa: ${hasVitePWA}, workbox-window: ${hasWorkboxWindow}`
    });
  } catch (error) {
    checks.push({
      name: 'PWA Dependencies',
      passed: false,
      details: `Error reading package.json: ${error.message}`
    });
  }
}

// Run all checks
function runChecks() {
  console.log('🔍 Verifying PWA Setup...\n');
  
  checkViteConfig();
  checkPWAService();
  checkPWAHooks();
  checkPWAComponents();
  checkHTMLMetaTags();
  checkDependencies();
  
  // Display results
  const passedChecks = checks.filter(check => check.passed).length;
  const totalChecks = checks.length;
  
  console.log('📋 PWA Setup Verification Results:\n');
  
  checks.forEach((check, index) => {
    const status = check.passed ? '✅' : '❌';
    console.log(`${index + 1}. ${status} ${check.name}`);
    console.log(`   ${check.details}\n`);
  });
  
  console.log(`📊 Summary: ${passedChecks}/${totalChecks} checks passed`);
  
  if (passedChecks === totalChecks) {
    console.log('🎉 PWA setup is complete and properly configured!');
    process.exit(0);
  } else {
    console.log('⚠️  Some PWA setup issues were found. Please review the failed checks above.');
    process.exit(1);
  }
}

runChecks();