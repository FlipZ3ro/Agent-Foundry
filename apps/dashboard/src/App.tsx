import { useCallback, useEffect, useState } from "react";
import { client } from "./api.js";
import { RunList } from "./components/RunList.js";
import { RunDetail } from "./components/RunDetail.js";
import { CreateRunForm } from "./components/CreateRunForm.js";
import { Icon } from "./components/Icon.js";
import type { OrchestrationRun, RunSummary } from "./types.js";

export function App() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selected, setSelected] = useState<OrchestrationRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await client.listRuns();
      setRuns(items.sort((a, b) => b.id.localeCompare(a.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const select = useCallback(async (id: string) => {
    setError(null);
    try {
      const run = await client.getRun(id);
      setSelected(run);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const create = useCallback(
    async (idea: string) => {
      setError(null);
      try {
        const run = await client.createRun(idea);
        await refresh();
        setSelected(run);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh]
  );

  const retry = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const run = await client.retryRun(id);
        await refresh();
        setSelected(run);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh]
  );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">AF</div>
          <div className="brand-text">
            <span className="brand-name">Agent Foundry</span>
            <span className="brand-sub">operator</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="kbd">⌘K</span>
          <button className="ghost" onClick={refresh} disabled={loading}>
            <Icon name="refresh" />
            {loading ? "refreshing" : "refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="banner error">
          <Icon name="alert" />
          {error}
        </div>
      ) : null}

      <main className="grid">
        <aside className="sidebar">
          <div>
            <div className="section-head">
              <h2>new run</h2>
            </div>
            <div className="create-card">
              <CreateRunForm onCreate={create} />
            </div>
          </div>

          <div>
            <div className="section-head">
              <h2>runs</h2>
              <span className="count-pill">{runs.length}</span>
            </div>
            <RunList runs={runs} selectedId={selected?.id} onSelect={select} />
          </div>
        </aside>

        <section className="pane detail">
          {selected ? (
            <RunDetail run={selected} onRetry={retry} />
          ) : (
            <div className="empty detail-empty">
              <Icon name="inbox" className="empty-icon" />
              <div className="empty-title">no run selected</div>
              <div className="empty-hint">create a new run or pick one from the sidebar</div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
