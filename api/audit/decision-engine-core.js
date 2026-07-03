/**
 * Deterministic account-stage decision engine.
 * Runs AFTER screenshot JSON preprocessing (Step 1). No AI involvement.
 *
 * Input: structured JSON from preprocess with account_summary metrics.
 * Output: { stage, engine, bottleneck, reason }
 */

export const THRESHOLDS = {
  avg_views: 300,
  avg_likes: 20,
  engagement_rate: 2,
};

const BOTTLENECK_NO_TRACTION = "distribution problem (lack of reach)";
const BOTTLENECK_GROWING = "content performance problem (hooks, retention, format)";

function metricValue(summary, key) {
  const value = summary?.[key];
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function isBelowThreshold(value, threshold) {
  return value === null || value < threshold;
}

function formatMetric(value, suffix = "") {
  if (value === null) return "unavailable";
  return `${value}${suffix}`;
}

/**
 * @param {object} preprocessedJson - Step 1 output from screenshot preprocessing
 * @returns {{ stage: string, engine: string, bottleneck: string, reason: string }}
 */
export function runDecisionEngine(preprocessedJson) {
  const summary = preprocessedJson?.account_summary || {};
  const avgViews = metricValue(summary, "avg_views");
  const avgLikes = metricValue(summary, "avg_likes");
  const engagementRate = metricValue(summary, "engagement_rate");

  const viewsBelow = isBelowThreshold(avgViews, THRESHOLDS.avg_views);
  const likesBelow = isBelowThreshold(avgLikes, THRESHOLDS.avg_likes);
  const engagementBelow = isBelowThreshold(engagementRate, THRESHOLDS.engagement_rate);

  const isNoTraction = viewsBelow || likesBelow || engagementBelow;

  if (isNoTraction) {
    const triggers = [];
    if (viewsBelow) {
      triggers.push(
        `avg_views (${formatMetric(avgViews)}) is below ${THRESHOLDS.avg_views}`
      );
    }
    if (likesBelow) {
      triggers.push(
        `avg_likes (${formatMetric(avgLikes)}) is below ${THRESHOLDS.avg_likes}`
      );
    }
    if (engagementBelow) {
      triggers.push(
        `engagement_rate (${formatMetric(engagementRate, "%")}) is below ${THRESHOLDS.engagement_rate}%`
      );
    }

    return {
      stage: "NO_TRACTION",
      engine: "DISTRIBUTION",
      bottleneck: BOTTLENECK_NO_TRACTION,
      reason: `Classified as NO_TRACTION because ${triggers.join(" and ")}. Engine set to DISTRIBUTION — primary bottleneck is ${BOTTLENECK_NO_TRACTION}.`,
    };
  }

  return {
    stage: "GROWING",
    engine: "GROWTH",
    bottleneck: BOTTLENECK_GROWING,
    reason: `Classified as GROWING because avg_views (${avgViews}), avg_likes (${avgLikes}), and engagement_rate (${engagementRate}%) all meet minimum thresholds (${THRESHOLDS.avg_views} views, ${THRESHOLDS.avg_likes} likes, ${THRESHOLDS.engagement_rate}% engagement). Engine set to GROWTH — primary bottleneck is ${BOTTLENECK_GROWING}.`,
  };
}
