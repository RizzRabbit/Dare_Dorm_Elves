from src.config.paths import PATH_TO_GAMES
from collections import defaultdict
import os


def get_unoptimized_hits(lut_path, all_modes, win_ranges):
    """Calculate hit-rates of simulation output lookup table."""
    all_modes_base_dist = defaultdict(lambda: defaultdict(int))
    total_mode_count = {}
    for mode in all_modes:
        base_lut_file = os.path.join(lut_path, "lookUpTable_" + str(mode) + ".csv")
        lut = open(base_lut_file, "r", encoding="UTF-8")
        counter = 0
        for line in lut:
            _, _, payout = line.strip().split(",")
            all_modes_base_dist[mode][float(round(int(payout) / 100, 2))] += 1
            counter += 1

        total_mode_count[mode] = counter

    # Segregate to win-ranges
    all_modes_range_hits = {}
    for mode in all_modes:
        all_modes_range_hits[mode] = {}
        for wr in win_ranges:
            all_modes_range_hits[mode][wr] = 0

        for payout in list(all_modes_base_dist[mode].keys()):
            for wr in win_ranges:
                if payout >= wr[0] and payout < wr[1]:
                    all_modes_range_hits[mode][wr] += all_modes_base_dist[mode][payout]
                    break

    all_modes_hit_rates = {}
    for mode in all_modes:
        all_modes_hit_rates[mode] = {}
        for wr in win_ranges:
            try:
                all_modes_hit_rates[mode][wr] = round(
                    1 / (all_modes_range_hits[mode][wr] / total_mode_count[mode]), 3
                )
            except ZeroDivisionError:
                all_modes_hit_rates[mode][wr] = 0
    return all_modes_hit_rates, all_modes_range_hits


def make_split_win_distribution(lut_file, split_file, all_modes, base_mode_name="basegame"):
    """Separate probability information for different game-types."""
    combined_distributions = defaultdict(lambda: defaultdict(float))
    all_modes.append("cumulative")
    split = open(split_file, "r", encoding="UTF-8")
    lut = open(lut_file, "r", encoding="UTF-8")

    all_base, all_free, all_fences = [], [], []
    for line in split:
        idx, idv_fence, base_win, free_win = line.strip().split(",")
        all_base.append(float(base_win))
        all_free.append(float(free_win))
        if str(idv_fence) == "0":
            idv_fence = base_mode_name
        all_fences.append(str(idv_fence))

    all_weights = []
    for line in lut:
        _, weight, _ = line.strip().split(",")
        all_weights.append(int(weight))
    total_lut_weight = int(sum(all_weights))

    for idx, _ in enumerate(all_weights):
        if base_mode_name in all_modes:
            combined_distributions[base_mode_name][all_base[idx]] += all_weights[idx]

        if all_fences[idx] != base_mode_name and all_fences[idx] != "wincap":
            combined_distributions[all_fences[idx]][all_free[idx]] += all_weights[idx]
        else:
            for mode in all_modes:
                if mode != base_mode_name and mode != "cumulative":
                    combined_distributions[mode][all_free[idx]] += all_weights[idx]
            if (all_free[idx] != 0) and (all_fences[idx] == base_mode_name):
                raise ValueError("Non-Zero FreeGame win in baseGame Fence.")

        # Construct cumulative hit-rate data
        combined_distributions["cumulative"][all_base[idx] + all_free[idx]] += all_weights[idx]

    # Sort all dictionaries by payout
    all_sorted_payouts = {}
    all_sorted_distributions = {}
    for mode in all_modes:
        all_sorted_payouts[mode] = sorted(list(combined_distributions[mode].keys()))
        all_sorted_distributions[mode] = {}

    for mode in all_modes:
        mode_pays = list(all_sorted_payouts[mode])
        for pay in mode_pays:
            all_sorted_distributions[mode][pay] = combined_distributions[mode][pay]

    return all_sorted_distributions, total_lut_weight


def return_hit_rates(all_mode_distributions, total_weight, win_ranges, mode_cost):
    """Calculate hit-rates for game-type specific types."""
    all_modes = list(all_mode_distributions.keys())
    all_mode_probs = {}
    all_mode_hits = {}
    all_mode_rtps = {}
    for mode in all_modes:
        all_mode_probs[mode] = {}
        all_mode_hits[mode] = {}
        all_mode_rtps[mode] = {}

    for w in win_ranges:
        for mode in all_modes:
            all_mode_probs[mode][w] = 0
            all_mode_rtps[mode][w] = 0

    for mode in all_modes:
        mode_wins = list(all_mode_distributions[mode].keys())
        for win in mode_wins:
            for win_range in win_ranges:
                if win >= win_range[0] and win < win_range[1]:
                    all_mode_probs[mode][win_range] += all_mode_distributions[mode][win] / total_weight
                    all_mode_rtps[mode][win_range] += win * (all_mode_distributions[mode][win] / total_weight)
                    continue

        for win_range in win_ranges:
            try:
                all_mode_hits[mode][win_range] = round((1 / (all_mode_probs[mode][win_range])), 3)
                all_mode_rtps[mode][win_range] /= mode_cost
            except ZeroDivisionError:
                all_mode_hits[mode][win_range] = "NaN"

    return all_mode_hits, all_mode_probs, all_mode_rtps


def return_all_filepaths(game_id: str, mode: str):
    """Return file files required for PAR sheet generation."""
    lut_path = os.path.join(PATH_TO_GAMES, game_id, "library", "publish_files", f"lookUpTable_{mode}_0.csv")
    split_path = os.path.join(
        PATH_TO_GAMES, game_id, "library", "lookup_tables", f"lookUpTableSegmented_{mode}.csv"
    )

    return lut_path, split_path
