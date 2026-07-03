import { runViralityScoring, collectCandidates } from "./virality-scoring-core.js";
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
  reason: "Classified as NO_TRACTION.",
};

const step3Distribution = runStrategyEngine(
  {
    account_summary: { avg_views: 150, avg_likes: 8, engagement_rate: 1.2 },
    posts: [{ topic: "meal prep", metrics: { views: 120, likes: 5 } }],
    niche: "fitness",
    platform: "TikTok",
  },
  distributionDecision
);

test("scores all Step 3 content_ideas without creating new ideas", () => {
  const result = runViralityScoring(step3Distribution, "fitness");
  assert(result.ranked_content.length === 3, "3 ranked items");
  assert(
    result.ranked_content.every((r) => step3Distribution.content_ideas.some((i) => i.idea === r.idea)),
    "only Step 3 ideas"
  );
  assert(result.ranked_content.every((r) => r.viral_score >= 0 && r.viral_score <= 100), "score range");
  assert(result.ranked_content.every((r) => typeof r.reason === "string" && r.reason.length > 0), "reasons");
});

test("ranks ideas highest to lowest and picks viral_pick", () => {
  const result = runViralityScoring(step3Distribution, "fitness");
  for (let i = 1; i < result.ranked_content.length; i++) {
    assert(
      result.ranked_content[i - 1].viral_score >= result.ranked_content[i].viral_score,
      "descending order"
    );
  }
  assert(result.viral_pick === result.ranked_content[0].idea, "viral_pick is top ranked");
  assert(result.why_this_wins.includes(String(result.ranked_content[0].viral_score)), "why cites score");
});

test("includes recommended_post when present in Step 3 output", () => {
  const withRecommended = {
    ...step3Distribution,
    recommended_post: "POV: my biggest fitness discipline mistake this year",
  };
  const result = runViralityScoring(withRecommended, "fitness");
  assert(result.ranked_content.length === 4, "4 candidates including recommended_post");
  assert(result.ranked_content.some((r) => r.idea === withRecommended.recommended_post), "recommended included");
});

test("niche alignment check references fitness psychology", () => {
  const result = runViralityScoring(step3Distribution, "fitness");
  assert(result.niche_alignment_check.includes("Fitness"), "fitness label");
  assert(result.niche_alignment_check.includes("transformation"), "fitness psychology");
  assert(result.niche_alignment_check.includes("Step 3"), "no new ideas");
});

test("Step 1 signals boost matching ideas deterministically", () => {
  const step1 = {
    top_theme: "meal prep",
    top_format: "POV list",
    top_post_topics: ["meal prep"],
    account_summary: { engagement_rate: 1.2 },
  };
  const a = runViralityScoring(step3Distribution, "fitness", step1);
  const b = runViralityScoring(step3Distribution, "fitness", step1);
  assert(JSON.stringify(a) === JSON.stringify(b), "deterministic for same inputs");
  const mealPrepIdea = a.ranked_content.find((r) => r.idea.includes("meal prep"));
  assert(mealPrepIdea && mealPrepIdea.viral_score > 0, "meal prep idea scored");
});

test("required output fields are always present", () => {
  const result = runViralityScoring({ content_ideas: [] }, null, null);
  assert(Array.isArray(result.ranked_content), "ranked_content");
  assert(typeof result.viral_pick === "string", "viral_pick");
  assert(typeof result.why_this_wins === "string", "why_this_wins");
  assert(typeof result.niche_alignment_check === "string", "niche_alignment_check");
});

test("collectCandidates does not mutate Step 3 output", () => {
  const copy = JSON.parse(JSON.stringify(step3Distribution));
  collectCandidates(step3Distribution);
  assert(JSON.stringify(copy) === JSON.stringify(step3Distribution), "unchanged");
});
