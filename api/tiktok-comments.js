const APIFY_TOKEN = process.env.APIFY_API_KEY || process.env.apifi_api_key || "";
const ACTOR_ID = "clockworks~tiktok-comments-scraper";
const ALLOWED = (process.env.ALLOWED_ORIGIN || "*").split(",").map(s => s.trim());

function cors(res, origin) {
  const allow = ALLOWED.includes("*") ? "*" : (ALLOWED.includes(origin) ? origin : ALLOWED[0]);
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

export default async function handler(req, res) {
  cors(res, req.headers.origin || "");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const niche = (req.query.niche || "general").trim();
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);

  if (!APIFY_TOKEN) {
    return res.status(200).json({
      niche,
      comments: [],
      questions: [],
      product_mentions: [],
      status: "api_key_missing",
      message: "Apify API key not configured. Set APIFY_API_KEY in Vercel environment variables."
    });
  }

  try {
    const searchTerms = [
      niche + " tips",
      niche + " trending",
      niche + " review"
    ];

    const input = {
      hashtags: [niche.replace(/\s+/g, "")],
      resultsPerPage: limit,
      searchQueries: searchTerms.slice(0, 2),
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadVideos: false
    };

    const runResp = await fetch(
      `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}&waitForFinish=60`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      }
    );

    if (!runResp.ok) {
      const errText = await runResp.text().catch(() => "");
      return res.status(200).json({
        niche,
        comments: [],
        questions: [],
        product_mentions: [],
        status: "apify_error",
        message: `Apify returned ${runResp.status}: ${errText.slice(0, 200)}`
      });
    }

    const runData = await runResp.json();
    const datasetId = runData.data && runData.data.defaultDatasetId;

    if (!datasetId) {
      return res.status(200).json({
        niche,
        comments: [],
        questions: [],
        product_mentions: [],
        status: "no_dataset",
        message: "Apify run completed but no dataset returned"
      });
    }

    const dataResp = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&limit=${limit}`
    );
    const items = await dataResp.json();

    const comments = [];
    const questions = [];
    const productMentions = [];
    const questionWords = ["how", "what", "where", "why", "when", "which", "can", "does", "is there", "anyone", "recommend"];
    const productSignals = ["buy", "bought", "purchase", "link", "shop", "store", "price", "cost", "order", "amazon", "available", "stock", "sold out", "where to get", "need this"];

    for (const item of (Array.isArray(items) ? items : [])) {
      const text = (item.text || item.comment || "").trim();
      if (!text || text.length < 5) continue;

      const entry = {
        text: text.slice(0, 300),
        likes: item.diggCount || item.likes || 0,
        author: (item.uniqueId || item.author || "").slice(0, 30),
        video_url: item.videoWebUrl || item.url || ""
      };

      comments.push(entry);

      const lower = text.toLowerCase();
      const isQuestion = lower.includes("?") || questionWords.some(w => lower.startsWith(w) || lower.includes(" " + w + " "));
      if (isQuestion) {
        questions.push({ ...entry, type: "question" });
      }

      const isProduct = productSignals.some(s => lower.includes(s));
      if (isProduct) {
        productMentions.push({ ...entry, type: "product_mention" });
      }
    }

    questions.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    productMentions.sort((a, b) => (b.likes || 0) - (a.likes || 0));

    res.status(200).json({
      niche,
      total_comments: comments.length,
      comments: comments.slice(0, 30),
      questions: questions.slice(0, 15),
      product_mentions: productMentions.slice(0, 15),
      status: "ok"
    });

  } catch (err) {
    res.status(200).json({
      niche,
      comments: [],
      questions: [],
      product_mentions: [],
      status: "error",
      message: (err.message || String(err)).slice(0, 200)
    });
  }
}
