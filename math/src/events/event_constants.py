"""Single class containing all reuseable event `type` constants."""

from enum import Enum


class EventConstants(Enum):
    "Define all standard event 'type' keys."

    # Reveal events
    REVEAL = "reveal"

    # Win events
    WIN_DATA = "winInfo"
    FINAL_WIN = "finalWin"
    SET_WIN = "setWin"
    SET_TOTAL_WIN = "setTotalWin"
    WINCAP = "wincap"

    # Freespin events
    UPDATE_FS = "updateFreeSpin"
    FREESPINTRIGGER = "freeSpinTrigger"
    FREESPINRETRIGGER = "freeSpinRetrigger"
    FREE_SPIN_END = "freeSpinEnd"
    ENTER_BONUS = "enterBonus"

    # Tumble events
    TUMBLE_BOARD = "tumbleBoard"
    SET_TUMBLE_WIN = "setTumbleWin"
    UPDATE_TUMBLE_WIN = "updateTumbleWin"

    # Special symbol events
    UPDATE_GLOBAL_MULT = "updateGlobalMult"
