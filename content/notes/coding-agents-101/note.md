---
title: Notes on working with coding agents
date: 2026-06-01
display_date: Jun 1, 2026
status: draft
summary: Tool-agnostic principles for working with coding agents, including context economy, model-task fit, verification, and autonomy.
slug: coding-agents-101
author: Sundeep Yedida
author_url: mailto:sundeep.yedida@stitchfix.com
---

Over the past year, coding agents have changed how I work. My throughput
is higher and [the quality is better](https://xkcd.com/285/). These are
some general notes on what seems to help, not specific to a particular
coding agent.

## Before the notes

### Good software still comes first

Code still needs to be easy to read and maintain. [Kernighan's
Law](https://www.laws-of-software.com/laws/kernighan/) holds even more
true when an agent writes the code and a human has to
([inevitably](https://simonwillison.net/2025/Feb/3/a-computer-can-never-be-held-accountable/))
debug it.

### Agents are means, not ends

The goal is still to deliver value and ship the thing. [AI tools are
force multipliers](#). They can also get [very
expensive](https://simonwillison.net/2026/Jun/3/uber-caps-usage/) very
[quick](https://digg.com/tech/2pxk2bay), and it's in our best
[interest](https://www.newyorker.com/cartoon/a16995) to be as efficient
as possible with these tools.

### These tools have a lot of moving parts

Coding agents come with features like compaction, rewinding, subagents,
plan modes, and durable context files. It is not obvious when to use
which. "[Loops](https://addyosmani.com/blog/loop-engineering/)" are a
thing now … and Fable [came and
went](https://en.wikipedia.org/wiki/Comet_Hale%E2%80%93Bopp), and might
never be back again.

### The economics are not yet clear

We don't yet have a clear formula on how to calculate RoI. But all
things being equal, fewer tokens are better than more.

## A few definitions

### Coding agent

A program that uses a language model to write, edit, and run code on
your behalf. Claude Code, Cursor, and Codex are examples.

### Session

A single conversation with the agent. Everything said and done in a
session is visible to the agent until the session ends or the context
window fills up. Sessions can be branched, rewound, compacted, and
cleared.

### Context (and context window)

Everything the agent can see when it generates its next response,
including the conversation, files read, and tool outputs. It has a fixed
size, depending on the coding agent and/or model. *Almost everything
here is in service of optimizing this context window*.

### Tools

Things the agent can do besides generating text, e.g., reading files,
running commands, or searching the web. These are mainly what make an
LLM "agentic" … being able to *do* things in service of a goal.

## 1. Shaping the work

### Plan before code

Every major coding agent has a "plan mode" built in. When competing
tools all build the same feature without coordinating, it tells you
something about what the work needs. Separating research from writing
code keeps the agent from solving the wrong problem at full speed.

The pattern is to research the codebase first, build a plan, get
alignment on the plan, and then write the code.

#### Flip the interview

A useful variation is to flip the interview. Instead of writing a
detailed spec up front, hand the agent a rough idea and have it ask
questions. It will surface edge cases and constraints that had not come
up yet. The result is a sharper spec than most devs would write on their
own. That spec can then be run in a fresh session with clean context.

#### When to skip the plan

Not every task needs a plan. If a change can be described in one
sentence, e.g., fix a typo or rename a variable, planning adds overhead
with no benefit. Planning is worth it when the scope is not clear, when
the change touches many files, or when the codebase is unfamiliar.

### Model-task fit

Different models have different cost and capability profiles. The right
choice depends on the task, not the project. A complex architectural
refactor and a mechanical find-and-replace across fifty files need very
different levels of intelligence. Using the most powerful model for both
means paying extra for work that does not need it.

#### Decompose first

This principle has a prerequisite that is easy to skip past. The work
needs to be broken into tasks first. Choosing a model is a per-task
decision, not a per-project one. A dev who thinks "I am working on the
auth migration" is working at the wrong level to make this choice. A dev
who breaks that into "explore the current session handling," "plan the
OAuth flow," "write the token refresh," and "write integration tests"
can match each piece to the right model.

The cost and capability picture is changing fast. As pricing moves to
usage-based models and as open-weights models close the gap on certain
tasks, getting this choice right pays off more.

## 2. Managing the session

### Context economy

The context window is everything the model can see when it generates its
next response. It includes the system prompt, the conversation so far,
every tool call and its output, and every file that has been read. It is
a fixed-size resource. The model's performance gets worse as it fills
up, an effect sometimes called context rot. As the window fills, the
model's attention spreads across more tokens, and older content starts
to pull attention away from the current task.

#### The options at every turn

Every turn in a session is a decision point. The obvious move is to keep
going and send another message in the same thread. But other options
exist for good reasons. You can rewind to a previous point and re-prompt
with new information. You can clear the session and start fresh. You can
compact the history into a summary. Or you can spin off a subagent with
its own clean context that only sends back its conclusions.

#### When to use subagents

The test for when to use a subagent is simple. Will the intermediate
output be needed again, or just the conclusion? Investigation, code
review, and documentation are tasks where only the final result is
needed. A subagent handles those in a separate context window and keeps
the parent session clean.

What the agent sees determines how well it performs. A small, relevant
context window produces better results than a large, cluttered one.

### Restart over wrestle

This one goes against instinct. After spending twenty minutes in a
session, correcting the agent twice, watching it go sideways, the
natural move is to keep correcting. Every tool vendor's documentation
says the opposite. A clean session with a better prompt almost always
produces better results than a long session full of failed attempts. If
the agent has been corrected twice on the same issue, the context is
full of wrong approaches. The agent's earlier mistakes are in the
context and affect its next response.

The practical move is to write down what was learned. Which approach
failed and why. Which files are relevant. What constraints came up. Then
start a fresh session with that knowledge in the opening prompt.
Starting over is cheap. Continuing in a broken session is expensive in
both time and output quality.

## 3. Closing the loop

### Give the agent a way to verify its work

Without a check the agent can run on its own, "looks done" is its only
signal. The dev becomes the verification loop, and every mistake waits
for a human to notice it. Give the agent something that returns a pass
or fail, e.g., a test suite, a build exit code, or a linter. The agent
does the work, runs the check, reads the result, and keeps going until
the check passes.

This is what makes it safe to give the agent more freedom. Giving the
agent full freedom without a verifier produces confidently wrong output.
Giving the agent full freedom with a verifier produces an agent that
corrects itself. Writing good tests and keeping a fast, reliable build
has always paid off. With agents, the return on that investment roughly
doubles because both humans and agents use the signal.

Each tool has its own way of setting up verification. Claude Code has
"/goal" conditions and stop hooks. Cursor has its hook system. Codex has
test-first loops. The principle is the same across all of them.

### Use deterministic guardrails, not instructions

Instructions in a prompt are suggestions. The agent will usually follow
them and sometimes will not. The failure mode is silent. Nobody gets an
error when a style rule is ignored. Linters, type checkers, hooks, and
permission scopes are deterministic. They run every time, and they fail
loudly.

The general idea is to put constraints in tools rather than in words.
Strict linting and formatting rules force consistency regardless of
which model or tool wrote the code. A hook that runs eslint after every
file edit catches what a CLAUDE.md instruction to "follow our style
guide" might miss.

This is not an argument against instructions in prompts. They are useful
for guidance that is hard to put into a tool. It is an argument for
preferring the tool when one exists. Constraints that you build into
tools work across the team and survive across sessions. They do not get
worse as the context window fills up.

## 4. The cross-session investment

### Durable context

Every major agent tool has landed on the same pattern. There is a
markdown file that the agent reads at the start of every session. It
contains persistent instructions about the project. Claude Code calls it
CLAUDE.md. Cursor uses .cursor/rules/. Codex has AGENTS.md. The name is
different. The function is the same.

This file becomes more useful over time as the team adds to it. A
well-maintained project file means every new session starts with the
right constraints, the right commands, and pointers to the patterns the
team uses. The agent cannot figure this out from the code alone.

#### Keeping it useful

The advice on how to maintain this file is the same across every tool's
documentation. Keep it short. For each line, ask whether removing it
would cause the agent to make mistakes. If not, cut it. Treat it like
code that gets reviewed and pruned. Check it into version control so the
team benefits. A short file with clear instructions works better than a
long one. A long file causes the agent to ignore the instructions in it.

There is a larger topic here about company-level knowledge bases and
shared context. That is a discussion for a future post.

## 5. The allocation decision

### The autonomy spectrum

Every interaction with a coding agent sits somewhere on a range. At one
end: "implement this method with the following signature." At the other:
"here is the goal, here are the acceptance criteria, go."

Tight control keeps the dev involved in every decision. This limits
throughput and removes most of the agent's value. Full autonomy
maximizes throughput but requires confidence in the verifier, the
durable context, and the guardrails. It requires confidence that all the
other principles above are working.

Where to sit on this range depends on the task. How clear is the scope?
How good is the test coverage? How reversible is a mistake? How
expensive is it to stay closely involved? A mechanical refactor with
strong test coverage can run at high autonomy. A security-sensitive
change in unfamiliar code should be closely supervised.

Choosing where to sit on this range, and adjusting it as confidence
changes during the task, is a skill that develops with practice.

## What is next

A follow-up post will cover how to apply these principles in specific
workflows. Beyond that, there are topics that deserve their own
discussion, e.g., what "good software" means when generating code costs
almost nothing, company knowledge bases as shared context, and the
ethics of LLM-assisted development.

These are positions, not settled facts. Where the reasoning is wrong, or
where different experience has led to different conclusions, that is
worth hearing.

## References

Each of these sources contributed to the thinking above. In a sense,
this post is a distillation of many sources into a compressed,
opinionated form. Which, come to think of it, is also how the models
work.

- **Thariq Shihipar**, "Using Claude Code: Session Management & 1M
  Context" — the clearest treatment of context windows as a resource to
  manage, including compaction, rewind, and subagent patterns.
- **Anthropic Engineering**, "Effective Context Engineering for AI
  Agents" — strategies for managing context in long-running agent tasks.
  [anthropic.com](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- **Anthropic Engineering**, "Claude Code: Best Practices for Agentic
  Coding" — tool-specific but the patterns apply more broadly.
  [anthropic.com](https://www.anthropic.com/engineering/claude-code-best-practices)
- **Lee Robinson / Cursor**, "Best Practices for Coding with Agents" —
  plan mode, context management, the writer/reviewer pattern.
  [cursor.com](https://cursor.com/blog/agent-best-practices)
- **OpenAI**, "How OpenAI Uses Codex" — internal usage patterns across
  security, product, infrastructure, and performance engineering teams.
  [openai.com](https://openai.com/business/guides-and-resources/how-openai-uses-codex/)
- **OpenAI Developers**, "Best Practices" (Codex docs) — AGENTS.md as
  durable context, plan mode, test-driven verification loops.
  [developers.openai.com](https://developers.openai.com/codex/learn/best-practices)
