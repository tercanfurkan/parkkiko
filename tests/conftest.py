"""The pipeline and analysis scripts are run as `python pipeline/<script>.py`, so they import each
other by bare name. Put those directories on the path and the tests import them the same way the
scripts do, rather than making production code carry a package layout only the tests need.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path[:0] = [str(ROOT / "pipeline"), str(ROOT / "analysis")]
