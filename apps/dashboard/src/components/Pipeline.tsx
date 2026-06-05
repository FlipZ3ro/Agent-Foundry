import type { OrchestrationRun } from "../types.js";

type StepState = "done" | "active" | "pending";

interface Step {
  index: string;
  title: string;
  sub: string;
  state: StepState;
}

export function Pipeline({ run, live }: { run: OrchestrationRun; live: boolean }) {
  const taskCount = run.routingDecisions.length || run.results.length || 0;
  const planned = run.history.some((h) => h.stage === "planned") || taskCount > 0;
  const routed = run.routingDecisions.length > 0;
  const executed = taskCount > 0 && run.results.length >= taskCount;
  const reviewed = taskCount > 0 && run.reviews.length >= taskCount;
  const done = run.status === "completed" || run.status === "failed";

  const steps: Step[] = [
    {
      index: "01",
      title: "Decompose",
      sub: "planner · mimo-pro",
      state: planned ? "done" : live ? "active" : "pending"
    },
    {
      index: "02",
      title: "Dispatch",
      sub: "router · model policy",
      state: routed ? "done" : planned ? "active" : "pending"
    },
    {
      index: "03",
      title: "Execute",
      sub: `worker swarm · ${taskCount || "—"} lanes`,
      state: executed ? "done" : routed && !executed ? "active" : "pending"
    },
    {
      index: "04",
      title: "Review",
      sub: "reviewer · rubric gate",
      state: reviewed && done ? "done" : executed && !reviewed ? "active" : "pending"
    }
  ];

  return (
    <div className="pipeline">
      {steps.map((step, i) => (
        <div key={step.index} className={`pipe-step pipe-${step.state}`}>
          <div className="pipe-index">{step.index}</div>
          <div className="pipe-body">
            <div className="pipe-title">{step.title}</div>
            <div className="pipe-sub">{step.sub}</div>
          </div>
          {step.state === "active" ? <span className="pipe-pulse" /> : null}
          {i < steps.length - 1 ? <span className="pipe-arrow">→</span> : null}
        </div>
      ))}
    </div>
  );
}
