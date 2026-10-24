class Option:
    def __init__(self, name, value):
        self.name = name
        self.value = value

    def toJson(self):
        return {"name": self.name, "value": self.value}

    def __eq__(self, __value: object) -> bool:
        if type(__value) == type(self):
            return str(__value.name) == str(self.name) and str(__value.value) == str(self.value)
        return False


class Search:
    def __init__(self, forceOptions=None):
        self.forceOptions: list[Option] = []
        if not forceOptions == None:
            if type(forceOptions) == dict:
                self.addOptionsDict(forceOptions)
            else:
                self.forceOptions = forceOptions

    def addOption(self, newOption):
        self.forceOptions.append(newOption)

    def addOptionsDict(self, forceOptions):
        for forceOption in forceOptions:
            self.addOption(Option(forceOption, forceOptions[forceOption]))

    def __eq__(self, __value: object) -> bool:
        if type(__value) == self:
            isEqual = True
            for option1 in self.forceOptions:
                for option2 in self.forceOptions:
                    if option1.name == option2.name:
                        if not (option1.value == option2.value or option1.value == None or option2.value == None):
                            isEqual = False
                            break

            return isEqual
        return False

    def toJson(self):
        json_object = []
        for option in self.forceOptions:
            json_object.append(option.toJson())

        return json_object


class IdentityCondition:
    """Return simulation ids which fulfil force-search or payout value conditions."""

    def __init__(self, search={}, opposite=False, win_amount=-1, win_range=(-1, -1)):
        if win_amount != -1:
            if win_range != (-1, -1):
                raise Exception("Can't have both a win_amout and win_range condition.")
            win_range = (win_amount, win_amount)
        if search != {} and (win_range != (-1, -1)):
            raise Exception("Can't have both a search condition and a win amount or win range condition.")
        self.search: Search = Search(search)
        self.opposite: bool = opposite
        self.win_range_start: float = float(win_range[0])
        self.win_range_end: float = float(win_range[1])

    def toJson(self):
        return {
            "search": self.search.toJson(),
            "opposite": self.opposite,
            "win_range_start": self.win_range_start,
            "win_range_end": self.win_range_end,
        }
