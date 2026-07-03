/**
 * Client-side decision engine — deterministic stage/engine selection.
 * Runs AFTER screenshot JSON preprocessing (Step 1), BEFORE any AI prompt.
 */
(function (global) {
  var THRESHOLDS = { avg_views: 300, avg_likes: 20, engagement_rate: 2 };
  var BOTTLENECK_NO_TRACTION = "distribution problem (lack of reach)";
  var BOTTLENECK_GROWING = "content performance problem (hooks, retention, format)";

  function metricValue(summary, key) {
    var value = summary && summary[key];
    return typeof value === "number" && !isNaN(value) ? value : null;
  }

  function isBelowThreshold(value, threshold) {
    return value === null || value < threshold;
  }

  function formatMetric(value, suffix) {
    suffix = suffix || "";
    if (value === null) return "unavailable";
    return value + suffix;
  }

  function runDecisionEngine(preprocessedJson) {
    var summary = (preprocessedJson && preprocessedJson.account_summary) || {};
    var avgViews = metricValue(summary, "avg_views");
    var avgLikes = metricValue(summary, "avg_likes");
    var engagementRate = metricValue(summary, "engagement_rate");

    var viewsBelow = isBelowThreshold(avgViews, THRESHOLDS.avg_views);
    var likesBelow = isBelowThreshold(avgLikes, THRESHOLDS.avg_likes);
    var engagementBelow = isBelowThreshold(engagementRate, THRESHOLDS.engagement_rate);
    var isNoTraction = viewsBelow || likesBelow || engagementBelow;

    if (isNoTraction) {
      var triggers = [];
      if (viewsBelow) {
        triggers.push(
          "avg_views (" + formatMetric(avgViews) + ") is below " + THRESHOLDS.avg_views
        );
      }
      if (likesBelow) {
        triggers.push(
          "avg_likes (" + formatMetric(avgLikes) + ") is below " + THRESHOLDS.avg_likes
        );
      }
      if (engagementBelow) {
        triggers.push(
          "engagement_rate (" +
            formatMetric(engagementRate, "%") +
            ") is below " +
            THRESHOLDS.engagement_rate +
            "%"
        );
      }

      return {
        stage: "NO_TRACTION",
        engine: "DISTRIBUTION",
        bottleneck: BOTTLENECK_NO_TRACTION,
        reason:
          "Classified as NO_TRACTION because " +
          triggers.join(" and ") +
          ". Engine set to DISTRIBUTION — primary bottleneck is " +
          BOTTLENECK_NO_TRACTION +
          ".",
      };
    }

    return {
      stage: "GROWING",
      engine: "GROWTH",
      bottleneck: BOTTLENECK_GROWING,
      reason:
        "Classified as GROWING because avg_views (" +
        avgViews +
        "), avg_likes (" +
        avgLikes +
        "), and engagement_rate (" +
        engagementRate +
        "%) all meet minimum thresholds (" +
        THRESHOLDS.avg_views +
        " views, " +
        THRESHOLDS.avg_likes +
        " likes, " +
        THRESHOLDS.engagement_rate +
        "% engagement). Engine set to GROWTH — primary bottleneck is " +
        BOTTLENECK_GROWING +
        ".",
    };
  }

  global.runDecisionEngine = runDecisionEngine;
})(typeof window !== "undefined" ? window : globalThis);
