import { MetabolicType } from "../constants/colors";
import { TYPE_CONFIGS } from "../constants/types";
import { stressBand } from "../utils/stress";

// ---------- Types ----------

export type ScoreBand = "low" | "steady" | "strong";

export interface GreetingContext {
  // Core (from AppContext)
  metabolicType: MetabolicType;
  hasScan: boolean;
  dayNumber: number;
  userName?: string;

  // From profile API
  checkInCount: number;
  latestEnergy: string | null;
  latestStressTags: string[];
  latestSleepQuality: string | null;
  latestSleepHours: number | null;
  scanCount: number;
  latestScan: Record<string, any> | null;
  esterTier: string;
  compositeConfidence: number;

  // Recency timestamps (ISO strings)
  lastCheckInAt: string | null;
  lastScanAt: string | null;

  // Reset Score (today's value + delta from prior day, both null if unknown)
  score: number | null;
  scoreBand: ScoreBand | null;
  scoreDelta: number | null;

  // Derived
  daysSinceLastCheckIn: number | null;
  isGlanceOnly: boolean;
  lapseTier: 0 | 1 | 2 | 3 | 4;
  mealFeedbackCount: number;
}

/** Map a 0-100 reset score to a coarse tone band. */
export function scoreBand(score: number | null): ScoreBand | null {
  if (score === null) return null;
  if (score < 40) return "low";
  if (score >= 70) return "strong";
  return "steady";
}

/** True when today's score moved meaningfully (≥8 pts) versus prior day. */
function hasBigMove(delta: number | null): boolean {
  return delta !== null && Math.abs(delta) >= 8;
}

export interface GreetingResult {
  nameGreeting: string;
  message: string;
  embedAction?: "energy_checkin";
}

// ---------- Banned opener guard ----------

const BANNED_PREFIXES = [
  "Good morning",
  "Good afternoon",
  "Good evening",
  "Welcome back",
  "How are you today",
  "Let's have a great day",
];

/** Banned phrases that must never appear in any greeting (PRD 16.4). */
const BANNED_GREETING_PHRASES = [
  "great job",
  "good work",
  "good job",
  "cheat day",
  "bad food",
  "get back on track",
  "we missed you",
  "you've been away",
  "you've been gone",
  "low cal",
  "low-cal",
  "clean eating",
  "guilt-free",
  "goal weight",
  "target weight",
  "before and after",
  "bmi",
  "body mass index",
  "body fat %",
  "body fat percentage",
  "body shape index",
  "body roundness index",
  "waist-to-height ratio",
  "conicity index",
];

function validateNoBannedOpener(text: string): void {
  const lower = text.toLowerCase();
  for (const prefix of BANNED_PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) {
      console.warn(
        `[Greeting] Banned opener detected: "${text.slice(0, 30)}…"`,
      );
    }
  }
  for (const phrase of BANNED_GREETING_PHRASES) {
    if (lower.includes(phrase)) {
      console.warn(
        `[Greeting] Banned phrase detected: "${phrase}" in "${text.slice(0, 50)}…"`,
      );
    }
  }
}

// ---------- Deterministic daily index ----------

function dailyIndex(count: number): number {
  const today = new Date().toISOString().split("T")[0];
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = (hash * 31 + today.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % count;
}

// ---------- Lapse detection ----------

export function detectLapseTier(
  daysSinceLastCheckIn: number | null,
): 0 | 1 | 2 | 3 | 4 {
  if (daysSinceLastCheckIn === null) return 0;
  if (daysSinceLastCheckIn <= 1) return 0;
  if (daysSinceLastCheckIn <= 3) return 1;
  if (daysSinceLastCheckIn <= 7) return 2;
  if (daysSinceLastCheckIn <= 14) return 3;
  return 4;
}

export function computeDaysSinceLastCheckIn(
  checkInHistory: { date: string }[],
): number | null {
  if (checkInHistory.length === 0) return null;
  const latest = new Date(checkInHistory[0].date);
  const now = new Date();
  const diffMs = now.getTime() - latest.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// ---------- Confidence tier language ----------

const TIER_LANGUAGE: Record<string, { prefix: string; verb: string }> = {
  "Pattern Acknowledgment": {
    prefix: "It looks like",
    verb: "I notice",
  },
  Observation: {
    prefix: "Your",
    verb: "I see that",
  },
  Interpretation: {
    prefix: "Your",
    verb: "Because of",
  },
  Prediction: {
    prefix: "If this holds,",
    verb: "Based on your pattern,",
  },
};

// ---------- Scan metric helpers ----------

function scanVal(scan: Record<string, any> | null, key: string): string | null {
  if (!scan) return null;
  const val = scan[key];
  if (val === undefined || val === null) return null;
  if (typeof val === "number") return String(Math.round(val));
  return String(val);
}

// ---------- Lapse greetings ----------

function getLapseGreeting(ctx: GreetingContext): GreetingResult {
  const type = TYPE_CONFIGS[ctx.metabolicType];
  // Lapse greetings prioritize the time-gap framing — band only nudges the
  // last clause for tier-1 (short lapse) where there's still a usable score.
  // Tier 2-4 leans into "data is stale" which conflicts with making the
  // score the headline, so we leave those band-agnostic.

  const tier1WithBand: Record<ScoreBand, string[]> = {
    low: [
      `A couple days off — and today's read is on the low side. Your ${type.name.toLowerCase()} pattern wants softer fuel; meals are tuned for it.`,
      `Two days away. Today's score is low — recovery first, performance later.`,
    ],
    steady: [
      `Missed a couple days. Your ${type.name.toLowerCase()} pattern is still steady; today's plan picks up where we left off.`,
      `Two days off. You're back at a steady read — let's hold the line.`,
    ],
    strong: [
      `A couple days off — but today's read is strong. Your ${type.name.toLowerCase()} pattern came back ready.`,
      `Two days away, and you're back at a strong read. Today's plan rides that.`,
    ],
  };

  const messages: Record<1 | 2 | 3 | 4, string[]> = {
    1:
      ctx.scoreBand && ctx.score !== null
        ? tier1WithBand[ctx.scoreBand]
        : [
            `Missed a couple days. Your ${type.name.toLowerCase()} pattern doesn't reset that fast — picking up where we left off.`,
            `Two days off. Your rhythm is still there. Let's keep going.`,
          ],
    2: [
      `It's been about a week. Your pattern shifted a bit — one check-in brings me back up to speed.`,
      `A week away. Your body kept its rhythm — I just need to catch up.`,
    ],
    3: [
      `Two weeks since I last heard from you. I'm working from older data now — a check-in would sharpen things.`,
      `It's been a stretch. I still know your type, but your current state is fuzzy.`,
    ],
    4: [
      `It's been a while. I won't pretend to know your pattern. One check-in and I'll recalibrate.`,
      `Long time. Your data is stale — but one check-in is all I need to start fresh.`,
    ],
  };

  const tier = ctx.lapseTier as 1 | 2 | 3 | 4;
  const lines = messages[tier];
  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: lines[dailyIndex(lines.length)],
  };
}

// ---------- Glance-only greeting ----------

function getGlanceOnlyGreeting(ctx: GreetingContext): GreetingResult {
  const lines = [
    "Your lunches this week were built for your afternoon pattern. Did they help?",
    "I've been tuning your meals based on your type. A quick check-in tells me if it's working.",
    "Five days of meals, zero signals from you. One tap tells me a lot.",
  ];
  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: lines[dailyIndex(lines.length)],
    embedAction: "energy_checkin",
  };
}

// ---------- Scan day greetings ----------

function getScanDay1Greeting(ctx: GreetingContext): GreetingResult {
  const type = TYPE_CONFIGS[ctx.metabolicType];
  const stressIndex = scanVal(ctx.latestScan, "stressIndex");
  const heartRate = scanVal(ctx.latestScan, "heartRate");
  const wellness = scanVal(ctx.latestScan, "wellnessIndex");

  let message: string;
  if (stressIndex) {
    const band = stressBand(Number(stressIndex));
    message = `Your stress balance looks ${(band ?? "balanced").toLowerCase()}. That confirms what your quiz suggested — your body runs ${type.signals.stress === "high" ? "hot" : "steady"}.`;
  } else if (heartRate) {
    message = `Resting at ${heartRate} bpm. Combined with your quiz answers, I can see how your body manages fuel.`;
  } else if (wellness) {
    message = `Wellness score of ${wellness}. ${type.whyLineSeed}`;
  } else {
    message = `I've seen your scan. ${type.whyLineSeed} Let's start here.`;
  }

  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message,
  };
}

function getScanDay2Greeting(ctx: GreetingContext): GreetingResult {
  const parasympathetic = scanVal(ctx.latestScan, "parasympatheticActivity");
  const recoveryScore = scanVal(ctx.latestScan, "recoveryScore");

  let message: string;
  if (parasympathetic) {
    message = `Your recovery score was ${parasympathetic}. That's your body's bounce-back signal between meals.`;
  } else if (recoveryScore) {
    message = `Recovery at ${recoveryScore}. That tells me how fast your body resets after stress — and what to feed it next.`;
  } else {
    message = "Day 2. I'm watching how your body responds to yesterday's meals.";
  }

  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message,
  };
}

function getScanDay3Greeting(ctx: GreetingContext): GreetingResult {
  const heartRate = scanVal(ctx.latestScan, "heartRate");
  const bmr = scanVal(ctx.latestScan, "bmr");

  let message: string;
  if (heartRate) {
    message = `Resting at ${heartRate} bpm — that tells me how much fuel your body burns just existing.`;
  } else if (bmr) {
    message = `Your baseline burn is around ${bmr} cal. Three days in and I'm calibrating your meals to match.`;
  } else {
    message = "Three days of scan data. Your metabolic rhythm is getting clearer.";
  }

  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message,
  };
}

function getScanDay4to5Greeting(ctx: GreetingContext): GreetingResult {
  if (ctx.checkInCount > 0) {
    const cardiacWorkload = scanVal(ctx.latestScan, "cardiacWorkload");
    const energyRef = ctx.latestEnergy ? `${ctx.latestEnergy} energy` : "your feedback";

    let message: string;
    if (cardiacWorkload) {
      message = `Your cardiac load is ${cardiacWorkload}. Paired with yesterday's ${energyRef}, I'm seeing a pattern.`;
    } else {
      message = `Your scan data plus ${energyRef} from check-in — the picture is getting specific.`;
    }

    return {
      nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
      message,
    };
  }

  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message:
      "I haven't heard how you're feeling yet. That signal matters — tap the check-in below.",
    embedAction: "energy_checkin",
  };
}

function getScanDay6to7Greeting(ctx: GreetingContext): GreetingResult {
  const lines = [
    "There are deeper patterns in your scan I want to unpack for you. I need a bit more time.",
    "Almost a week of biometric data. The patterns are there — I'm building toward something specific.",
  ];
  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: lines[dailyIndex(lines.length)],
  };
}

function getScanDay8to14Greeting(ctx: GreetingContext): GreetingResult {
  const lines = [
    "A full week of data in. I'm building a bigger picture — your weekly review will pull it together.",
    "Your scan data is stacking up. There are patterns I want to walk you through soon.",
    "I've got enough signal now to go deeper. Stay tuned for your weekly review.",
  ];
  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: lines[dailyIndex(lines.length)],
  };
}

function getScanDay15PlusGreeting(ctx: GreetingContext): GreetingResult {
  const type = TYPE_CONFIGS[ctx.metabolicType];
  const typeName = type.name.toLowerCase();

  const byBand: Record<ScoreBand, string[]> = {
    low: [
      `Two weeks of data and today's read landed low. Your ${typeName} pattern has layers — Pro will open up the why.`,
      `Score is on the low side. The deeper markers in your scan would explain it — Pro goes there.`,
    ],
    steady: [
      `There are deeper markers in your scan I haven't unpacked yet. Your ${typeName} pattern has layers — Pro will open them up.`,
      "Two weeks of biometric data. The surface-level patterns are clear. The deeper ones are waiting.",
      `Your body's telling a more detailed story now. I've shared the headlines — the full read goes deeper.`,
    ],
    strong: [
      `Two weeks of data and today's read is strong. Your ${typeName} pattern is humming — Pro would tell you why.`,
      `Score reads strong. There's more to unpack about why — Pro opens the deeper layers.`,
    ],
  };

  const lines = ctx.scoreBand ? byBand[ctx.scoreBand] : byBand.steady;
  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: lines[dailyIndex(lines.length)],
  };
}

// ---------- Skip (no scan) greetings ----------

function getSkipDay1Greeting(ctx: GreetingContext): GreetingResult {
  const type = TYPE_CONFIGS[ctx.metabolicType];
  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: `Based on what you told me, I think I know what's happening. ${type.whyLineSeed}`,
  };
}

function getSkipDay2to4Greeting(ctx: GreetingContext): GreetingResult {
  const lines: Record<number, string[]> = {
    2: [
      "Day 2. I'm watching how your body responds to yesterday's meals.",
      "Back again. That's the pattern I need to see.",
    ],
    3: [
      "Three days in. I'm starting to see your rhythm.",
      "Day 3. Your pattern is getting clearer.",
    ],
    4: [
      "Day 4. Your body is settling into a rhythm I can work with.",
      "Four days. Enough to stop guessing, start knowing.",
    ],
  };

  const dayLines = lines[ctx.dayNumber] || lines[4];
  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: dayLines[dailyIndex(dayLines.length)],
  };
}

function getSkipDay5PlusGreeting(ctx: GreetingContext): GreetingResult {
  const type = TYPE_CONFIGS[ctx.metabolicType];
  const typeName = type.name.toLowerCase();

  const byBand: Record<ScoreBand, string[]> = {
    low: [
      `Today's read landed low. Your ${typeName} pattern wants softer fuel — meals are tuned for it.`,
      `Score is on the low side today. I've leaned today's plan toward recovery, not push.`,
    ],
    steady: [
      `Your ${typeName} pattern is holding steady today. The plan stays balanced.`,
      `Steady read today. I'm getting confident in your ${typeName} pattern — meals match.`,
    ],
    strong: [
      `Strong read today. Your ${typeName} pattern is working with you — today's plan rides that.`,
      `Today's score is strong. I've used the headroom — meals are dialed for a ${typeName} in a good window.`,
    ],
  };

  const lines = ctx.scoreBand
    ? byBand[ctx.scoreBand]
    : [
        `Your ${typeName} pattern is holding. Today's plan is dialed in.`,
        `I'm getting confident in your pattern. Today's meals are tuned for a ${typeName}.`,
      ];

  return {
    nameGreeting: ctx.userName ? `${ctx.userName}.` : "Hey.",
    message: lines[dailyIndex(lines.length)],
  };
}

// ---------- Recency helpers ----------

function isWithin24Hours(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return now - then < 24 * 60 * 60 * 1000;
}

/** True when the latest check-in contains something worth calling out. */
function hasNotableSignal(ctx: GreetingContext): boolean {
  if (ctx.latestSleepHours !== null && ctx.latestSleepHours < 6) return true;
  if (ctx.latestSleepQuality === "poor" || ctx.latestSleepQuality === "bad") return true;
  if (ctx.latestStressTags.length > 0) return true;
  if (ctx.latestEnergy === "low" || ctx.latestEnergy === "very_low") return true;
  if (ctx.latestEnergy === "high" || ctx.latestEnergy === "very_high") return true;
  return false;
}

// ---------- Recent-signal greetings (< 24 h) ----------

function getRecentCheckInGreeting(ctx: GreetingContext): GreetingResult {
  const type = TYPE_CONFIGS[ctx.metabolicType];
  const nameGreeting = ctx.userName ? `${ctx.userName}.` : "Hey.";
  const band = ctx.scoreBand;
  // A short clause that ties the surfaced signal back to today's score, only
  // appended when we have a band so the line stays clean for users without
  // a score yet.
  const bandTag: Record<ScoreBand, string> = {
    low: " Score is low today, so the plan leans into recovery.",
    steady: " You're at a steady read today — the plan stays balanced.",
    strong: " Score's still strong — the plan keeps the momentum.",
  };
  const tail = band ? bandTag[band] : "";

  // Sleep-based greetings
  if (ctx.latestSleepHours !== null && ctx.latestSleepHours < 6) {
    return {
      nameGreeting,
      message: `${ctx.latestSleepHours} hours of sleep. Today's meals lean heavier on protein to keep your energy steady.${tail}`,
    };
  }
  if (ctx.latestSleepQuality === "poor" || ctx.latestSleepQuality === "bad") {
    return {
      nameGreeting,
      message: `Rough night. I've weighted today's meals toward recovery — more magnesium, less sugar.${tail}`,
    };
  }

  // Stress-based greetings
  if (ctx.latestStressTags.length > 0) {
    const tag = ctx.latestStressTags[0];
    const stressMessages: Record<string, string> = {
      work: "Work stress showing up. Today's meals are anti-cortisol — protein-forward to keep you level.",
      sleep: "Sleep stress flagged. I've adjusted your meals to support recovery today.",
      family: "Family stress is real. Today's meals are comfort-forward without the crash.",
      health: "Health stress noted. I've tuned your meals to support your body, not add to the load.",
    };
    const baseMessage =
      stressMessages[tag] || "Today's meals are adjusted to help your body recover.";
    return {
      nameGreeting,
      message: `${baseMessage}${tail}`,
    };
  }

  // Energy-based greetings
  if (ctx.latestEnergy === "low" || ctx.latestEnergy === "very_low") {
    return {
      nameGreeting,
      message: `Low energy yesterday. I've front-loaded protein at breakfast and added slow carbs at lunch.${tail}`,
    };
  }
  if (ctx.latestEnergy === "high" || ctx.latestEnergy === "very_high") {
    return {
      nameGreeting,
      message: `Your energy was solid yesterday. Today's plan keeps that momentum — same balance, slight variety.${tail}`,
    };
  }

  // Moderate / generic recent check-in
  return {
    nameGreeting,
    message: `Your check-in is in. ${type.whyLineSeed}`,
  };
}

function getRecentScanGreeting(ctx: GreetingContext): GreetingResult {
  const nameGreeting = ctx.userName ? `${ctx.userName}.` : "Hey.";
  const scan = ctx.latestScan;
  const band = ctx.scoreBand;

  // Tail clause that ties the surfaced biometric to today's score band.
  const bandTag: Record<ScoreBand, string> = {
    low: " That landed your score on the lower side today.",
    steady: " That's holding your score steady today.",
    strong: " That's helping your score read strong today.",
  };
  const tail = band ? bandTag[band] : "";

  const stressIndex = scanVal(scan, "stressIndex");
  const heartRate = scanVal(scan, "heartRate");
  const recoveryScore = scanVal(scan, "recoveryScore");
  const wellness = scanVal(scan, "wellnessIndex");

  if (stressIndex) {
    const stressWord = stressBand(Number(stressIndex)) ?? "Balanced";
    return {
      nameGreeting,
      message: `Your stress balance looks ${stressWord.toLowerCase()}. Today's meals are calibrated to match.${tail}`,
    };
  }
  if (heartRate) {
    return {
      nameGreeting,
      message: `Resting at ${heartRate} bpm. Your meals today are tuned to that baseline.${tail}`,
    };
  }
  if (recoveryScore) {
    return {
      nameGreeting,
      message: `Recovery score: ${recoveryScore}. That shapes how I fuel you today.${tail}`,
    };
  }
  if (wellness) {
    return {
      nameGreeting,
      message: `Wellness at ${wellness}. I'm using that to dial in today's plan.${tail}`,
    };
  }

  return {
    nameGreeting,
    message: `Fresh scan in. I'm using your latest numbers to shape today's meals.${tail}`,
  };
}

// ---------- No recent data greeting (> 24 h) ----------

function getStaleDataGreeting(ctx: GreetingContext): GreetingResult {
  const nameGreeting = ctx.userName ? `${ctx.userName}.` : "Hey.";
  const type = TYPE_CONFIGS[ctx.metabolicType];

  // When we have a score from today's check-in but no recent scan, lead with
  // the score band so the greeting matches the visible number — but still
  // nudge toward a scan to refresh the trustworthy signal.
  if (ctx.score !== null && ctx.scoreBand) {
    const byBand: Record<ScoreBand, string> = {
      low: `Today's read landed low. Your ${type.name.toLowerCase()} pattern wants softer fuel — a quick scan would sharpen what I'm seeing.`,
      steady: `You're in a steady zone today. A quick scan would let me push past the surface — right now I'm leaning on what you told me.`,
      strong: `Today's read is strong. A scan would lock that in — without one I'm working from your check-in alone.`,
    };
    return {
      nameGreeting,
      message: byBand[ctx.scoreBand],
      embedAction: "energy_checkin",
    };
  }

  if (ctx.hasScan) {
    return {
      nameGreeting,
      message: "I'm working from older data. A quick scan or check-in sharpens your meals today.",
      embedAction: "energy_checkin",
    };
  }

  return {
    nameGreeting,
    message: "I haven't heard from you today. A quick check-in sharpens your meals.",
    embedAction: "energy_checkin",
  };
}

// ---------- Score-anchored greeting (Priority 4) ----------

/**
 * Triggered when today's score is interesting on its own — either a meaningful
 * day-over-day move (>= 8 pts) or an extreme band (low/strong). The score IS
 * the headline; we tie it to archetype and (when present) the underlying
 * check-in signal so it doesn't read as a number in a vacuum.
 */
function getScoreAnchoredGreeting(ctx: GreetingContext): GreetingResult {
  const nameGreeting = ctx.userName ? `${ctx.userName}.` : "Hey.";
  const type = TYPE_CONFIGS[ctx.metabolicType];
  const typeName = type.name.toLowerCase();
  const delta = ctx.scoreDelta;
  const band = ctx.scoreBand!;

  // Big delta path — direction matters more than band when the score moved.
  if (delta !== null && Math.abs(delta) >= 8) {
    if (delta > 0) {
      const lines: Record<ScoreBand, string[]> = {
        strong: [
          `Up ${delta} from yesterday — and a strong read. Today's plan keeps the momentum going.`,
          `Today's score climbed ${delta}. Whatever you did yesterday, your ${typeName} pattern liked it.`,
        ],
        steady: [
          `Score is up ${delta} from yesterday. Trending in the right direction — today's meals stay on the same track.`,
          `Up ${delta} since yesterday. Your ${typeName} pattern is responding — let's keep the signal stable.`,
        ],
        low: [
          `Score moved up ${delta} from yesterday — a real recovery, even if today's read is still on the lower side.`,
          `Up ${delta}. Even from a low base, that's the direction we want.`,
        ],
      };
      const variants = lines[band];
      return {
        nameGreeting,
        message: variants[dailyIndex(variants.length)],
      };
    }

    // delta < 0 (large drop)
    const drop = Math.abs(delta);
    const lines: Record<ScoreBand, string[]> = {
      low: [
        `Down ${drop} from yesterday. Today's plan leans into recovery — your ${typeName} pattern needs softer fuel.`,
        `That's a ${drop}-point drop. I've shifted today's meals toward steady carbs and protein, less load on your system.`,
      ],
      steady: [
        `Down ${drop} from yesterday. You're still in a workable zone — today's plan is built around steadying things out.`,
        `Score dipped ${drop}. Not alarming, but worth noting — today's meals lean toward calm energy over performance.`,
      ],
      strong: [
        `Down ${drop} from yesterday — but your read today is still strong. Just a softer day inside a good window.`,
        `Score eased ${drop} from yesterday. Still in a strong band; today's plan keeps the same shape.`,
      ],
    };
    const variants = lines[band];
    return {
      nameGreeting,
      message: variants[dailyIndex(variants.length)],
    };
  }

  // No big delta — extreme band path.
  if (band === "low") {
    const lines = [
      `Today's read landed low. Your ${typeName} pattern is asking for recovery — meals are tuned for it.`,
      `Score is low today. I've leaned today's plan toward softer carbs and protein — less load, more reset.`,
    ];
    return {
      nameGreeting,
      message: lines[dailyIndex(lines.length)],
    };
  }

  // band === "strong"
  const lines = [
    `Today's read is strong. Your ${typeName} pattern is working with you — today's plan keeps the rhythm.`,
    `Strong read today. I'm using that headroom — meals are dialed for performance, not just recovery.`,
  ];
  return {
    nameGreeting,
    message: lines[dailyIndex(lines.length)],
  };
}

// ---------- Main greeting router ----------

export function generateGreeting(ctx: GreetingContext): GreetingResult {
  let result: GreetingResult;

  const hasRecentCheckIn = isWithin24Hours(ctx.lastCheckInAt);
  const hasRecentScan = isWithin24Hours(ctx.lastScanAt);
  const hasAnyRecentData = hasRecentCheckIn || hasRecentScan;
  // Score is "interesting" when it moved meaningfully day-over-day or sits in
  // an extreme band. Steady scores with no big move fall through to the
  // existing branches (which become band-aware via tone-only modifiers).
  const scoreIsHeadline =
    ctx.score !== null &&
    ctx.scoreBand !== null &&
    (hasBigMove(ctx.scoreDelta) || ctx.scoreBand !== "steady");

  // Priority 1: Lapse
  if (ctx.lapseTier > 0) {
    result = getLapseGreeting(ctx);
  }
  // Priority 2: No recent data (> 24 h) — prompt to scan or check in
  else if (!hasAnyRecentData && ctx.dayNumber >= 2 && !ctx.isGlanceOnly) {
    result = getStaleDataGreeting(ctx);
  }
  // Priority 3: Recent check-in with a notable signal — surface it
  else if (hasRecentCheckIn && hasNotableSignal(ctx)) {
    result = getRecentCheckInGreeting(ctx);
  }
  // Priority 4: Score is the headline (big day-over-day move or extreme band)
  else if (scoreIsHeadline && hasAnyRecentData) {
    result = getScoreAnchoredGreeting(ctx);
  }
  // Priority 5: Recent scan — surface a metric
  else if (hasRecentScan && ctx.latestScan) {
    result = getRecentScanGreeting(ctx);
  }
  // Priority 6: Has scan — day-progression revelations
  // Scan-progression copy implies recent biometric data ("two weeks of data",
  // "deeper markers in your scan"). Gate on scan recency so a 30-day-old scan
  // doesn't trigger language that pretends it's fresh.
  else if (ctx.hasScan && hasRecentScan) {
    if (ctx.dayNumber <= 1) {
      result = getScanDay1Greeting(ctx);
    } else if (ctx.dayNumber === 2) {
      result = getScanDay2Greeting(ctx);
    } else if (ctx.dayNumber === 3) {
      result = getScanDay3Greeting(ctx);
    } else if (ctx.dayNumber <= 5) {
      result = getScanDay4to5Greeting(ctx);
    } else if (ctx.dayNumber <= 7) {
      result = getScanDay6to7Greeting(ctx);
    } else if (ctx.dayNumber <= 14) {
      result = getScanDay8to14Greeting(ctx);
    } else {
      result = getScanDay15PlusGreeting(ctx);
    }
  }
  // Priority 7: Glance-only (non-scan users with no engagement)
  else if (ctx.isGlanceOnly) {
    result = getGlanceOnlyGreeting(ctx);
  }
  // Priority 8: No scan (skip) — day-progression
  else {
    if (ctx.dayNumber <= 1) {
      result = getSkipDay1Greeting(ctx);
    } else if (ctx.dayNumber <= 4) {
      result = getSkipDay2to4Greeting(ctx);
    } else {
      result = getSkipDay5PlusGreeting(ctx);
    }
  }

  validateNoBannedOpener(result.nameGreeting);
  validateNoBannedOpener(result.message);

  return result;
}

// ---------- Fallback for pre-profile loading ----------

export function generateSimpleGreeting(ctx: {
  metabolicType: MetabolicType;
  hasScan: boolean;
  dayNumber: number;
  userName?: string;
}): GreetingResult {
  return generateGreeting({
    ...ctx,
    checkInCount: 0,
    latestEnergy: null,
    latestStressTags: [],
    latestSleepQuality: null,
    latestSleepHours: null,
    scanCount: 0,
    latestScan: null,
    esterTier: "Pattern Acknowledgment",
    compositeConfidence: 35,
    lastCheckInAt: null,
    lastScanAt: null,
    score: null,
    scoreBand: null,
    scoreDelta: null,
    daysSinceLastCheckIn: null,
    isGlanceOnly: false,
    lapseTier: 0,
    mealFeedbackCount: 0,
  });
}

// Calculate day number from account creation date
export function getDayNumber(createdAt?: string): number {
  if (!createdAt) return 1;
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}
