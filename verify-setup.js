#!/usr/bin/env node

import fs from 'fs'
import path from 'path'

const checks = [
  // Project structure
  { path: 'src/modules/service-bus', type: 'dir', name: 'Service Bus module structure' },
  { path: 'src/modules/chirpstack', type: 'dir', name: 'Chirpstack module structure' },
  { path: 'src/modules/shared', type: 'dir', name: 'Shared module structure' },
  { path: 'src/components/ui', type: 'dir', name: 'UI components structure' },
  { path: 'src/components/terminal', type: 'dir', name: 'Terminal components structure' },
  
  // Configuration files
  { path: 'vite.config.ts', type: 'file', name: 'Vite configuration with PWA' },
  { path: 'tailwind.config.js', type: 'file', name: 'TailwindCSS configuration' },
  { path: 'tsconfig.json', type: 'file', name: 'TypeScript configuration' },
  { path: 'eslint.config.js', type: 'file', name: 'ESLint configuration' },
  { path: '.prettierrc', type: 'file', name: 'Prettier configuration' },
  
  // Testing setup
  { path: 'vitest.config.ts', type: 'file', name: 'Vitest configuration' },
  { path: 'playwright.config.ts', type: 'file', name: 'Playwright configuration' },
  { path: 'src/test/setup.ts', type: 'file', name: 'Test setup file' },
  
  // Core files
  { path: 'src/App.tsx', type: 'file', name: 'Main App component' },
  { path: 'src/index.css', type: 'file', name: 'TailwindCSS styles' },
  { path: 'src/lib/utils.ts', type: 'file', name: 'Utility functions' },
  
  // Component files
  { path: 'src/components/terminal/TerminalWindow.tsx', type: 'file', name: 'Terminal Window component' },
  { path: 'src/components/ui/button.tsx', type: 'file', name: 'Button component' },
]

console.log('🔍 Verifying project setup...\n')

let passed = 0
let failed = 0

for (const check of checks) {
  try {
    const exists = fs.existsSync(check.path)
    if (exists) {
      const stats = fs.statSync(check.path)
      const isCorrectType = check.type === 'dir' ? stats.isDirectory() : stats.isFile()
      
      if (isCorrectType) {
        console.log(`✅ ${check.name}`)
        passed++
      } else {
        console.log(`❌ ${check.name} (wrong type)`)
        failed++
      }
    } else {
      console.log(`❌ ${check.name} (not found)`)
      failed++
    }
  } catch (error) {
    console.log(`❌ ${check.name} (error: ${error.message})`)
    failed++
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`)

if (failed === 0) {
  console.log('🎉 All checks passed! Project setup is complete.')
} else {
  console.log('⚠️  Some checks failed. Please review the setup.')
  process.exit(1)
}