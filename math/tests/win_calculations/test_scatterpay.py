"""Test basic scatterpay-calculation functionality."""

import pytest
from tests.win_calculations.game_test_config import GamestateTest, create_blank_board
from src.calculations.scatter import Scatter


class GameScatterConfig:
    """Testing game functions"""

    def __init__(self):
        self.game_id = "0_test_class"
        self.rtp = 0.9700

        # Game Dimensions
        self.num_reels = 5
        self.num_rows = [5] * self.num_reels
        # Board and Symbol Properties
        self.paytable = {
            (25, "W"): 100,
            (20, "W"): 80,
            (15, "W"): 50,
            (25, "H1"): 80,
            (20, "H1"): 50,
            (15, "H1"): 20,
            (10, "H1"): 10,
            (25, "H2"): 70,
            (20, "H2"): 15,
            (15, "H2"): 5,
            (10, "H2"): 3,
        }

        self.special_symbols = {"wild": ["W", "WM"], "scatter": ["S"], "multiplier": ["M", "WM"], "blank": ["X"]}

        self.mult_values = [2, 3, 4, 5]
        self.bet_modes = []
        self.basegame_type = "basegame"
        self.freegame_type = "freegame"


def create_test_scatter_gamestate():
    """Boilerplate gamestate for testing."""
    test_config = GameScatterConfig()
    test_gamestate = GamestateTest(test_config)
    test_gamestate.create_symbol_map()
    test_gamestate.assign_special_sym_function()
    test_gamestate.board = create_blank_board(test_config.num_reels, test_config.num_rows)

    return test_gamestate


@pytest.fixture
def gamestate():
    return create_test_scatter_gamestate()


def test_scatterpay_nowilds(gamestate):
    "Test basic scatter-pay functionality, no wilds/multipliers"
    for idx, _ in enumerate(gamestate.board):
        for idy, _ in enumerate(gamestate.board[idx]):
            gamestate.board[idx][idy] = gamestate.create_symbol("H1")

    windata = Scatter.get_scatterpay_wins(gamestate.config, gamestate.board, global_multiplier=1)

    assert len(windata["wins"][0]["positions"]) == 25
    assert windata["totalWin"] == 80


def test_scatterpay_mults(gamestate):
    """Test wins with wild-multipliers"""
    for idx, _ in enumerate(gamestate.board):
        for idy, _ in enumerate(gamestate.board[idx]):
            if (idx + idy) % 5 == 0:
                gamestate.board[idx][idy] = gamestate.create_symbol("WM")
            else:
                gamestate.board[idx][idy] = gamestate.create_symbol("H1")

    windata = Scatter.get_scatterpay_wins(gamestate.config, gamestate.board, global_multiplier=1)

    assert windata["wins"][0]["meta"]["clusterMult"] == 15
    assert round(windata["totalWin"] / windata["wins"][0]["meta"]["clusterMult"], 2) == round(
        windata["wins"][0]["meta"]["winWithoutMult"], 2
    )


def test_scatterpay_wilds(gamestate):
    "Test scatter-pay method with inclusion of Wild symbols"
    for idx, _ in enumerate(gamestate.board):
        for idy, _ in enumerate(gamestate.board[idx]):
            if idx == 0:
                gamestate.board[idx][idy] = gamestate.create_symbol("W")
            elif idx == 1:
                gamestate.board[idx][idy] = gamestate.create_symbol("H2")
            else:
                gamestate.board[idx][idy] = gamestate.create_symbol("H1")

    windata = Scatter.get_scatterpay_wins(gamestate.config, gamestate.board, global_multiplier=1)

    for wd in windata["wins"]:
        if wd["symbol"] == "H1":
            assert wd["win"] == 50
        elif wd["symbol"] == "H2":
            assert wd["win"] == 3

    assert windata["totalWin"] == 53
