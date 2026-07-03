/**
 * Client-side Step 3.5 Virality Scoring Layer.
 */
(function (global) {
  var NICHE_RULES = {
  fitness: {
    label: "Fitness",
    match: /fitness|gym|workout|health|meal prep|exercise|training|nutrition/i,
    keywords: [
      "transformation",
      "mistake",
      "routine",
      "discipline",
      "workout",
      "meal prep",
      "gym",
      "before",
      "after",
      "progress",
    ],
    patterns: ["pov list", "transformation", "mistake", "routine", "discipline"],
    psychology: "transformation, mistakes, routines, discipline hooks",
  },
  finance: {
    label: "Finance",
    match: /finance|money|invest|crypto|budget|wealth|trading|saving/i,
    keywords: [
      "money",
      "mistake",
      "mindset",
      "rule",
      "budget",
      "invest",
      "debt",
      "save",
      "wealth",
      "habit",
    ],
    patterns: ["mistake", "mindset", "rule", "pov list", "carousel"],
    psychology: "money mistakes, mindset shifts, simple rules",
  },
  business: {
    label: "Business",
    match: /business|entrepreneur|marketing|startup|founder|saas|agency|sales/i,
    keywords: [
      "growth",
      "scale",
      "failure",
      "tactic",
      "mistake",
      "client",
      "revenue",
      "founder",
      "strategy",
      "lesson",
    ],
    patterns: ["growth", "failure", "scaling", "pov list", "carousel"],
    psychology: "growth tactics, failure points, scaling insights",
  },
  beauty: {
    label: "Beauty",
    match: /beauty|skincare|makeup|cosmetic|hair|glow|routine/i,
    keywords: [
      "routine",
      "comparison",
      "product",
      "value",
      "before",
      "after",
      "review",
      "myth",
      "tip",
      "skin",
    ],
    patterns: ["routine", "comparison", "carousel", "myth", "review"],
    psychology: "routines, comparisons, product/value insights",
  },
  lifestyle: {
    label: "Lifestyle",
    match: /lifestyle|wellness|travel|fashion|vlog|daily|life|mindful/i,
    keywords: [
      "relatable",
      "identity",
      "emotion",
      "pov",
      "habit",
      "day",
      "real",
      "honest",
      "struggle",
      "routine",
    ],
    patterns: ["pov list", "relatable", "emotional", "trend reply", "identity"],
    psychology: "relatability, identity, emotional hooks",
  },
};

  var HOOK_TRIGGERS = [
  { pattern: /pov:/i, points: 5, label: "POV curiosity hook" },
  { pattern: /nobody tells you|no one tells you|secret|hidden/i, points: 5, label: "curiosity gap" },
  { pattern: /mistake|wrong|fail|hot take|nobody/i, points: 4, label: "controversy or mistake framing" },
  { pattern: /rewrite|variation|test 3|opening line/i, points: 4, label: "hook-test framing" },
  { pattern: /things nobody|things no one/i, points: 5, label: "list curiosity hook" },
  { pattern: /"[^"]{8,}"/, points: 3, label: "quoted hook line" },
  { pattern: /\?/, points: 2, label: "question hook" },
];

  var SHARE_TRIGGERS = [
  { pattern: /pov|relatable|honest|real talk/i, points: 4 },
  { pattern: /mistake|hot take|nobody|wrong/i, points: 4 },
  { pattern: /trend reply|stitch|duet/i, points: 3 },
  { pattern: /transformation|before|after/i, points: 3 },
];

  var SAVE_TRIGGERS = [
  { pattern: /carousel|list|routine|tips|steps|guide/i, points: 4 },
  { pattern: /5 quick|3-slide|numbered|weekly/i, points: 3 },
  { pattern: /rewrite|variation|scale winner/i, points: 2 },
];

  function resolveNicheCategory(niche) {
  const text = (niche || "").trim();
  if (!text) return { key: "general", ...buildGeneralNiche() };
  for (const [key, rule] of Object.entries(NICHE_RULES)) {
    if (rule.match.test(text)) {
      return { key, label: rule.label, rule };
    }
  }
  return { key: "general", ...buildGeneralNiche() };
}

  function buildGeneralNiche() {
  return {
    label: "General",
    rule: {
      keywords: ["tip", "mistake", "routine", "pov", "how", "why"],
      patterns: ["pov list", "trend reply", "carousel", "list"],
      psychology: "clear hooks, simple formats, audience-relevant topics",
    },
  };
}

  function collectCandidates(step3Output) {
  const items = [];
  const ideas = Array.isArray(step3Output?.content_ideas) ? step3Output.content_ideas : [];

  ideas.forEach((item, index) => {
    if (item && typeof item.idea === "string" && item.idea.trim()) {
      items.push({
        idea: item.idea.trim(),
        format: item.format || "",
        focus: item.focus || "",
        _index: index,
        _source: "content_ideas",
      });
    }
  });

  const rec = step3Output?.recommended_post;
  if (typeof rec === "string" && rec.trim()) {
    items.push({
      idea: rec.trim(),
      format: "",
      focus: "",
      _index: ideas.length,
      _source: "recommended_post",
    });
  } else if (rec && typeof rec === "object" && typeof rec.idea === "string" && rec.idea.trim()) {
    items.push({
      idea: rec.idea.trim(),
      format: rec.format || "",
      focus: rec.focus || "",
      _index: ideas.length,
      _source: "recommended_post",
    });
  }

  return items;
}

  function scoreHookStrength(text) {
  let score = 0;
  const hits = [];
  for (const trigger of HOOK_TRIGGERS) {
    if (trigger.pattern.test(text)) {
      score += trigger.points;
      hits.push(trigger.label);
    }
  }
  if (/how |why |what /i.test(text)) score += 2;
  return { score: Math.min(20, score), hits };
}

  function scoreNicheRelevance(text, format, nicheInfo) {
  const keywords = nicheInfo.rule.keywords || [];
  let score = 0;
  const hits = [];
  for (const kw of keywords) {
    if (text.includes(kw)) {
      score += 3;
      hits.push(kw);
    }
  }
  const formatText = format.toLowerCase();
  for (const pattern of nicheInfo.rule.patterns || []) {
    if (text.includes(pattern) || formatText.includes(pattern)) {
      score += 2;
      hits.push(pattern);
    }
  }
  return { score: Math.min(20, score), hits };
}

  function scoreSimplicity(text, format) {
  let score = 8;
  const formatLower = format.toLowerCase();
  if (/pov list|trend reply|3-slide|carousel/i.test(formatLower + " " + text)) score += 5;
  if (/5 quick|3-slide|first line|first 3 seconds/i.test(text)) score += 4;
  if (text.length > 180) score -= 3;
  if (text.length > 260) score -= 3;
  return { score: Math.max(0, Math.min(15, score)), hits: [] };
}

  function scorePatternMatch(text, format, nicheInfo, strategyType) {
  let score = 0;
  const hits = [];
  const combined = `${text} ${format}`.toLowerCase();

  for (const pattern of nicheInfo.rule.patterns || []) {
    if (combined.includes(pattern)) {
      score += 4;
      hits.push(`niche pattern: ${pattern}`);
    }
  }

  if (strategyType === "DISTRIBUTION") {
    if (/trend reply|pov list|carousel|viral/i.test(combined)) {
      score += 6;
      hits.push("distribution viral format match");
    }
    if (/reach/i.test(text)) score += 2;
  }

  if (strategyType === "GROWTH") {
    if (/rewrite|retention|variation|scale winner|hook/i.test(combined)) {
      score += 6;
      hits.push("growth optimisation format match");
    }
  }

  return { score: Math.min(20, score), hits };
}

  function scoreShareability(text, nicheInfo) {
  let score = 4;
  const hits = [];
  for (const trigger of SHARE_TRIGGERS) {
    if (trigger.pattern.test(text)) {
      score += trigger.points;
      hits.push("share trigger");
    }
  }
  for (const kw of ["relatable", "identity", "emotion"]) {
    if (text.includes(kw) && nicheInfo.key === "lifestyle") {
      score += 3;
      hits.push("lifestyle share psychology");
    }
  }
  return { score: Math.min(15, score), hits };
}

  function scoreSavePotential(text, format) {
  let score = 2;
  const hits = [];
  const combined = `${text} ${format}`.toLowerCase();
  for (const trigger of SAVE_TRIGGERS) {
    if (trigger.pattern.test(combined)) {
      score += trigger.points;
      hits.push("save trigger");
    }
  }
  return { score: Math.min(10, score), hits };
}

  function scoreStep1Signals(ideaObj, step1Signals) {
  if (!step1Signals) return { score: 0, hits: [] };

  let score = 0;
  const hits = [];
  const text = ideaObj.idea.toLowerCase();
  const format = (ideaObj.format || "").toLowerCase();

  const topTheme = (step1Signals.top_theme || "").toLowerCase();
  const topFormat = (step1Signals.top_format || "").toLowerCase();
  const topics = Array.isArray(step1Signals.top_post_topics)
    ? step1Signals.top_post_topics
    : [];

  if (topTheme && text.includes(topTheme)) {
    score += 4;
    hits.push(`matches top theme "${step1Signals.top_theme}"`);
  }

  if (topFormat && (format.includes(topFormat) || text.includes(topFormat))) {
    score += 3;
    hits.push(`matches top format "${step1Signals.top_format}"`);
  }

  for (const topic of topics) {
    const t = (topic || "").toLowerCase();
    if (t && text.includes(t)) {
      score += 3;
      hits.push(`matches top post topic "${topic}"`);
      break;
    }
  }

  const engagementRate = step1Signals.account_summary?.engagement_rate;
  if (typeof engagementRate === "number" && engagementRate >= 3 && /retention|variation|scale/i.test(text)) {
    score += 2;
    hits.push("retention/scaling signal fits existing engagement");
  }

  return { score: Math.min(10, score), hits };
}

  function buildScoreReason(breakdown, viralScore) {
  const factors = [
    { name: "hook strength", value: breakdown.hook.score, hits: breakdown.hook.hits },
    { name: "niche relevance", value: breakdown.niche.score, hits: breakdown.niche.hits },
    { name: "simplicity", value: breakdown.simplicity.score, hits: breakdown.simplicity.hits },
    { name: "pattern match", value: breakdown.pattern.score, hits: breakdown.pattern.hits },
    { name: "shareability", value: breakdown.share.score, hits: breakdown.share.hits },
    { name: "save potential", value: breakdown.save.score, hits: breakdown.save.hits },
    { name: "Step 1 signal match", value: breakdown.signals.score, hits: breakdown.signals.hits },
  ]
    .filter((f) => f.value > 0)
    .sort((a, b) => b.value - a.value);

  const top = factors.slice(0, 2);
  const detail =
    top.length === 2
      ? `${top[0].name} (${top[0].value}/20+) and ${top[1].name} (${top[1].value})`
      : top.length === 1
        ? `${top[0].name} (${top[0].value})`
        : "baseline format scoring";

  const evidence = [...new Set(factors.flatMap((f) => f.hits))].slice(0, 3).join("; ");
  const evidencePart = evidence ? ` Key signals: ${evidence}.` : "";
  return `Viral score ${viralScore}/100 — led by ${detail}.${evidencePart}`;
}

  function scoreIdea(ideaObj, context) {
  const text = ideaObj.idea.toLowerCase();
  const format = ideaObj.format || "";

  const breakdown = {
    hook: scoreHookStrength(text),
    niche: scoreNicheRelevance(text, format, context.nicheInfo),
    simplicity: scoreSimplicity(text, format),
    pattern: scorePatternMatch(text, format, context.nicheInfo, context.strategyType),
    share: scoreShareability(text, context.nicheInfo),
    save: scoreSavePotential(text, format),
    signals: scoreStep1Signals(ideaObj, context.step1Signals),
  };

  const rawTotal =
    breakdown.hook.score +
    breakdown.niche.score +
    breakdown.simplicity.score +
    breakdown.pattern.score +
    breakdown.share.score +
    breakdown.save.score +
    breakdown.signals.score;

  const viralScore = Math.max(0, Math.min(100, Math.round(rawTotal)));

  return {
    idea: ideaObj.idea,
    viral_score: viralScore,
    reason: buildScoreReason(breakdown, viralScore),
    _index: ideaObj._index,
  };
}

  function buildNicheAlignmentCheck(pick, nicheInfo, strategyType) {
  const psychology = nicheInfo.rule.psychology || nicheInfo.psychology;
  return (
    `Viral pick aligns with ${nicheInfo.label} psychology (${psychology}) ` +
    `under ${strategyType} strategy — selected from Step 3 content_ideas only, not newly generated.`
  );
}

  function buildWhyThisWins(winner, ranked) {
  if (!winner) {
    return "No Step 3 content ideas were available to score.";
  }
  const margin =
    ranked.length > 1 ? ranked[0].viral_score - ranked[1].viral_score : ranked[0].viral_score;
  const marginText =
    ranked.length > 1
      ? ` Beat next-ranked idea by ${margin} point${margin === 1 ? "" : "s"}.`
      : " Only Step 3 candidate evaluated.";
  return `${winner.reason}${marginText}`;
}

/**
 * @param {object} step3Output - Step 3 strategy output
 * @param {string|null} niche - Account niche
 * @param {object|null} step1Signals - Step 1 account signals (engagement, top posts, patterns)
 * @returns {{ ranked_content: object[], viral_pick: string, why_this_wins: string, niche_alignment_check: string }}
 */
  function runViralityScoring(step3Output, niche = null, step1Signals = null) {
  const candidates = collectCandidates(step3Output);
  const nicheInfo = resolveNicheCategory(niche);
  const strategyType = step3Output?.strategy_type === "GROWTH" ? "GROWTH" : "DISTRIBUTION";

  const context = { nicheInfo, strategyType, step1Signals };

  const ranked = candidates
    .map((item) => scoreIdea(item, context))
    .sort((a, b) => {
      if (b.viral_score !== a.viral_score) return b.viral_score - a.viral_score;
      return a._index - b._index;
    })
    .map(({ idea, viral_score, reason }) => ({ idea, viral_score, reason }));

  const winner = ranked[0] || null;

  return {
    ranked_content: ranked,
    viral_pick: winner ? winner.idea : "",
    why_this_wins: buildWhyThisWins(winner, ranked),
    niche_alignment_check: buildNicheAlignmentCheck(winner, nicheInfo, strategyType),
  };
}

  global.runViralityScoring = runViralityScoring;
})(typeof window !== "undefined" ? window : globalThis);
