#!/usr/bin/env node

import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/chat";

const tests = [
  {
    name: "HELLP синдром - симптомы",
    question: "Какие основные симптомы HELLP синдрома?",
    shouldContain: ["боль", "головная боль", "тромбоцит", "АСТ", "АЛТ"]
  },
  {
    name: "Дислипидемия - анализы",
    question: "Какие анализы нужны при дислипидемии?",
    shouldContain: ["холестерин", "триглицерид", "печен", "АЛТ", "креатинин"]
  },
  {
    name: "HELLP синдром - лечение",
    question: "Как лечить HELLP синдром?",
    shouldContain: ["магний", "родоразреш", "лабеталол", "тромбоцит"]
  },
  {
    name: "Гипертензия - диагностика",
    question: "Какие критерии диагноза преэклампсии?",
    shouldContain: ["АД", "артериальное", "протеинурия"]
  }
];

async function runTests() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 Dr.AI RAG System Testing");
  console.log("=".repeat(70) + "\n");

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    console.log(`📝 Test: ${test.name}`);
    console.log(`   Q: ${test.question}`);
    
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: test.question })
      });

      const data = await response.json();
      const reply = data.reply.toLowerCase();

      // Проверяем наличие ключевых слов
      const found = test.shouldContain.filter(word => reply.includes(word));
      const score = (found.length / test.shouldContain.length) * 100;

      if (score >= 60) {
        console.log(`   ✅ PASS (${score.toFixed(0)}%) - найдено ${found.length}/${test.shouldContain.length} ключевых слов`);
        console.log(`   📖 ${reply.substring(0, 150)}...`);
        passed++;
      } else {
        console.log(`   ❌ FAIL (${score.toFixed(0)}%) - найдено только ${found.length}/${test.shouldContain.length}`);
        console.log(`   Missing: ${test.shouldContain.filter(w => !reply.includes(w)).join(", ")}`);
        failed++;
      }
    } catch (err) {
      console.log(`   ⚠️ ERROR: ${err.message}`);
      failed++;
    }

    console.log();
  }

  console.log("=".repeat(70));
  console.log(`✅ PASSED: ${passed}/${tests.length}`);
  console.log(`❌ FAILED: ${failed}/${tests.length}`);
  console.log("=".repeat(70) + "\n");

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
