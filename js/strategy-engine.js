/**
 * Client-side Step 3 Strategy Engine — deterministic execution logic.
 * Runs AFTER Step 2 decision output, BEFORE any AI prompt.
 */
(function (global) {
  var THRESHOLDS = { avg_views: 300, avg_likes: 20, engagement_rate: 2 };
  var VIRAL_FORMATS = ["POV list", "trend reply", "3-slide carousel", "green-screen explainer"];
  var DISTRIBUTION_POSTS_PER_WEEK = "6-7 posts per week";
  var GROWTH_POSTS_PER_WEEK = "4-5 posts per week";

  function metricValue(summary, key) {
    var value = summary && summary[key];
    return typeof value === "number" && !isNaN(value) ? value : null;
  }

  function formatMetric(value, suffix) {
    suffix = suffix || "";
    if (value === null) return "unavailable";
    return value + suffix;
  }

  function resolveEngine(decision) {
    if (decision && (decision.engine === "DISTRIBUTION" || decision.engine === "GROWTH")) {
      return decision.engine;
    }
    if (decision && decision.stage === "GROWING") return "GROWTH";
    return "DISTRIBUTION";
  }

  function getTopics(accountData) {
    var posts = Array.isArray(accountData && accountData.posts) ? accountData.posts : [];
    return posts
      .map(function (p) {
        return typeof (p && p.topic) === "string" ? p.topic.trim() : "";
      })
      .filter(Boolean);
  }

  function postPerformanceScore(post) {
    var m = (post && post.metrics) || {};
    return (
      (m.views || 0) +
      (m.likes || 0) * 10 +
      (m.comments || 0) * 20 +
      (m.shares || 0) * 30 +
      (m.saves || 0) * 25
    );
  }

  function getTopPost(posts) {
    if (!posts.length) return null;
    return posts.slice().sort(function (a, b) {
      return postPerformanceScore(b) - postPerformanceScore(a);
    })[0];
  }

  function getWeakestPost(posts) {
    if (!posts.length) return null;
    return posts.slice().sort(function (a, b) {
      return postPerformanceScore(a) - postPerformanceScore(b);
    })[0];
  }

  function nicheLabel(accountData) {
    return (accountData && accountData.niche && accountData.niche.trim()) || "your niche";
  }

  function platformLabel(accountData) {
    return (accountData && accountData.platform && accountData.platform.trim()) || "platform";
  }

  function topTheme(accountData, topics) {
    return (
      (accountData && accountData.top_theme && accountData.top_theme.trim()) ||
      topics[0] ||
      nicheLabel(accountData)
    );
  }

  function topFormat(accountData) {
    return (
      (accountData && accountData.top_format && accountData.top_format.trim()) ||
      "your highest-scoring caption format"
    );
  }

  function distributionGoal(summary) {
    var avgViews = metricValue(summary, "avg_views");
    var targetViews = THRESHOLDS.avg_views;
    if (avgViews === null) {
      return (
        "Reach " +
        targetViews +
        "+ avg views per post within 30 days (baseline unavailable — use screenshot metrics on next audit)."
      );
    }
    if (avgViews >= targetViews) {
      return (
        "Hold " +
        avgViews +
        "+ avg views while posting " +
        DISTRIBUTION_POSTS_PER_WEEK +
        " to expand reach beyond current audience."
      );
    }
    var stretch = Math.max(targetViews, Math.round(avgViews * 2));
    return (
      "Raise avg views from " +
      avgViews +
      " to " +
      stretch +
      "+ within 30 days via " +
      DISTRIBUTION_POSTS_PER_WEEK +
      " and viral-format testing."
    );
  }

  function growthGoal(summary) {
    var avgViews = metricValue(summary, "avg_views");
    var engagementRate = metricValue(summary, "engagement_rate");
    if (engagementRate === null) {
      return "Improve hook-to-retention on top-performing posts and publish 3 variations of your best topic within 30 days.";
    }
    var stretchRate = Math.round((engagementRate + 1) * 100) / 100;
    var viewsPart = avgViews !== null ? " while holding " + avgViews + "+ avg views" : "";
    return (
      "Increase engagement_rate from " +
      engagementRate +
      "% to " +
      stretchRate +
      "%" +
      viewsPart +
      " by scaling winning formats and hook rewrites."
    );
  }

  function buildDistributionContentIdeas(accountData, topics, theme) {
    var niche = nicheLabel(accountData);
    var platform = platformLabel(accountData);
    var topicA = topics[0] || theme;
    var topicB = topics[1] || niche + " beginner mistake";
    var topicC = topics[2] || niche + " hot take";
    return [
      {
        idea:
          'POV: "Things nobody tells you about ' +
          topicA +
          '" — 5 quick points in one ' +
          platform +
          " post",
        format: VIRAL_FORMATS[0],
        focus: "reach",
      },
      {
        idea:
          "Trend reply on a trending " +
          niche +
          ' sound — hook with "' +
          topicB +
          '" in the first line',
        format: VIRAL_FORMATS[1],
        focus: "reach",
      },
      {
        idea:
          '3-slide carousel: "' +
          topicC +
          '" — slide 1 hook, slides 2-3 payoff — repost weekly with new examples',
        format: VIRAL_FORMATS[2],
        focus: "reach",
      },
    ];
  }

  function buildGrowthContentIdeas(accountData, topPost, theme, format) {
    var topTopic =
      (topPost && typeof topPost.topic === "string" && topPost.topic.trim()) || theme;
    var topViews = topPost && topPost.metrics ? topPost.metrics.views : null;
    var viewsRef = topViews !== null ? " (" + topViews + " views on current top post)" : "";
    return [
      {
        idea:
          'Hook rewrite of top post on "' +
          topTopic +
          '" — test 3 new opening lines before the existing payoff' +
          viewsRef,
        format: format,
        focus: "hooks",
      },
      {
        idea:
          'Retention variant: same "' +
          topTopic +
          '" angle with a loop/payoff in the first 3 seconds — extend watch time on ' +
          format,
        format: format,
        focus: "retention",
      },
      {
        idea:
          'Scale winner: publish 2 variations of "' +
          topTopic +
          '" this week (new angle, same ' +
          format +
          " structure)" +
          viewsRef,
        format: format,
        focus: "scale winning formats",
      },
    ];
  }

  function buildDistributionStrategy(accountData, decision) {
    var summary = (accountData && accountData.account_summary) || {};
    var avgViews = metricValue(summary, "avg_views");
    var avgLikes = metricValue(summary, "avg_likes");
    var engagementRate = metricValue(summary, "engagement_rate");
    var topics = getTopics(accountData);
    var theme = topTheme(accountData, topics);
    var niche = nicheLabel(accountData);
    var platform = platformLabel(accountData);

    return {
      strategy_type: "DISTRIBUTION",
      diagnosis: [
        "Engine: DISTRIBUTION (" + ((decision && decision.stage) || "NO_TRACTION") + ").",
        "Metrics: avg_views " +
          formatMetric(avgViews) +
          ", avg_likes " +
          formatMetric(avgLikes) +
          ", engagement_rate " +
          formatMetric(engagementRate, "%") +
          ".",
        "Bottleneck: " +
          ((decision && decision.bottleneck) || "distribution problem (lack of reach)") +
          ".",
        (decision && decision.reason) ||
          "Reach is below growth thresholds — distribution must come before optimisation.",
      ].join(" "),
      action_plan: {
        posting_frequency: DISTRIBUTION_POSTS_PER_WEEK,
        focus_areas: ["reach", "viral formats", "high-frequency posting", "simple repeatable content"],
        week1:
          "Post daily on " +
          platform +
          " using one repeatable viral format (" +
          VIRAL_FORMATS[0] +
          ") on " +
          theme +
          " — no hook polish, priority is impressions.",
        week2:
          "Increase to " +
          DISTRIBUTION_POSTS_PER_WEEK +
          ". Add " +
          VIRAL_FORMATS[1] +
          " entries in " +
          niche +
          " plus 3 trend-reply posts.",
        week3:
          "Run 3 format tests (" +
          VIRAL_FORMATS.join(", ") +
          "). Keep only formats breaking " +
          THRESHOLDS.avg_views +
          "+ views.",
        week4:
          "Lock the top 2 formats from week 3. Maintain " +
          DISTRIBUTION_POSTS_PER_WEEK +
          " on " +
          theme +
          " with zero new format experiments.",
      },
      content_ideas: buildDistributionContentIdeas(accountData, topics, theme),
      goal: distributionGoal(summary),
    };
  }

  function buildGrowthStrategy(accountData, decision) {
    var summary = (accountData && accountData.account_summary) || {};
    var avgViews = metricValue(summary, "avg_views");
    var avgLikes = metricValue(summary, "avg_likes");
    var engagementRate = metricValue(summary, "engagement_rate");
    var posts = Array.isArray(accountData && accountData.posts) ? accountData.posts : [];
    var topPost = getTopPost(posts);
    var weakestPost = getWeakestPost(posts);
    var topics = getTopics(accountData);
    var theme = topTheme(accountData, topics);
    var format = topFormat(accountData);
    var topTopic =
      (topPost && typeof topPost.topic === "string" && topPost.topic.trim()) || theme;
    var weakTopic =
      (weakestPost && typeof weakestPost.topic === "string" && weakestPost.topic.trim()) ||
      "lowest-performing post topic";

    return {
      strategy_type: "GROWTH",
      diagnosis: [
        "Engine: GROWTH (" + ((decision && decision.stage) || "GROWING") + ").",
        "Metrics: avg_views " +
          formatMetric(avgViews) +
          ", avg_likes " +
          formatMetric(avgLikes) +
          ", engagement_rate " +
          formatMetric(engagementRate, "%") +
          ".",
        "Bottleneck: " +
          ((decision && decision.bottleneck) ||
            "content performance problem (hooks, retention, format)") +
          ".",
        'Top post topic: "' + topTopic + '". Weakest topic: "' + weakTopic + '".',
        (decision && decision.reason) ||
          "Reach thresholds met — optimise hooks, retention, and scale winners.",
      ].join(" "),
      action_plan: {
        posting_frequency: GROWTH_POSTS_PER_WEEK,
        focus_areas: [
          "improve hooks",
          "improve retention",
          "scale winning formats",
          "variations of top posts",
        ],
        week1:
          'Rewrite hooks on 3 weakest posts using the opening pattern from top post "' +
          topTopic +
          '" — publish 1 rewritten post every 2 days.',
        week2:
          "Retention pass on " +
          format +
          ": add loop/payoff in first 3 seconds on 2 existing " +
          theme +
          " posts; republish as new cuts.",
        week3:
          'Publish 3 variations of "' +
          topTopic +
          '" (new angle, same ' +
          format +
          " structure) — track which variation holds highest completion rate.",
        week4:
          "Scale winning variation to " +
          GROWTH_POSTS_PER_WEEK +
          " — 80% " +
          format +
          " on " +
          theme +
          ", 20% single format experiment.",
      },
      content_ideas: buildGrowthContentIdeas(accountData, topPost, theme, format),
      goal: growthGoal(summary),
    };
  }

  function runStrategyEngine(accountData, decisionOutput) {
    var engine = resolveEngine(decisionOutput);
    if (engine === "GROWTH") {
      return buildGrowthStrategy(accountData, decisionOutput);
    }
    return buildDistributionStrategy(accountData, decisionOutput);
  }

  global.runStrategyEngine = runStrategyEngine;
})(typeof window !== "undefined" ? window : globalThis);
