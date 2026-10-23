"""Recompute every number and chart quoted in the report and the canvas.

    python analysis/report_stats.py              print the tables
    python analysis/report_stats.py --write      also write docs/report_stats.md
    python analysis/report_stats.py --figures    also write docs/figures/*.png

Nothing here is typed by hand: if the register changes, rerun this and the report follows.
"""
import argparse
import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

SOURCE = Path("data/processed/parking_rules.parquet")
OUT = Path("docs/report_stats.md")
FIGURES = Path("docs/figures")

# Okabe-Ito, colour-blind safe. RULE_COLOURS mirrors web/src/style.js, so if you recolour the
# map, recolour it there too. STATUS_COLOURS are deliberately different hues: a reader who has
# seen the app should not read the status map's orange as "banned at times".
RULE_COLOURS = {
    "free_limited": "#009E73", "paid": "#0072B2", "banned_hours": "#E69F00",
    "always_banned": "#D55E00", "reserved": "#CC79A7", "unknown": "#999999",
}
STATUS_COLOURS = {"official": "#56B4E9", "missing_hours": "#F0E442", "uncertain": "#CC79A7"}
STATUS_MEANING = {
    "official": "Complete rule published",
    "missing_hours": "Rule type known, hours missing",
    "uncertain": "Uncertain, with a stated reason",
}
RAW_FIELDS = {"voimassaolo": "Hours", "kesto": "Time limit", "kausi": "Season",
              "tyyppi": "Space type", "lisatieto": "Free-text note"}
DISTANCE_BINS = [0, 10, 50, 200, float("inf")]
DISTANCE_LABELS = ["0-10 m", "10-50 m", "50-200 m", "over 200 m"]


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
    """What 'reserved' means in practice, in the words the documents display.

    "not stated" stays its own row: folding it into an "other" bucket would hide the very
    distinction this project is about.
    """
    labels = areas.loc[areas["rule_type"] == "reserved", "space_type_en"]
    counts = labels.fillna("not stated").value_counts()
    df = pd.DataFrame({"Reserved for": counts.index, "Areas": counts.values})
    return table(df, "Reserved areas by space type")


def coverage(areas):
    counts = areas["status"].value_counts()
    df = pd.DataFrame({
        "Status": [STATUS_MEANING.get(s, s) for s in counts.index],
        "Areas": counts.values,
    })
    return table(df, "What the app can answer")


def readable(value):
    """'{"mon_fri": [9, 21]}' as 'mon_fri 9-21', so a table shows the rule and not its storage."""
    if not isinstance(value, str) or not value.startswith("{"):
        return value
    rule = json.loads(value)
    if "start" in rule:
        (m1, d1), (m2, d2) = rule["start"], rule["end"]
        return f"{d1}.{m1}.-{d2}.{m2}."
    return ", ".join(f"{window} {a}-{b}" for window, (a, b) in rule.items())


def summary_statistics(areas):
    """The typical value of every variable: the mode of a category, the median of a number.

    Missing stays its own column. For hours and the time limit it is not noise to drop: it is the
    gap the learning task exists to close.
    """
    rows = []
    categorical = {
        "Rule type": areas["rule_type"], "Status": areas["status"],
        "Space type": areas["space_type_en"], "District": areas["district"],
        "Hours": areas["hours"], "Season": areas["season"],
    }
    for name, col in categorical.items():
        counts = col.value_counts()
        rows.append({
            "Variable": name, "Typical value": readable(counts.index[0]),
            "Share of stated": f"{counts.iloc[0] / counts.sum() * 100:.1f}%",
            "Distinct": col.nunique(), "Missing": col.isna().sum(),
        })
    numeric = {"Time limit, minutes": areas["duration_min"], "Area, m²": areas.geometry.area}
    for name, col in numeric.items():
        q1, median, q3 = col.quantile([0.25, 0.5, 0.75])
        rows.append({
            "Variable": name, "Typical value": f"{median:.0f} (middle half {q1:.0f}-{q3:.0f})",
            "Share of stated": "", "Distinct": "", "Missing": col.isna().sum(),
        })
    return table(pd.DataFrame(rows), "Summary statistics: mode or median of each variable")


def duration_label(minutes):
    if pd.isna(minutes):
        return "none stated"
    if minutes == 0:
        return "no limit, stated"
    return f"{minutes / 60:g} h" if minutes >= 60 else f"{minutes:.0f} min"


def duration_by_rule_type(areas):
    """Which time limits go with which rule. Only paid and free-limited areas should carry one."""
    labels = areas["duration_min"].map(duration_label)
    order = sorted(labels.unique(), key=lambda l: areas.loc[labels == l, "duration_min"].fillna(-1).iloc[0])
    df = pd.crosstab(labels, areas["rule_type"]).reindex(order)
    df.index.name = "Time limit"
    return table(df.reset_index(), "Time limit against rule type")


def size_bounds(areas):
    """Each area's size in m², and the outlier bounds: the interquartile rule on log10 of the size.

    Sizes span three orders of magnitude, so on the raw scale every large polygon would be an
    outlier and no small one could be.
    """
    size = areas.geometry.area
    q1, q3 = np.log10(size).quantile([0.25, 0.75])
    spread = 1.5 * (q3 - q1)
    return size, 10 ** (q1 - spread), 10 ** (q3 + spread)


def large_overlaps(areas):
    """The large outliers, and each (area, large outlier) pair that intersects.

    A large polygon lying over a smaller one decides what a tap there selects.
    """
    size, _, high = size_bounds(areas)
    large = areas[size > high]
    pairs = gpd.sjoin(areas[["id", "geometry"]], large[["id", "geometry"]], predicate="intersects")
    return large, pairs[pairs["id_left"] != pairs["id_right"]]


def area_outliers(areas):
    """Polygon sizes, the outliers by size_bounds(), and how many large ones overlap an area."""
    size, low, high = size_bounds(areas)
    summary = pd.DataFrame({
        "Measure": ["Median area", "Smallest", "Largest", "Outlier bounds",
                    "Below the lower bound", "Above the upper bound"],
        "Value": [f"{size.median():.0f} m²", f"{size.min():.1f} m²", f"{size.max():,.0f} m²",
                  f"{low:.1f} to {high:,.0f} m²", f"{(size < low).sum()}", f"{(size > high).sum()}"],
    })
    sized = areas.assign(size=size)
    picked = pd.concat([sized[sized["size"] < low], sized.nlargest(5, "size")])
    examples = pd.DataFrame({
        "Id": picked["id"], "Rule type": picked["rule_type"],
        "Space type": picked["space_type_en"].fillna("not stated"),
        "District": picked["district"], "Area, m²": picked["size"].round(1),
    })
    large, overlaps = large_overlaps(areas)
    note = (f"{overlaps['id_right'].nunique()} of the {len(large)} large outliers overlap another "
            f"area, {overlaps['id_left'].nunique()} areas in all.\n")
    return (table(summary, "Area sizes and outliers")
            + "\n" + table(examples, "The smallest outliers and the five largest areas")
            + "\n" + note)


def raw_spellings(areas):
    """How many ways the register writes each field: the work the parsers do."""
    rows = []
    for field, name in RAW_FIELDS.items():
        col = areas[field].where(areas[field].str.strip() != "")
        rows.append({"Field": f"{name} (`{field}`)", "Distinct spellings": col.nunique(),
                     "Missing or blank": col.isna().sum()})
    return table(pd.DataFrame(rows), "Distinct raw spellings per field")


def issue_codes(areas):
    """Why an area is uncertain. An area can carry more than one code, so codes outnumber areas."""
    codes = areas["issue_codes"].dropna().str.split(",").explode().value_counts()
    df = pd.DataFrame({"Issue code": codes.index, "Areas": codes.values})
    note = (f"{areas['issue_codes'].notna().sum()} uncertain areas, "
            f"{(areas['issue_codes'].str.contains(',', na=False)).sum()} with more than one code.\n")
    return table(df, "Issue codes") + "\n" + note


def accuracy_by_distance(paired):
    """Share of correct copies per distance band. Used by both the table and the chart."""
    bands = pd.cut(paired["dist"], DISTANCE_BINS, labels=DISTANCE_LABELS)
    return paired.groupby(bands, observed=True)["match"].agg(["mean", "size"])


def neighbour_accuracy(paired, by_dist, baseline):
    """Hide each area's hours and copy them from its nearest area of the same class."""
    headline = (
        f"Copying the nearest same-class area is correct "
        f"**{paired['match'].mean() * 100:.1f}%** of the time, over {len(paired):,} comparisons. "
        f"Always guessing the most common pattern scores **{baseline:.1f}%**.\n"
    )
    df = by_dist.reset_index().rename(columns={
        "dist": "Distance to nearest same-class area", "mean": "Correct", "size": "Areas"})
    df["Correct"] = (df["Correct"] * 100).round(1)
    return headline + "\n" + table(df, "Accuracy by distance")


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


def nearest_pairs(known, same_class=True):
    """Pair every area with its nearest other area: of the same class, unless same_class is False."""
    groups = known.groupby("luokka") if same_class else [(None, known)]
    paired = pd.concat(
        gpd.sjoin_nearest(g[["geometry", "hours"]], g[["geometry", "hours"]],
                          exclusive=True, distance_col="dist")
        for _, g in groups if len(g) > 1
    )
    paired["match"] = paired["hours_left"] == paired["hours_right"]
    return paired


def baseline_accuracy(known):
    """Percent correct when always guessing the most common hours pattern: the score to beat."""
    return known["hours"].value_counts().iloc[0] / len(known) * 100


# One function per chart, each returning its figure: save_figures() writes them for the report,
# and a notebook shows the same figure without writing anything.

def _pyplot():
    import matplotlib.pyplot as plt      # only the chart path needs a plotting stack
    return plt


def plot_rule_types(areas):
    """What the city publishes."""
    plt = _pyplot()
    counts = areas["rule_type"].value_counts().sort_values()
    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.barh(counts.index, counts.values, color=[RULE_COLOURS[r] for r in counts.index])
    for y, value in enumerate(counts.values):
        ax.text(value + 60, y, f"{value:,}", va="center", fontsize=9)
    ax.set_xlabel("parking areas")
    ax.set_title(f"What Helsinki publishes: {len(areas):,} street parking areas")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    return fig


def plot_status_map(areas):
    """Where the register is complete, silent, or self-contradicting."""
    plt = _pyplot()
    # A couple of outlying areas would otherwise stretch the frame over empty sea.
    centres = areas.geometry.centroid
    minx, maxx = centres.x.quantile([0.002, 0.998])
    miny, maxy = centres.y.quantile([0.002, 0.998])
    pad = 0.02 * max(maxx - minx, maxy - miny)
    minx, maxx, miny, maxy = minx - pad, maxx + pad, miny - pad, maxy + pad
    fig, ax = plt.subplots(figsize=(11, 11 * (maxy - miny) / (maxx - minx)))
    for status in ("official", "missing_hours", "uncertain"):
        group = areas[areas["status"] == status]
        group.plot(ax=ax, color=STATUS_COLOURS[status], linewidth=2.5,
                   label=f"{STATUS_MEANING[status].lower()} ({len(group):,})")
    ax.set_xlim(minx, maxx)
    ax.set_ylim(miny, maxy)
    ax.legend(loc="lower right", frameon=False, fontsize=11)
    ax.set_title("Where the register is complete, silent, or self-contradicting", fontsize=13)
    ax.set_axis_off()
    return fig


def plot_accuracy_by_distance(by_dist, baseline):
    """Where prediction from a neighbour works."""
    plt = _pyplot()
    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.bar(by_dist.index.astype(str), by_dist["mean"] * 100, color=RULE_COLOURS["paid"])
    ax.axhline(baseline, color=RULE_COLOURS["always_banned"], linestyle="--",
               label=f"always guess the most common pattern ({baseline:.0f}%)")
    for x, (share, n) in enumerate(zip(by_dist["mean"], by_dist["size"])):
        ax.text(x, share * 100 + 2, f"{share * 100:.1f}%\nn={n:,}", ha="center", fontsize=9)
    ax.set_ylim(0, 112)
    ax.set_ylabel("hours copied correctly")
    ax.set_title("A neighbour predicts the hours, until it is far away")
    ax.legend(frameon=False, loc="lower left")
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    return fig


def plot_rule_type_by_district(areas):
    """Rule type per district, sorted by total: bar length is where the register is, colour what
    it says there."""
    plt = _pyplot()
    counts = pd.crosstab(areas["district"].fillna("outside any district"), areas["rule_type"])
    counts = counts.loc[counts.sum(axis=1).sort_values().index]
    order = [r for r in RULE_COLOURS if r in counts.columns]
    fig, ax = plt.subplots(figsize=(8, 9))
    left = pd.Series(0, index=counts.index)
    for rule in order:
        ax.barh(counts.index, counts[rule], left=left, color=RULE_COLOURS[rule], label=rule)
        left += counts[rule]
    for y, total in enumerate(left):
        ax.text(total + 15, y, f"{total:,}", va="center", fontsize=8)
    ax.set_xlabel("parking areas")
    ax.set_title("Rule types per district: the register is a city-centre register")
    ax.legend(frameon=False, loc="lower right")
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(axis="y", labelsize=8)
    fig.tight_layout()
    return fig


def plot_area_sizes(areas):
    """The spread of polygon sizes, with the median and the outlier bounds."""
    plt = _pyplot()
    size, low, high = size_bounds(areas)
    log = np.log10(size)
    fig, ax = plt.subplots(figsize=(7, 3.5))
    ax.hist(size, bins=np.logspace(log.min(), log.max(), 50), color=RULE_COLOURS["paid"])
    ax.set_xscale("log")
    ax.axvline(size.median(), color="black", label=f"median {size.median():.0f} m²")
    for bound in (low, high):
        ax.axvline(bound, color=RULE_COLOURS["always_banned"], linestyle="--")
    ax.plot([], [], color=RULE_COLOURS["always_banned"], linestyle="--",
            label=f"outlier bounds, {(size < low).sum()} below and {(size > high).sum()} above")
    ax.set_xlabel("area of the polygon, m² (log scale)")
    ax.set_ylabel("parking areas")
    ax.set_title("Polygon sizes span three orders of magnitude")
    ax.legend(frameon=False, fontsize=8)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    return fig


def save_figures(areas, by_dist, baseline):
    """Write every chart to docs/figures. Agg draws without a screen."""
    import matplotlib
    matplotlib.use("Agg")
    plt = _pyplot()
    FIGURES.mkdir(parents=True, exist_ok=True)
    charts = [
        ("rule_types.png", plot_rule_types(areas), {}),
        ("status_map.png", plot_status_map(areas), {"bbox_inches": "tight"}),
        ("accuracy_by_distance.png", plot_accuracy_by_distance(by_dist, baseline), {}),
        ("rule_type_by_district.png", plot_rule_type_by_district(areas), {}),
        ("area_sizes.png", plot_area_sizes(areas), {}),
    ]
    for name, fig, options in charts:
        fig.savefig(FIGURES / name, dpi=150, **options)
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

    # The nearest-neighbour join is the expensive step and both the table and the chart need it.
    paired = nearest_pairs(known)
    by_dist = accuracy_by_distance(paired)
    baseline = baseline_accuracy(known)

    parts = [
        f"# Report figures\n\nGenerated by `analysis/report_stats.py` from "
        f"`{SOURCE}`: {len(areas)} parking areas, {len(known)} of them with stated hours.\n",
        rule_types(areas),
        reserved_for(areas),
        coverage(areas),
        summary_statistics(areas),
        duration_by_rule_type(areas),
        area_outliers(areas),
        raw_spellings(areas),
        issue_codes(areas),
        neighbour_accuracy(paired, by_dist, baseline),
        prediction_gap(areas, known),
    ]
    text = "\n".join(parts)
    print(text)
    if args.figures:
        save_figures(areas, by_dist, baseline)
    if args.write:
        OUT.write_text(text)
        print(f"written to {OUT}")


if __name__ == "__main__":
    main()
