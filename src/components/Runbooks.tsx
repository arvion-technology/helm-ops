import { useEffect } from "react";
import type { AppState, Action } from "../lib/state.ts";
import { formatAgo, formatDate } from "../lib/format.ts";
import {
  selectRunbookMatches, selectSelectedRunbook, selectTagCounts,
} from "../lib/selectors.ts";
import { KpiStrip } from "./KpiStrip.tsx";
import { Icon } from "./Icon.tsx";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${tokens.map(escapeRegExp).join("|")})`, "gi");
  return (
    <>
      {text.split(pattern).map((part, index) => (
        tokens.includes(part.toLowerCase())
          ? <mark key={index}>{part}</mark>
          : <span key={index}>{part}</span>
      ))}
    </>
  );
}

export function Runbooks({ state, dispatch }: { state: AppState; dispatch: (action: Action) => void }) {
  const matches = selectRunbookMatches(state);
  const selected = selectSelectedRunbook(state);
  const tags = selectTagCounts(state.runbooks).slice(0, 7);
  const query = state.runbookQuery;
  const latest = state.runbooks.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;

  // When a search narrows the list, keep the detail panel on a visible runbook.
  useEffect(() => {
    if (!query) return;
    if (matches.length === 0) return;
    if (!matches.some((match) => match.runbook.id === state.selectedRunbookId)) {
      dispatch({ type: "selectRunbook", id: matches[0]?.runbook.id ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, matches.length]);

  const relatedIncidents = selected
    ? state.incidents.filter(
      (incident) => incident.serviceId === selected.serviceId && incident.status !== "resolved",
    )
    : [];

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <div className="eyebrow">Operations handbook</div>
          <p className="lede">
            The steps that were written before the incident, not during it. Search covers
            titles, tags, service names and step text, and every runbook is one click
            from the incident it belongs to.
          </p>
        </div>
        <span className="spacer" />
        <div className="head-actions">
          <span className="badge">{state.runbooks.length} runbooks</span>
          {latest ? <span className="badge gold">updated {formatAgo(latest.updatedAt, state.now)}</span> : null}
        </div>
      </div>

      <KpiStrip
        items={[
          { label: "Runbooks", value: String(state.runbooks.length), hint: "one per recurring failure", tone: "blue" },
          { label: "Matching search", value: String(matches.length), hint: query ? `query "${query}"` : "no query applied", tone: query ? "gold" : "" },
          { label: "Tags", value: String(selectTagCounts(state.runbooks).length), hint: "payments, database, edge and more", tone: "" },
          { label: "Latest update", value: latest ? formatAgo(latest.updatedAt, state.now) : "n/a", hint: latest ? latest.title : "no runbooks", tone: "green" },
        ]}
      />

      <div className="runbook-grid">
        <section className="card runbook-list-card">
          <div className="card-head">
            <div>
              <div className="card-title">Runbooks</div>
              <div className="card-sub">{matches.length} shown, ranked by where the query matched.</div>
            </div>
          </div>
          <div className="search" style={{ marginBottom: 10 }}>
            <input
              className="input"
              placeholder="Search runbooks, tags, steps"
              aria-label="Search runbooks"
              value={query}
              onChange={(event) => dispatch({ type: "setRunbookQuery", query: event.target.value })}
            />
          </div>
          <div className="tag-row">
            {tags.map((tag) => (
              <button
                key={tag.tag}
                type="button"
                className={`tag-chip${query === tag.tag ? " active" : ""}`}
                onClick={() => dispatch({ type: "setRunbookQuery", query: query === tag.tag ? "" : tag.tag })}
              >
                {tag.tag}<span className="tag-count">{tag.count}</span>
              </button>
            ))}
          </div>
          <div className="runbook-rows">
            {matches.map((match) => (
              <button
                key={match.runbook.id}
                type="button"
                className={`runbook-row${selected?.id === match.runbook.id ? " selected" : ""}`}
                onClick={() => dispatch({ type: "selectRunbook", id: match.runbook.id })}
                aria-pressed={selected?.id === match.runbook.id}
              >
                <span className="runbook-row-icon"><Icon name="book" size={14} /></span>
                <span className="runbook-row-main">
                  <span className="runbook-row-title">
                    <Highlight text={match.runbook.title} query={query} />
                  </span>
                  <span className="runbook-row-meta">
                    {state.services.find((service) => service.id === match.runbook.serviceId)?.name ?? match.runbook.serviceId}
                    <span className="dot-sep">·</span>
                    {match.runbook.steps.length} steps
                    <span className="dot-sep">·</span>
                    updated {formatDate(match.runbook.updatedAt)}
                  </span>
                </span>
                <span className="runbook-row-side">
                  {match.score > 0 ? <span className="badge gold">score {match.score}</span> : null}
                  <span className="runbook-row-owner small muted">{match.runbook.owner}</span>
                </span>
              </button>
            ))}
            {matches.length === 0 ? (
              <div className="empty">
                <strong>Nothing matches "{query}"</strong>
                <span>Try a service name, a tag such as database, or clear the search.</span>
                <button type="button" className="btn sm mt-2" onClick={() => dispatch({ type: "setRunbookQuery", query: "" })}>
                  Clear search
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card runbook-detail-card">
          {selected ? (
            <>
              <div className="card-head">
                <div>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>
                    {state.services.find((service) => service.id === selected.serviceId)?.name ?? selected.serviceId}
                  </div>
                  <h2 className="runbook-title">
                    <Highlight text={selected.title} query={query} />
                  </h2>
                </div>
                <span className="spacer" />
                <span className="badge">{selected.steps.length} steps</span>
              </div>
              <div className="runbook-meta-row">
                <span className="small muted">Owner {selected.owner}</span>
                <span className="dot-sep">·</span>
                <span className="small muted">Updated {formatDate(selected.updatedAt)}</span>
                <span className="spacer" />
                <span className="tag-row">
                  {selected.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="tag-chip"
                      onClick={() => dispatch({ type: "setRunbookQuery", query: tag })}
                    >
                      {tag}
                    </button>
                  ))}
                </span>
              </div>

              <ol className="steps">
                {selected.steps.map((step, index) => (
                  <li className="step-row" key={step}>
                    <span className="step-number">{index + 1}</span>
                    <span className="step-text">
                      <Highlight text={step} query={query} />
                    </span>
                  </li>
                ))}
              </ol>

              <div className="divider" />
              <div className="related">
                <div className="row" style={{ marginBottom: 8 }}>
                  <span className="small strong">Open incidents on this service</span>
                  <span className="spacer" />
                  <span className="badge">{relatedIncidents.length}</span>
                </div>
                {relatedIncidents.length === 0 ? (
                  <p className="small muted" style={{ margin: 0 }}>
                    None open right now. Keep the runbook warm anyway.
                  </p>
                ) : relatedIncidents.map((incident) => (
                  <button
                    key={incident.id}
                    type="button"
                    className="related-row"
                    onClick={() => {
                      dispatch({ type: "selectIncident", id: incident.id });
                      dispatch({ type: "setTab", tab: "incidents" });
                    }}
                  >
                    <span className={`sev-pill sev-${incident.severity.slice(-1)}`}>{incident.severity}</span>
                    <span className="small">{incident.title}</span>
                    <span className="spacer" />
                    <span className="small muted mono">{incident.id}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="empty">
              <strong>No runbook selected</strong>
              <span>Pick one from the list.</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
