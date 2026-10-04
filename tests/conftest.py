"""The pipeline scripts are run as `python pipeline/<script>.py`, so they import each other by
bare name. Put that directory on the path and the tests import them the same way the scripts do,
rather than making production code carry a package layout only the tests need.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
