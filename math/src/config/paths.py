"""Define relevant paths to games, logic engine and optimization."""

import os
from pathlib import Path

PROJECT_PATH = os.path.abspath(Path(__file__).resolve().parent.parent.parent)
PATH_TO_ENGINE = PROJECT_PATH
PATH_TO_GAMES = os.path.join(PROJECT_PATH, "games")
OPTIMIZATION_PATH = os.path.join(PROJECT_PATH, "optimization_program")
SETUP_PATH = os.path.join(OPTIMIZATION_PATH, "src", "setup.toml")
