/**
 * Client-side screenshot preprocessing — calls /api/screenshots/preprocess
 * before AI audit analysis. Returns structured metrics JSON only.
 */
(function (global) {
  async function preprocessScreenshots(images) {
    var list = Array.isArray(images) ? images : images ? [images] : [];
    list = list
      .map(function (img) {
        return typeof img === "string" ? img : img && (img.dataUrl || img.image);
      })
      .filter(Boolean);

    if (list.length === 0) {
      return {
        account_summary: {
          avg_views: null,
          avg_likes: null,
          avg_comments: null,
          engagement_rate: null,
        },
        posts: [],
        data_quality: {
          confidence: "low",
          missing_fields: ["views", "likes", "comments", "shares", "saves"],
          screenshots_processed: 0,
          posts_detected: 0,
        },
      };
    }

    var resp = await fetch("/api/screenshots/preprocess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: list }),
    });

    if (!resp.ok) {
      var errBody = null;
      try {
        errBody = await resp.json();
      } catch (e) {}
      throw new Error(
        (errBody && errBody.error && errBody.error.message) ||
          "Screenshot preprocessing failed (" + resp.status + ")"
      );
    }

    return resp.json();
  }

  /** Map first detected post metrics for perf-log form fields (legacy shape). */
  function metricsToLegacyForm(metricsJson) {
    var post = metricsJson && metricsJson.posts && metricsJson.posts[0];
    if (!post) return null;
    var m = post.metrics || {};
    return {
      views: m.views,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      saves: m.saves,
      followers: null,
      watchTime: null,
      completionRate: null,
    };
  }

  global.preprocessScreenshots = preprocessScreenshots;
  global.metricsToLegacyForm = metricsToLegacyForm;
})(typeof window !== "undefined" ? window : globalThis);
