"""Construct optimization class from GameConfig.bet_mode specifications."""


class OptimizationParameters:
    """Construct optimization parameter class for each bet mode."""

    # TODO: PUT IN OPPOSITE AND DEFAULT "X" CONDITIONS

    def __init__(
        self,
        rtp: float = None,
        av_win: float = None,
        hr: float = None,
        bet_cost: float = None,
        search_conditions=None,
    ):
        if rtp is None or rtp == "x":
            assert all([av_win is not None, hr is not None]), "if RTP is not specified, hit-rate (hr) "
            rtp = round(av_win / hr, 5)
        none_count = sum([1 for x in [rtp, av_win, hr] if x is None])
        assert none_count < 3, "Criteria RTP is ill defined."
        assert bet_cost is not None, "Define a bet-cost for parameter."

        if rtp is None:
            rtp = round(av_win / hr, 5)
        elif av_win is None and all([rtp is not None, hr is not None]):
            av_win = round(rtp * hr, 5)
        elif hr is None:
            if rtp != 0 and av_win is not None:
                hr = round((av_win / rtp) / bet_cost, 5)
            else:
                hr = "x"

        search_range, force_search = (-1, -1), {}
        if isinstance(search_conditions, (float, int)):
            search_range = (search_conditions, search_conditions)
            force_search = {}
        elif isinstance(search_conditions, tuple):
            assert search_conditions[0] <= search_conditions[1], "Enter (min, max) payout format."
            search_range = search_conditions
            force_search = {}
        elif isinstance(search_conditions, dict):
            search_range = (-1, -1)
            force_search = search_conditions

        self.rtp = rtp
        self.av_win = av_win
        self.hr = hr
        self.search_range = search_range
        self.force_search = force_search
        self.params = self.to_dict()

    def to_dict(self):
        """JSON readable"""
        data_struct = {
            "rtp": self.rtp,
            "hr": self.hr,
            "av_win": self.av_win,
            "search_range": self.search_range,
            "force_search": self.force_search,
        }
        return data_struct
