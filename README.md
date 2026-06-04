# agentic-saas-factory

Scaffold repo untuk membangun SaaS dengan pola planner + worker swarm + reviewer.

## Scope awal
- Belum ada API integration
- Belum ada business logic production
- Fokus: struktur monorepo, batas tanggung jawab, dan tempat kerja tiap layer

## Arsitektur
- `apps/web` — landing/marketing site
- `apps/dashboard` — app shell SaaS
- `services/orchestrator` — planner, task graph, dispatch
- `services/worker` — worker executors
- `services/reviewer` — review/merge/quality gate
- `packages/*` — shared modules
- `templates/*` — PRD/task spec templates
- `docs/*` — architecture, plans, examples

## Next steps
1. pilih stack frontend/backend final
2. definisikan task graph schema
3. definisikan worker contract
4. tambahkan queue + state store
5. tambahkan auth/billing setelah core orchestration stabil
