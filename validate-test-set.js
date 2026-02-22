#!/usr/bin/env node

import fetch from "node-fetch";
import fs from "fs";
import readline from "readline";

const API_URL = "http://localhost:3000/api/diagnose";
const TEST_SET_FILE = process.argv[2] || "test_set.jsonl";

async function loadTestSet() {
  const tests = [];
  const stream = fs.createReadStream(TEST_SET_FILE);
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        tests.push(JSON.parse(line));
      } catch (e) {
        console.error("Parse error:", e);
      }
    }
  }
  return tests;
}

async function runValidation() {
  const tests = await loadTestSet();
  
  console.log("\n" + "=".repeat(80));
  console.log("🧪 Medical Diagnosis System - Test Set Validation");
  console.log("=".repeat(80) + "\n");

  let passed = 0;
  let failed = 0;
  let totalTests = tests.length;

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`📝 Test ${i + 1}/${totalTests}: "${test.query.substring(0, 60)}..."`);
    console.log(`   Ground Truth (GT): ${test.gt}`);
    
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: test.query })
      });

      const data = await response.json();
      
      if (!data.diagnoses || data.diagnoses.length === 0) {
        console.log(`   ❌ FAIL - No diagnoses found`);
        failed++;
      } else {
        const topDiagnosis = data.diagnoses[0];
        const foundCode = topDiagnosis.icd_codes?.[0];
        
        // Проверяем точное совпадение или совпадение префикса
        const isMatch = foundCode === test.gt || 
                       (foundCode && test.gt && foundCode.startsWith(test.gt.substring(0, 3)));
        
        if (isMatch) {
          console.log(`   ✅ PASS - Matched: ${foundCode} (${topDiagnosis.likelihood_percent}%)`);
          console.log(`      Diagnosis: ${topDiagnosis.diagnosis}`);
          passed++;
        } else {
          console.log(`   ❌ FAIL - Got: ${foundCode}, Expected: ${test.gt}`);
          console.log(`      Diagnosis: ${topDiagnosis.diagnosis}`);
          console.log(`      Top 3 matches:`);
          data.diagnoses.slice(0, 3).forEach((d, idx) => {
            console.log(`         ${idx + 1}. ${d.icd_codes.join(", ")} - ${d.diagnosis}`);
          });
          failed++;
        }
      }
    } catch (err) {
      console.log(`   ⚠️ ERROR: ${err.message}`);
      failed++;
    }

    console.log();
  }

  console.log("=".repeat(80));
  console.log(`✅ PASSED: ${passed}/${totalTests}`);
  console.log(`❌ FAILED: ${failed}/${totalTests}`);
  console.log(`Success Rate: ${((passed / totalTests) * 100).toFixed(1)}%`);
  console.log("=".repeat(80) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

runValidation().catch(err => {
  console.error("❌ Validation Error:", err);
  process.exit(1);
});
