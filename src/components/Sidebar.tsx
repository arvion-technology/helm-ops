import type { AppState } from "../lib/state.ts";
import { TABS, TAB_LABEL } from "../lib/types.ts";
import type { Tab } from "../lib/types.ts";
import { selectCurrentOnCall, selectKpis } from "../lib/selectors.ts";
import { Avatar } from "./badges.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./Icon.tsx";

const TAB_ICON: Record<Tab, IconName> = {
  incidents: "pulse",
  deploys: "layers",
  oncall: "users",
  runbooks: "book",
};

export function Sidebar({ state }: { state: AppState }) {
  const kpis = selectKpis(state);
  const critical = selectCurrentOnCall(state).filter((row) => row.service.tier === "critical");

  return (
    <aside className="sidebar">
      <a className="brand" href="#incidents" style={{ padding: "6px 8px 14px" }}>
        <span className="brand-mark">H</span>
        <span>
          <span className="brand-word">HELM <b>/</b> OPS</span>
          <span className="brand-sub" style={{ display: "block" }}>Arvion Labs</span>
        </span>
      </a>

      <div className="nav-label">Console</div>
      {TABS.map((tab) => (
        <a
          key={tab}
          className={`nav-item nav-link${state.tab === tab ? " active" : ""}`}
          href={`#${tab}`}
          aria-current={state.tab === tab ? "page" : undefined}
        >
          <span className="nav-icon"><Icon name={TAB_ICON[tab]} /></span>
          <span>{TAB_LABEL[tab]}</span>
          {tab === "incidents" && kpis.openIncidents > 0 ? (
            <span className="nav-count">{kpis.openIncidents}</span>
          ) : null}
        </a>
      ))}

      <div className="nav-label">On this shift</div>
      <div className="card flat pad-sm shift-card">
        <div className="shift-row">
          <span className="small muted">Open incidents</span>
          <span className="mono">{kpis.openIncidents}</span>
        </div>
        <div className="shift-row">
          <span className="small muted">Unacknowledged</span>
          <span className={kpis.unacknowledged > 0 ? "mono warn" : "mono"}>{kpis.unacknowledged}</span>
        </div>
        <div className="shift-row">
          <span className="small muted">SEV1 active</span>
          <span className={kpis.sev1Open > 0 ? "mono danger" : "mono"}>{kpis.sev1Open}</span>
        </div>
        <div className="divider" style={{ margin: "10px 0" }} />
        <div className="small muted" style={{ marginBottom: 6 }}>Critical services on call</div>
        {critical.map((row) => (
          <div className="oncall-mini" key={row.service.id}>
            {row.primary ? <Avatar name={row.primary.person} /> : null}
            <span className="oncall-mini-person">{row.primary?.person ?? "unassigned"}</span>
            <span className="small muted">{row.service.name}</span>
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div className="sidebar-foot">
        <span className="badge green"><span className="dot pulse" /> live demo</span>
        <span className="small muted mono">v1.0</span>
      </div>
      <p className="small muted sidebar-note">
        Seeded data. Times shown in UTC. State lives in a reducer.
      </p>
    </aside>
  );
}
