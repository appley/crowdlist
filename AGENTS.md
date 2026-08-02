# Project Agent Instructions

These instructions apply to every task in this repository unless the user
explicitly overrides them.

## Start Here

Before changing code or project files:

1. Read this file completely.
2. Read `memory.md` for current, verified project context.
3. Inspect the files directly involved in the task, including their exports,
   immediate callers, tests, and shared utilities.
4. State assumptions and define concrete success criteria.

After completing a task, update `memory.md` only when the work establishes
durable, project-level information that will help future work. Do not add
speculation, transient task status, secrets, credentials, or a chronological
work log. Correct stale entries when repository evidence proves them wrong.

## Working Rules

### Rule 1 — Think Before Coding

State assumptions explicitly. If uncertain, ask rather than guess. Present
multiple interpretations when ambiguity exists. Push back when a simpler
approach exists. Stop when confused. Name what is unclear.

### Rule 2 — Simplicity First

Write the minimum code that solves the problem. Add nothing speculative and no
features beyond what was asked. Do not introduce abstractions for single-use
code. If a senior engineer would call the solution overcomplicated, simplify
it.

### Rule 3 — Surgical Changes

Touch only what is necessary. Clean up only changes introduced by the current
task. Do not improve adjacent code, comments, or formatting. Do not refactor
working code. Match the existing style.

### Rule 4 — Goal-Driven Execution

Define success criteria, then iterate until they are verified. Do not merely
follow a sequence of steps; work toward the stated outcome.

### Rule 5 — Use the Model Only for Judgment Calls

Use the model for classification, drafting, summarization, and extraction. Do
not use it for routing, retries, or deterministic transformations. When code can
answer reliably, let code answer.

### Rule 6 — Token Budgets Are Not Advisory

The per-task budget is 4,000 tokens. The per-session budget is 30,000 tokens. If
approaching either budget, summarize the current state and start fresh. Surface
any breach; never silently overrun a budget.

### Rule 7 — Surface Conflicts, Do Not Average Them

When two patterns conflict, select the more recent or better-tested pattern and
explain the choice. Flag the other pattern for cleanup. Do not blend conflicting
approaches.

### Rule 8 — Read Before You Write

Before adding code, read exports, immediate callers, and shared utilities.
Assuming something is orthogonal is unsafe. If the reason for a structure is
unclear, ask.

### Rule 9 — Tests Verify Intent, Not Just Behavior

Tests must encode why behavior matters, not only what it does. A test that
cannot fail when the relevant business logic changes is inadequate.

### Rule 10 — Checkpoint After Every Significant Step

Summarize what was done, what is verified, and what remains. Do not continue
from a state that cannot be described clearly. If context is lost, stop and
restate it.

### Rule 11 — Match Codebase Conventions

Conformance takes priority over personal taste. If an existing convention is
genuinely harmful, surface the concern rather than silently introducing a
different convention.

### Rule 12 — Fail Loud

Do not claim completion when anything was silently skipped. Do not claim tests
pass when any were skipped. Surface uncertainty instead of hiding it.

## Completion Checklist

- The requested outcome and success criteria are satisfied.
- Changes are minimal and limited to the task.
- Relevant verification has run, with skipped checks disclosed.
- Durable new project knowledge is reflected in `memory.md`.
- Remaining uncertainty, conflicts, and follow-up work are stated explicitly.
