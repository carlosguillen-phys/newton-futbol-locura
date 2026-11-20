# Implementation Plan: NFL ETL and Heatmap API

## Overview

Implementation language: Python 3.12.12 inside `.venv`, on the fixed stack (FastAPI 0.115.14, Uvicorn 0.34.3, Pydantic 2.11.7, pandas 2.2.3, numpy 2.1.3, pytest 8.3.5, httpx 0.28.1). No new dependencies, no `pyarrow`, no Hypothesis, no Docker. Persistence uses gzip pickle (`DataFrame.to_pickle(..., compression="gzip")`).

The plan follows the design order: profiler, pure ETL functions (normalization, phases, metrics, target inference), store and pipeline with Persist_Run, then the API (schemas, heatmap logic including `yards_by_down`, endpoints), then documentation and the two generated artifacts (`DATA_REPORT.md` and `data/processed/`).

Conventions for all tasks:

- Imports use the `backend.` prefix. Run tools with `.venv/bin/python`, `.venv/bin/pytest`, `.venv/bin/uvicorn`.
- `data/` originals are read-only. Only `data/processed/` may be written, and only by the Persist_Run script.
- Property tests are plain pytest tests that loop at least 100 iterations over inputs from `numpy.random.default_rng(seed)`. Each carries the comment `# Feature: nfl-etl-and-heatmap-api, Property N: <title>`. Each property lives in its own file `backend/tests/test_prop_NN_<name>.py`.
- Tests run with no network, no `.env` and no AWS credentials.

## Tasks

- [x] 1. Set up package structure, constants and test scaffolding
  - Create `backend/etl/__init__.py`, `backend/scripts/__init__.py`, `backend/tests/__init__.py` (keep the existing `backend/__init__.py` and `backend/main.py`)
  - Create `backend/etl/constants.py` with `TRACKING_COLS` and explicit dtypes, `NA_VALUES = ["NA", "None"]`, `EVENT_ALIASES`, `USE_AUTOEVENTS`, `LAYERS`, `PASS_RESULTS`, `GRID_SIZE = 5`, `X_BIN_MAX = 115`, `Y_BIN_MAX = 50`, `DATA_DIR`, `PROCESSED_DIR`, and the `TABLE_NAMES` tuple of nine names
  - Add `pytest` configuration (`pytest.ini` or `pyproject` section) so `.venv/bin/pytest` finds `backend/tests/`
  - Add `backend/tests/helpers.py` with small synthetic CSV writers for games, plays, players, pff and tracking files used by later tests
  - _Requirements: 2.3, 2.4, 14.1_

- [x] 2. Implement the data profiling script
  - [x] 2.1 Implement `backend/scripts/profile_data.py`
    - Read `games`, `plays`, `players`, `pffScoutingData` fully with `dtype=str` and `keep_default_na=False`, counting empty cells, `NA` and `None` as null per real column name
    - Read each Tracking_File one at a time, keeping only counters and key sets (`gameId`, `(gameId, playId)`, `nflId`, per-track frame min, max, count), then release the frame
    - Compute orphan counts and percentages in both directions for the three key relations, `frameId` continuity, and sorted value counts (nulls as separate entry) for `passResult`, `offenseFormation`, `pff_passCoverage`, `pff_passCoverageType`, `pff_role`, `event`, `officialPosition`
    - Render the report in memory, write `DATA_REPORT.md` to the project root only after all files were read, print the stdout summary, exit 0
    - On a missing or unreadable file or an empty `data/tracking/`, print path and error to stderr, leave `DATA_REPORT.md` untouched, exit non-zero
    - Open all inputs read-only. Expose `main() -> int` and run with `.venv/bin/python -m backend.scripts.profile_data`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

  - [ ]* 2.2 Write unit tests for the profiler
    - Use a synthetic data dir in `tmp_path`: check report sections, null percentages, orphan counts, frame continuity, stdout summary and exit 0
    - Check missing-file and empty-tracking exit codes and that an existing `DATA_REPORT.md` is untouched on failure
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12_

- [x] 3. Implement spatial normalization and phase labeling
  - [x] 3.1 Implement `backend/etl/normalize.py`
    - `normalize_frame(df) -> (DataFrame, excluded_count)`: `left` gives `x_norm = 120 - x`, `y_norm = 53.3 - y`, and `(v + 180) % 360` for non-null `o` and `dir`; `right` copies values; nulls stay null; rows with other or null `playDirection` are excluded and counted
    - Handle frames without `o` and `dir` columns
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 3.9_

  - [ ]* 3.2 Write property test for normalization formulas
    - File `backend/tests/test_prop_01_normalization_formulas.py`
    - **Property 1: Spatial normalization formulas and null preservation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

  - [ ]* 3.3 Write property test for the left normalization round trip
    - File `backend/tests/test_prop_02_normalization_roundtrip.py`
    - **Property 2: Left normalization round trip**
    - **Validates: Requirements 3.7**

  - [ ]* 3.4 Write property test for normalized angle range
    - File `backend/tests/test_prop_03_angle_range.py`
    - **Property 3: Normalized angles stay in range**
    - **Validates: Requirements 3.8**

  - [ ]* 3.5 Write property test for invalid direction exclusion
    - File `backend/tests/test_prop_04_invalid_direction.py`
    - **Property 4: Invalid directions are excluded and counted**
    - **Validates: Requirements 3.9**

  - [ ]* 3.6 Write example tests for normalization
    - File `backend/tests/test_normalize_examples.py`
    - At least 4 cases including one `left` and one `right`, and 3 round-trip inputs with tolerance 1e-6
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 14.2_

  - [x] 3.7 Implement `backend/etl/phases.py`
    - `event_bounds(frames)`: lowest `frameId` per canonical event, manual event name preferred over its `autoevent_` alias, controlled by `USE_AUTOEVENTS`
    - `label_phases(frame_ids, snap, forward, arrived)`: phase rules with null for frames whose needed boundary is missing, and all-null when the three boundaries are out of order
    - `time_to_throw(snap, forward)`: `(forward - snap) / 10.0`, null when a frame is missing or `forward < snap`
    - _Requirements: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 5.1, 5.2, 5.3, 5.11_

  - [ ]* 3.8 Write property test for phase labeling
    - File `backend/tests/test_prop_06_phase_labelling.py`
    - **Property 6: Phase labelling**
    - **Validates: Requirements 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.10, 4.11**

  - [ ]* 3.9 Write property test for the event boundary
    - File `backend/tests/test_prop_07_event_boundary.py`
    - **Property 7: Event boundary is the lowest frame**
    - **Validates: Requirements 4.9**

  - [ ]* 3.10 Write property test for Time_To_Throw
    - File `backend/tests/test_prop_08_time_to_throw.py`
    - **Property 8: Time_To_Throw**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.11**

- [x] 4. Implement play metrics and target inference
  - [x] 4.1 Implement `backend/etl/metrics.py`
    - `pressure_counts(pff)`: per play `n_hurry`, `n_hit`, `n_sack` (count of values equal to 1, NaN as 0) and `pressure`
    - `separation_at_frame(pos)`: numpy broadcasting per play between `Pass Route` and `Coverage` players, per-receiver nearest distance and per-play `min_separation` with lowest `nflId` tie-break, no rows when either side is empty
    - `qb_position(rows)`: `Pass` role position at `pass_forward`, else `ball_snap`
    - _Requirements: 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 5.10_

  - [ ]* 4.2 Write property test for pressure flag and counts
    - File `backend/tests/test_prop_09_pressure.py`
    - **Property 9: Pressure flag and counts**
    - **Validates: Requirements 5.4, 5.5, 5.6**

  - [ ]* 4.3 Write property test for separation geometry
    - File `backend/tests/test_prop_10_separation.py`
    - Compare against a brute-force distance computation
    - **Property 10: Separation geometry**
    - **Validates: Requirements 5.7, 5.8, 5.9, 5.10**

  - [x] 4.4 Implement `backend/etl/targets.py`
    - `infer_targets(plays, pff, players)`: parse the first `to <Initial>.<Surname>` after `pass` in `playDescription` (accepting `Dj.` style initials, hyphens, `Jr.`, `II`), match against abbreviated names of the play's `Pass Route` players, return `nflId` only for exactly one match, null for `S`, `R`, no name, zero or ambiguous matches
    - Return a nullable `Int32` series and log the resolved ratio
    - _Requirements: 11.17, 11.21_

  - [ ]* 4.5 Write property test for target inference
    - File `backend/tests/test_prop_12_target_inference.py`
    - **Property 12: Target inference**
    - **Validates: Requirements 11.17, 11.21**

  - [ ]* 4.6 Write example test for a synthetic play
    - File `backend/tests/test_synthetic_play.py`
    - One play of at most 5 frames and 4 players: phase labels non-decreasing, Time_To_Throw and Min_Separation equal hand-computed values within 1e-6
    - _Requirements: 4.10, 5.1, 5.7, 14.3_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement the store, cleaning pipeline and Persist_Run
  - [x] 6.1 Implement `backend/store.py`
    - `Store` dataclass, `StoreHolder` (`status` loading/ready/failed, `store`, `error`)
    - `save_store(store, out_dir)`: create `out_dir` when absent, write each table to `<table>.pkl.gz.tmp` with `to_pickle(..., compression="gzip")`, `os.replace` to the final name, on failure remove that temp file, log table name and error, raise `PersistError`
    - `load_store(in_dir)`: read the nine `<table>.pkl.gz` files, raise on a missing or unreadable file, check that grid `pidx` values are smaller than `len(plays)`, ignore `*.tmp`
    - `load_or_build(processed_dir, data_dir)`: load when complete and readable, otherwise import `build_store` lazily and build in memory, never write, modify or delete
    - _Requirements: 6.2, 6.6, 6.7, 6.8, 6.11, 6.12, 6.13, 6.14_

  - [x] 6.2 Implement `build_store` in `backend/etl/clean_pipeline.py`
    - Read `plays`, `players`, `pffScoutingData` with `na_values=NA_VALUES`, keep plays with non-null `passResult`, sort by `gameId, playId`, assign `pidx`
    - Loop over sorted `tracking_*.csv`: read one file with `usecols`, explicit dtypes and `na_values`, split ball and player rows before dropping any row, normalize, compute event bounds, ball fragment, analysis-frame fragments (separation, receivers, QB position), then release the frame
    - A parse error logs file name and error, discards that file's fragments, counts it as skipped. Log processed and skipped counts and excluded-direction row count. Raise `NoTrackingDataError` when no file was processed
    - Apply the arrival-frame rule with `allow_last_frame_fallback` and store `arrival_source`
    - Finalize the nine tables (`plays`, `ball`, `receivers`, `rushers`, `players`, four `grid_*` tables) with the documented columns, bins (`floor(v / 5) * 5` clamped), explicit dtypes and deterministic sorting, log table name, seconds (2 decimals) and rows per table, and require at least 1 row per table
    - Write nothing to disk
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 3.9, 4.1, 4.2, 4.8, 5.12, 6.1, 6.3, 6.4, 6.5, 6.9, 11.6, 11.22_

  - [ ]* 6.3 Write property test for store persistence round trip
    - File `backend/tests/test_prop_13_persistence_roundtrip.py`
    - **Property 13: Store persistence round trip**
    - **Validates: Requirements 6.2**

  - [ ]* 6.4 Write property test for the Persist_Run write protocol
    - File `backend/tests/test_prop_26_persist_run.py`
    - Force a writer failure at a random table index with `monkeypatch`
    - **Property 26: Persist_Run leaves only complete files**
    - **Validates: Requirements 6.2, 6.11, 6.12, 6.13**

  - [x] 6.5 Implement `main()` Persist_Run in `backend/etl/clean_pipeline.py`
    - Build the store, call `save_store(store, PROCESSED_DIR)`, return 0, return 1 on `NoTrackingDataError` or `PersistError`
    - Add `if __name__ == "__main__": raise SystemExit(main())` so `.venv/bin/python -m backend.etl.clean_pipeline` works
    - _Requirements: 2.7, 6.2, 6.11, 6.12, 6.13, 6.15_

  - [ ]* 6.6 Write property test for ball/player split
    - File `backend/tests/test_prop_05_ball_player_split.py`
    - **Property 5: Ball/player split conserves rows and the ball table is well formed**
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 6.7 Write property test for pass-play restriction
    - File `backend/tests/test_prop_11_pass_plays_only.py`
    - **Property 11: Only pass plays enter the aggregates**
    - **Validates: Requirements 5.12**

  - [ ]* 6.8 Write property test for read-only startup
    - File `backend/tests/test_prop_27_startup_read_only.py`
    - Cover absent, complete, partial, unreadable and stale-`*.tmp` directories, with `build_store` spied
    - **Property 27: Startup never writes data/processed**
    - **Validates: Requirements 6.6, 6.7, 6.8, 6.14**

  - [ ]* 6.9 Write pipeline integration example tests
    - File `backend/tests/test_pipeline_integration.py`
    - On a 3-file synthetic data dir: all nine tables present with at least 1 row, two builds identical in columns, dtypes, order and values, no files created, SHA-256 of inputs unchanged, a corrupt file skipped and counted, all-corrupt raises, `NA` and `None` read as null in numeric and `event` columns
    - Check `caplog` for one entry per table with seconds and rows, and the processed/skipped counts
    - Persist_Run example: `main()` creates `data/processed/` when absent, writes nine files, leaves no `*.tmp`, exits 0, and the forced-failure case exits non-zero with the table name logged; then `load_or_build` loads the files with `build_store` spied and not called
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 6.1, 6.3, 6.4, 6.5, 6.6, 6.9, 6.11, 6.12, 6.13, 14.10_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement the FastAPI application and heatmap logic
  - [x] 8.1 Implement `backend/schemas.py`
    - Pydantic models `FiltersResponse`, `Meta`, `GridItem`, `TopPlayer`, `YardsByDownItem`, `HeatmapResponse`, all with `extra="forbid"`
    - Field constraints from the design, `top_players` max 10, `yards_by_down` exactly 4 items and a validator that the downs are `[1, 2, 3, 4]` in order
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.11_

  - [x] 8.2 Implement `backend/heatmap.py`
    - `num(v, nd)` helper turning None, NaN and infinity into 0.0 and rounding otherwise
    - `build_mask(plays, team, down, formation, coverage, pass_result)` with exact, case-sensitive AND filters
    - Meta metrics with the rounding rules and zeros for empty input
    - Per-layer grid aggregation (`targets`, `routes`, `pocket_pressure`, `separation`) from the grid tables via `pidx`, with distinct `plays_count`, per-layer `success_rate`, `avg_epa_or_yards` as mean `playResult`, `intensity` normalized by the unrounded maximum, items sorted by `(x_bin, y_bin)`
    - `yards_by_down(plays_f)`: always four items for downs 1 to 4, mean `playResult` rounded to one decimal, 0 for downs without plays, independent of `layer`
    - Top players per layer with the labels `Targets`, `Presiones generadas`, `Yardas separación prom.`, at least 3 plays for separation, ties by `name` then `nflId`, empty `name` and `position` for unknown `nflId`
    - `compute_heatmap(store, layer, mask)` returning a `HeatmapResponse`, with the empty result when no play matches
    - _Requirements: 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.12, 10.6, 10.7, 10.8, 10.9, 10.10, 10.11, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 11.15, 11.16, 11.17, 11.18, 11.19, 11.20, 11.21, 11.22, 11.23, 11.24, 11.25, 12.1, 12.2, 12.3_

  - [x] 8.3 Implement endpoints in `backend/main.py`
    - Keep `cargar_env()` exactly as in the project rules at the top of the file, called once, before any other project import, with no `boto3` import and no reading of AWS key variables
    - `CORSMiddleware` with `allow_origins=["http://localhost:5173"]`, `allow_methods=["GET"]`, `allow_headers=["*"]`
    - `lifespan` creates the `StoreHolder` in `app.state.holder` and starts a daemon thread running `load_or_build`, catching every exception, logging it and setting status `failed`, and logging the build time in seconds on success
    - `GET /health` returns `{"status": "ok"}` without touching the holder
    - `GET /api/filters` returns sorted distinct lists computed once and cached, `downs = [1, 2, 3, 4]`, `pass_results = ["C", "I", "S", "R", "IN"]`
    - `GET /api/heatmap` with optional `team`, `down`, `formation`, `coverage`, `pass_result`, `layer` (default `targets`), manual validation returning 422 with a string `detail`, then 503 with a string `detail` when the store is loading or failed, `response_model=HeatmapResponse`
    - Expose `get_holder` as a dependency for `app.dependency_overrides`. Add no other application routes and no file writes after startup
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 9.1, 9.8, 9.9, 9.10, 9.11, 9.13, 12.4, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 8.4 Create the synthetic store factory
    - File `backend/tests/factories.py`: `make_store(rng, ...)` building all nine tables with the real dtypes, including NaN, null, empty-string and missing-frame cases, and a helper that builds a `TestClient` with `app.dependency_overrides` pointing to a ready holder
    - _Requirements: 14.1, 14.4_

  - [ ]* 8.5 Write property test for filter lists
    - File `backend/tests/test_prop_14_filter_lists.py`
    - **Property 14: Filter lists**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.10**

  - [ ]* 8.6 Write property test for filter conjunction
    - File `backend/tests/test_prop_15_filter_conjunction.py`
    - **Property 15: Filter conjunction**
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.12**

  - [ ]* 8.7 Write property test for invalid parameters
    - File `backend/tests/test_prop_16_invalid_params.py`
    - **Property 16: Invalid parameters return 422**
    - **Validates: Requirements 9.9, 9.10, 9.11, 9.13**

  - [ ]* 8.8 Write property test for unknown query parameters
    - File `backend/tests/test_prop_17_unknown_params.py`
    - **Property 17: Unknown query parameters are ignored**
    - **Validates: Requirements 12.4**

  - [ ]* 8.9 Write property test for response schema and finite numbers
    - File `backend/tests/test_prop_18_response_schema.py`
    - **Property 18: Response schema, rounding and finite numbers**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 12.1, 12.2**

  - [ ]* 8.10 Write property test for grid binning
    - File `backend/tests/test_prop_19_grid_binning.py`
    - **Property 19: Grid binning**
    - **Validates: Requirements 11.6**

  - [ ]* 8.11 Write property test for layer aggregation
    - File `backend/tests/test_prop_20_layer_aggregation.py`
    - Compare each layer against a brute-force reference
    - **Property 20: Layer aggregation matches a reference**
    - **Validates: Requirements 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14, 11.15, 10.9, 10.10**

  - [ ]* 8.12 Write property test for meta formulas
    - File `backend/tests/test_prop_21_meta_formulas.py`
    - **Property 21: Meta formulas**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

  - [ ]* 8.13 Write property test for top players ranking
    - File `backend/tests/test_prop_22_top_players.py`
    - **Property 22: Top players ranking**
    - **Validates: Requirements 10.4, 11.16, 11.17, 11.18, 11.19, 11.20, 11.21, 12.3**

  - [ ]* 8.14 Write property test for plays without the layer frame
    - File `backend/tests/test_prop_23_missing_layer_frame.py`
    - **Property 23: Plays without the layer frame stay in the total**
    - **Validates: Requirements 11.22**

  - [ ]* 8.15 Write property test for yards by down
    - File `backend/tests/test_prop_24_yards_by_down.py`
    - **Property 24: Yards by down**
    - **Validates: Requirements 10.11, 10.6, 11.23, 11.25**

  - [ ]* 8.16 Write property test for the down filter and yards by down
    - File `backend/tests/test_prop_25_down_filter_yards.py`
    - **Property 25: Down filter isolates yards by down**
    - **Validates: Requirements 11.24**

  - [ ]* 8.17 Write API example tests
    - File `backend/tests/test_api_examples.py`, using `httpx`-based `TestClient`
    - `/health` body `{"status": "ok"}`; `/api/filters` and `/api/heatmap` shapes and types including `yards_by_down` with 4 items ordered 1 to 4
    - One invalid case per Requirement 9 validation rule giving 422 with a string `detail` and no heatmap keys
    - Filters that match nothing give the empty result with four `avg_yards` equal to 0 and no error
    - Synthetic plays with known `down` and `playResult`: hand-computed means to one decimal, downs without plays 0, `down` filter gives 0 for the other three
    - CORS: `Origin: http://localhost:5173` gives a matching `Access-Control-Allow-Origin`
    - Holder `loading` and `failed` give 503 on data endpoints and 200 on `/health`; `/health` and data endpoints work with the three AWS variables unset
    - _Requirements: 7.3, 7.6, 7.8, 7.9, 7.10, 8.9, 9.9, 9.10, 9.11, 9.13, 10.11, 11.23, 11.24, 11.25, 12.1, 14.4, 14.5, 14.6, 14.7, 14.9_

  - [ ]* 8.18 Write startup source selection tests
    - File `backend/tests/test_startup_source.py`
    - With `TestClient` as a context manager: a complete `data/processed/` loads without calling `build_store`; an absent, partial or unreadable directory builds in memory and leaves the directory unchanged; the build time log entry is written
    - _Requirements: 6.6, 6.7, 6.8, 6.14, 7.7, 13.4, 13.5, 14.10_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Documentation and generated artifacts
  - [x] 10.1 Document the pipeline in `README.md`
    - Add the commands: profiler, Persist_Run (`.venv/bin/python -m backend.etl.clean_pipeline`), `.venv/bin/uvicorn backend.main:app --port 8000`, `.venv/bin/pytest`
    - State that `data/processed/` is excluded by `.gitignore`, is not delivered, and that the server rebuilds the store in memory at startup (roughly 15 to 30 s) unless the team changes `.gitignore`, a decision that belongs to the team
    - State that the user must run the Persist_Run locally to persist the tables so later restarts load the files
    - List the proposed amendments A to H from the design for the team to confirm
    - _Requirements: 6.10, 6.15_

  - [ ]* 10.2 Write smoke test for README statements
    - File `backend/tests/test_readme_smoke.py`
    - Check the README contains the Persist_Run command and the statement that the store is rebuilt in memory when `data/processed/` is absent
    - _Requirements: 6.10, 6.15_

  - [x] 10.3 Run the profiler to generate `DATA_REPORT.md`
    - Run `.venv/bin/python -m backend.scripts.profile_data` from the project root
    - Confirm exit 0, that `DATA_REPORT.md` exists at the project root with all sections, and that `data/` originals are unchanged
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.12_

  - [x] 10.4 Run the Persist_Run to create `data/processed/`
    - Run `.venv/bin/python -m backend.etl.clean_pipeline` from the project root
    - Confirm exit 0, nine `*.pkl.gz` files, no `*.tmp` file, logged per-table times and row counts, and processed plus skipped equal to 122
    - Confirm the API then starts from the files: `GET /health`, `GET /api/filters` and `GET /api/heatmap` respond correctly using `TestClient` against the real files
    - _Requirements: 2.6, 6.1, 6.2, 6.6, 6.9, 6.11, 6.12, 6.15_

  - [ ]* 10.5 Write a latency benchmark script
    - File `backend/scripts/bench_api.py`: 100 sequential requests each to `/api/filters` and `/api/heatmap` with varied valid filters on the real store, printing p95 against the 100 ms and 500 ms targets. It is not collected by the default pytest run
    - _Requirements: 13.1, 13.2_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints ensure incremental validation.
- Property tests validate universal correctness properties with seeded numpy loops (no Hypothesis, per Requirement 14.1).
- Example tests validate specific cases, error conditions and the API contract.
- Tasks 10.3 and 10.4 run local scripts to produce `DATA_REPORT.md` and `data/processed/`, as requested. Both outputs are excluded or optional for delivery per `.gitignore` and the team's decision.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "3.1", "3.7", "4.1", "4.4"] },
    { "id": 2, "tasks": ["2.2", "3.2", "3.3", "3.4", "3.5", "3.6", "3.8", "3.9", "3.10", "4.2", "4.3", "4.5", "4.6"] },
    { "id": 3, "tasks": ["5"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["6.2", "6.3", "6.4"] },
    { "id": 6, "tasks": ["6.5", "6.6", "6.7", "6.8"] },
    { "id": 7, "tasks": ["6.9"] },
    { "id": 8, "tasks": ["7"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2"] },
    { "id": 11, "tasks": ["8.3", "8.4"] },
    { "id": 12, "tasks": ["8.5", "8.6", "8.7", "8.8", "8.9", "8.10", "8.11", "8.12", "8.13", "8.14", "8.15", "8.16", "8.17", "8.18"] },
    { "id": 13, "tasks": ["9"] },
    { "id": 14, "tasks": ["10.1", "10.3", "10.4", "10.5"] },
    { "id": 15, "tasks": ["10.2"] },
    { "id": 16, "tasks": ["11"] }
  ]
}
```
