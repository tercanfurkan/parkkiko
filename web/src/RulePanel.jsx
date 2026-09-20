export default function RulePanel({ area, time, setTime, result }) {
  if (!area) return <div className="panel">Tap a street section.</div>;
  return (
    <div className="panel">
      <strong>{result.label}</strong>
      <div>Source: {result.source}</div>
      <div>Sign text: {area.voimassaolo ?? "-"} {area.kesto ?? ""}</div>
      <input
        type="datetime-local"
        onChange={(e) => setTime(new Date(e.target.value))}
      />
    </div>
  );
}
