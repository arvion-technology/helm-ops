import type { AppState, Action } from "../lib/state.ts";
import type { Severity } from "../lib/types.ts";
import { formatAgo, formatDate, formatIn, formatMinutes, initials } from "../lib/format.ts";
import {
  selectActiveEscalations, selectCurrentOnCall, selectHandoffs, selectServiceStatus,
} from "../lib/selectors.ts";
import { KpiStrip } from "./KpiStrip.tsx";
import { Avatar, StatusBadge } from "./badges.tsx";
import { Icon } from "./Icon.tsx";

const LADDER_ORDER: Severity[] = ["SEV1", "SEV2", "SEV3", "SEV4"];

export function OnCallRoster({ state, dispatch }: { state: AppState; dispatch: (action: Action) => void }) {
  const rows = selectCurrentOnCall(state);
  const handoffs = selectHandoffs(state);
  const escalations = selectActiveEscalations(state);
  const serviceStatus = selectServiceStatus(state);
  const covered = rows.filter((row) => row.primary !== null).length;
  const nextHandoff = handoffs[0] ?? null;

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">Rotation</div>
          <p className="lede">
            One primary and one secondary per service, rotating on Sunday at 00:00 UTC.
            The escalation clock under each incident starts when it opens, which is
            deliberately stricter than starting it when someone acknowledges.
          </p>
        </div>
        <span className="spacer" />
        <div className="head-actions">
          <span className="badge green">{covered}/{rows.length} covered</span>
          <span className="badge">{escalations.length} SEV1/2 active</span>
        </div>
      </div>

      <KpiStrip
        items={[
          { label: "Services covered", value: `${covered}/${rows.length}`, hint: "primary on call right now", tone: covered === rows.length ? "green" : "red" },
          { label: "Next handoff", value: nextHandoff ? `${formatIn(nextHandoff.startsAt, state.now)}` : "n/a", hint: nextHandoff ? `${nextHandoff.person} takes ${nextHandoff.service.name}` : "no scheduled shift", tone: "blue" },
          { label: "Active escalations", value: String(escalations.length), hint: "unresolved SEV1 and SEV2", tone: escalations.length > 0 ? "gold" : "green" },
          { label: "Rotation", value: "Weekly", hint: "Sunday 00:00 UTC, no overrides in this demo", tone: "" },
        ]}
      />

      <div className="oncall-grid">
        <section className="card">
          <div className="card-head">
            <div>
              <div className="card-title">On call now</div>
              <div className="card-sub">Primary is paged first; secondary is the safety net.</div>
            </div>
            <span className="spacer" />
            <span className="badge">{formatDate(state.now)}</span>
          </div>
          <div className="oncall-cards">
            {rows.map((row) => {
              const status = serviceStatus.find((entry) => entry.service.id === row.service.id);
              return (
                <div className="oncall-card" key={row.service.id}>
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="strong">{row.service.name}</span>
                    <span className="badge">{row.service.owner}</span>
                    <span className="spacer" />
                    {status?.worstSeverity ? (
                      <span className={`sev-pill sev-${status.worstSeverity.slice(-1)}`}>{status.worstSeverity}</span>
                    ) : (
                      <span className="badge green">clear</span>
                    )}
                  </div>
                  <div className="oncall-person">
                    <Avatar name={row.primary?.person ?? "Unassigned"} />
                    <div>
                      <div className="small strong">{row.primary?.person ?? "unassigned"}</div>
                      <div className="small muted">primary · ends {row.endsAt ? formatDate(row.endsAt) : "n/a"}</div>
                    </div>
                    <span className="spacer" />
                    <span className="small muted">{row.endsAt ? formatIn(row.endsAt, state.now) : ""}</span>
                  </div>
                  <div className="oncall-person secondary">
                    <span className="avatar avatar-sm ghost-avatar">{row.secondary ? initials(row.secondary.person) : "?"}</span>
                    <div>
                      <div className="small">{row.secondary?.person ?? "unassigned"}</div>
                      <div className="small muted">secondary · escalation after 5m on SEV1</div>
                    </div>
                  </div>
                  <div className="oncall-foot">
                    <span className="small muted">
                      {status?.openIncidents ? `${status.openIncidents} open incident` : "no open incidents"}
                    </span>
                    <span className="spacer" />
                    <span className="small muted mono">
                      {status?.lastDeploy ? `last ${status.lastDeploy.version}` : "no deploys"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="col" style={{ gap: 14 }}>
          <section className="card">
            <div className="card-head">
              <div className="card-title">Escalation policy</div>
            </div>
            <div className="ladders">
              {LADDER_ORDER.map((severity) => (
                <div className="ladder" key={severity}>
                  <div className="row" style={{ marginBottom: 5 }}>
                    <span className={`sev-pill sev-${severity.slice(-1)}`}>{severity}</span>
                    <span className="spacer" />
                    <span className="small muted">
                      {state.incidents.filter((incident) => incident.severity === severity && incident.status !== "resolved").length} open
                    </span>
                  </div>
                  <div className="ladder-steps">
                    {state.roster.escalation[severity].map((step, index) => (
                      <span className="ladder-step" key={`${severity}-${step.afterMinutes}`}>
                        <b>{step.afterMinutes}m</b> {step.role}
                        {index === 0 ? <span className="ladder-channel">{step.channel}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-title">Handoffs</div>
              <span className="spacer" />
              <span className="small muted">next five</span>
            </div>
            <div className="handoff-list">
              {handoffs.map((handoff) => (
                <div className="handoff" key={`${handoff.service.id}-${handoff.startsAt}`}>
                  <div className="handoff-when">
                    <span className="mono small">{formatDate(handoff.startsAt)}</span>
                    <span className="small muted">{formatIn(handoff.startsAt, state.now)}</span>
                  </div>
                  <Avatar name={handoff.person} />
                  <div style={{ minWidth: 0 }}>
                    <div className="small strong">{handoff.person}</div>
                    <div className="small muted">{handoff.service.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <section className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <div>
            <div className="card-title">Escalation clocks</div>
            <div className="card-sub">Where each active SEV1 and SEV2 sits on its ladder.</div>
          </div>
          <span className="spacer" />
          <span className="badge gold">{escalations.length} tracked</span>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Incident</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Primary</th>
                <th>Open for</th>
                <th>Current step</th>
                <th>Next escalation</th>
              </tr>
            </thead>
            <tbody>
              {escalations.map((row) => (
                <tr
                  key={row.incident.id}
                  className="clickable-row"
                  onClick={() => {
                    dispatch({ type: "selectIncident", id: row.incident.id });
                    dispatch({ type: "setTab", tab: "incidents" });
                  }}
                >
                  <td>
                    <div className="strong small">{row.incident.title}</div>
                    <div className="small muted mono">{row.incident.id}</div>
                  </td>
                  <td><span className={`sev-pill sev-${row.incident.severity.slice(-1)}`}>{row.incident.severity}</span></td>
                  <td><StatusBadge status={row.incident.status} /></td>
                  <td>{row.primary ?? "unassigned"}</td>
                  <td className="mono small">{formatMinutes(row.hint.minutesOpen)}</td>
                  <td className="small">{row.hint.current.role}</td>
                  <td>
                    {row.hint.next && row.hint.nextAt ? (
                      <span className={`badge ${row.hint.next.afterMinutes - row.hint.minutesOpen <= 2 ? "red" : "gold"}`}>
                        <Icon name="clock" size={11} />
                        {row.hint.next.role} {formatIn(row.hint.nextAt, state.now)}
                      </span>
                    ) : (
                      <span className="badge red">all steps paged</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="small muted" style={{ marginTop: 10 }}>
          Clicking a row opens that incident on the board. Clock started {formatAgo(
            Math.min(...escalations.map((row) => row.incident.openedAt), state.now),
            state.now,
          )} for the oldest one.
        </div>
      </section>
    </div>
  );
}
