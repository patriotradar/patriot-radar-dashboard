const GEMINI_OPENAI_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function setCorsHeaders(res, origin) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  const allowOrigin =
    allowed === "*" ? "*" : origin === allowed ? origin : allowed;

  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function mapModel(clientModel) {
  if (typeof clientModel === "string" && clientModel.startsWith("gemini-")) {
    return clientModel;
  }
  return DEFAULT_MODEL;
}

export default async function handler(req, res) {
  const origin = req.headers.origin || "";

  if (req.method === "OPTIONS") {
    setCorsHeaders(res, origin);
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    setCorsHeaders(res, origin);
    return res.status(405).json({ error: { message: "Method not allowed" } });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    setCorsHeaders(res, origin);
    return res
      .status(500)
      .json({ error: { message: "GEMINI_API_KEY is not configured" } });
  }

  setCorsHeaders(res, origin);

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: { message: "Invalid JSON body" } });
    }
  }

  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: { message: "Request body required" } });
  }

  const payload = {
    ...body,
    model: mapModel(body.model),
  };

  try {
    const upstream = await fetch(GEMINI_OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    return res.end(text);
  } catch (err) {
    console.error("Gemini proxy error:", err);
    return res.status(502).json({ error: { message: "Upstream request failed" } });
  }
}
