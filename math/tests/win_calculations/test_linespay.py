"""Test basic lines-calculation functionality."""

import pytest
from tests.win_calculations.game_test_config import GamestateTest, create_blank_board
from src.calculations.lines import Lines


class GameLinesConfig:
    """Testing game functions"""

    def __init__(self):
        self.game_id = "0_test_class"
        self.rtp = 0.9700

        # Game Dimensions
        self.num_reels = 5
        self.num_rows = [5] * self.num_reels
        # Board and Symbol Properties
        self.paytable = {
            (5, "W"): 100,
            (4, "W"): 90,
            (3, "W"): 80,
            (5, "H1"): 70,
            (4, "H1"): 60,
            (3, "H1"): 50,
            (5, "WM"): 30,
            (4, "WM"): 20,
            (3, "WM"): 10,
        }

        self.paylines = {
            1: [
                0,
                0,
                0,
                0,
                0,
            ],
            2: [
                0,
                1,
                2,
                1,
                2,
            ],
            3: [
                4,
                3,
                2,
                3,
                4,
            ],
            4: [
                4,
                4,
                4,
                4,
                4,
            ],
        }

        self.special_symbols = {"wild": ["W"], "scatter": ["S"], "multiplier": ["M", "WM"], "blank": ["X"]}

        self.mult_values = [2, 3, 4, 5]
        self.bet_modes = []
        self.basegame_type = "basegame"
        self.freegame_type = "freegame"


def create_test_lines_gamestate():
    """Boilerplate gamestate for testing."""
    test_config = GameLinesConfig()
    test_gamestate = GamestateTest(test_config)
    test_gamestate.create_symbol_map()
    test_gamestate.assign_special_sym_function()
    test_gamestate.board = create_blank_board(test_config.num_reels, test_config.num_rows)

    return test_gamestate


@pytest.fixture
def gamestate():
    """Initialise test state."""
    return create_test_lines_gamestate()


def test_linespay_basic(gamestate):
    "Basic lines-payout."
    for idx, _ in enumerate(gamestate.board):
        for idy, _ in enumerate(gamestate.board[idx]):
            if idx != len(gamestate.board) - 1:
                gamestate.board[idx][idy] = gamestate.create_symbol("H1")
            else:
                gamestate.board[idx][idy] = gamestate.create_symbol("W")

    windata = Lines.get_lines(gamestate.board, gamestate.config)
    assert windata["totalWin"] == (gamestate.config.paytable[(5, "H1")] * len(gamestate.config.paylines))


def test_linespay_wilds(gamestate):
    "Basic lines-payout."
    for idx, _ in enumerate(gamestate.board):
        for idy, _ in enumerate(gamestate.board[idx]):
            if idx < 4:
                gamestate.board[idx][idy] = gamestate.create_symbol("W")
            else:
                gamestate.board[idx][idy] = gamestate.create_symbol("H1")

    windata = Lines.get_lines(gamestate.board, gamestate.config)
    # 4Kind W pay > 5Kind H1
    assert windata["totalWin"] == (gamestate.config.paytable[(4, "W")] * len(gamestate.config.paylines))


def test_linespay_mult(gamestate):
    "Special symbol with multiplier"
    for idx, _ in enumerate(gamestate.board):
        for idy, _ in enumerate(gamestate.board[idx]):
            if idy == 0:
                gamestate.board[idx][idy] = gamestate.create_symbol("WM")
            else:
                gamestate.board[idx][idy] = gamestate.create_symbol("X")

    windata = Lines.get_lines(gamestate.board, gamestate.config)
    assert windata["totalWin"] == (gamestate.config.paytable[(5, "WM")] * sum([3, 3, 3, 3, 3]))
