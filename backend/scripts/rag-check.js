#!/usr/bin/env node
/**
 * Live check of the policy assistant (RAG) against RUNNING services. No test framework needed.
 *
 *   uvicorn app.main:app --port 8000   (in ai-service/)
 *   npm start                          (in backend/)
 *   npm run rag:check
 *
 * A. straight to the AI service: retrieval + grounded answer, and refusal of off-topic questions
 * B. through POST /assistant/chat, signed in as a seeded GOLD customer
 *
 * It calls Gemini for real, so results depend on the key's rate limit. See docs/TESTING.md.
 */
import env from '../src/config/env.js';

const AI = `${env.aiServiceUrl}/api/v1/knowledge`;
const API = `${process.env.SMOKE_BASE_URL ?? 'http://localhost:8080'}${process.env.API_PREFIX ?? '/api/v1'}`;
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? 'Passw0rd!';
const REFUSAL = "I don't have that information.";
const aiHeaders = { Authorization: `Bearer ${env.aiServiceApiKey}` };

// question, extra fields, a word the top document must contain (null = must refuse),
// a fact the answer must contain
const CASES = [
  ['Can I return an opened mobile phone purchased online?', {}, 'Return', /14/],
  ['Do Gold members get free express delivery?', { membershipTier: 'GOLD' }, 'Shipping', null],
  ['What is the warranty period for a refrigerator compressor?', {}, 'Warranty', /10 years/i],
  ['How do I factory reset my smartphone?', { category: 'Smartphones' }, 'Smartphone', null],
  [
    'At what stock level should a store raise a replenishment request?',
    { category: 'Store Operations' },
    'Replenishment',
    null,
  ],
  ['What is the capital of France?', {}, null, null],
  ["What is NovaMart's policy on returning a pet tiger?", {}, null, null],
];

const CHAT = [
  ['Can I return an opened mobile phone purchased online?', 'policy'],
  ['Do Gold members get free express delivery?', 'policy'],
  ['What is the warranty period for a refrigerator compressor?', 'policy'],
  ['laptop for Java development under 1 lakh', 'products'],
];

async function post(url, body, headers = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(70000),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json, secs: (Date.now() - started) / 1000 };
  } catch (err) {
    return { status: 0, json: null, secs: (Date.now() - started) / 1000, error: err.name };
  }
}

const short = (text) => String(text).replace(/\s+/g, ' ').slice(0, 240);
const docName = (name) => name.replace('NovaMart ', '');

console.log(`=== A. Straight to the AI service (${env.aiServiceUrl})`);
let passedDirect = 0;
for (const [question, extra, expectDoc, expectFact] of CASES) {
  const body = { question, region: 'IN', ...extra };
  const [retrieval, query] = await Promise.all([
    post(`${AI}/retrieve`, body, aiHeaders),
    post(`${AI}/query`, body, aiHeaders),
  ]);
  const chunks = retrieval.json?.chunks ?? [];
  const answer = query.json ?? {};
  const sources = answer.sources ?? [];

  console.log(`\nQ: ${question}`);
  console.log(
    `   retrieval (${retrieval.secs.toFixed(1)}s): ` +
      (retrieval.status === 200
        ? chunks
            .slice(0, 2)
            .map((c) => `${c.relevance_score.toFixed(2)} ${docName(c.document)} / ${c.section}`)
            .join('  |  ')
        : `HTTP ${retrieval.status} ${retrieval.error ?? ''}`)
  );
  if (query.status !== 200) {
    console.log(`   answer: HTTP ${query.status} ${query.error ?? ''}  => PROBLEM`);
    continue;
  }
  console.log(
    `   answer (${query.secs.toFixed(1)}s, ${answer.confidence}): ${short(answer.answer)}`
  );
  console.log(
    `   sources: ${sources.map((s) => `${docName(s.document)} / ${s.section}`).join('; ') || 'none'}`
  );

  const refused = String(answer.answer).trim() === REFUSAL;
  const good =
    expectDoc === null
      ? refused && sources.length === 0
      : !refused &&
        chunks[0]?.document.includes(expectDoc) &&
        sources.some((s) => s.document.includes(expectDoc)) &&
        (!expectFact || expectFact.test(answer.answer));
  passedDirect += good ? 1 : 0;
  const verdict = expectDoc === null ? 'correctly refused' : 'correct, with the right citation';
  const hint = refused && expectDoc ? ' (refused although the right evidence was retrieved)' : '';
  console.log(`   => ${good ? verdict : `PROBLEM${hint}`}`);
}
console.log(`\nA: ${passedDirect}/${CASES.length} handled correctly`);

console.log(`\n=== B. Through the backend chat endpoint (${API}), as a GOLD customer`);
const login = await post(`${API}/auth/login`, {
  email: 'meera.iyer@example.com',
  password: PASSWORD,
});
const token = login.json?.data?.token;
console.log(`login: HTTP ${login.status} ${login.json?.data?.user?.fullName ?? login.error ?? ''}`);

let passedChat = 0;
for (const [message, expectType] of CHAT) {
  const res = await post(
    `${API}/assistant/chat`,
    { message },
    { Authorization: `Bearer ${token}` }
  );
  const data = res.json?.data;
  console.log(`\nQ: ${message}`);
  if (res.status !== 200) {
    console.log(`   HTTP ${res.status}: ${short(JSON.stringify(res.json?.error ?? res.error))}`);
    console.log('   => PROBLEM');
    continue;
  }
  if (data.type === 'policy') {
    console.log(`   policy (${res.secs.toFixed(1)}s, ${data.confidence}): ${short(data.answer)}`);
    console.log(
      `   sources: ${data.sources.map((s) => `${docName(s.document)} / ${s.section}`).join('; ') || 'none'}`
    );
  } else {
    console.log(`   products (${res.secs.toFixed(1)}s, engine ${data.meta.engine})`);
    for (const p of data.recommendations) {
      console.log(`     - ${p.name} ₹${p.price} [${p.availability.status}]`);
    }
  }
  const good =
    data.type === expectType &&
    (data.type === 'products'
      ? data.recommendations.length > 0
      : data.answer !== REFUSAL && data.sources.length > 0);
  passedChat += good ? 1 : 0;
  console.log(`   => ${good ? 'ok' : 'PROBLEM'}`);
}
console.log(`\nB: ${passedChat}/${CHAT.length} handled correctly`);

process.exit(passedDirect === CASES.length && passedChat === CHAT.length ? 0 : 1);
