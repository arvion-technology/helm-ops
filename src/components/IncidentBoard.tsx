import { useState } from "react";
import type { FormEvent } from "react";
import type { AppState, Action } from "../lib/state.ts";
import { nextStatus } from "../lib/state.ts";
import { INCIDENT_STATUSES, SEVERITIES, STATUS_LABEL } from "../lib/types.ts";
import type { Incident, Severity, TimelineKind } from "../lib/types.ts";
import {
  formatAgo, formatClock, formatCount, formatIn, formatMinutes, plural,
} from "../lib/format.ts";
import {
  selectEscalationHint, selectKpis, selectSelectedIncident, selectVisibleIncidents,
  severityRank,
} from "../lib/selectors.ts";
import { KpiStrip } from "./KpiStrip.tsx";
import { SeverityPill, StatusBadge, AckFlag, Avatar } from "./badges.tsx";
import { Icon } from "./Icon.tsx";
import type { IconName } from "./Icon.tsx";

const TIMELINE_ICON: Record<TimelineKind, IconName> = {
  opened: "alert",
  ack: "check",
  status: "arrow",
  note: "note",
  escalation: "users",
  deploy: "layers",
};

function SeverityFilter({ state, dispatch, counts }: {
  state: AppState;
  dispatch: (action: Action) => void;
  counts: Record<Severity, number>;
}) {
  const options: (Severity | "all")[] = ["all", ...SEVERITIES];
  return (
    <div className="filter-row" role="group" aria-label="Filter by severity">
      {options.map((value) => {
        const active = state.filters.severity === value;
        return (
          <button
            key={value}
            type="button"
            className={`sev-filter${active ? " active" : ""}${value !== "all" ? ` sev-text-${value.slice(-1)}` : ""}`}
            aria-pressed={active}
            onClick={() => dispatch({ type: "setFilters", patch: { severity: value } })}
          >
            {value === "all" ? "All severities" : value}
            {value !== "all" ? <span className="sev-filter-count">{counts[value]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function IncidentRow({ incident, selected, serviceName, now, onSelect }: {
  incident: Incident;
  selected: boolean;
  serviceName: string;
  now: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`incident-row${selected ? " selected" : ""}${incident.acknowledgedAt === null && incident.status !== "resolved" ? " unacked" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <SeverityPill severity={incident.severity} />
      <span className="incident-main">
        <span className="incident-title">{incident.title}</span>
        <span className="incident-meta">
          {serviceName}
          <span className="dot-sep">·</span>
          {incident.commander}
          <span className="dot-sep">·</span>
          opened {formatAgo(incident.openedAt, now)}
          {incident.affectedSessions > 0 ? (
            <>
              <span className="dot-sep">·</span>
              {formatCount(incident.affectedSessions)} {plural(incident.affectedSessions, "session")} affected
            </>
          ) : null}
        </span>
      </span>
      <span className="incident-side">
        <StatusBadge status={incident.status} />
        {incident.acknowledgedAt === null && incident.status !== "resolved" ? <AckFlag /> : null}
        <span className="incident-code mono">{incident.id}</span>
      </span>
    </button>
  );
}

function StatusStepper({ status }: { status: Incident["status"] }) {
  const currentIndex = INCIDENT_STATUSES.indexOf(status);
  return (
    <div className="stepper" role="list" aria-label="Incident status">
      {INCIDENT_STATUSES.map((value, index) => {
        const stateName = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
        return (
          <div className={`step ${stateName}`} key={value} role="listitem">
            <span className="step-dot">
              {index < currentIndex ? <Icon name="check" size={10} /> : null}
            </span>
            <span className="step-label">{STATUS_LABEL[value]}</span>
          </div>
        );
      })}
    </div>
  );
}

function NoteForm({ incidentId, dispatch }: { incidentId: string; dispatch: (action: Action) => void }) {
  const [text, setText] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    dispatch({ type: "logNote", id: incidentId, text });
    setText("");
  }
  return (
    <form className="note-form" onSubmit={submit}>
      <input
        className="input"
        placeholder="Add a timeline note"
        aria-label="Timeline note"
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <button className="btn sm" type="submit" disabled={!text.trim()}>Add note</button>
    </form>
  );
}

function IncidentDetail({ state, dispatch, incident, notify }: {
  state: AppState;
  dispatch: (action: Action) => void;
  incident: Incident;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}) {
  const service = state.services.find((row) => row.id === incident.serviceId);
  const hint = selectEscalationHint(state, incident);
  const next = nextStatus(incident.status);
  const history = state.history[0];
  const runbook = incident.runbookId
    ? state.runbooks.find((row) => row.id === incident.runbookId) ?? null
    : null;
  const isResolved = incident.status === "resolved";
  const ladderLast = hint.steps[hint.steps.length - 1]?.afterMinutes ?? 30;
  const progress = hint.steps.length > 1
    ? Math.min(1, Math.max(0, hint.minutesOpen / Math.max(1, ladderLast)))
    : 1;

  return (
    <aside className="card incident-detail">
      <div className="detail-head">
        <div className="row" style={{ gap: 8 }}>
          <SeverityPill severity={incident.severity} />
          <span className="mono small muted">{incident.id}</span>
          <span className="spacer" />
          {incident.acknowledgedAt === null && !isResolved ? <AckFlag /> : (
            <span className="badge green"><Icon name="check" size={11} /> acknowledged</span>
          )}
        </div>
        <h2 className="detail-title">{incident.title}</h2>
        <p className="detail-impact">{incident.impact}</p>
      </div>

      <StatusStepper status={incident.status} />

      <div className="detail-actions">
        <button
          type="button"
          className="btn sm"
          disabled={incident.acknowledgedAt !== null || isResolved}
          onClick={() => {
            dispatch({ type: "acknowledge", id: incident.id });
            notify(`${incident.id} acknowledged`);
          }}
        >
          Acknowledge
        </button>
        <button
          type="button"
          className="btn sm primary"
          disabled={next === null}
          onClick={() => {
            if (!next) return;
            dispatch({ type: "advance", id: incident.id });
            notify(`${incident.id} moved to ${STATUS_LABEL[next]}`);
          }}
        >
          {next ? `Advance to ${STATUS_LABEL[next]}` : "Resolved"}
        </button>
        <button
          type="button"
          className="btn sm ghost"
          disabled={!history}
          title={history ? history.label : "Nothing to undo"}
          onClick={() => {
            dispatch({ type: "undo" });
            notify("Last status change undone", "info");
          }}
        >
          Undo
        </button>
      </div>
      <div className="undo-hint">
        {history
          ? `Undo available: ${history.label} · ${formatAgo(history.at, state.now)}`
          : "Acknowledge or advance this incident and the change can be undone."}
      </div>

      <dl className="detail-meta">
        <div>
          <dt>Service</dt>
          <dd>{service?.name ?? incident.serviceId}</dd>
        </div>
        <div>
          <dt>Commander</dt>
          <dd className="row" style={{ gap: 6 }}><Avatar name={incident.commander} />{incident.commander}</dd>
        </div>
        <div>
          <dt>Opened</dt>
          <dd>{formatClock(incident.openedAt)} · {formatAgo(incident.openedAt, state.now)}</dd>
        </div>
        <div>
          <dt>Acknowledged</dt>
          <dd>{incident.acknowledgedAt ? `${formatClock(incident.acknowledgedAt)} · ${formatAgo(incident.acknowledgedAt, state.now)}` : "waiting"}</dd>
        </div>
        <div>
          <dt>Impact</dt>
          <dd>
            {incident.affectedSessions > 0
              ? `${formatCount(incident.affectedSessions)} ${plural(incident.affectedSessions, "session")} affected`
              : "internal only"}
          </dd>
        </div>
        <div>
          <dt>Runbook</dt>
          <dd>
            {runbook ? (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  dispatch({ type: "selectRunbook", id: runbook.id });
                  dispatch({ type: "setRunbookQuery", query: "" });
                  dispatch({ type: "setTab", tab: "runbooks" });
                }}
              >
                {runbook.title}
              </button>
            ) : "none linked"}
          </dd>
        </div>
      </dl>

      <div className="escalation-box">
        <div className="row" style={{ marginBottom: 6 }}>
          <span className="small strong">Escalation</span>
          <span className="spacer" />
          <span className={`badge ${hint.next?.afterMinutes === 5 || hint.severity === "SEV1" ? "red" : "gold"}`}>
            {hint.severity} ladder
          </span>
        </div>
        <div className="progress"><i style={{ width: `${progress * 100}%` }} /></div>
        <div className="row escalation-line">
          <span className="small muted">
            Now: {hint.current.role.toLowerCase()} via {hint.current.channel}
          </span>
          <span className="spacer" />
          <span className="small">
            {hint.next && hint.nextAt
              ? `Next: ${hint.next.role} ${formatIn(hint.nextAt, state.now)}`
              : "all steps paged"}
          </span>
        </div>
      </div>

      <div className="detail-timeline-head">
        <span className="small strong">Timeline</span>
        <span className="small muted">{formatMinutes(hint.minutesOpen)} open</span>
      </div>
      <ol className="timeline">
        {incident.timeline.map((entry) => (
          <li className={`tl ${entry.kind}`} key={entry.id}>
            <span className="tl-icon"><Icon name={TIMELINE_ICON[entry.kind]} size={12} /></span>
            <div className="tl-body">
              <div className="tl-text">{entry.text}</div>
              <div className="tl-meta">{entry.actor} · {formatClock(entry.at)} · {formatAgo(entry.at, state.now)}</div>
            </div>
          </li>
        ))}
      </ol>

      {isResolved ? null : <NoteForm key={incident.id} incidentId={incident.id} dispatch={dispatch} />}
    </aside>
  );
}

export function IncidentBoard({ state, dispatch, notify }: {
  state: AppState;
  dispatch: (action: Action) => void;
  notify: (message: string, kind?: "success" | "error" | "info") => void;
}) {
  const kpis = selectKpis(state);
  const visible = selectVisibleIncidents(state);
  const selected = selectSelectedIncident(state) ?? visible[0] ?? null;
  const counts = SEVERITIES.reduce((acc, severity) => {
    acc[severity] = state.incidents.filter(
      (incident) => incident.serviceId && incident.severity === severity && incident.status !== "resolved",
    ).length;
    return acc;
  }, {} as Record<Severity, number>);

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">Incident response</div>
          <p className="lede">
            {kpis.openIncidents} open {plural(kpis.openIncidents, "incident")},
            {" "}{kpis.unacknowledged} still unacknowledged. Acknowledge here, advance the
            status here, and undo the last change if you click the wrong row.
          </p>
        </div>
        <span className="spacer" />
        <div className="head-actions">
          <span className="badge red">{kpis.sev1Open} SEV1</span>
          <span className="badge gold">{kpis.deploys24h} deploys today</span>
        </div>
      </div>

      <KpiStrip
        items={[
          { label: "Open incidents", value: String(kpis.openIncidents), hint: "SEV1 to SEV4, not resolved", tone: "blue" },
          { label: "SEV1 active", value: String(kpis.sev1Open), hint: "critical, page if unacknowledged", tone: "red" },
          { label: "Unacknowledged", value: String(kpis.unacknowledged), hint: "no commander at the keyboard", tone: kpis.unacknowledged > 0 ? "gold" : "green" },
          { label: "Mean time to resolve", value: kpis.mttrMinutes === null ? "n/a" : formatMinutes(kpis.mttrMinutes), hint: "all resolved incidents in the seed", tone: "" },
          { label: "Deploys 24h", value: String(kpis.deploys24h), hint: `${kpis.deploySuccessRate === null ? "n/a" : Math.round(kpis.deploySuccessRate * 100)}% success, ${kpis.rollbacks24h} rollback`, tone: "green" },
        ]}
      />

      <div className="board-grid">
        <section className="card incident-list-card">
          <div className="card-head">
            <div>
              <div className="card-title">Incident board</div>
              <div className="card-sub">
                Sorted by severity, then longest open. {visible.length} shown.
              </div>
            </div>
            <span className="spacer" />
            <div className="status-toggle" role="group" aria-label="Filter by status">
              {(["active", "all"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`toggle-btn${state.filters.status === value ? " active" : ""}`}
                  aria-pressed={state.filters.status === value}
                  onClick={() => dispatch({ type: "setFilters", patch: { status: value } })}
                >
                  {value === "active" ? "Active" : "All"}
                </button>
              ))}
            </div>
          </div>

          <div className="toolbar">
            <SeverityFilter state={state} dispatch={dispatch} counts={counts} />
            <div className="search small-search">
              <input
                className="input"
                placeholder="Search incidents, services, commanders"
                aria-label="Search incidents"
                value={state.filters.query}
                onChange={(event) => dispatch({ type: "setFilters", patch: { query: event.target.value } })}
              />
            </div>
          </div>

          <div className="incident-rows">
            {visible.length === 0 ? (
              <div className="empty">
                <strong>No incidents match</strong>
                <span>Clear the filters to see the board again.</span>
                <button
                  type="button"
                  className="btn sm mt-2"
                  onClick={() => dispatch({ type: "setFilters", patch: { severity: "all", status: "all", query: "" } })}
                >
                  Clear filters
                </button>
              </div>
            ) : visible.map((incident) => (
              <IncidentRow
                key={incident.id}
                incident={incident}
                selected={selected?.id === incident.id}
                serviceName={state.services.find((service) => service.id === incident.serviceId)?.name ?? incident.serviceId}
                now={state.now}
                onSelect={() => dispatch({ type: "selectIncident", id: incident.id })}
              />
            ))}
          </div>
          <div className="list-foot">
            <span className="small muted">
              Oldest open {selected ? formatMinutes(selectEscalationHint(state, selected).minutesOpen) : "n/a"}
              <span className="dot-sep">·</span>
              {formatCount(state.incidents.reduce((sum, row) => sum + row.affectedSessions, 0))} sessions affected across the board
            </span>
            <span className="spacer" />
            <button
              type="button"
              className="link-button"
              onClick={() => dispatch({ type: "setTab", tab: "runbooks" })}
            >
              Open the runbooks
            </button>
          </div>
        </section>

        {selected ? (
          <IncidentDetail state={state} dispatch={dispatch} incident={selected} notify={notify} />
        ) : (
          <aside className="card incident-detail empty-detail">
            <Icon name="check" size={28} />
            <h2>No open incidents</h2>
            <p className="small muted">The board is clear. Switch to All to read past incidents.</p>
          </aside>
        )}
      </div>

      <div className="legend-row small muted">
        <span>Severity order: {SEVERITIES.slice().sort((a, b) => severityRank(a) - severityRank(b)).join(" > ")}</span>
        <span className="dot-sep">·</span>
        <span>Escalation clock starts when the incident opens, not when it is acknowledged</span>
        <span className="dot-sep">·</span>
        <span>Unsaved: nothing leaves the browser</span>
      </div>
    </div>
  );
}
