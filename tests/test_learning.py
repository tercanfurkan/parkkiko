"""The two things stage 5's headline rests on: the test hides what it claims to hide, and an
unsafe answer is the one that costs a driver a fine."""
import geopandas as gpd
from shapely.geometry import Point

import learning
import process
from learning import Neighbours, in_force, unsafe

DAY = '{"mon_fri": [9, 21]}'
DAY_AND_SATURDAY = '{"mon_fri": [9, 21], "sat": [9, 18]}'
ORIGIN = (25_496_000, 6_672_000)


def street(distances):
    """Labelled areas of one class along a line, `distances` metres from the origin."""
    return gpd.GeoDataFrame({"luokka": [6] * len(distances), "hours": [DAY] * len(distances)},
                            geometry=[Point(ORIGIN[0] + d, ORIGIN[1]).buffer(1) for d in distances], crs=3879)


def test_hidden_neighbours_are_never_used():
    """The distance-matched test hides neighbours out to the real gap; if one leaked, the headline
    would describe the easy case again. The stand-in itself, at distance 0, is hidden with them."""
    found = Neighbours(street([0, 5, 20, 60, 200])).nearest(6, ORIGIN, k=3, beyond=50)
    assert [round(d) for d, _ in found] == [60, 200]


def test_without_hiding_the_nearest_come_first():
    found = Neighbours(street([30, 0, 10])).nearest(6, ORIGIN, k=2)
    assert [round(d) for d, _ in found] == [0, 10]


def test_learning_trains_on_the_rule_types_the_pipeline_marks_missing():
    assert set(learning.NEEDS_HOURS) == set(process.NEEDS_HOURS)


def test_a_range_past_midnight_runs_into_the_next_day():
    """Friday 22-5 ends on Saturday morning."""
    friday_night = in_force('{"mon_fri": [22, 5]}')
    assert (4, 23) in friday_night and (5, 2) in friday_night and (5, 5) not in friday_night


def test_missing_hours_the_rule_applies_is_unsafe_and_the_reverse_is_not():
    """Predicting weekdays only, where Saturday is paid too, tells a driver Saturday is free."""
    assert unsafe(predicted=DAY, truth=DAY_AND_SATURDAY)
    assert not unsafe(predicted=DAY_AND_SATURDAY, truth=DAY)
