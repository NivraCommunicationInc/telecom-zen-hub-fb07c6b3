#!/usr/bin/env node
/**
 * Address Input Anti-Regression Check
 * 
 * This script scans all TSX files for free-text address inputs that should use
 * the AddressAutocomplete component instead. Run as part of CI/CD or pre-commit.
 * 
 * ALLOWED patterns:
 * - AddressAutocomplete, PortalAddressAutocomplete, AdminAddressAutocomplete
 * - Input for apartment/unit/suite/line2 fields only
 * 
 * FORBIDDEN patterns:
 * - <Input placeholder="...address..." /> (except apt/unit/suite)
 * - <Input id="*-address" /> (except apartment/line2)
 * - <Input name="*address*" /> (except apartment/line2)
 * 
 * Usage: node scripts/check-address-inputs.js
 * Exit code: 0 if no issues, 1 if violations found
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Patterns for allowed exceptions (apartment, unit, suite, line2)
const ALLOWED_PATTERNS = /apartment|apt|unit|suite|line2|unité|appartement/i;

// Patterns that indicate a free-text address input (forbidden)
const FORBIDDEN_PATTERNS = [
  // placeholder containing "address" or "adresse" without apartment/unit context
  /<Input[^>]*placeholder\s*=\s*["'][^"']*(?:address|adresse)[^"']*["'][^>]*>/gi,
  // id containing "address" without apartment/unit context
  /<Input[^>]*id\s*=\s*["'][^"']*address[^"']*["'][^>]*>/gi,
  // name containing "address" without apartment/unit context
  /<Input[^>]*name\s*=\s*["'][^"']*address[^"']*["'][^>]*>/gi,
];

// Files/directories to scan
const SCAN_DIRS = ['src'];
const EXCLUDE_DIRS = ['node_modules', 'dist', '.git'];
const FILE_EXTENSION = '.tsx';

function getAllTsxFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.includes(entry.name)) {
        getAllTsxFiles(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith(FILE_EXTENSION)) {
      files.push(fullPath);
    }
  }
  
  return files;
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];
  const lines = content.split('\n');
  
  // Skip files that are the autocomplete components themselves
  if (filePath.includes('AddressAutocomplete')) {
    return [];
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    for (const pattern of FORBIDDEN_PATTERNS) {
      // Reset regex state
      pattern.lastIndex = 0;
      const match = pattern.exec(line);
      
      if (match) {
        const matchedText = match[0];
        
        // Check if this is an allowed exception (apartment, unit, etc.)
        if (ALLOWED_PATTERNS.test(matchedText)) {
          continue;
        }
        
        // Check if line also has AddressAutocomplete (it's the autocomplete component, not a plain input)
        if (line.includes('AddressAutocomplete')) {
          continue;
        }
        
        violations.push({
          file: filePath,
          line: lineNum,
          match: matchedText.trim().substring(0, 100),
          message: 'Free-text address Input detected. Use AddressAutocomplete instead.'
        });
      }
    }
  }
  
  return violations;
}

function main() {
  console.log('🔍 Scanning for free-text address inputs...\n');
  
  let allViolations = [];
  
  for (const scanDir of SCAN_DIRS) {
    if (!fs.existsSync(scanDir)) {
      console.warn(`⚠️  Directory not found: ${scanDir}`);
      continue;
    }
    
    const files = getAllTsxFiles(scanDir);
    console.log(`📁 Found ${files.length} TSX files in ${scanDir}`);
    
    for (const file of files) {
      const violations = checkFile(file);
      allViolations = allViolations.concat(violations);
    }
  }
  
  console.log('');
  
  if (allViolations.length === 0) {
    console.log('✅ No free-text address inputs found. All address fields use AddressAutocomplete.');
    process.exit(0);
  } else {
    console.log(`❌ Found ${allViolations.length} violation(s):\n`);
    
    for (const v of allViolations) {
      console.log(`  📍 ${v.file}:${v.line}`);
      console.log(`     ${v.message}`);
      console.log(`     Match: ${v.match}`);
      console.log('');
    }
    
    console.log('💡 Fix: Replace <Input> with AddressAutocomplete, PortalAddressAutocomplete, or AdminAddressAutocomplete');
    console.log('   Exception: Apartment/Unit/Suite fields may use plain <Input>');
    console.log('');
    
    process.exit(1);
  }
}

main();
