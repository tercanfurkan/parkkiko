"""Stage 5: predict the hours the register does not publish, and decide where not to.

A same-class nearest-neighbour vote predicts an area's hours pattern. It is tested the way it will
be used: for each area we must predict, a labelled area of the same class stands in with its
neighbours hidden out to that area's real distance from known ones. Everything notebook 05 and the
report quote about this stage comes from here.
"""
import json

import numpy as np
import pandas as pd
from sklearn.metrics import f1_score
from sklearn.model_selection import GroupKFold
from sklearn.neighbors import KDTree

NEEDS_HOURS = ["paid", "free_limited", "banned_hours"]
K_CHOICES = (1, 3, 5)
ROUNDS = 20
# Fixed on 24 October 2026, before any result was seen
TARGET_ACCURACY = 0.95
TARGET_UNSAFE = 0.01
DISTANCES = (10, 25, 50, 75, 100, 150, 200, 300, 500)   # candidate cut-offs, metres
SHARES = (0.5, 0.67, 0.8, 1.0)                          # candidate vote agreement
MIN_ANSWERS = 200                                       # a cut-off must rest on at least this many


def split(areas):
    """Labelled areas to learn from, and the areas whose hours we must predict."""
    labelled = areas[areas["rule_type"].isin(NEEDS_HOURS) & areas["status"].eq("official")
                     & areas["hours"].notna()]
    return labelled, areas[areas["status"].eq("missing_hours")]


def xy(frame):
    centres = frame.geometry.centroid
    return np.column_stack([centres.x, centres.y])


class Neighbours:
    """Labelled areas, one spatial index per class."""

    def __init__(self, labelled):
        self.classes = {}
        for klass, group in labelled.groupby("luokka"):
            self.classes[klass] = (KDTree(xy(group)), group["hours"].to_numpy(), group.index.to_numpy())

    def nearest(self, klass, point, k, beyond=0.0, skip=None):
        """The k nearest labelled areas of a class as (distance, hours), at least `beyond` metres away."""
        tree, labels, index = self.classes[klass]
        hidden = tree.query_radius([point], r=beyond, count_only=True)[0] if beyond > 0 else 0
        dist, idx = tree.query([point], k=min(len(labels), k + hidden + 1))
        found = [(d, labels[i]) for d, i in zip(dist[0], idx[0]) if d >= beyond and index[i] != skip]
        return found[:k]


def vote(found, k):
    """Distance-weighted vote of the k nearest: (pattern, distance to the nearest, agreement)."""
    weights = {}
    for distance, hours in found[:k]:
        weights[hours] = weights.get(hours, 0.0) + 1 / max(distance, 1.0)
    best = max(weights, key=weights.get)
    return best, found[0][0], weights[best] / sum(weights.values())


def in_force(hours):
    """The hours of the week a rule applies, as (day, hour), Monday 0. A range like 22-5 runs into
    the next day."""
    days = {"mon_fri": range(5), "sat": [5], "sun": [6]}
    slots = set()
    for window, (start, end) in json.loads(hours).items():
        for day in days[window]:
            hours_today = range(start, end) if start < end else range(start, 24)
            slots |= {(day, h) for h in hours_today}
            if end < start:
                slots |= {((day + 1) % 7, h) for h in range(end)}
    return slots


def unsafe(predicted, truth):
    """True when the real rule applies at an hour the prediction says it does not: the app would
    say free or allowed where the driver must pay or move. The reverse only costs money or a space."""
    return bool(in_force(truth) - in_force(predicted))


def gaps(neighbours, targets):
    """Each target's distance to the nearest labelled area of its class: what the model faces."""
    return pd.Series([neighbours.nearest(k, p, 1)[0][0] for k, p in zip(targets["luokka"], xy(targets))],
                     index=targets.index, name="gap")


def simulate(labelled, targets, rounds=ROUNDS, seed=0):
    """For each target, a random labelled area of the same class stands in, with its neighbours
    hidden out to the target's real gap. One row per stand-in and k, with the truth known."""
    neighbours = Neighbours(labelled)
    gap = gaps(neighbours, targets)
    points = dict(zip(labelled.index, xy(labelled)))
    members = labelled.groupby("luokka").groups
    rng = np.random.default_rng(seed)
    rows = []
    for r in range(rounds):
        for target, klass, g in zip(targets.index, targets["luokka"], gap):
            stand_in = rng.choice(members[klass])
            found = neighbours.nearest(klass, points[stand_in], max(K_CHOICES), beyond=g, skip=stand_in)
            if not found:
                continue
            for k in K_CHOICES:
                predicted, nearest, share = vote(found, k)
                rows.append({"round": r, "k": k, "target": target, "stand_in": stand_in, "luokka": klass,
                             "nearest": nearest, "share": share, "predicted": predicted,
                             "truth": labelled.at[stand_in, "hours"]})
    sim = pd.DataFrame(rows)
    sim["correct"] = sim["predicted"].eq(sim["truth"])
    sim["unsafe"] = [unsafe(p, t) for p, t in zip(sim["predicted"], sim["truth"])]
    return sim


def baselines(labelled, sim):
    """Always the most common pattern overall, and always the most common pattern of the class,
    scored on the same stand-ins as the model."""
    rows = sim[sim["k"] == K_CHOICES[0]]
    overall = labelled["hours"].value_counts().index[0]
    per_class = labelled.groupby("luokka")["hours"].agg(lambda s: s.value_counts().index[0])
    guesses = {"most common pattern": pd.Series(overall, index=rows.index),
               "most common pattern of the class": rows["luokka"].map(per_class)}
    return {name: score(rows["truth"], guess) for name, guess in guesses.items()}


def score(truth, predicted):
    predicted = pd.Series(predicted, index=truth.index)
    return {"accuracy": truth.eq(predicted).mean(),
            "macro F1": f1_score(truth, predicted, average="macro", zero_division=0),
            "unsafe": np.mean([unsafe(p, t) for p, t in zip(predicted, truth)])}


def district_blocked(labelled, k, folds=5):
    """Hold out whole districts, a test the cut-off is not chosen on. Coarser than the simulation,
    and partly a test of rule regimes, since rule types cluster by district."""
    rows = []
    for train, test in GroupKFold(folds).split(labelled, groups=labelled["district"]):
        neighbours = Neighbours(labelled.iloc[train])
        held = labelled.iloc[test]
        for klass, point, hours in zip(held["luokka"], xy(held), held["hours"]):
            if klass in neighbours.classes:
                predicted, nearest, share = vote(neighbours.nearest(klass, point, k), k)
                rows.append({"truth": hours, "predicted": predicted, "nearest": nearest, "share": share})
    blocked = pd.DataFrame(rows)
    blocked["correct"] = blocked["predicted"].eq(blocked["truth"])
    blocked["unsafe"] = [unsafe(p, t) for p, t in zip(blocked["predicted"], blocked["truth"])]
    return blocked


def cutoff(sim):
    """The k, distance and agreement that answer the most while meeting the targets, chosen on the
    first half of the rounds. Returns None if no cut-off meets them."""
    fit = sim[sim["round"] < ROUNDS // 2]
    best = None
    for k in K_CHOICES:
        rows = fit[fit["k"] == k]
        for distance in DISTANCES:
            for share in SHARES:
                kept = rows[(rows["nearest"] <= distance) & (rows["share"] >= share)]
                if len(kept) < MIN_ANSWERS:
                    continue
                if kept["correct"].mean() >= TARGET_ACCURACY and kept["unsafe"].mean() < TARGET_UNSAFE:
                    coverage = len(kept) / len(rows)
                    if best is None or coverage > best["coverage"]:
                        best = {"k": k, "distance": distance, "share": share, "coverage": coverage}
    return best


def kept(rows, cut):
    """The rows the cut-off lets the model answer."""
    return rows[(rows["nearest"] <= cut["distance"]) & (rows["share"] >= cut["share"])]


def held_out(sim, cut):
    """The simulation rounds the cut-off was not chosen on, for its k."""
    return sim[(sim["round"] >= ROUNDS // 2) & (sim["k"] == cut["k"])]


def at_cutoff(rows, cut):
    """Share answered, and how good the answers are, once the cut-off is applied."""
    answered = kept(rows, cut)
    return {"answered": len(answered) / len(rows), "accuracy": answered["correct"].mean(),
            "unsafe": answered["unsafe"].mean()}


def predict(labelled, targets, cut):
    """The hours for each area we must predict, and whether the cut-off lets us say so."""
    neighbours = Neighbours(labelled)
    rows = []
    for klass, point in zip(targets["luokka"], xy(targets)):
        predicted, nearest, share = vote(neighbours.nearest(klass, point, cut["k"]), cut["k"])
        rows.append({"predicted": predicted, "nearest": nearest, "share": share})
    out = pd.DataFrame(rows, index=targets.index)
    out["answer"] = (out["nearest"] <= cut["distance"]) & (out["share"] >= cut["share"])
    return out
