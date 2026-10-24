"""Analyze symbol hit-rates"""

import json
import os
from src.config.paths import PATH_TO_GAMES


class HitRateCalculations:
    """Calculate hit-rates of symbol and search key combinations."""

    def __init__(self, game_id, mode, mode_cost):
        self.game_id = game_id
        self.mode = mode
        self.cost = mode_cost
        self.initialize_file()

    def initialize_file(self) -> None:
        """Initialize force files and lookup tables."""
        force_file = os.path.join(
            PATH_TO_GAMES, self.game_id, "library", "forces", f"force_record_{self.mode}.json"
        )
        lut_file = os.path.join(
            PATH_TO_GAMES, self.game_id, "library", "publish_files", f"lookUpTable_{self.mode}_0.csv"
        )
        with open(force_file, "r", encoding="UTF-8") as f:
            file_dict = json.load(f)
            all_keys = [d.keys() for d in file_dict]
        f.close()

        lut_ids = []
        weights = []
        payouts = []
        with open(lut_file, "r", encoding="UTF-8") as f:
            for line in f:
                lut_ids.append(int(line.strip().split(",")[0]))
                weights.append(int(line.strip().split(",")[1]))
                payouts.append(float(line.strip().split(",")[2]))
        f.close()

        self.weights = weights
        self.total_weight = sum(self.weights)
        self.payouts = payouts
        self.force_dict = file_dict
        self.all_keys = all_keys

    def get_hit_rates(self, unique_ids: list) -> float:
        """Get hit-rates using inverse probabilities from optimized lookup tables."""
        cumulative_weight = 0
        for idx in unique_ids:
            cumulative_weight += self.weights[idx - 1]

        prob = cumulative_weight / self.total_weight
        try:
            return 1 / prob
        except ZeroDivisionError:
            return 0

    def get_av_wins(self, unique_ids: list) -> float:
        """Return average win amount for a specified list of simulation ids."""
        search_key_tot_weight = 0
        # find out the total payout and weights from the force keys subset of the lookup table
        for id in unique_ids:
            search_key_tot_weight += self.weights[id - 1]
        average_win = 0
        # multiply each win in the subset of lookup table by the ratio of its weight to normalize the avg payout
        for id in unique_ids:
            norm_payout = self.payouts[id - 1] * (self.weights[id - 1] / search_key_tot_weight)
            average_win += norm_payout
        try:
            return average_win
        except ZeroDivisionError:
            return 0

    def get_sim_count(self, search_key: dict) -> int:
        """Get raw sim count with partial or complete matches to force file keys."""
        search_key_count = 0
        for key in self.force_dict:
            transform_dict = {}
            for i in key["search"]:
                transform_dict[i["name"]] = i["value"]
            if all(transform_dict.get(x) == y for x, y in search_key.items()):
                search_key_count += key["timesTriggered"]
        return search_key_count

    def return_valid_ids(self, search_key) -> list:
        """Extract all ids with a partial match to search conditions."""
        valid_ids = []
        for item in self.force_dict:
            transform_dict = {}
            for i in item["search"]:
                transform_dict[i["name"]] = str(i["value"])

            if all(transform_dict.get(k) == v for k, v in search_key.items()):
                validIDs = item["bookIds"]
                valid_ids.extend(validIDs)

        return valid_ids


def construct_symbol_keys(config) -> list:
    """Return symbol keys from paytable."""
    search_keys = []
    for symTuple in list(config.paytable.keys()):
        search_keys.append({"kind": str(symTuple[0]), "symbol": str(symTuple[1])})

    return search_keys


def analyse_search_keys(config, modes_to_analyse: list, search_keys: list[dict]) -> type:
    """Extract win information from search keys."""
    hr_summary, av_win_summary, sim_count_summary = {}, {}, {}
    for mode in modes_to_analyse:
        for bm in config.bet_modes:
            if bm.get_name() == mode:
                cost = bm._cost
                break
        GameObject = HitRateCalculations(config.game_id, mode, mode_cost=cost)
        hr_summary[mode], av_win_summary[mode], sim_count_summary[mode] = {}, {}, {}
        for search_key in search_keys:
            valid_key_ids = GameObject.return_valid_ids(search_key)
            hr = GameObject.get_hit_rates(valid_key_ids)
            avg_win = GameObject.get_av_wins(valid_key_ids)
            key_instances = GameObject.get_sim_count(search_key)
            hr_summary[mode][str(search_key)] = hr
            av_win_summary[mode][str(search_key)] = avg_win
            sim_count_summary[mode][str(search_key)] = key_instances

    return hr_summary, av_win_summary, sim_count_summary


def construct_symbol_probabilities(config, modes_to_analyse: list) -> type:
    """Find hit-rates of all symbol combinations."""
    check_file = []
    for mode in modes_to_analyse:
        force_file = os.path.join(config.library_path, "forces", f"force_record_{mode}.json")
        check_file.append(os.path.isfile(force_file))
    if not all(check_file):
        raise RuntimeError("Force File Does Not Exist.")

    symbol_search_keys = construct_symbol_keys(config)
    hr_summary, av_win_summary, sim_count_summary = analyse_search_keys(
        config, modes_to_analyse, symbol_search_keys
    )
    return hr_summary, av_win_summary, sim_count_summary


def construct_custom_key_probabilities(config, modes_to_analyse, custom_search) -> type:
    """Analyze win information from user defined search keys."""
    check_file = []
    for mode in modes_to_analyse:
        force_file = os.path.join(config.library_path, "forces", f"force_record_{mode}.json")
        check_file.append(os.path.isfile(force_file))
    if not all(check_file):
        raise RuntimeError("Force File Does Not Exist.")

    hr_summary, av_win_summary, sim_count_summary = analyse_search_keys(config, modes_to_analyse, custom_search)

    return hr_summary, av_win_summary, sim_count_summary
