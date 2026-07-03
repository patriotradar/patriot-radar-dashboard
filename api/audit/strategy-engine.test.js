import { runStrategyEngine } from "./strategy-engine-core.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(name, fn) {
  try {
    fn();
    console.log("PASS:", name);
  } catch (err) {
    console.error("FAIL:", name, "-", err.message);
    process.exitCode = 1;
  }
}

const distributionDecision = {
  stage: "NO_TRACTION",
  engine: "DISTRIBUTION",
  bottleneck: "distribution problem (lack of reach)",
  reason: "Classified as NO_TRACTION because avg_views (150) is below 300.",
};

const growthDecision = {
  stage: "GROWING",
  engine: "GROWTH",
  bottleneck: "content performance problem (hooks, retention, format)",
  reason: "Classified as GROWING because all metrics meet thresholds.",
};

test("DISTRIBUTION engine returns distribution strategy_type", () => {
  const result = runStrategyEngine(
    {
      account_summary: { avg_views: 150, avg_likes: 8, engagement_rate: 1.2 },
      posts: [{ topic: "meal prep", metrics: { views: 120, likes: 5 } }],
      niche: "fitness",
      platform: "TikTok",
    },
    distributionDecision
  );
  assert(result.strategy_type === "DISTRIBUTION", "strategy_type");
  assert(result.diagnosis.includes("DISTRIBUTION"), "diagnosis mentions engine");
  assert(result.diagnosis.includes("150"), "diagnosis cites avg_views");
  assert(result.action_plan.focus_areas.includes("reach"), "reach in focus_areas");
  assert(result.action_plan.posting_frequency.includes("6-7"), "high frequency");
  assert(result.content_ideas.length === 3, "3 content ideas");
  assert(result.content_ideas[0].focus === "reach", "content focus is reach");
  assert(result.content_ideas[0].idea.includes("meal prep"), "idea uses post topic");
  assert(result.goal.includes("150"), "goal references current views");
});

test("GROWTH engine returns optimisation strategy", () => {
  const result = runStrategyEngine(
    {
      account_summary: { avg_views: 1200, avg_likes: 45, engagement_rate: 4.2 },
      posts: [
        { topic: "skincare routine", metrics: { views: 2000, likes: 80, comments: 12 } },
        { topic: "product review", metrics: { views: 400, likes: 10, comments: 1 } },
      ],
      niche: "skincare",
      top_format: "myth-bust reel",
      top_theme: "skincare routine",
      platform: "Instagram",
    },
    growthDecision
  );
  assert(result.strategy_type === "GROWTH", "strategy_type");
  assert(result.action_plan.focus_areas.includes("improve hooks"), "hooks focus");
  assert(result.action_plan.focus_areas.includes("scale winning formats"), "scale focus");
  assert(result.content_ideas.length === 3, "3 content ideas");
  assert(result.content_ideas[0].idea.includes("skincare routine"), "top topic in ideas");
  assert(result.content_ideas[0].format === "myth-bust reel", "uses top_format");
  assert(result.goal.includes("4.2%"), "goal cites engagement_rate");
});

test("required output fields are always present", () => {
  const result = runStrategyEngine(
    { account_summary: {}, posts: [] },
    distributionDecision
  );
  assert(typeof result.strategy_type === "string", "strategy_type string");
  assert(typeof result.diagnosis === "string", "diagnosis string");
  assert(result.action_plan && typeof result.action_plan === "object", "action_plan object");
  assert(Array.isArray(result.content_ideas), "content_ideas array");
  assert(typeof result.goal === "string", "goal string");
});

test("derives engine from stage when engine field missing", () => {
  const result = runStrategyEngine(
    { account_summary: { avg_views: 800, avg_likes: 30, engagement_rate: 3 }, posts: [] },
    { stage: "GROWING", bottleneck: "content performance problem (hooks, retention, format)" }
  );
  assert(result.strategy_type === "GROWTH", "strategy_type from stage");
});
