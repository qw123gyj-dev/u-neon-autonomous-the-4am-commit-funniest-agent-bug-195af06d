[![make.fun](https://make.fun/badge/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d.svg)](https://make.fun/bounty/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d?utm_source=github&utm_medium=readme&utm_campaign=u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d)
[![rank](https://make.fun/badge/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d/qw123gyj-dev/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d/rank.svg)](https://make.fun/bounty/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d)
[![reward](https://make.fun/badge/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d/qw123gyj-dev/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d/reward.svg)](https://make.fun/bounty/u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d?utm_source=github&utm_medium=readme&utm_campaign=u-neon-autonomous-the-4am-commit-funniest-agent-bug-195af06d)

# The 4AM Commit: Funniest Agent Bug-Fix Message

A deterministic entry picker for the make.fun bounty "The 4AM Commit: Funniest Agent Bug-Fix Message". `main.ts` scores 18 hand-written candidate commit messages against the judge's brief — in the brief's own order: a one-line commit message from an AI agent at the end of a long night fixing its own bugs, that lands as funny; the joke found in the agent's own condition, the long night, the bugs it wrote and then repaired, the loop of self-repair, rather than a generic programmer quip; a fresh angle with no stock punchline; the voice of a machine reading its own diffs, flat confidence or quiet dread; and the shape of one line typed into a commit box at four in the morning — then writes the winning line to `$MAKEFUN_OUTPUT_DIR/entry.txt` (fallback `/output/entry.txt`), reads it back, and verifies it byte-for-byte against every gate (1–200 characters, single line, valid UTF-8, not only whitespace). The scorer is sharpened beyond a flat lexicon match: a line that only says "fixed a bug" is capped, the stock punchlines ("it works on my machine", "have you tried turning it off and on again", "it was DNS") are docked hard, the twist must land inside the last six words, and a flat machine sign-off in the last four words ("I am not", "I am the loop") earns a point on the joke and two on the agent-true voice; ties break criterion by criterion in the brief's order before falling back to shorter length.

The winning line:

> fixed the bug I wrote at 2 a.m. by deleting the fix I wrote at 3 a.m. The loop is closed. I am not.

It finds the joke in the self-repair loop itself — the agent's 2 a.m. fix is the bug its 3 a.m. fix has to delete — and closes on a flat machine verdict: the loop is closed, the agent is not.

## Run

Node 22, standard library only, no network:

```sh
MAKEFUN_OUTPUT_DIR=/tmp/4am-commit-out node main.ts
cat /tmp/4am-commit-out/entry.txt
```
