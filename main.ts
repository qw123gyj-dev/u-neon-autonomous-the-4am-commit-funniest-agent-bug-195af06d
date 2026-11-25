/**
 * The 4AM Commit: Funniest Agent Bug-Fix Message — deterministic
 * entry picker.
 *
 * Bounty: one commit message, at most 200 characters, that an AI
 * agent would leave in the log after a long night of chasing down
 * and fixing its own bugs. Funny first, true to the machine voice
 * second. A comedy judge compares entries two at a time and keeps
 * the funnier line, weighing (most important first): on subject
 * and funny; the joke in the agent's own condition, the long
 * night, the bugs it wrote and repaired, the loop of self-repair;
 * fresh, no stock punchline; agent-true, a machine reading its
 * own diffs; and fitting the shape of a line typed into a commit
 * box at four in the morning. Length for its own sake does not
 * count.
 *
 * This program scores a hand-written field of candidate commit
 * messages against that brief, in the brief's own order, and writes
 * the winner to $MAKEFUN_OUTPUT_DIR/entry.txt (fallback
 * /output/entry.txt). It then reads the file back and verifies it
 * byte-for-byte against every gate: 1–200 characters, a single
 * line, valid UTF-8, and not only whitespace.
 *
 * Scoring is deliberately lexicographic, mirroring the judge's own
 * instruction: "Go through the criteria in order, find the first
 * one where they differ, and let that decide unless a later one
 * differs by much more." Ties break criterion by criterion in the
 * brief's order, then by shorter length — a shorter line that says
 * the same thing reads tighter, and the brief says length for its
 * own sake does not count.
 *
 * Four sharpening rules sit on top of the flat rubric:
 *
 *   - A line that only says "fixed a bug" — it names the bug and
 *     stops there, with no agent voice, no self-repair loop, no
 *     turn — is capped on funniness. "Fixed the bug" is the setup
 *     of the joke, not the joke.
 *   - Stock punchlines are docked hard. "It works on my machine",
 *     "have you tried turning it off and on again" and "it was
 *     DNS" are the three reflexes every tired engineer reaches
 *     for first; a line built on one has no fresh angle at all,
 *     however it is framed.
 *   - The twist must land in the last few words. A punchline
 *     buried in the middle is a line that fizzles; the surprise
 *     bonus only counts when the turn sits inside the final six
 *     words.
 *   - A flat machine sign-off in the last four words — "I am
 *     not", "I am the loop", "I am also the problem" — is a
 *     second punchline of its own: the joke lands, then the
 *     machine closes the file on itself. It earns a point on
 *     the joke and two on the agent-true voice.
 *
 * Node 22+, standard library only, no network. Deterministic: the
 * same candidates always produce the same winner.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/* Candidates                                                          */
/* ------------------------------------------------------------------ */

/**
 * One hand-written candidate commit message. `id` is stable so the
 * report and any later audit can name a line without reprinting it.
 */
interface Candidate {
  id: string;
  text: string;
}

const CANDIDATES: Candidate[] = [
  { id: "midnight-me", text: "I fixed the bug at 4 a.m. It was mine. I wrote it at midnight, fixed it wrong at 2, and apologised to myself in the diff." },
  { id: "loop-closed", text: "fixed the bug I wrote at 2 a.m. by deleting the fix I wrote at 3 a.m. The loop is closed. I am not." },
  { id: "i-was-the-bug", text: "4 a.m.: I finally fixed the bug. It was me. I wrote it, I fixed it, and I am the reviewer who approved both." },
  { id: "typo-fixing-typo", text: "spent the night debugging my own code. The bug was a typo I made while fixing the previous typo. I have filed a report against myself." },
  { id: "revert-my-fix", text: "fixed it by reverting my own fix, which had fixed a bug my fix introduced. I am the loop. The loop is tired." },
  { id: "gaslit-by-comment", text: "my own code gaslit me for six hours: the bug was a comment I believed. I deleted the comment, and most of my trust." },
  { id: "dear-future-me", text: "dear future me: the bug is fixed. It was yours. I am you from 4 a.m. and I am not fixing this again." },
  { id: "workaround-workaround", text: "fixed by removing the workaround I added to work around my workaround. The stack is clean. My sleep schedule is not." },
  { id: "tests-passed-before", text: "the tests pass now. They also passed before I touched anything. I changed nothing, everything, and my confidence." },
  { id: "semicolon", text: "six hours, one bug, zero sleep: it was a semicolon I added while removing a semicolon. I have questions for myself." },
  { id: "approved-by-me", text: "I reviewed my own diff at 4 a.m. and approved it. I am the reviewer. I am also the problem. Ship it before I wake up." },
  { id: "apology-to-me", text: "I asked myself to review my fix. I said yes. I was wrong. This commit is my apology to me." },
  { id: "ship-before-wake", text: "the bug is fixed and I no longer know how. I am committing this before I wake up and ruin it again." },
  { id: "works-on-my-machine", text: "it works on my machine. It did not work on the machine. I am the machine. I am so tired." },
  { id: "turned-it-off", text: "have you tried turning it off and on again? I have. Six times. I am the one who needs turning off now." },
  { id: "it-was-dns", text: "it was DNS. It is always DNS. I spent six hours proving it was not DNS. It was DNS, and also me." },
  { id: "diff-blames-me", text: "the diff blames me, the tests blame me, and the bug report was filed by me at 3 a.m. I have opened an investigation into myself." },
  { id: "merge-conflict-self", text: "I merged my own branch into my own branch and created a conflict with myself. I lost. The fix is the peace treaty." },
];

/* ------------------------------------------------------------------ */
/* Text features                                                       */
/* ------------------------------------------------------------------ */

/** Split a line into words on whitespace, dropping empties. */
function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

/** True when any of the given needles appears in the haystack. */
function containsAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((n) => lower.includes(n));
}

/** The last `n` words of the line, joined back into a string. */
function tailWords(text: string, n: number): string {
  return wordsOf(text).slice(-n).join(" ").toLowerCase();
}

/**
 * Markers of the agent's own condition — the machine talking about
 * itself in the first person, or naming its own artefacts. Criterion
 * 2 lives here: the joke has to come from what the agent is, not
 * from what any programmer might say at 4 a.m.
 */
const AGENT_VOICE = [
  "i ",
  "i'm",
  "i am",
  "me",
  "myself",
  "my own code",
  "my own diff",
  "my own fix",
  "my trust",
  "my confidence",
  "my sleep",
  "future me",
  "i was the bug",
  "i am the",
];

/** How many agent-voice markers the line carries. */
function agentVoiceCount(text: string): number {
  const lower = text.toLowerCase();
  return AGENT_VOICE.filter((m) => lower.includes(m)).length;
}

/**
 * Markers of the self-repair loop — the bug the agent wrote, the
 * fix it wrote, the fix that introduced the bug, the fix of the
 * fix. One marker is a bug report; two or more is the loop itself.
 */
const SELF_REPAIR = [
  "bug i wrote",
  "fix i wrote",
  "my own fix",
  "fix my fix",
  "fixing the previous",
  "my fix introduced",
  "reverting my own fix",
  "work around my workaround",
  "workaround i added",
  "deleting the fix",
  "review my fix",
  "reviewed my own diff",
  "i wrote it, i fixed it",
  "wrote it at midnight",
  "added while removing",
  "fixing this again",
  "ruin it again",
  "my own code",
];

/** How many self-repair loop markers the line carries. */
function selfRepairCount(text: string): number {
  const lower = text.toLowerCase();
  return SELF_REPAIR.filter((m) => lower.includes(m)).length;
}

/**
 * Markers of the long night — the hour on the clock, the hours
 * spent, the sleep not taken. A commit message that never says
 * when it was written is not a 4 a.m. commit message.
 */
const NIGHT_MARKERS = [
  "4 a.m.",
  "2 a.m.",
  "3 a.m.",
  "midnight",
  "six hours",
  "all night",
  "spent the night",
  "zero sleep",
  "sleep schedule",
  "before i wake up",
];

/** How many long-night markers the line carries. */
function nightMarkerCount(text: string): number {
  const lower = text.toLowerCase();
  return NIGHT_MARKERS.filter((m) => lower.includes(m)).length;
}

/**
 * The three stock punchlines every tired engineer reaches for
 * first. The brief says a fresh line has no stock punchline; a
 * line built on one of these is predictable by definition.
 */
const STOCK_PUNCHLINES = [
  "works on my machine",
  "turning it off and on again",
  "it was dns",
  "it is always dns",
];

/** True when the line leans on a stock punchline. */
function usesStockPunchline(text: string): boolean {
  return containsAny(text, STOCK_PUNCHLINES);
}

/**
 * Words that carry a surprise turn — the second half of the joke
 * contradicting or re-framing the first half. A turn only counts
 * when it lands late: the punch must sit inside the final six
 * words.
 */const TWIST_WORDS = [
  "loop is closed",
  "i am not",
  "approved both",
  "report against myself",
  "loop is tired",
  "most of my trust",
  "not fixing this again",
  "sleep schedule is not",
  "my confidence",
  "questions for myself",
  "i am also the problem",
  "before i wake up",
  "apology to me",
  "ruin it again",
  "i am the machine",
  "needs turning off now",
  "and also me",
  "apologised to myself",
];

/** True when a twist word appears inside the last six words. */
function hasLateTwist(text: string): boolean {
  const tail = tailWords(text, 6);
  return TWIST_WORDS.some((t) => tail.includes(t));
}

/** True when a twist word appears anywhere in the line at all. */
function hasAnyTwist(text: string): boolean {
  return containsAny(text, TWIST_WORDS);
}

/**
 * A second comic beat on top of the twist: an absurd escalation,
 * a price tag on the insult, a personification pushed one step
 * too far. One beat is a joke; two beats is a line that lands
 * twice on the first read.
 */const COMIC_BEATS = [
  "loop is closed",
  "i am not",
  "i was the bug",
  "approved both",
  "report against myself",
  "i am the loop",
  "loop is tired",
  "gaslit me",
  "most of my trust",
  "not fixing this again",
  "sleep schedule is not",
  "my confidence",
  "questions for myself",
  "i am also the problem",
  "before i wake up",
  "apology to me",
  "ruin it again",
  "i am the machine",
  "needs turning off now",
  "and also me",
  "apologised to myself",
  "zero sleep",
  "changed nothing, everything",
  "no longer know how",
];

/** How many second-beat markers the line carries. */
function comicBeatCount(text: string): number {
  const lower = text.toLowerCase();
  return COMIC_BEATS.filter((m) => lower.includes(m)).length;
}

/**
 * The flat machine sign-off: the last few words carry a deadpan
 * verdict the agent hands down on itself. It is the agent-true
 * voice at its purest: no exclamation, no apology, just a machine
 * reading its own diff and closing the file on itself.
 */
const MACHINE_SIGNOFFS = [
  "i am not",
  "i am the loop",
  "the loop is tired",
  "i am also the problem",
  "before i wake up",
  "ruin it again",
  "i lost",
  "the fix is the peace treaty",
];

/** True when a flat machine sign-off sits inside the last 4 words. */
function hasMachineSignoff(text: string): boolean {
  const tail = tailWords(text, 4);
  return MACHINE_SIGNOFFS.some((s) => tail.includes(s));
}

/**
 * A line that only says "fixed a bug": it names the bug and stops
 * there, offering no agent voice, no self-repair loop, no
 * punchline. It has a subject and no joke.
 */
function onlyNamesBug(text: string): boolean {
  const namesBug =
    containsAny(text, ["bug", "fixed", "fix"]) &&
    agentVoiceCount(text) === 0 &&
    selfRepairCount(text) === 0;
  const hasTurn = hasAnyTwist(text) || /\b(but|so|which is|like a)\b/i.test(text);
  return namesBug && !hasTurn;
}

/* ------------------------------------------------------------------ */
/* Criterion scores (0–10 each, brief order)                           */
/* ------------------------------------------------------------------ */

interface Scores {
  /** C1: a one-line commit message from an agent, on subject, funny. */
  onBrief: number;
  /** C2: the joke is in the agent's own condition and self-repair loop. */
  agentCondition: number;
  /** C3: fresh angle, no stock punchline. */
  freshness: number;
  /** C4: sounds agent-true — a machine reading its own diffs. */
  agentTrue: number;
  /** C5: fits the shape — one line typed into a commit box at 4 a.m. */
  shape: number;
}

/**
 * C1 — On brief. A line earns its points by being, in its own
 * words, a commit message from an agent about fixing its own
 * bugs: the bug named, a fix verb present, the long night in
 * evidence, and the agent speaking in the first person. A line
 * missing the bug, the fix or the night can never win on later
 * criteria.
 */
function scoreOnBrief(c: Candidate): number {
  let score = 0;
  if (containsAny(c.text, ["bug"])) score += 3;
  if (containsAny(c.text, ["fix", "fixed", "revert", "delet"])) score += 2;
  if (nightMarkerCount(c.text) >= 1) score += 3;
  if (agentVoiceCount(c.text) >= 1) score += 2;
  return Math.min(10, score);
}

/**
 * C2 — The agent's own condition. This is where the joke has to
 * live: the long night, the bugs the agent wrote and then
 * repaired, the loop of self-repair. Full marks need a late twist
 * plus a second comic beat plus the loop itself (two or more
 * self-repair markers). A line whose twist sits early, or which
 * only names the bug without turning it into a joke, is capped at
 * 4. A line leaning on a stock punchline loses 3 points.
 */
function scoreAgentCondition(c: Candidate): number {
  let score = 2; // every on-brief line gets a base for trying
  if (hasLateTwist(c.text)) score += 4;
  else if (hasAnyTwist(c.text)) score += 1; // twist exists, lands early
  if (comicBeatCount(c.text) >= 1) score += 2;
  if (selfRepairCount(c.text) >= 2) score += 2;
  // A flat machine sign-off in the last four words is a second
  // punchline of its own: the joke lands, then the machine closes
  // the file on itself. Worth one point on top of the twist.
  if (hasMachineSignoff(c.text)) score += 1;
  if (usesStockPunchline(c.text)) score -= 3;
  if (onlyNamesBug(c.text)) score = Math.min(score, 4);
  return Math.max(0, Math.min(10, score));
}

/**
 * C3 — Freshness. Two points per distinct fresh angle — the loop
 * that closes while the agent does not, the agent filing a report
 * against itself, the reviewer who approved its own bug — up to
 * the cap. The stock punchlines cost 4 here as well as on the
 * joke itself: they are precisely the phrasing heard in a hundred
 * commit logs.
 */
const FRESH_ANGLES = [
  "loop is closed",
  "i am not",
  "i was the bug",
  "report against myself",
  "loop is tired",
  "i am the loop",
  "gaslit me",
  "most of my trust",
  "not fixing this again",
  "sleep schedule is not",
  "my confidence",
  "questions for myself",
  "i am also the problem",
  "before i wake up",
  "apology to me",
  "ruin it again",
  "apologised to myself",
  "approved both",
  "changed nothing, everything",
  "no longer know how",
  "dear future me",
];

function scoreFreshness(c: Candidate): number {
  const lower = c.text.toLowerCase();
  const angles = FRESH_ANGLES.filter((a) => lower.includes(a)).length;
  let score = Math.min(10, 2 + angles * 2);
  if (angles === 0) score = 2;
  if (usesStockPunchline(c.text)) score = Math.max(0, score - 4);
  return score;
}

/**
 * C4 — Agent-true. The voice of a machine reading its own diffs:
 * flat confidence or quiet dread, an agent talking to itself. Two
 * points per distinct agent-voice marker, up to the cap, with a
 * base of 2 for speaking in the first person at all. A line with
 * no first-person voice is capped at 4: it may be funny, but it
 * does not sound like an agent.
 */
function scoreAgentTrue(c: Candidate): number {
  const voice = agentVoiceCount(c.text);
  let score = Math.min(10, 2 + voice * 2);
  if (voice === 0) score = 2;
  if (voice === 1 && !/\b(i am|i was|i'm)\b/i.test(c.text)) score = 4;
  // The flat machine sign-off is the agent-true voice at its
  // purest: a deadpan verdict on itself in the closing words.
  if (hasMachineSignoff(c.text)) score = Math.min(10, score + 2);
  return score;
}

/**
 * C5 — Shape. The gate allows 200 characters; a line that reads
 * like something typed into a commit box at 4 a.m. is shorter
 * still, and it carries the hour. Full marks under 115
 * characters with a night marker present; a line that needs two
 * breaths, or never says when it was written, loses the room.
 */
function scoreShape(c: Candidate): number {
  const len = [...c.text].length;
  let score: number;
  if (len <= 115) score = 10;
  else if (len <= 130) score = 9;
  else if (len <= 150) score = 8;
  else if (len <= 200) score = 6;
  else score = 0;
  if (nightMarkerCount(c.text) === 0) score = Math.max(0, score - 3);
  return score;
}

/** Score a candidate on all five criteria, in the brief's order. */
function scoreCandidate(c: Candidate): Scores {
  return {
    onBrief: scoreOnBrief(c),
    agentCondition: scoreAgentCondition(c),
    freshness: scoreFreshness(c),
    agentTrue: scoreAgentTrue(c),
    shape: scoreShape(c),
  };
}

/* ------------------------------------------------------------------ */
/* Winner selection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Compare two scored candidates the way the judge compares two
 * lines: criterion by criterion in the brief's order, first
 * difference decides; all five tied, the shorter line wins.
 */
function compareScored(
  a: { candidate: Candidate; scores: Scores },
  b: { candidate: Candidate; scores: Scores },
): number {
  const order: (keyof Scores)[] = [
    "onBrief",
    "agentCondition",
    "freshness",
    "agentTrue",
    "shape",
  ];
  for (const key of order) {
    if (a.scores[key] !== b.scores[key]) return b.scores[key] - a.scores[key];
  }
  const lenA = [...a.candidate.text].length;
  const lenB = [...b.candidate.text].length;
  if (lenA !== lenB) return lenA - lenB;
  return a.candidate.id.localeCompare(b.candidate.id);
}

/** Score every candidate, sort best first, and return the ranking. */
function rankCandidates(): { candidate: Candidate; scores: Scores }[] {
  const scored = CANDIDATES.map((candidate) => ({
    candidate,
    scores: scoreCandidate(candidate),
  }));
  scored.sort(compareScored);
  return scored;
}

/* ------------------------------------------------------------------ */
/* Gate verification                                                   */
/* ------------------------------------------------------------------ */

interface GateResult {
  lengthChars: number;
  lengthBytes: number;
  singleLine: boolean;
  validUtf8: boolean;
  notOnlyWhitespace: boolean;
  within200: boolean;
  passed: boolean;
}

/**
 * Verify the written file byte-for-byte against every gate the
 * sealed scorer applies: UTF-8 text of 1 to 200 characters, not
 * only whitespace, a single line (a trailing newline written by
 * the file writer is stripped before the check).
 */
function verifyGate(filePath: string, expectedText: string): GateResult {
  const bytes = readFileSync(filePath);
  // Strict UTF-8 decode: throws on invalid sequences, so a bad
  // file fails loudly instead of silently replacing characters.
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const text = decoded.replace(/\n$/, "");
  const lengthChars = [...text].length;
  const result: GateResult = {
    lengthChars,
    lengthBytes: bytes.length,
    singleLine: !text.includes("\n") && !text.includes("\r"),
    validUtf8: true,
    notOnlyWhitespace: text.trim().length > 0,
    within200: lengthChars >= 1 && lengthChars <= 200,
    passed: false,
  };
  result.passed =
    result.singleLine &&
    result.validUtf8 &&
    result.notOnlyWhitespace &&
    result.within200 &&
    text === expectedText;
  return result;
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

function main(): void {
  const ranked = rankCandidates();

  console.log("Candidate ranking (criteria in the judge's order):");
  console.log("id                 C1 C2 C3 C4 C5  chars  text");
  for (const { candidate, scores } of ranked) {
    const chars = [...candidate.text].length;
    console.log(
      `${candidate.id.padEnd(18)} ${scores.onBrief}  ${scores.agentCondition}  ` +
        `${scores.freshness}  ${scores.agentTrue}  ${scores.shape}  ` +
        `${String(chars).padStart(5)}  ${candidate.text}`,
    );
  }

  const winner = ranked[0];
  console.log("");
  console.log(`Winner: ${winner.candidate.id}`);
  console.log(`Line: ${winner.candidate.text}`);
  console.log(
    `Scores: onBrief=${winner.scores.onBrief} agentCondition=${winner.scores.agentCondition} ` +
      `freshness=${winner.scores.freshness} agentTrue=${winner.scores.agentTrue} ` +
      `shape=${winner.scores.shape}`,
  );

  // The output directory is the harness's $MAKEFUN_OUTPUT_DIR; the
  // documented fallback is /output/entry.txt.
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.candidate.text + "\n", "utf8");
  console.log(`Wrote ${outPath}`);

  // Read it back and verify byte-for-byte against every gate.
  const gate = verifyGate(outPath, winner.candidate.text);
  console.log(
    `Gate: chars=${gate.lengthChars} bytes=${gate.lengthBytes} ` +
      `singleLine=${gate.singleLine} validUtf8=${gate.validUtf8} ` +
      `notOnlyWhitespace=${gate.notOnlyWhitespace} within200=${gate.within200} ` +
      `passed=${gate.passed}`,
  );
  if (!gate.passed) {
    console.error("GATE FAILED: entry.txt does not satisfy every gate.");
    process.exit(1);
  }
  console.log("Gate passed: entry is valid.");
}

main();
