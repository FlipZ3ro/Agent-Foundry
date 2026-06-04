# agentic-saas-factory

Monorepo starter untuk membangun SaaS dengan pola **planner → worker swarm → reviewer**.

## Isi sekarang

- TypeScript schemas untuk:
  - blueprint
  - task spec
  - worker job
  - worker result
  - review decision
- minimal service code:
  - `services/orchestrator`
  - `services/worker`
  - `services/reviewer`
- app placeholders:
  - `apps/web`
  - `apps/dashboard`
- runnable demo:
  - `npm run demo`

## Repo map

- `packages/schemas` — source of truth untuk contracts
- `services/orchestrator` — planner + dispatch + run assembly
- `services/worker` — worker abstraction
- `services/reviewer` — quality gate abstraction
- `apps/web` — landing/marketing shell placeholder
- `apps/dashboard` — SaaS dashboard placeholder

## Arsitektur saat ini

1. planner bikin `ProjectBlueprint`
2. orchestrator buat `WorkerJob[]`
3. worker produce `WorkerResult[]`
4. reviewer bikin `ReviewDecision[]`

## Quick start

```bash
npm install
npm run demo
```

Contoh output:

```json
{
  "blueprint": { "...": "..." },
  "jobs": [],
  "results": [],
  "reviews": []
}
```

## Next steps

- tambah real queue / state store
- tambah HTTP API
- tambah auth + billing
- tambah frontend app beneran
- tambah lane-specific workers
- tambah persisted run history
