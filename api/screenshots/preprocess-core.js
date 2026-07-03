/**
 * Screenshot metrics preprocessing — extraction only, no analysis or advice.
 * Output schema is consumed by the AI audit system.
 */

export const METRIC_FIELDS = ["views", "likes", "comments", "shares", "saves"];

export const EXTRACTION_PROMPT = `You are a data extraction tool. Read this social media analytics screenshot and extract ONLY visible performance numbers.

RULES:
- Do NOT analyze, score, rank, or give advice.
- Do NOT interpret performance or suggest improvements.
- Extract every individual post visible in the screenshot.
- If one screenshot shows multiple posts (grid, list, or carousel), return one object per post.
- Use null for any metric that is not clearly visible.
- Parse abbreviated numbers (e.g. 1.2K → 1200, 3.4M → 3400000).
- Include topic only if visible (caption snippet, title, hashtag, or on-screen label). Otherwise null.

Return ONLY valid JSON (no markdown, no commentary) in this exact shape:
{"posts":[{"topic":null,"metrics":{"views":null,"likes":null,"comments":null,"shares":null,"saves":null}}]}`;

const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

export function normalizeMetric(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && !Number.isNaN(value)) return Math.round(value);
  const s = String(value).trim().replace(/,/g, "");
  if (!s || s === "—" || s === "-" || s === "N/A" || s === "n/a") return null;
  let mult = 1;
  let numStr = s;
  if (/k$/i.test(numStr)) {
    mult = 1000;
    numStr = numStr.replace(/k$/i, "");
  } else if (/m$/i.test(numStr)) {
    mult = 1_000_000;
    numStr = numStr.replace(/m$/i, "");
  } else if (/b$/i.test(numStr)) {
    mult = 1_000_000_000;
    numStr = numStr.replace(/b$/i, "");
  }
  const n = parseFloat(numStr);
  return Number.isNaN(n) ? null : Math.round(n * mult);
}

export function normalizePost(raw, postIndex) {
  const metrics = raw?.metrics && typeof raw.metrics === "object" ? raw.metrics : raw || {};
  const normalized = {};
  for (const field of METRIC_FIELDS) {
    normalized[field] = normalizeMetric(metrics[field]);
  }
  const topic =
    typeof raw?.topic === "string" && raw.topic.trim() ? raw.topic.trim().slice(0, 200) : null;
  return { post_index: postIndex, topic, metrics: normalized };
}

export function parseJsonFromModelContent(content) {
  if (!content || typeof content !== "string") return null;
  let cleaned = content.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  cleaned = cleaned.substring(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    const fixed = cleaned.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

function average(values) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function computeEngagementRate(posts) {
  const rates = [];
  for (const post of posts) {
    const m = post.metrics;
    if (!m.views || m.views <= 0) continue;
    const engagement =
      (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
    rates.push((engagement / m.views) * 100);
  }
  if (!rates.length) return null;
  return Math.round((rates.reduce((s, r) => s + r, 0) / rates.length) * 100) / 100;
}

export function buildStructuredOutput(rawPosts, screenshotsProcessed = 0) {
  const posts = Array.isArray(rawPosts) ? rawPosts : [];
  const views = [];
  const likes = [];
  const comments = [];
  const missingCounts = Object.fromEntries(METRIC_FIELDS.map((f) => [f, 0]));

  for (const post of posts) {
    for (const field of METRIC_FIELDS) {
      if (post.metrics[field] === null) missingCounts[field] += 1;
      else if (field === "views") views.push(post.metrics.views);
      else if (field === "likes") likes.push(post.metrics.likes);
      else if (field === "comments") comments.push(post.metrics.comments);
    }
  }

  const missingFields = METRIC_FIELDS.filter(
    (field) => posts.length === 0 || missingCounts[field] === posts.length
  );

  let confidence = "low";
  if (posts.length > 0) {
    const withViews = posts.filter((p) => p.metrics.views !== null).length;
    const withEngagement = posts.filter(
      (p) =>
        p.metrics.likes !== null ||
        p.metrics.comments !== null ||
        p.metrics.shares !== null ||
        p.metrics.saves !== null
    ).length;
    if (withViews >= posts.length * 0.8 && withEngagement >= posts.length * 0.5) {
      confidence = "high";
    } else if (withViews > 0 || withEngagement > 0) {
      confidence = "medium";
    }
  }

  return {
    account_summary: {
      avg_views: average(views),
      avg_likes: average(likes),
      avg_comments: average(comments),
      engagement_rate: computeEngagementRate(posts),
    },
    posts,
    data_quality: {
      confidence,
      missing_fields: missingFields,
      screenshots_processed: screenshotsProcessed,
      posts_detected: posts.length,
    },
  };
}

export async function extractPostsFromImage(imageDataUrl, apiKey, model = DEFAULT_MODEL) {
  const resp = await fetch(GEMINI_OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_PROMPT },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 800,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Vision extraction failed (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = parseJsonFromModelContent(content);
  if (!parsed || !Array.isArray(parsed.posts)) {
    throw new Error("Vision model returned invalid extraction JSON");
  }
  return parsed.posts;
}

export async function preprocessScreenshots(images, apiKey, model = DEFAULT_MODEL) {
  const normalizedImages = (Array.isArray(images) ? images : [])
    .map((img) => (typeof img === "string" ? img : img?.dataUrl || img?.image || null))
    .filter(Boolean);

  const rawPosts = [];
  let postIndex = 1;

  for (const imageDataUrl of normalizedImages) {
    const extracted = await extractPostsFromImage(imageDataUrl, apiKey, model);
    for (const raw of extracted) {
      rawPosts.push(normalizePost(raw, postIndex++));
    }
  }

  return buildStructuredOutput(rawPosts, normalizedImages.length);
}
