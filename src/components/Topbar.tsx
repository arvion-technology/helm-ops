import type { AppState } from "../lib/state.ts";
import { TAB_LABEL } from "../lib/types.ts";
import { formatClock } from "../lib/format.ts";
import { selectKpis } from "../lib/selectors.ts";
import { Icon } from "./Icon.tsx";

export function Topbar({ state, onToggleEnvironment }: { state: AppState; onToggleEnvironment: () => void }) {
  const kpis = selectKpis(state);
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{TAB_LABEL[state.tab]}</h1>
        <span className="topbar-sub">Arvion production</span>
      </div>
      <span className="spacer" />
      <button
        type="button"
        className={`env-toggle${state.filters.environment === "prod" ? " on" : ""}`}
        onClick={onToggleEnvironment}
        title="Toggle between production and staging deploys"
      >
        <span className="dot" /> {state.filters.environment === "prod" ? "Production" : "Staging"}
      </button>
      <span className="badge clock-badge">
        <Icon name="clock" size={13} />
        <span className="mono">{formatClock(state.now)} UTC</span>
      </span>
      <span className="badge">
        <span className="dot" style={{ color: kpis.sev1Open > 0 ? "var(--red)" : "var(--green)" }} />
        {kpis.sev1Open > 0 ? "SEV1 active" : "All clear"}
      </span>
      <div className="avatar" title="Shift lead">SP</div>
    </header>
  );
}
