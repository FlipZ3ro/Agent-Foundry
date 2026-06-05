# Agent Foundry

> Working repo name: `agentic-saas-factory`

Agent Foundry is a monorepo starter for building AI-operated SaaS systems with a simple execution model:

**planner -> router -> worker swarm -> reviewer**

The goal is to separate **reasoning-heavy orchestration** from **execution-heavy production work** so the system can scale cleanly, stay auditable, and support multiple agent lanes over time.

---

## Why this name

I think **Agent Foundry** is the best simple name here because it is:

- **short**
- **easy to remember**
- sounds like a place where products get built
- broad enough for SaaS, agents, automations, and internal tooling
- cleaner than a long descriptive repo name

Other good options if you want alternatives:

- **Agent Foundry** ← best balance
- **SaaS Foundry**
- **BuildSwarm**
- **TaskForge**
- **LaunchOS**

If you want the cleanest branding, I’d rename the GitHub repo later to:

- `agent-foundry`

---

## Core idea

Most teams waste money by sending every task to the most expensive model.

This repo is designed around a different pattern:

- **Planner** handles strategy, decomposition, and quality thresholds
- **Router** decides whether a task needs reasoning, execution, or both
- **Worker swarm** handles clear, parallelizable output generation
- **Reviewer** checks outputs before they are accepted
- **Run history** records what happened at each stage

This creates a reusable operating system for agentic product building.

---

## Current architecture

The current implementation is a minimal runnable prototype of this flow:

1. **Planner** creates a `ProjectBlueprint`
2. **Router** classifies each task into an execution mode
3. **Orchestrator** creates routed `WorkerJob[]`
4. **Worker layer** produces `WorkerResult[]`
5. **Reviewer** returns `ReviewDecision[]`
6. **Run history** captures the lifecycle of the run

Execution modes currently supported in schema:

- `reasoning`
- `execution`
- `hybrid`

---

## What exists right now

### Shared schemas
Located in:
- `packages/schemas`

Includes:
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

- **Orchestrator**
  - creates the project blueprint
  - applies routing decisions
  - creates jobs
  - collects results
  - assembles the full run object

- **Worker**
  - simulates task execution
  - returns produced files and summaries

- **Reviewer**
  - applies a simple quality gate
  - approves tasks that declare outputs

### App placeholders
Located in:
- `apps/web`
- `apps/dashboard`

These are placeholders for:
- marketing site
- operator dashboard
- run viewer / control panel

---

## Repo structure

```text
agentic-saas-factory/
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
Source of truth for contracts shared across planner, router, workers, and reviewers.

### `services/orchestrator`
Main coordination layer.

Contains:
- blueprint planning
- routing logic
- job creation
- run assembly
- demo entrypoint

### `services/worker`
Worker abstraction that turns a routed task into an execution result.

### `services/reviewer`
Review abstraction that decides whether a worker result is acceptable.

### `apps/dashboard`
Future operator UI for:
- viewing runs
- retrying failed tasks
- inspecting routing decisions
- tracking quality and cost

### `apps/web`
Future public-facing site or product shell.

### `docs/architecture`
Architecture notes and repo map.

### `docs/examples`
Small examples of flow and task behavior.

---

## Data flow

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

---

## Example routing logic

The demo currently applies simple heuristics:

- **frontend tasks** with clear outputs -> `execution`
- **backend contract tasks** -> `hybrid`
- **coordination-heavy tasks** with dependencies -> `reasoning`

This is intentionally minimal, but it establishes the right shape for future model routing.

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

The important part is not the placeholder output itself, but the shape:

- planning is explicit
- routing is explicit
- execution is explicit
- review is explicit
- run history is explicit

---

## What this repo is good for

This repo is a good base for building:

- AI SaaS factories
- internal agent ops platforms
- multi-lane workflow systems
- autonomous content/research pipelines
- code generation and review pipelines
- batch execution systems with human approval checkpoints

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

If you want to evolve this into a real platform, the best next changes are:

### 1. Persist run history
Save each `OrchestrationRun` into a `runs/` directory or database.

### 2. Add HTTP API
Expose endpoints like:
- `POST /runs`
- `GET /runs/:id`
- `POST /runs/:id/retry`

### 3. Add real router policies
Replace demo heuristics with task classification rules based on:
- ambiguity
- dependency count
- output format clarity
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

## Design principles

This repo is being shaped around a few simple ideas:

- **Reasoning is expensive** -> use it where judgment matters
- **Execution should scale** -> route clear tasks to workers
- **Review should be explicit** -> never silently accept outputs
- **History matters** -> every run should be inspectable
- **Contracts first** -> schemas before infra

---

## Suggested future rename

Current repo name:
- `agentic-saas-factory`

Recommended public-facing name:
- **Agent Foundry**

Recommended GitHub repo rename later:
- `agent-foundry`

This keeps the branding simple while still matching the architecture.

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
