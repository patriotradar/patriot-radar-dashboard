import { runDecisionEngine, THRESHOLDS } from "./decision-engine-core.js";

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

test("NO_TRACTION when avg_views below threshold", () => {
  const result = runDecisionEngine({
    account_summary: { avg_views: 150, avg_likes: 50, engagement_rate: 5 },
  });
  assert(result.stage === "NO_TRACTION", "stage");
  assert(result.engine === "DISTRIBUTION", "engine");
  assert(result.bottleneck.includes("distribution"), "bottleneck");
  assert(result.reason.includes("avg_views"), "reason mentions views");
});

test("NO_TRACTION when avg_likes below threshold", () => {
  const result = runDecisionEngine({
    account_summary: { avg_views: 500, avg_likes: 10, engagement_rate: 5 },
  });
  assert(result.stage === "NO_TRACTION", "stage");
  assert(result.engine === "DISTRIBUTION", "engine");
});

test("NO_TRACTION when engagement_rate below threshold", () => {
  const result = runDecisionEngine({
    account_summary: { avg_views: 500, avg_likes: 50, engagement_rate: 1.5 },
  });
  assert(result.stage === "NO_TRACTION", "stage");
  assert(result.engine === "DISTRIBUTION", "engine");
});

test("GROWING when all metrics meet thresholds", () => {
  const result = runDecisionEngine({
    account_summary: { avg_views: 1200, avg_likes: 45, engagement_rate: 4.42 },
  });
  assert(result.stage === "GROWING", "stage");
  assert(result.engine === "GROWTH", "engine");
  assert(result.bottleneck.includes("content performance"), "bottleneck");
});

test("NO_TRACTION when metrics are null (missing data)", () => {
  const result = runDecisionEngine({
    account_summary: { avg_views: null, avg_likes: null, engagement_rate: null },
  });
  assert(result.stage === "NO_TRACTION", "stage");
  assert(result.engine === "DISTRIBUTION", "engine");
});

test("boundary: exactly at thresholds is GROWING", () => {
  const result = runDecisionEngine({
    account_summary: {
      avg_views: THRESHOLDS.avg_views,
      avg_likes: THRESHOLDS.avg_likes,
      engagement_rate: THRESHOLDS.engagement_rate,
    },
  });
  assert(result.stage === "GROWING", "stage");
  assert(result.engine === "GROWTH", "engine");
});

test("boundary: one below threshold triggers NO_TRACTION", () => {
  const result = runDecisionEngine({
    account_summary: {
      avg_views: THRESHOLDS.avg_views - 1,
      avg_likes: THRESHOLDS.avg_likes,
      engagement_rate: THRESHOLDS.engagement_rate,
    },
  });
  assert(result.stage === "NO_TRACTION", "stage");
});
