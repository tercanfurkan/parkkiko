"""Predict the hours the register does not publish, where stage 5 found it safe to.

Stage 5 (analysis/learning.py, notebooks/stages/05_learning.ipynb) measured the method and chose
when to trust it; this applies that choice. A predicted area keeps its status, missing_hours, and
gains two fields the app shows as an estimate: predicted_hours, in the shape of hours, and
predicted_from_m, the distance to the nearest known area it was predicted from.
"""
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

import rules

# Chosen by stage 5 on 24 October 2026: the 5 nearest same-class areas, the nearest within 150 m,
# all agreeing. Frozen, so what the docs quote cannot drift; analysis/learning.py checks it holds.
CHOSEN = {"k": 5, "distance": 150, "share": 1.0}
# Classes whose own unsafe rate in stage 5's test is at or over 1%, withheld on 25 October 2026
WITHHELD_CLASSES = {1, 5, 7}
# How often a shown estimate was right in that test, as the app says it: "about 99 times in 100".
# analysis/learning.py checks it still holds; web/src/answer.js words it.
RELIABILITY = 0.99


def split(areas):
    """Labelled areas to learn from, and the areas whose hours we must predict."""
    labelled = areas[areas["rule_type"].isin(rules.NEEDS_HOURS) & areas["status"].eq("official")]
    return labelled, areas[areas["status"].eq("missing_hours")]


def xy(frame):
    centres = frame.geometry.centroid
    return np.column_stack([centres.x, centres.y])


class Neighbours:
    """Labelled areas, one spatial index per class."""

    def __init__(self, labelled):
        self.classes = {klass: (cKDTree(xy(group)), group["hours"].to_numpy())
                        for klass, group in labelled.groupby("luokka")}

    def nearest(self, klass, point, k, beyond=None):
        """The k nearest labelled areas of a class as (distance, hours). With `beyond`, only those
        further than it: stage 5's test, which also leaves out the area standing in."""
        tree, labels = self.classes[klass]
        hidden = tree.query_ball_point(point, beyond, return_length=True) if beyond is not None else 0
        n = min(len(labels), k + hidden)
        dist, idx = tree.query(point, k=list(range(1, n + 1)))
        found = [(d, labels[i]) for d, i in zip(dist, idx) if beyond is None or d > beyond]
        return found[:k]


def vote(found):
    """Distance-weighted vote: the pattern, the distance to the nearest, and the agreement."""
    weights = {}
    for distance, hours in found:
        weights[hours] = weights.get(hours, 0.0) + 1 / max(distance, 1.0)
    best = max(weights, key=weights.get)
    return {"predicted": best, "nearest": found[0][0], "share": weights[best] / sum(weights.values())}


def predict(neighbours, frame, k):
    """The vote for each area of a frame, from its k nearest labelled areas of the same class."""
    votes = [vote(neighbours.nearest(klass, point, k)) if klass in neighbours.classes else None
             for klass, point in zip(frame["luokka"], xy(frame))]
    return pd.DataFrame([v or {} for v in votes], index=frame.index)


def answered(rows, cut):
    """Which predictions the cut-off lets the model give."""
    return (rows["nearest"] <= cut["distance"]) & (rows["share"] >= cut["share"])


def shown(votes, targets):
    """Which predictions the app shows: the cut-off passes and the class is not withheld."""
    return answered(votes, CHOSEN) & ~targets["luokka"].isin(WITHHELD_CLASSES)


def add_predictions(areas):
    """The areas, with predicted_hours and predicted_from_m where an estimate is shown, and absent
    everywhere else."""
    labelled, targets = split(areas)
    votes = predict(Neighbours(labelled), targets, CHOSEN["k"])
    show = shown(votes, targets)
    areas["predicted_hours"] = votes.loc[show, "predicted"]
    areas["predicted_from_m"] = votes.loc[show, "nearest"].round().astype("Int64")
    return areas
