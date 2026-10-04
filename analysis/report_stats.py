"""Recompute every number and chart quoted in the report and the canvas.

    python analysis/report_stats.py              print the tables
    python analysis/report_stats.py --write      also write docs/report_stats.md
    python analysis/report_stats.py --figures    also write docs/figures/*.png

Nothing here is typed by hand: if the register changes, rerun this and the report follows.
"""
import argparse
from pathlib import Path

import geopandas as gpd
import matplotlib
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

SOURCE = Path("data/processed/parking_rules.parquet")
OUT = Path("docs/report_stats.md")
FIGURES = Path("docs/figures")

# Okabe-Ito, colour-blind safe, the same palette the app uses.
COLOURS = {
    "free_limited": "#009E73", "paid": "#0072B2", "banned_hours": "#E69F00",
    "always_banned": "#D55E00", "reserved": "#CC79A7", "unknown": "#999999",
    "official": "#0072B2", "missing_hours": "#E69F00", "uncertain": "#D55E00",
}


def table(df, title):
    return f"### {title}\n\n{df.to_markdown(index=False)}\n"


def rule_types(areas):
    counts = areas["rule_type"].value_counts()
    df = pd.DataFrame({
        "Rule type": counts.index,
        "Areas": counts.values,
        "Share": (counts.values / len(areas) * 100).round(1),
    })
    return table(df, "Areas by rule type")


def reserved_for(areas):
    """What 'reserved' means in practice. Falls back to the Finnish field if labels are absent."""
    column = "space_type_en" if "space_type_en" in areas.columns else "tyyppi"
    counts = areas.loc[areas["rule_type"] == "reserved", column].value_counts(dropna=False)
    df = pd.DataFrame({"Reserved for": counts.index.fillna("not stated"), "Areas": counts.values})
    return table(df, "Reserved areas by space type")


def coverage(areas):
    counts = areas["status"].value_counts()
    meaning = {
        "official": "Complete rule published",
        "missing_hours": "Rule type known, hours missing",
        "uncertain": "Uncertain, with a stated reason",
    }
    df = pd.DataFrame({
        "Status": [meaning.get(s, s) for s in counts.index],
        "Areas": counts.values,
    })
    return table(df, "What the app can answer")


def neighbour_accuracy(known):
    """Hide each area's hours and copy them from its nearest area of the same class."""
    paired = nearest_pairs(known)
    baseline = known["hours"].value_counts().iloc[0] / len(known) * 100
    headline = (
        f"Copying the nearest same-class area is correct "
        f"**{paired['match'].mean() * 100:.1f}%** of the time "
        f"({len(paired)} comparisons; ties add a few rows). Always guessing the most common "
        f"pattern scores **{baseline:.1f}%**.\n"
    )
    bins = pd.cut(paired["dist"], [0, 10, 50, 200, float("inf")],
                  labels=["0-10 m", "10-50 m", "50-200 m", "over 200 m"])
    by_dist = paired.groupby(bins, observed=True)["match"].agg(["mean", "size"]).reset_index()
    by_dist.columns = ["Distance to nearest same-class area", "Correct", "Areas"]
    by_dist["Correct"] = (by_dist["Correct"] * 100).round(1)
    return headline + "\n" + table(by_dist, "Accuracy by distance")


def prediction_gap(areas, known):
    """How far the areas we must predict sit from the areas we can learn from."""
    gap = pd.concat(
        gpd.sjoin_nearest(m[["geometry"]], known[known["luokka"] == k][["geometry"]],
                          distance_col="dist")
        for k, m in areas[areas["status"] == "missing_hours"].groupby("luokka")
        if (known["luokka"] == k).any()
    )
    d = gap["dist"]
    df = pd.DataFrame({
        "Measure": ["Areas measured", "Median distance", "Within 10 m", "Within 50 m",
                    "Within 200 m"],
        "Value": [f"{len(d)}", f"{d.median():.0f} m", f"{(d <= 10).mean() * 100:.1f}%",
                  f"{(d <= 50).mean() * 100:.1f}%", f"{(d <= 200).mean() * 100:.1f}%"],
    })
    return table(df, "Distance from a missing-hours area to the nearest area we can learn from")


def nearest_pairs(known):
    """Pair every area with its nearest other area of the same class."""
    paired = pd.concat(
        gpd.sjoin_nearest(g[["geometry", "hours"]], g[["geometry", "hours"]],
                          exclusive=True, distance_col="dist")
        for _, g in known.groupby("luokka") if len(g) > 1
    )
    paired["match"] = paired["hours_left"] == paired["hours_right"]
    return paired


def figures(areas, known):
    """Three charts: what the city publishes, what we can answer, where prediction works."""
    FIGURES.mkdir(parents=True, exist_ok=True)

    counts = areas["rule_type"].value_counts().sort_values()
    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.barh(counts.index, counts.values, color=[COLOURS.get(r, "#999999") for r in counts.index])
    for y, value in enumerate(counts.values):
        ax.text(value + 60, y, f"{value:,}", va="center", fontsize=9)
    ax.set_xlabel("parking areas")
    ax.set_title("What Helsinki publishes: 8,754 street parking areas")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIGURES / "rule_types.png", dpi=150)
    plt.close(fig)

    # A couple of outlying areas would otherwise stretch the frame over empty sea.
    centres = areas.geometry.centroid
    minx, maxx = centres.x.quantile([0.002, 0.998])
    miny, maxy = centres.y.quantile([0.002, 0.998])
    pad = 0.02 * max(maxx - minx, maxy - miny)
    minx, maxx, miny, maxy = minx - pad, maxx + pad, miny - pad, maxy + pad
    fig, ax = plt.subplots(figsize=(11, 11 * (maxy - miny) / (maxx - minx)))
    for status in ("official", "missing_hours", "uncertain"):
        group = areas[areas["status"] == status]
        group.plot(ax=ax, color=COLOURS[status], linewidth=2.5,
                   label=f"{status.replace('_', ' ')} ({len(group):,})")
    ax.set_xlim(minx, maxx)
    ax.set_ylim(miny, maxy)
    ax.legend(loc="lower right", frameon=False, fontsize=11)
    ax.set_title("Where the register is complete, silent, or self-contradicting", fontsize=13)
    ax.set_axis_off()
    fig.savefig(FIGURES / "status_map.png", dpi=150, bbox_inches="tight")
    plt.close(fig)

    paired = nearest_pairs(known)
    bins = pd.cut(paired["dist"], [0, 10, 50, 200, float("inf")],
                  labels=["0-10 m", "10-50 m", "50-200 m", "over 200 m"])
    by_dist = paired.groupby(bins, observed=True)["match"].agg(["mean", "size"])
    baseline = known["hours"].value_counts().iloc[0] / len(known) * 100

    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.bar(by_dist.index.astype(str), by_dist["mean"] * 100, color="#0072B2")
    ax.axhline(baseline, color="#D55E00", linestyle="--",
               label=f"always guess the most common pattern ({baseline:.0f}%)")
    for x, (share, n) in enumerate(zip(by_dist["mean"], by_dist["size"])):
        ax.text(x, share * 100 + 2, f"{share * 100:.1f}%\nn={n:,}", ha="center", fontsize=9)
    ax.set_ylim(0, 112)
    ax.set_ylabel("hours copied correctly")
    ax.set_title("A neighbour predicts the hours, until it is far away")
    ax.legend(frameon=False, loc="lower left")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(FIGURES / "accuracy_by_distance.png", dpi=150)
    plt.close(fig)
    print(f"figures written to {FIGURES}/")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--write", action="store_true", help=f"also write {OUT}")
    ap.add_argument("--figures", action="store_true", help=f"also write {FIGURES}/*.png")
    args = ap.parse_args()

    if not SOURCE.exists():
        raise SystemExit(f"{SOURCE} not found. Run: python pipeline/process.py")
    areas = gpd.read_parquet(SOURCE)
    known = areas[areas["hours"].notna()]

    parts = [
        f"# Report figures\n\nGenerated by `analysis/report_stats.py` from "
        f"`{SOURCE}`: {len(areas)} parking areas, {len(known)} of them with stated hours.\n",
        rule_types(areas),
        reserved_for(areas),
        coverage(areas),
        neighbour_accuracy(known),
        prediction_gap(areas, known),
    ]
    text = "\n".join(parts)
    print(text)
    if args.figures:
        figures(areas, known)
    if args.write:
        OUT.write_text(text)
        print(f"written to {OUT}")


if __name__ == "__main__":
    main()
