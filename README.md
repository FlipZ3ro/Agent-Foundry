# Agent Foundry

> Repository: `FlipZ3ro/Agent-Foundry`

**Build AI-operated products with a clean multi-agent architecture.**

Agent Foundry is a TypeScript monorepo starter for building agentic SaaS systems around one simple idea:

**planner -> router -> worker swarm -> reviewer**

Instead of sending every task to one expensive general-purpose model, Agent Foundry separates:

- **reasoning**
- **routing**
- **execution**
- **review**
- **run history**

That makes the system easier to scale, inspect, debug, and evolve.

---

## TL;DR

Agent Foundry is for teams who want to build:

- AI SaaS factories
- internal agent ops platforms
- research and content pipelines
- multi-lane execution systems
- autonomous product builders
- reviewable agent workflows with explicit contracts

Current state:

- runnable demo: **yes**
- typed schemas: **yes**
- routing layer: **yes**
- run history shape: **yes**
- HTTP API: **not yet**
- persistent storage: **not yet**
- real dashboard UI: **not yet**

---

## Why Agent Foundry

The name is short, clean, and broad.

It feels like a place where products get built.

That fits the repo better than a long descriptive name, because this project is not just a SaaS scaffold — it is intended to become an **agent operating system for product creation**.

Other names that also work:

- `SaaS Foundry`
- `BuildSwarm`
- `TaskForge`
- `LaunchOS`

But **Agent Foundry** is the best balance of:

- simple
- memorable
- flexible
- brandable

---

## The problem this repo is solving

Most teams overpay for AI workflows because they route everything through one strong model.

That creates three problems:

1. **cost explosion**
2. **unclear task boundaries**
3. **poor observability**

Agent Foundry takes a different approach.

It assumes different layers should do different jobs:

- **Planner** handles decomposition, strategy, and quality thresholds
- **Router** decides whether a task is reasoning-heavy, execution-heavy, or hybrid
- **Worker swarm** handles clear, parallelizable output generation
- **Reviewer** checks results before acceptance
- **Run history** records what happened across the lifecycle

This turns a vague “AI app builder” into a structured system.

---

## Core idea

The architecture is intentionally simple:

```text
Idea
  -> Planner
  -> ProjectBlueprint
  -> Router
  -> RoutingDecision[]
  -> WorkerJob[]
  -> WorkerResult[]
  -> ReviewDecision[]
  -> OrchestrationRun
```

The point is not complexity.

The point is to make these things explicit:

- what was planned
- how it was routed
- what got executed
- what passed review
- what happened during the run

---

## What exists right now

### Shared schemas
Located in:
- `packages/schemas`

Current contracts include:
- `ProjectBlueprint`
- `TaskSpec`
- `AcceptanceCriterion`
- `RoutingDecision`
- `WorkerJob`
- `WorkerResult`
- `ReviewDecision`
- `RunHistoryEntry`
- `OrchestrationRun`

### Services
Located in:
- `services/orchestrator`
- `services/worker`
- `services/reviewer`

Current responsibilities:

#### `services/orchestrator`
- creates the project blueprint
- applies routing decisions
- creates jobs
- collects results
- assembles the final run object
- exposes the demo entrypoint

#### `services/worker`
- simulates task execution
- returns summaries and produced files

#### `services/reviewer`
- applies a simple quality gate
- approves or rejects based on declared outputs

### App placeholders
Located in:
- `apps/web`
- `apps/dashboard`

Intended future roles:
- public product or marketing shell
- operator dashboard
- run viewer / control plane

---

## Current architecture

The repo currently implements a minimal prototype of this flow:

1. **Planner** creates a `ProjectBlueprint`
2. **Router** classifies tasks into execution modes
3. **Orchestrator** creates routed `WorkerJob[]`
4. **Worker layer** produces `WorkerResult[]`
5. **Reviewer** returns `ReviewDecision[]`
6. **Run history** captures the lifecycle of the run

Execution modes currently modeled in schema:

- `reasoning`
- `execution`
- `hybrid`

---

## Example routing logic

The demo uses simple heuristics right now:

- **frontend tasks** with clear outputs -> `execution`
- **backend contract tasks** -> `hybrid`
- **coordination-heavy tasks** with dependencies -> `reasoning`

This is intentionally lightweight, but it proves the shape of the system.

---

## Repo structure

```text
Agent-Foundry/
├── apps/
│   ├── dashboard/
│   └── web/
├── docs/
│   ├── architecture/
│   └── examples/
├── infra/
├── packages/
│   ├── config/
│   ├── prompts/
│   ├── schemas/
│   ├── sdk/
│   └── ui/
├── scripts/
├── services/
│   ├── orchestrator/
│   ├── reviewer/
│   └── worker/
└── templates/
```

---

## Repo map

### `packages/schemas`
Source of truth for contracts shared across planner, router, worker lanes, and reviewers.

### `services/orchestrator`
Main coordination layer.

Contains:
- blueprint planning
- routing logic
- job creation
- run assembly
- demo flow

### `services/worker`
Worker abstraction that turns a routed task into an execution result.

### `services/reviewer`
Review abstraction that decides whether a worker result is acceptable.

### `apps/dashboard`
Future operator UI for:
- viewing runs
- retrying failed tasks
- inspecting routing decisions
- tracking quality
- tracking cost

### `apps/web`
Future public-facing shell.

### `docs/architecture`
Architecture notes and repo map.

### `docs/examples`
Examples of task and run behavior.

---

## Quick start

### Install

```bash
npm install
```

### Run the demo

```bash
npm run demo
```

### Build core packages

```bash
npm run build:core
```

---

## Example output

The demo returns a structured object like this:

```json
{
  "blueprint": {
    "id": "blueprint-001",
    "idea": "Build a crypto + macro SaaS factory MVP"
  },
  "run": {
    "id": "run-001",
    "status": "completed",
    "routingDecisions": [],
    "jobs": [],
    "results": [],
    "reviews": [],
    "history": []
  }
}
```

The important part is not the placeholder values.

The important part is that the system shape is explicit:

- planning is explicit
- routing is explicit
- execution is explicit
- review is explicit
- run history is explicit

---

## What this repo is good for

This repo is a strong base for building:

- AI SaaS factories
- internal agent ops platforms
- multi-lane workflow systems
- autonomous content pipelines
- research and synthesis systems
- code generation and review pipelines
- batch execution systems with approval checkpoints

---

## Design principles

This repo is being shaped around a few simple ideas:

- **Reasoning is expensive** -> use it where judgment matters
- **Execution should scale** -> route clear tasks to workers
- **Review should be explicit** -> never silently accept outputs
- **History matters** -> every run should be inspectable
- **Contracts first** -> define schemas before infra

---

## What is still missing

This is still a scaffold / prototype.

Not implemented yet:

- persistent run storage
- HTTP API for creating and managing runs
- actual queue system
- retry loop on failed review
- lane-specific worker implementations
- real subagent execution
- auth and billing
- dashboard UI
- metrics and cost tracking
- skill/template registry

---

## Best next steps

If you want to evolve this into a real platform, the most valuable next changes are:

### 1. Persist run history
Save each `OrchestrationRun` into a `runs/` directory or a database.

### 2. Add HTTP API
Expose endpoints like:
- `POST /runs`
- `GET /runs/:id`
- `POST /runs/:id/retry`

### 3. Add real router policies
Replace demo heuristics with task classification rules based on:
- ambiguity
- dependency count
- output clarity
- reviewability
- estimated cost

### 4. Add lane-specific workers
Examples:
- `research-worker`
- `frontend-worker`
- `backend-worker`
- `content-worker`
- `qa-worker`

### 5. Add dashboard
Show:
- runs
- task graph
- routing decisions
- failures
- review notes
- estimated cost savings

---

## Status

Current status:
- runnable demo: yes
- typed schemas: yes
- routing layer: yes
- run history shape: yes
- persistent backend: not yet
- real product apps: not yet

---

## License / usage

Use this repo as a starter for your own agentic systems, internal operator tools, or experimental SaaS automation stacks.
