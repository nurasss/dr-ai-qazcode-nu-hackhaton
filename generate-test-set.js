#!/usr/bin/env node

import fs from "fs";
import readline from "readline";

/**
 * Генерация test_set из корпуса протоколов.
 * Формат строки: только query (описание симптомов пациента) и gt (ground truth код МКБ-10).
 * В одном протоколе может быть несколько смежных диагнозов — для каждого кода
 * query строится по контексту этого кода в протоколе, gt = этот код.
 * Использование: node generate-test-set.js [output_file] [max_cases_per_protocol]
 */

const CORPUS_FILE = "protocols_corpus.jsonl";
const OUTPUT_FILE = process.argv[2] || "test_set_generated.jsonl";
const MAX_CASES = parseInt(process.argv[3]) || 3;

// Маппинг кодов на типичные симптомы для генерации query
const CODE_SYMPTOMS = {
  "O14.2": [
    "боль в правом верхнем квадранте живота",
    "головная боль",
    "рвота",
    "повышенное артериальное давление",
    "снижение тромбоцитов",
    "повышение трансаминаз"
  ],
  "E78.0": [
    "повышенный холестерин",
    "гиперхолестеринемия",
    "ХС-ЛПНП выше нормы",
    "боль в груди",
    "раннее развитие ИБС"
  ],
  "E78.2": [
    "смешанная гиперлипидемия",
    "повышенные триглицериды",
    "высокий холестерин",
    "семейная история ССЗ"
  ],
  "I63": [
    "инсульт",
    "острое нарушение мозгового кровообращения",
    "ишемический инсульт",
    "атеросклероз мозговых артерий"
  ],
  "I70.2": [
    "атеросклероз артерий конечностей",
    "боль в ногах при ходьбе",
    "перемежающаяся хромота",
    "поражение периферических артерий"
  ],
  "I21": [
    "острый инфаркт миокарда",
    "боль в груди",
    "острый коронарный синдром",
    "ИБС"
  ],
  "I20": [
    "стенокардия",
    "боль в загрудинной области",
    "ишемическая болезнь сердца",
    "боль при физической нагрузке"
  ]
};

async function loadCorpus() {
  const docs = [];
  const stream = fs.createReadStream(CORPUS_FILE);
  const rl = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.trim()) {
      try {
        docs.push(JSON.parse(line));
      } catch (e) {
        console.error("Parse error:", e);
      }
    }
  }
  return docs;
}

/**
 * Извлекает из текста протокола фрагмент, относящийся к данному коду МКБ
 * (определение, описание, клиника — чтобы подобрать gt под симптомы).
 */
function getContextForCode(docText, code) {
  if (!docText || !code) return "";
  const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`\\b${escapedCode}\\b[^.]*[.—\\-][^.]*\\.|[^.]*\\b${escapedCode}\\b[^.]*\\.`, "gi");
  const m = docText.match(re);
  return m ? m[0].trim() : "";
}

function extractKeywords(text, code) {
  // Сначала пробуем контекст именно этого кода в протоколе
  const contextForCode = getContextForCode(text, code);
  const searchText = contextForCode.length > 50 ? contextForCode : text;

  const symptoms = CODE_SYMPTOMS[code] || [];
  if (symptoms.length > 0) {
    return symptoms;
  }

  const regex = /жалоб[а-я]*:|симптом[а-я]*:|признак[а-я]*:([^\.\n]+)/gi;
  const matches = searchText.match(regex) || [];
  if (matches.length > 0) {
    return matches.slice(0, 5).map(m => m.replace(/жалоб[а-я]*:|симптом[а-я]*:|признак[а-я]*:/gi, "").trim());
  }

  // Вытаскиваем короткие фразы из контекста кода (клиника, жалобы)
  const words = searchText.replace(/\s+/g, " ").split(/[.;]/).filter(p => p.length > 20 && p.length < 200);
  return words.slice(0, 3).map(p => p.trim());
}

function generateQuery(doc, code) {
  const text = doc.text || "";
  const symptoms = extractKeywords(text, code);
  const safeSymptoms = symptoms && symptoms.length > 0 ? symptoms : [];
  if (safeSymptoms.length === 0) {
    const fallback = (getContextForCode(text, code) || text).substring(0, 200);
    return fallback.trim() || "Жалобы по протоколу.";
  }
  const selected = safeSymptoms.slice(0, Math.min(3, safeSymptoms.length));
  return `Пациент обратился с жалобами на: ${selected.join(", ")}.`;
}

async function generateTestSet() {
  const corpus = await loadCorpus();
  const testCases = [];
  
  console.log(`📚 Loading corpus: ${corpus.length} documents`);
  console.log(`🔍 Generating test cases (max ${MAX_CASES} per protocol)...\n`);

  for (const doc of corpus) {
    if (!doc.icd_codes || doc.icd_codes.length === 0) continue;

    // В одном протоколе несколько смежных диагнозов — для каждого кода
    // строим query по контексту этого кода в протоколе, gt = этот код
    const protocolCases = [];
    for (const code of doc.icd_codes) {
      const query = generateQuery(doc, code);
      protocolCases.push({ query, gt: code });
    }
    // Ограничиваем число кейсов на протокол
    testCases.push(...protocolCases.slice(0, MAX_CASES));
  }

  const lines = testCases.map(tc => JSON.stringify({ query: tc.query, gt: tc.gt }));
  fs.writeFileSync(OUTPUT_FILE, lines.join("\n"));

  console.log(`✅ Generated ${testCases.length} test cases`);
  console.log(`📄 Saved to: ${OUTPUT_FILE} (only query + gt)`);
  if (testCases.length > 0) {
    console.log(`\nExample: ${JSON.stringify(testCases[0])}`);
  }
}

generateTestSet().catch(err => {
  console.error("❌ Error:", err);
  process.exit(1);
});
