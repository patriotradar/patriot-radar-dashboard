/**
 * Bridge module — re-exports live state utilities to avoid circular requires.
 * tiktok-insights.js and tiktok-content-approval.js depend on this module.
 */

function getSupabaseConfig() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://kdwqnlgdanzigpdwyqbh.supabase.co"
  ).replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_7WtTtv9S4dl5jO-YE9QXRg_Ldy3gU_G";
  return { url, key };
}

function emptyLiveState(niche) {
  return {
    updated_at: new Date().toISOString(),
    niche: niche || "general",
    trend_intelligence_feed: [],
    niche_comment_raw: [],
    niche_keywords: {
      results: [],
      emerging: [],
      product_trends: [],
      creator_insights: [],
    },
    insights: [],
    recommended_posts: [],
    trend_scores: [],
    trending_products: [],
    videos: [],
    virality: { calibration: [], explanations: [] },
    shop_catalog: [],
    inventory_gaps: [],
    trend_history: {},
    breaking_news: [],
    errors: [],
    success: true,
  };
}

function buildLiveState(accountIdOrNiche, opts) {
  const tls = require("./tiktok-live-state");
  if (typeof tls.buildLiveState === "function") {
    return tls.buildLiveState(accountIdOrNiche, opts);
  }
  return Promise.resolve(emptyLiveState(accountIdOrNiche));
}

async function approveQueuedContent(contentId, decision) {
  if (!contentId) {
    return { success: false, content_id: "", decision: "", status: "", error: "missing_content_id" };
  }
  const validDecisions = ["approve", "approved", "reject", "rejected", "pause", "paused"];
  const normalizedDecision = decision === "approved" ? "approved"
    : decision === "approve" ? "approved"
    : decision === "rejected" ? "rejected"
    : decision === "reject" ? "rejected"
    : decision === "paused" ? "paused"
    : decision === "pause" ? "paused"
    : "";

  if (!normalizedDecision) {
    return { success: false, content_id: contentId, decision, status: "", error: "invalid_decision" };
  }

  const { url, key } = getSupabaseConfig();
  if (!url || !key) {
    return { success: false, content_id: contentId, decision: normalizedDecision, status: "", error: "supabase_not_configured" };
  }

  try {
    const resp = await fetch(
      `${url}/rest/v1/content_queue?id=eq.${encodeURIComponent(contentId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({ status: normalizedDecision }),
      }
    );

    if (!resp.ok) {
      const text = await resp.text();
      return { success: false, content_id: contentId, decision: normalizedDecision, status: "", error: text.slice(0, 200) };
    }

    const rows = await resp.json();
    const updated = Array.isArray(rows) && rows.length ? rows[0] : {};
    return {
      success: true,
      content_id: contentId,
      decision: normalizedDecision,
      status: updated.status || normalizedDecision,
      error: null,
    };
  } catch (err) {
    return { success: false, content_id: contentId, decision: normalizedDecision, status: "", error: String(err.message || err) };
  }
}

module.exports = {
  emptyLiveState,
  buildLiveState,
  approveQueuedContent,
};
