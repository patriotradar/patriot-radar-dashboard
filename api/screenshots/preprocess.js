import { preprocessScreenshots } from "./preprocess-core.js";

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

  const images = body?.images;
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({
      error: { message: "Request must include a non-empty images array" },
    });
  }

  if (images.length > 10) {
    return res.status(400).json({
      error: { message: "Maximum 10 screenshots per request" },
    });
  }

  try {
    const result = await preprocessScreenshots(images, apiKey, DEFAULT_MODEL);
    return res.status(200).json(result);
  } catch (err) {
    console.error("Screenshot preprocess error:", err);
    return res.status(502).json({
      error: { message: err.message || "Screenshot preprocessing failed" },
    });
  }
}
