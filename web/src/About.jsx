/* global __COMMIT__ */
const REPO = "https://github.com/tercanfurkan/parkkiko";

export default function About({ onClose }) {
  return (
    <div className="about-backdrop" onClick={onClose}>
      <div className="about" role="dialog" aria-label="About Parkkiko" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
        <h2>Parkkiko</h2>
        <p>May I park here, and until when? Tap a street section and Parkkiko turns Helsinki's street parking rules into a plain answer for right now.</p>
        <p>It shows the city's rule, not permission. When the data cannot say, it tells you to check the sign, and the sign on the street always wins.</p>
        <p>Rules: City of Helsinki open data, CC BY 4.0. Map: © OpenStreetMap contributors. A University of Helsinki Introduction to Data Science mini-project.</p>
        <p className="version">
          Version <a href={`${REPO}/commit/${__COMMIT__}`} target="_blank" rel="noreferrer">{__COMMIT__}</a> · <a href={REPO} target="_blank" rel="noreferrer">Source</a>
        </p>
      </div>
    </div>
  );
}
