# Repo Map

## apps/
- web: landing page, marketing, docs entry
- dashboard: authenticated SaaS shell

## services/
- orchestrator: planning, dependency graph, dispatch
- worker: lane executors
- reviewer: validation, QA, merge gates

## packages/
- ui: shared components
- config: shared config
- schemas: task/job/result contracts
- prompts: planner/worker/reviewer prompts
- sdk: shared client/helper layer
