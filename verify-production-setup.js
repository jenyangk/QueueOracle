#!/usr/bin/env node

/**
 * Production Setup Verification Script
 * Verifies that all production requirements are met
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProductionVerifier {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.passed = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '📋',
      pass: '✅',
      warn: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    switch (type) {
      case 'error':
        this.errors.push(message);
        break;
      case 'warn':
        this.warnings.push(message);
        break;
      case 'pass':
        this.passed.push(message);
        break;
    }
  }

  checkFile(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.log(`${description}: ${filePath}`, 'pass');
      return true;
    } else {
      this.log(`Missing ${description}: ${filePath}`, 'error');
      return false;
    }
  }

  checkDirectory(dirPath, description) {
    if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
      this.log(`${description}: ${dirPath}`, 'pass');
      return true;
    } else {
      this.log(`Missing ${description}: ${dirPath}`, 'error');
      return false;
    }
  }

  checkPackageScript(scriptName, description) {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      if (packageJson.scripts && packageJson.scripts[scriptName]) {
        this.log(`${description}: ${scriptName}`, 'pass');
        return true;
      } else {
        this.log(`Missing ${description}: ${scriptName}`, 'error');
        return false;
      }
    } catch (error) {
      this.log(`Error reading package.json: ${error.message}`, 'error');
      return false;
    }
  }

  checkEnvironmentVariables() {
    this.log('Checking environment configuration...', 'info');
    
    const requiredEnvVars = [
      'VITE_APP_NAME',
      'VITE_APP_VERSION',
      'VITE_APP_ENVIRONMENT'
    ];

    const envExample = '.env.example';
    if (this.checkFile(envExample, 'Environment example file')) {
      const envContent = fs.readFileSync(envExample, 'utf8');
      
      requiredEnvVars.forEach(varName => {
        if (envContent.includes(varName)) {
          this.log(`Environment variable defined: ${varName}`, 'pass');
        } else {
          this.log(`Missing environment variable: ${varName}`, 'error');
        }
      });
    }
  }

  checkBuildConfiguration() {
    this.log('Checking build configuration...', 'info');
    
    // Check Vite config
    this.checkFile('vite.config.ts', 'Vite configuration');
    
    // Check TypeScript config
    this.checkFile('tsconfig.json', 'TypeScript configuration');
    this.checkFile('tsconfig.app.json', 'TypeScript app configuration');
    
    // Check build scripts
    this.checkPackageScript('build', 'Build script');
    this.checkPackageScript('build:analyze', 'Bundle analysis script');
    this.checkPackageScript('preview', 'Preview script');
  }

  checkPWAConfiguration() {
    this.log('Checking PWA configuration...', 'info');
    
    // Check PWA assets
    this.checkFile('public/manifest.json', 'PWA manifest') ||
    this.checkFile('public/site.webmanifest', 'PWA manifest (alternative)');
    
    // Check service worker
    const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
    if (viteConfig.includes('VitePWA')) {
      this.log('PWA plugin configured in Vite', 'pass');
    } else {
      this.log('PWA plugin not found in Vite config', 'error');
    }
    
    // Check PWA icons
    const iconSizes = ['192x192', '512x512'];
    iconSizes.forEach(size => {
      const iconPath = `public/pwa-${size}.png`;
      this.checkFile(iconPath, `PWA icon ${size}`);
    });
  }

  checkSecurityConfiguration() {
    this.log('Checking security configuration...', 'info');
    
    // Check for security headers configuration
    const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
    
    // Check for HTTPS configuration
    if (viteConfig.includes('https') || process.env.HTTPS === 'true') {
      this.log('HTTPS configuration found', 'pass');
    } else {
      this.log('HTTPS configuration not found', 'warn');
    }
    
    // Check for CSP configuration
    if (viteConfig.includes('csp') || viteConfig.includes('Content-Security-Policy')) {
      this.log('Content Security Policy configuration found', 'pass');
    } else {
      this.log('Content Security Policy not configured', 'warn');
    }
  }

  checkTestConfiguration() {
    this.log('Checking test configuration...', 'info');
    
    // Check test scripts
    this.checkPackageScript('test', 'Test script');
    this.checkPackageScript('test:unit', 'Unit test script');
    this.checkPackageScript('test:e2e', 'E2E test script');
    
    // Check test configuration files
    this.checkFile('vitest.config.ts', 'Vitest configuration');
    this.checkFile('playwright.config.ts', 'Playwright configuration');
    
    // Check test directories
    this.checkDirectory('src/test', 'Test setup directory');
    this.checkDirectory('e2e', 'E2E test directory');
  }

  checkDeploymentConfiguration() {
    this.log('Checking deployment configuration...', 'info');
    
    // Check deployment scripts
    this.checkFile('scripts/deploy.sh', 'Deployment script');
    
    // Check GitHub Actions
    this.checkFile('.github/workflows/deploy.yml', 'GitHub Actions workflow');
    
    // Check Docker configuration (if applicable)
    if (fs.existsSync('Dockerfile')) {
      this.checkFile('Dockerfile', 'Docker configuration');
      this.checkFile('.dockerignore', 'Docker ignore file');
    }
    
    // Check health check endpoint
    this.checkFile('public/health.json', 'Health check endpoint');
  }

  checkDependencies() {
    this.log('Checking dependencies...', 'info');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check for critical dependencies
      const criticalDeps = [
        'react',
        'react-dom',
        'vite',
        '@vitejs/plugin-react',
        'vite-plugin-pwa'
      ];
      
      criticalDeps.forEach(dep => {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.log(`Critical dependency found: ${dep}`, 'pass');
        } else {
          this.log(`Missing critical dependency: ${dep}`, 'error');
        }
      });
      
      // Check for security vulnerabilities
      try {
        execSync('npm audit --audit-level=high', { stdio: 'pipe' });
        this.log('No high-severity security vulnerabilities found', 'pass');
      } catch (error) {
        this.log('Security vulnerabilities detected - run npm audit', 'warn');
      }
      
    } catch (error) {
      this.log(`Error checking dependencies: ${error.message}`, 'error');
    }
  }

  checkPerformanceConfiguration() {
    this.log('Checking performance configuration...', 'info');
    
    const viteConfig = fs.readFileSync('vite.config.ts', 'utf8');
    
    // Check for bundle optimization
    if (viteConfig.includes('manualChunks')) {
      this.log('Bundle splitting configured', 'pass');
    } else {
      this.log('Bundle splitting not configured', 'warn');
    }
    
    // Check for compression
    if (viteConfig.includes('gzip') || viteConfig.includes('brotli')) {
      this.log('Compression configured', 'pass');
    } else {
      this.log('Compression not configured', 'warn');
    }
    
    // Check for tree shaking
    if (viteConfig.includes('terser') || viteConfig.includes('minify')) {
      this.log('Minification configured', 'pass');
    } else {
      this.log('Minification not configured', 'warn');
    }
  }

  checkMonitoringConfiguration() {
    this.log('Checking monitoring configuration...', 'info');
    
    // Check for error tracking service
    this.checkFile('src/services/monitoring/ErrorTrackingService.ts', 'Error tracking service');
    
    // Check for feature flags service
    this.checkFile('src/services/feature-flags/FeatureFlagService.ts', 'Feature flags service');
    
    // Check for performance monitoring
    const performanceFiles = [
      'src/services/performance/WebVitalsService.ts',
      'src/services/performance/PerformanceProfiler.ts'
    ];
    
    performanceFiles.forEach(file => {
      this.checkFile(file, 'Performance monitoring service');
    });
  }

  checkDocumentation() {
    this.log('Checking documentation...', 'info');
    
    const docFiles = [
      'README.md',
      'docs/user-guide.md',
      'docs/analytics-guide.md',
      'docs/troubleshooting.md',
      'docs/faq.md'
    ];
    
    docFiles.forEach(file => {
      this.checkFile(file, 'Documentation file');
    });
  }

  runBuildTest() {
    this.log('Testing production build...', 'info');
    
    try {
      // Clean previous build
      if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true });
      }
      
      // Run build
      execSync('npm run build', { stdio: 'pipe' });
      
      // Check build output
      if (fs.existsSync('dist/index.html')) {
        this.log('Production build successful', 'pass');
        
        // Check for critical files
        const criticalFiles = [
          'dist/index.html',
          'dist/manifest.json'
        ];
        
        criticalFiles.forEach(file => {
          if (fs.existsSync(file)) {
            this.log(`Build output contains: ${file}`, 'pass');
          } else {
            this.log(`Build output missing: ${file}`, 'error');
          }
        });
        
      } else {
        this.log('Production build failed', 'error');
      }
      
    } catch (error) {
      this.log(`Build test failed: ${error.message}`, 'error');
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('PRODUCTION SETUP VERIFICATION REPORT');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Passed: ${this.passed.length}`);
    console.log(`⚠️  Warnings: ${this.warnings.length}`);
    console.log(`❌ Errors: ${this.errors.length}`);
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      this.warnings.forEach(warning => console.log(`   - ${warning}`));
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.errors.forEach(error => console.log(`   - ${error}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    if (this.errors.length === 0) {
      console.log('🎉 Production setup verification PASSED!');
      console.log('Your application is ready for production deployment.');
      return true;
    } else {
      console.log('💥 Production setup verification FAILED!');
      console.log('Please fix the errors above before deploying to production.');
      return false;
    }
  }

  async run() {
    console.log('🚀 Starting production setup verification...\n');
    
    this.checkEnvironmentVariables();
    this.checkBuildConfiguration();
    this.checkPWAConfiguration();
    this.checkSecurityConfiguration();
    this.checkTestConfiguration();
    this.checkDeploymentConfiguration();
    this.checkDependencies();
    this.checkPerformanceConfiguration();
    this.checkMonitoringConfiguration();
    this.checkDocumentation();
    this.runBuildTest();
    
    return this.generateReport();
  }
}

// Run verification if called directly
if (require.main === module) {
  const verifier = new ProductionVerifier();
  verifier.run().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Verification failed:', error);
    process.exit(1);
  });
}

module.exports = ProductionVerifier;