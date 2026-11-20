"""Pydantic response models for the API."""
from pydantic import BaseModel, ConfigDict, Field, model_validator


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FiltersResponse(_Strict):
    teams: list[str]
    downs: list[int]
    formations: list[str]
    coverages: list[str]
    pass_results: list[str]


class Meta(_Strict):
    total_plays: int
    avg_yards: float
    completion_pct: float
    sack_rate: float
    avg_time_to_throw: float


class GridItem(_Strict):
    x_bin: int = Field(ge=0)
    y_bin: int = Field(ge=0)
    intensity: float = Field(ge=0, le=1)
    plays_count: int = Field(ge=1)
    success_rate: float = Field(ge=0, le=1)
    avg_epa_or_yards: float


class TopPlayer(_Strict):
    nflId: int
    name: str
    position: str
    metric_value: float
    metric_label: str


class YardsByDownItem(_Strict):
    down: int = Field(ge=1, le=4)
    avg_yards: float


class HeatmapResponse(_Strict):
    meta: Meta
    grid: list[GridItem]
    top_players: list[TopPlayer] = Field(max_length=10)
    yards_by_down: list[YardsByDownItem] = Field(min_length=4, max_length=4)

    @model_validator(mode="after")
    def _downs_in_order(self) -> "HeatmapResponse":
        if [i.down for i in self.yards_by_down] != [1, 2, 3, 4]:
            raise ValueError("yards_by_down must contain downs 1, 2, 3, 4 in order")
        return self
