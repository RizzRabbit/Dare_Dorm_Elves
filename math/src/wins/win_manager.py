"""Payout wallet manager"""


class WinManager:
    """ "stores all simulation win info, at a cumulative and individual spin level"""

    def __init__(self, base_game_mode: str, free_game_mode: str, mode_max_win: float):
        """Initialize total simulation win values."""
        self.base_game_mode = base_game_mode
        self.free_game_mode = free_game_mode

        # Updates win amounts across all simulations
        self.max_allowed_win = mode_max_win
        self.total_cumulative_wins = 0
        self.cumulative_base_wins = 0
        self.cumulative_free_wins = 0

        # Base-game and free-game wins for a specific simulation
        self.running_bet_win = 0.0

        # Controls wins for a specific simulation number
        self.basegame_wins = 0.0
        self.freegame_wins = 0.0

        # Controls wins for all actions within a 'reveal' event
        self.spin_win = 0.0
        self.tumble_win = 0.0

    def update_spinwin(self, win_amount: float):
        """Update win-value associated with a given reveal."""
        self.spin_win += win_amount
        self.running_bet_win += win_amount

    def set_spin_win(self, win_amount: float):
        """Sets the spinwin, instead of updating the value. Useful for end-of-sequence win modification."""
        running_diff = win_amount - self.spin_win
        self.spin_win = win_amount
        self.running_bet_win += running_diff

    def reset_spin_win(self):
        """Reset wins for a given reveal."""
        self.spin_win = 0.0

    def update_gametype_wins(self, gametype: str):
        """Assigns wins to a specific gametype."""
        if self.base_game_mode.lower() == gametype.lower():
            self.basegame_wins += self.spin_win
        elif self.free_game_mode.lower() == gametype.lower():
            self.freegame_wins += self.spin_win
        else:
            raise RuntimeError("Must define a valid gametype")

    def update_end_round_wins(self):
        """Accumulate total wins for a given betting round."""
        base = min(self.max_allowed_win, self.basegame_wins)
        free = min(self.max_allowed_win, self.freegame_wins)
        self.total_cumulative_wins += base + free
        self.cumulative_base_wins += base
        self.cumulative_free_wins += free

    def reset_end_round_wins(self):
        """Reset wins at end of gameround/simulation."""
        self.basegame_wins = 0.0
        self.freegame_wins = 0.0

        self.running_bet_win = 0.0
        self.spin_win = 0.0
        self.tumble_win = 0.0
