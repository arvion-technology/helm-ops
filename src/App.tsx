import { useEffect, useReducer } from "react";
import { createInitialState, reducer } from "./lib/state.ts";
import type { Action } from "./lib/state.ts";
import { TABS } from "./lib/types.ts";
import type { Tab } from "./lib/types.ts";
import { Sidebar } from "./components/Sidebar.tsx";
import { Topbar } from "./components/Topbar.tsx";
import { IncidentBoard } from "./components/IncidentBoard.tsx";
import { DeployTimeline } from "./components/DeployTimeline.tsx";
import { OnCallRoster } from "./components/OnCallRoster.tsx";
import { Runbooks } from "./components/Runbooks.tsx";

type ToastKind = "success" | "error" | "info";

declare global {
  interface Window {
    A?: { toast?: (message: string, kind?: string, ms?: number) => void };
  }
}

/** Bridge to the shared arvion.js toast helper, with a safe no-op fallback. */
function notify(message: string, kind: ToastKind = "success"): void {
  window.A?.toast?.(message, kind, 2600);
}

function tabFromHash(): Tab | null {
  const value = window.location.hash.replace(/^#/, "").split("/")[0];
  return TABS.includes(value as Tab) ? (value as Tab) : null;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState());
  const set = (action: Action) => dispatch(action);

  // Keep the URL hash and the reducer in step, so a screenshot or a link can
  // open the console on a specific screen.
  useEffect(() => {
    const initial = tabFromHash();
    if (initial) dispatch({ type: "setTab", tab: initial });
    const onHashChange = () => {
      const tab = tabFromHash();
      if (tab) dispatch({ type: "setTab", tab });
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const wanted = `#${state.tab}`;
    if (window.location.hash !== wanted) {
      window.history.replaceState(null, "", wanted);
    }
  }, [state.tab]);

  // The relative times are computed from state.now, so the clock is part of the
  // reducer rather than a date printed once at render time.
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: "setNow", now: Date.now() }), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="app shell">
      <Sidebar state={state} />
      <div className="workspace">
        <Topbar
          state={state}
          onToggleEnvironment={() =>
            set({
              type: "setFilters",
              patch: { environment: state.filters.environment === "prod" ? "staging" : "prod" },
            })
          }
        />
        <main className="main">
          {state.tab === "incidents" ? (
            <IncidentBoard state={state} dispatch={set} notify={notify} />
          ) : null}
          {state.tab === "deploys" ? <DeployTimeline state={state} dispatch={set} /> : null}
          {state.tab === "oncall" ? <OnCallRoster state={state} dispatch={set} /> : null}
          {state.tab === "runbooks" ? <Runbooks state={state} dispatch={set} /> : null}
        </main>
      </div>
    </div>
  );
}
