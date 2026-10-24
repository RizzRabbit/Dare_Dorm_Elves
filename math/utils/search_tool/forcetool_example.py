"""Demonstartion of how to search recorded results for matching criteria"""

from forcetool_ids import ForceTool


def run(game: str, mode: str):
    """Test single and multiple search criteria."""
    ForceObject = ForceTool(game, mode)

    # Find force-file entries containing exactly the provided key/value pairs
    single_serach_condition = {"gametype": "freegame", "symbol": "H1", "kind": "5"}
    match_ids = ForceObject.find_partial_key_match(single_serach_condition, mode)
    ForceObject.print_search_results(single_serach_condition, match_ids, "test_single_search.json", mode)

    # Find the intersection of partial key matches
    multi_search_condition = [
        {"gametype": "basegame", "kind": "5", "symbol": "scatter"},
        {"gametype": "freegame", "symbol": "H1", "kind": "5"},
    ]
    intersection_ids = ForceObject.find_union_key_match(multi_search_condition, mode)
    ForceObject.print_search_results(multi_search_condition, intersection_ids, "test_multi_search.json", mode)

    # Find wins witin a specified payout range (1000x >= X > 2000x)
    payout_ids = ForceObject.find_payout_range_ids(
        method="RANGE", min_payout=int(1000 * 100), max_payout=int(2000 * 100), count_limit=100
    )
    ForceObject.print_search_results({"method": "payout_search"}, payout_ids, "test_range_search.json", mode)


if __name__ == "__main__":

    game_id = "0_0_lines"
    game_mode = "base"
    run(game_id, game_mode)
