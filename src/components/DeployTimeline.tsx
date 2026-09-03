import type { AppState, Action } from "../lib/state.ts";
import type { Deploy, Environment } from "../lib/types.ts";
import { formatAgo, formatClock, formatDay, formatDuration, formatMinutes, shortSha } from "../lib/format.ts";
import {
  deployStats, selectDeployFeed, selectDeployStatusCounts, selectDeploysPerService,
} from "../lib/selectors.ts";
import { KpiStrip } from "./KpiStrip.tsx";
import { DeployStatusBadge, EnvBadge } from "./badges.tsx";
import { Icon } from "./Icon.tsx";

const JSON_ENVS: (Environment | "all")[] = ["prod", "staging", "all"];
const ENV_LABEL: Record<Environment | "all", string> = {
  prod: "Production",
  staging: "Staging",
  all: "All environments",
};

function DeployRow({ deploy, serviceName, now }: { deploy: Deploy; serviceName: string; now: number }) {
  return (
    <li className={`deploy-row dp-row-${deploy.status}`}>
      <span className="deploy-rail">
        <span className={`deploy-dot ${deploy.status}`} />
      </span>
      <div className="deploy-main">
        <div className="deploy-line">
          <span className="deploy-version">{deploy.version}</span>
          <span className="deploy-service">{serviceName}</span>
          <EnvBadge environment={deploy.environment} />
          {deploy.status === "in-progress" ? <span className="live-pill"><span className="dot pulse" /> live</span> : null}
          {deploy.rollbackOf ? (
            <span className="rollback-chip"><Icon name="rollback" size={11} /> rollback of {deploy.rollbackOf}</span>
          ) : null}
        </div>
        <div className="deploy-meta">
          {deploy.actor}
          <span className="dot-sep">·</span>
          <span className="mono">{shortSha(deploy.commit)}</span>
          <span className="dot-sep">·</span>
          {deploy.status === "in-progress" ? "running" : formatDuration(deploy.durationSec)}
          {deploy.note ? (
            <>
              <span className="dot-sep">·</span>
              <span className="deploy-note">{deploy.note}</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="deploy-side">
        <DeployStatusBadge status={deploy.status} />
        <span className="deploy-time mono">{formatClock(deploy.at)}</span>
        <span className="small muted">{formatAgo(deploy.at, now)}</span>
      </div>
    </li>
  );
}

export function DeployTimeline({ state, dispatch }: { state: AppState; dispatch: (action: Action) => void }) {
  const feed = selectDeployFeed(state);
  const stats = deployStats(feed);
  const perService = selectDeploysPerService(state);
  const statusCounts = selectDeployStatusCounts(feed);
  const maxService = Math.max(1, ...perService.map((row) => row.count));
  const markers = state.deploys
    .filter((deploy) => deploy.status === "rolled-back" || deploy.rollbackOf)
    .sort((a, b) => b.at - a.at);

  const groups = new Map<string, Deploy[]>();
  for (const deploy of feed) {
    const label = formatDay(deploy.at, state.now);
    const rows = groups.get(label) ?? [];
    rows.push(deploy);
    groups.set(label, rows);
  }

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">Change log</div>
          <p className="lede">
            Every rollout in the last three days, newest first. A rollback is a deploy
            of its own, so the timeline shows the bad release and the deploy that
            replaced it, not a single row that quietly changes colour.
          </p>
        </div>
        <span className="spacer" />
        <div className="head-actions">
          <span className="badge">{formatClock(state.now)} UTC</span>
          <span className="badge green">{stats.inProgress} in progress</span>
        </div>
      </div>

      <KpiStrip
        items={[
          { label: "Deploys shown", value: String(stats.total), hint: `${ENV_LABEL[state.filters.environment].toLowerCase()} filter`, tone: "blue" },
          { label: "Success rate", value: stats.successRate === null ? "n/a" : `${Math.round(stats.successRate * 100)}%`, hint: `${stats.finished} finished deploys`, tone: "green" },
          { label: "Rollbacks", value: String(stats.rolledBack), hint: "finished deploys rolled back", tone: stats.rolledBack > 0 ? "red" : "green" },
          { label: "Median duration", value: stats.medianDurationSec === null ? "n/a" : formatDuration(stats.medianDurationSec), hint: "time from start to green", tone: "" },
          { label: "Failed", value: String(stats.failed), hint: "never took traffic", tone: stats.failed > 0 ? "gold" : "green" },
        ]}
      />

      <div className="deploy-grid">
        <section className="card deploy-card">
          <div className="card-head">
            <div>
              <div className="card-title">Deploy timeline</div>
              <div className="card-sub">Rail colour is the outcome. Rolled back releases show the replacement deploy.</div>
            </div>
            <span className="spacer" />
            <div className="status-toggle" role="group" aria-label="Filter by environment">
              {JSON_ENVS.map((environment) => (
                <button
                  key={environment}
                  type="button"
                  className={`toggle-btn${state.filters.environment === environment ? " active" : ""}`}
                  aria-pressed={state.filters.environment === environment}
                  onClick={() => dispatch({ type: "setFilters", patch: { environment } })}
                >
                  {environment === "all" ? "All" : ENV_LABEL[environment]}
                </button>
              ))}
            </div>
          </div>

          <div className="deploy-scroll">
            {[...groups.entries()].map(([day, deploys]) => (
              <div className="day-group" key={day}>
                <div className="day-label">
                  <span>{day}</span>
                  <span className="small muted">{deploys.length} {deploys.length === 1 ? "deploy" : "deploys"}</span>
                </div>
                <ol className="deploy-list">
                  {deploys.map((deploy) => (
                    <DeployRow
                      key={deploy.id}
                      deploy={deploy}
                      serviceName={state.services.find((service) => service.id === deploy.serviceId)?.name ?? deploy.serviceId}
                      now={state.now}
                    />
                  ))}
                </ol>
              </div>
            ))}
            {feed.length === 0 ? (
              <div className="empty">
                <strong>No deploys in this environment</strong>
                <span>Switch back to production to see the last three days.</span>
              </div>
            ) : null}
          </div>
        </section>

        <div className="col" style={{ gap: 14 }}>
          <section className="card">
            <div className="card-head">
              <div className="card-title">Deploy health</div>
              <span className="spacer" />
              <span className="small muted">filtered view</span>
            </div>
            <dl className="kv">
              <dt>Finished</dt><dd className="mono">{stats.finished}</dd>
              <dt>Succeeded</dt><dd className="mono">{stats.succeeded}</dd>
              <dt>Failed</dt><dd className="mono">{stats.failed}</dd>
              <dt>Rolled back</dt><dd className="mono">{stats.rolledBack}</dd>
              <dt>In progress</dt><dd className="mono">{stats.inProgress}</dd>
              <dt>Median</dt><dd className="mono">{stats.medianDurationSec === null ? "n/a" : formatDuration(stats.medianDurationSec)}</dd>
            </dl>
            <div className="divider" />
            <div className="status-mix">
              {statusCounts.map((row) => (
                <span className={`status-mix-item dp-text-${row.status}`} key={row.status}>
                  {row.count} {row.status.replace("-", " ")}
                </span>
              ))}
            </div>
            <div className="divider" />
            <div className="row" style={{ marginBottom: 7 }}>
              <span className="small strong">Rollback markers</span>
              <span className="spacer" />
              <span className="badge red">{markers.length}</span>
            </div>
            <div className="marker-list">
              {markers.map((deploy) => (
                <div className="marker" key={deploy.id}>
                  <Icon name="rollback" size={13} />
                  <div>
                    <div className="small strong">
                      {deploy.rollbackOf ? `${deploy.serviceId} replaced ${deploy.rollbackOf}` : `${deploy.version} rolled back`}
                    </div>
                    <div className="small muted">
                      {formatAgo(deploy.at, state.now)} · {deploy.note ?? "no note recorded"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <div className="card-title">Last 24 hours by service</div>
              <span className="spacer" />
              <span className="small muted">deploys</span>
            </div>
            <div className="service-bars">
              {perService.map((row) => (
                <div className="service-bar" key={row.service.id}>
                  <span className="service-bar-name">{row.service.name}</span>
                  <span className="service-bar-track">
                    <span
                      className={`service-bar-fill${row.failed > 0 ? " has-failure" : ""}`}
                      style={{ width: `${(row.count / maxService) * 100}%` }}
                    />
                  </span>
                  {row.failed > 0 ? <span className="badge red">{row.failed}</span> : null}
                  <span className="mono small muted service-bar-count">{row.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
