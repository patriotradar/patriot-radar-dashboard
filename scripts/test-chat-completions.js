#!/usr/bin/env node
/**
 * Smoke test for POST /api/chat/completions
 *
 * Usage:
 *   node scripts/test-chat-completions.js
 *   API_URL=https://your-app.vercel.app/api/chat/completions node scripts/test-chat-completions.js
 *
 * Local (with `vercel dev` running):
 *   API_URL=http://localhost:3000/api/chat/completions node scripts/test-chat-completions.js
 */

const API_URL =
  process.env.API_URL || "http://localhost:3000/api/chat/completions";

const sampleBody = {
  caption: "Test post",
  niche: "tech",
};

async function main() {
  console.log("POST", API_URL);
  console.log("Body:", JSON.stringify(sampleBody, null, 2));

  const resp = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sampleBody),
  });

  const text = await resp.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
    console.log("\nStatus:", resp.status);
    console.log("Response:", JSON.stringify(parsed, null, 2));
    if (parsed.choices?.[0]?.message?.content) {
      console.log("\nContent:", parsed.choices[0].message.content);
    }
  } catch {
    console.log("\nStatus:", resp.status);
    console.log("Response (raw):", text);
  }

  if (!resp.ok) process.exit(1);
}

main().catch((err) => {
  console.error("Request failed:", err.message);
  process.exit(1);
});
