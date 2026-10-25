"""Stage 5: predict the hours the register does not publish, and decide where not to.

A same-class nearest-neighbour vote predicts an area's hours pattern. It is tested the way it will
be used: for each area we must predict, a labelled area of the same class stands in with its
neighbours hidden out to that area's real distance from known ones. run() does the whole stage
once; notebook 05 and the report's tables read its results.
"""
import json
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd

# The predicting code lives in the pipeline, which applies what this stage chose; analysis imports
# it, never the reverse
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
from predict import CHOSEN, WITHHELD_CLASSES, Neighbours, answered, predict, split, vote, xy  # noqa: E402

K_CHOICES = (1, 3, 5)
ROUNDS = 20
# Fixed on 24 October 2026, before any result was seen
TARGET_ACCURACY = 0.95
TARGET_UNSAFE = 0.01
DISTANCES = (10, 25, 50, 75, 100, 150, 200, 300, 500)   # candidate cut-offs, metres
SHARES = (0.5, 0.67, 0.8, 1.0)                          # candidate vote agreement
MIN_ANSWERS = 200                                       # a cut-off must rest on at least this many


@lru_cache(maxsize=None)
def in_force(hours):
    """The hours of the week a rule applies, as (day, hour), Monday 0. Mirrors timeline() in
    web/src/evaluate.js for one plain week: a range like 22-5 runs into the next day; holidays,
    which only move a date to the Sunday or Saturday window, are left out."""
    days = {"mon_fri": range(5), "sat": [5], "sun": [6]}
    slots = set()
    for window, (start, end) in json.loads(hours).items():
        for day in days[window]:
            slots |= {(day, h) for h in (range(start, end) if start < end else range(start, 24))}
            if end < start:
                slots |= {((day + 1) % 7, h) for h in range(end)}
    return frozenset(slots)


def unsafe(predicted, truth):
    """True when the real rule applies at an hour the prediction says it does not: the app would
    say free or allowed where the driver must pay or move. Outside its hours every rule type that
    needs hours is free, so this is the direction that costs a fine; the reverse costs money."""
    return bool(in_force(truth) - in_force(predicted))


def judged(rows):
    """Rows of predictions with their truth, marked correct and unsafe."""
    frame = pd.DataFrame(rows)
    frame["correct"] = frame["predicted"].eq(frame["truth"])
    frame["unsafe"] = [unsafe(p, t) for p, t in zip(frame["predicted"], frame["truth"])]
    return frame


def score(frame):
    from sklearn.metrics import f1_score
    return {"accuracy": frame["correct"].mean(),
            "macro F1": f1_score(frame["truth"], frame["predicted"], average="macro", zero_division=0),
            "unsafe": frame["unsafe"].mean()}


def gaps(neighbours, targets):
    """Each target's distance, centre to centre, to the nearest labelled area of its class."""
    return pd.Series([neighbours.nearest(k, p, 1)[0][0] for k, p in zip(targets["luokka"], xy(targets))],
                     index=targets.index, name="gap")


def simulate(labelled, targets, neighbours, gap, seed=0):
    """For each target, a random labelled area of the same class stands in, with its neighbours
    hidden out to the target's real gap. One row per stand-in and k, with the truth known."""
    points = dict(zip(labelled.index, xy(labelled)))
    truth = labelled["hours"].to_dict()
    members = labelled.groupby("luokka").groups
    rng = np.random.default_rng(seed)
    rows = []
    for r in range(ROUNDS):
        for klass, g in zip(targets["luokka"], gap):
            stand_in = rng.choice(members[klass])
            found = neighbours.nearest(klass, points[stand_in], max(K_CHOICES), beyond=g)
            if found:
                rows += [{"round": r, "k": k, "luokka": klass, "truth": truth[stand_in], **vote(found[:k])}
                         for k in K_CHOICES]
    return judged(rows)


def baselines(labelled, test):
    """Always the most common pattern overall, and always the most common pattern of the class,
    scored on the same stand-ins as the model."""
    overall = labelled["hours"].value_counts().index[0]
    per_class = labelled.groupby("luokka")["hours"].agg(lambda s: s.value_counts().index[0])
    guesses = {"Always the most common pattern": [overall] * len(test),
               "Always the most common pattern of the class": test["luokka"].map(per_class)}
    return {name: score(judged({"truth": test["truth"].to_numpy(), "predicted": list(guess)}))
            for name, guess in guesses.items()}


def district_blocked(labelled, k, folds=5):
    """Hold out whole districts, a test the cut-off is not chosen on. Coarser than the simulation,
    and partly a test of rule regimes, since rule types cluster by district."""
    from sklearn.model_selection import GroupKFold
    parts = []
    for train, test in GroupKFold(folds).split(labelled, groups=labelled["district"]):
        held = labelled.iloc[test]
        parts.append(predict(Neighbours(labelled.iloc[train]), held, k).assign(truth=held["hours"]))
    return judged(pd.concat(parts).dropna(subset=["predicted"]).to_dict("records"))


def cutoff(fit):
    """The k, distance and agreement that answer the most while meeting the targets."""
    candidates = []
    for k in K_CHOICES:
        rows = fit[fit["k"] == k]
        for distance in DISTANCES:
            for share in SHARES:
                cut = {"k": k, "distance": distance, "share": share}
                kept = rows[answered(rows, cut)]
                if (len(kept) >= MIN_ANSWERS and kept["correct"].mean() >= TARGET_ACCURACY
                        and kept["unsafe"].mean() < TARGET_UNSAFE):
                    candidates.append((len(kept) / len(rows), cut))
    return max(candidates, key=lambda c: c[0], default=(None, None))[1]


def meets_target(rows, cut):
    kept = rows[(rows["k"] == cut["k"]) & answered(rows, cut)]
    return (len(kept) >= MIN_ANSWERS and kept["correct"].mean() >= TARGET_ACCURACY
            and kept["unsafe"].mean() < TARGET_UNSAFE)


def run(areas):
    """The whole stage once: the simulation, the frozen cut-off checked against the target, the
    district-blocked test, and the predictions for the areas without hours."""
    labelled, targets = split(areas)
    neighbours = Neighbours(labelled)
    gap = gaps(neighbours, targets)
    sim = simulate(labelled, targets, neighbours, gap)
    fit, test = sim[sim["round"] < ROUNDS // 2], sim[sim["round"] >= ROUNDS // 2]
    cut = CHOSEN
    if not meets_target(fit, cut):
        raise SystemExit(f"The frozen cut-off {cut} no longer meets the stage 5 target; rerun cutoff().")
    predicted = predict(neighbours, targets, cut["k"])
    predicted["answer"] = answered(predicted, cut)
    predicted["shown"] = predicted["answer"] & ~targets["luokka"].isin(WITHHELD_CLASSES)
    held = test[(test["k"] == cut["k"]) & answered(test, cut)]
    failing = set(held.groupby("luokka")["unsafe"].mean().loc[lambda u: u >= TARGET_UNSAFE].index)
    if failing - WITHHELD_CLASSES:
        raise SystemExit(f"Classes {failing - WITHHELD_CLASSES} now fail the unsafe bar alone; withhold them in pipeline/predict.py.")
    return {"labelled": labelled, "targets": targets, "gap": gap, "sim": sim, "cut": cut,
            "test": test[test["k"] == cut["k"]], "blocked": district_blocked(labelled, cut["k"]),
            "predicted": predicted}
