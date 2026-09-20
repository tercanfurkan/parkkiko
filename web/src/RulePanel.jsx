const LABELS = {
  paid: "Paid parking", free_limited: "Free, time limited", banned_hours: "Banned at times",
  always_banned: "No parking", reserved: "Reserved space", unknown: "Unknown",
};

export default function RulePanel({ area, setTime, result }) {
  if (!area) return <div className="panel">Tap a street section to see its rule.</div>;
  return (
    <div className="panel">
      <strong>{LABELS[area.rule_type] ?? area.rule_type}</strong>
      <div>{result.label}</div>
      {area.status !== "official" && <div className="warn">Not certain: {area.reason}</div>}
      {area.extra_info && <div>Sign note: {area.extra_info}</div>}
      <input type="datetime-local" onChange={(e) => setTime(new Date(e.target.value))} />
    </div>
  );
}
