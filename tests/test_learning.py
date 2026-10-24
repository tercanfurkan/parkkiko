"""The two things stage 5's headline rests on: the test hides what it claims to hide, and an
unsafe answer is the one that costs a driver a fine."""
import geopandas as gpd
from shapely.geometry import Point

from learning import Neighbours, in_force, unsafe

DAY = '{"mon_fri": [9, 21]}'
DAY_AND_SATURDAY = '{"mon_fri": [9, 21], "sat": [9, 18]}'


def street(distances, klass=6):
    """Labelled areas along a line, `distances` metres from the origin, all of one class."""
    return gpd.GeoDataFrame({"luokka": [klass] * len(distances), "hours": [DAY] * len(distances)},
                            geometry=[Point(25_496_000 + d, 6_672_000).buffer(1) for d in distances],
                            crs=3879)


def test_hidden_neighbours_are_never_used():
    """The distance-matched test hides neighbours closer than the real gap; if one leaked, the
    headline would describe the easy case again."""
    areas = street([0, 5, 20, 60, 200])
    found = Neighbours(areas).nearest(6, (25_496_000, 6_672_000), k=3, beyond=50, skip=areas.index[0])
    assert [round(d) for d, _ in found] == [60, 200]


def test_the_stand_in_is_never_its_own_neighbour():
    areas = street([0, 30])
    found = Neighbours(areas).nearest(6, (25_496_000, 6_672_000), k=1, skip=areas.index[0])
    assert round(found[0][0]) == 30


def test_a_range_past_midnight_runs_into_the_next_day():
    """Friday 22-5 ends on Saturday morning."""
    friday_night = in_force('{"mon_fri": [22, 5]}')
    assert (4, 23) in friday_night and (5, 2) in friday_night and (5, 5) not in friday_night


def test_missing_hours_the_rule_applies_is_unsafe_and_the_reverse_is_not():
    """Predicting weekdays only, where Saturday is paid too, tells a driver Saturday is free."""
    assert unsafe(predicted=DAY, truth=DAY_AND_SATURDAY)
    assert not unsafe(predicted=DAY_AND_SATURDAY, truth=DAY)
