export interface KpiItem {
  label: string;
  value: string;
  hint: string;
  tone?: "gold" | "green" | "red" | "blue" | "";
}

export function KpiStrip({ items }: { items: KpiItem[] }) {
  return (
    <div className="kpi-strip">
      {items.map((item) => (
        <div className={`card kpi kpi-${item.tone || "plain"}`} key={item.label}>
          <div className="stat-label">{item.label}</div>
          <div className="stat-value kpi-value">{item.value}</div>
          <div className="small muted">{item.hint}</div>
        </div>
      ))}
    </div>
  );
}
