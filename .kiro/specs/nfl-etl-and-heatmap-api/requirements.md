# Requirements Document

## Introduction

This feature delivers two ordered stages for the NFL Big Data Bowl UNAM hackathon project. Stage 1 profiles, audits and cleans the raw NFL tracking, play, player and PFF scouting data in `data/` and produces pre-aggregated tables. Stage 2 exposes those tables through a FastAPI backend (`backend/main.py`) with `GET /health`, `GET /api/filters` and `GET /api/heatmap`. No other endpoints are in scope.

Constraints taken from the project rules and the repository inspection:

- Stack is fixed: Python 3.12.12 in `.venv`, FastAPI 0.115.14, Uvicorn 0.34.3, Pydantic 2.11.7, pandas 2.2.3, numpy 2.1.3, pytest 8.3.5. No new dependencies and no Docker.
- `data/` is read-only for the original files. The server is ephemeral, so the API must not rely on writing files at runtime.
- `pyarrow` is not part of the fixed stack, so Parquet and Feather are unavailable. The processed format must be one that pandas 2.2.3 reads and writes natively (pickle or gzip-compressed CSV).
- `.gitignore` excludes `data/processed/` and `data/*.csv`. Processed files are therefore not delivered unless the team changes `.gitignore`. The API must be able to build the aggregates in memory at startup from the raw files, and may load files from `data/processed/` when they exist.
- Observed raw schema: tracking CSVs have no `displayName` column. Football rows have `nflId` = NA and `team` = `football`. `displayName` exists only in `players.csv`. Missing values appear as the literal `NA`, and the tracking `event` column uses the literal `None` for frames without an event. There are 122 tracking files in `data/tracking/`.
- The original request was cut off after the heatmap schema. This document covers only the known contract.

## Glossary

- **Profiler**: The script `backend/scripts/profile_data.py` that inspects the raw data.
- **Data_Report**: The Markdown file `DATA_REPORT.md` produced by the Profiler.
- **Cleaning_Pipeline**: The module `backend/etl/clean_pipeline.py` that normalizes and aggregates the raw data.
- **Processed_Store**: The set of clean datasets and pre-aggregated tables produced by the Cleaning_Pipeline, held in memory and optionally saved under `data/processed/`.
- **API**: The FastAPI application `app` defined in `backend/main.py`.
- **Tracking_File**: A CSV file matching `data/tracking/tracking_*.csv`.
- **Player_Row**: A tracking row with a non-null `nflId` and `team` different from `football`.
- **Ball_Row**: A tracking row with `team` equal to `football` or `nflId` null.
- **Play**: A unique combination of `gameId` and `playId`.
- **Normalized_Coordinates**: Coordinates where the offense attacks left to right, with `x` in 0 to 120 and `y` in 0 to 53.3.
- **Phase**: One of `pre_snap`, `pocket_phase`, `ball_in_air` or `yac_phase`, assigned to each frame of a Play.
- **Time_To_Throw**: (frameId of `pass_forward` minus frameId of `ball_snap`) divided by 10.0, in seconds.
- **Pressure_Flag**: A per-Play indicator that is true when at least one `pff_hurry`, `pff_hit` or `pff_sack` value is 1 for any player of the Play.
- **Min_Separation**: For a Play, the minimum Euclidean distance in yards between a receiver (`pff_role` = `Pass Route`) and a defender (`pff_role` = `Coverage`) at the `pass_arrived` frame.
- **Layer**: One of `targets`, `routes`, `pocket_pressure` or `separation`.
- **Grid_Cell**: A bin of the Normalized_Coordinates field identified by `x_bin` and `y_bin`.
- **Pass_Result**: One of `C`, `I`, `S`, `R`, `IN`.
- **Yards_By_Down**: The top-level `yards_by_down` field of the heatmap response, a list of exactly four objects `{"down": <integer>, "avg_yards": <number>}`, one per down from 1 to 4, that feeds the frontend chart.
- **Persist_Run**: A local execution of `backend/etl/clean_pipeline.py` as a script that writes the Processed_Store to `data/processed/`.

## Requirements

### Requirement 1: Data profiling script

**User Story:** As a data engineer, I want a profiling script over all raw files, so that the team knows the real structure and quality of the data before cleaning it.

#### Acceptance Criteria

1. WHEN the Profiler is run from the project root, THE Profiler SHALL read `games.csv`, `plays.csv`, `players.csv`, `pffScoutingData.csv` and every Tracking_File in `data/tracking/`.
2. WHILE the Profiler reads Tracking_Files, THE Profiler SHALL load one Tracking_File at a time and retain in memory only counters and sets of keys, releasing each Tracking_File's rows before loading the next one.
3. WHEN profiling completes, THE Profiler SHALL write Data_Report to the project root as `DATA_REPORT.md`, overwriting any existing file of that name.
4. THE Data_Report SHALL state the total count of distinct `gameId`, the weeks covered (minimum and maximum week and the list of weeks present), the earliest and latest game dates, the list of distinct teams involved, the total count of distinct Plays (distinct `gameId` plus `playId` pairs) and the total number of tracking rows summed across all Tracking_Files.
5. THE Data_Report SHALL list, for each table, every real column name as it appears in the file header and the percentage of null values per column, rounded to 2 decimal places, counting empty cells and the literals `NA` and `None` as null.
6. THE Data_Report SHALL report, for each of the following relations, the count and the percentage (rounded to 2 decimal places) of orphan keys in each direction: `gameId` between games, plays and tracking; `gameId` plus `playId` between plays, pffScoutingData and tracking; and `nflId` between players, pffScoutingData and tracking.
7. THE Data_Report SHALL report `frameId` continuity as the count and percentage of tracks (one track per `gameId`, `playId` and `nflId`) whose `frameId` values are not consecutive integers starting at 1.
8. THE Data_Report SHALL list the unique values and their counts, sorted by count in descending order, for `passResult`, `offenseFormation`, `pff_passCoverage`, `pff_passCoverageType`, `pff_role`, `event` and `officialPosition`, showing null values as a separate entry.
9. WHEN profiling completes, THE Profiler SHALL print to standard output a summary containing at least the number of files read, the total tracking rows, the distinct `gameId` count, the distinct Plays count and the path of `DATA_REPORT.md`, and exit with status 0.
10. IF a required input file is missing or unreadable, THEN THE Profiler SHALL print the file path and the error description to standard error, not write or modify `DATA_REPORT.md`, and exit with a non-zero status.
11. IF `data/tracking/` contains no Tracking_File, THEN THE Profiler SHALL print the directory path and an error indicating that no Tracking_File was found, and exit with a non-zero status.
12. THE Profiler SHALL leave every file under `data/` unmodified, opening them in read-only mode.

### Requirement 2: Memory-efficient tracking ingestion

**User Story:** As a data engineer, I want the tracking files processed one at a time, so that the pipeline runs on a laptop without exhausting memory.

#### Acceptance Criteria

1. WHEN the Cleaning_Pipeline runs, THE Cleaning_Pipeline SHALL load, transform and reduce one Tracking_File at a time, with at most one Tracking_File's raw frame data held in memory at any moment.
2. WHEN a Tracking_File has been processed or skipped, THE Cleaning_Pipeline SHALL release the raw frame data of that file before reading the next file.
3. THE Cleaning_Pipeline SHALL read tracking columns using explicit dtypes and only the columns required by the later steps, and SHALL NOT load any column that no later step uses.
4. THE Cleaning_Pipeline SHALL treat the literals `NA` and `None` as null values when reading the CSV files, so that those literals appear as null (not as the text `NA` or `None`) in every column read, including numeric columns.
5. IF a Tracking_File cannot be parsed, THEN THE Cleaning_Pipeline SHALL log the file name and the error, discard any partial data from that file, skip that file and continue with the remaining files.
6. WHEN the Cleaning_Pipeline finishes, THE Cleaning_Pipeline SHALL log the number of Tracking_Files processed and the number skipped, where processed plus skipped equals the total number of Tracking_Files found.
7. IF no Tracking_File can be processed successfully (zero files found or all files skipped), THEN THE Cleaning_Pipeline SHALL log an error stating that no tracking data was produced and terminate with a failure indication.

### Requirement 3: Spatial normalization

**User Story:** As an analyst, I want every play oriented in the same direction, so that spatial patterns can be compared across plays.

#### Acceptance Criteria

1. WHEN a tracking row has `playDirection` equal to `left` and non-null `x` and `y`, THE Cleaning_Pipeline SHALL set `x_norm` to 120.0 minus `x` and `y_norm` to 53.3 minus `y`.
2. WHEN a tracking row has `playDirection` equal to `left` and a non-null `o` or `dir`, THE Cleaning_Pipeline SHALL set each non-null value to `(value + 180) % 360`.
3. WHEN a tracking row has `playDirection` equal to `right`, THE Cleaning_Pipeline SHALL set `x_norm` to `x` and `y_norm` to `y`, and SHALL keep `o` and `dir` equal to their original values.
4. THE Cleaning_Pipeline SHALL apply the same normalization rules in criteria 1, 2 and 3 to Player_Rows and Ball_Rows. For Ball_Rows, `o` and `dir` SHALL be treated as null if they are null in the source.
5. WHEN `o` or `dir` is null, THE Cleaning_Pipeline SHALL keep that value null after normalization and SHALL NOT exclude the row for that reason.
6. WHEN `x` or `y` is null in a tracking row with `playDirection` equal to `left` or `right`, THE Cleaning_Pipeline SHALL set the corresponding `x_norm` or `y_norm` to null and SHALL NOT exclude the row for that reason.
7. FOR ALL tracking rows with non-null `x`, `y`, `o` and `dir`, applying the left-direction normalization formulas twice SHALL return `x`, `y`, `o` and `dir` equal to the original values within an absolute tolerance of 1e-9 (round-trip property).
8. FOR ALL normalized rows, THE Cleaning_Pipeline SHALL produce non-null `o` and `dir` values greater than or equal to 0 and strictly less than 360.
9. IF a tracking row has a `playDirection` value other than `left` or `right` (including null or empty), THEN THE Cleaning_Pipeline SHALL exclude the row from the output and SHALL record in the pipeline log the total count of excluded rows for this reason.

### Requirement 4: Ball separation and phase labeling

**User Story:** As an analyst, I want the ball trajectory kept and each frame labeled by phase, so that I can study the pocket, the pass in the air and the run after the catch.

#### Acceptance Criteria

1. WHEN a Tracking_File is processed, THE Cleaning_Pipeline SHALL split rows into Ball_Rows (`team` equal to `football` or `nflId` null) and Player_Rows (all other rows) before any row is removed for a missing `nflId`, so that the count of Player_Rows plus Ball_Rows equals the count of input rows of the Tracking_File.
2. THE Cleaning_Pipeline SHALL keep Ball_Rows in a separate dataset with exactly the columns `gameId`, `playId`, `frameId`, `x_norm`, `y_norm`, `s` and `event`, with one row per `gameId`, `playId` and `frameId` combination.
3. THE Cleaning_Pipeline SHALL label every frame of a Play that has complete events with exactly one Phase from the set `pre_snap`, `pocket_phase`, `ball_in_air` and `yac_phase`.
4. WHILE a frame precedes the `ball_snap` frame of its Play (`frameId` lower than the `frameId` of `ball_snap`), THE Cleaning_Pipeline SHALL label the frame `pre_snap`.
5. WHILE a frame is at or after the `ball_snap` frame and before the `pass_forward` frame of its Play, THE Cleaning_Pipeline SHALL label the frame `pocket_phase`.
6. WHILE a frame is at or after the `pass_forward` frame and before the `pass_arrived` frame of its Play, THE Cleaning_Pipeline SHALL label the frame `ball_in_air`.
7. WHILE a frame is at or after the `pass_arrived` frame of its Play, THE Cleaning_Pipeline SHALL label the frame `yac_phase`.
8. IF a Play lacks a `ball_snap`, `pass_forward` or `pass_arrived` event, THEN THE Cleaning_Pipeline SHALL mark the Play as lacking phase data, assign a null Phase to the frames whose boundary depends on the missing event, exclude the Play from the metrics that need the missing event, and keep the Play's other frames and rows in the output.
9. WHEN a Play has more than one frame carrying the same phase event, THE Cleaning_Pipeline SHALL use the frame with the lowest `frameId` as the phase boundary.
10. FOR ALL Plays with complete events whose boundary frames satisfy `ball_snap` ≤ `pass_forward` ≤ `pass_arrived` in `frameId`, the phase labels SHALL be non-decreasing in the order `pre_snap`, `pocket_phase`, `ball_in_air`, `yac_phase` as `frameId` increases (invariant).
11. IF a Play with all three events has boundary frames out of order (`pass_forward` frame before `ball_snap` frame, or `pass_arrived` frame before `pass_forward` frame), THEN THE Cleaning_Pipeline SHALL mark the Play as lacking phase data, assign a null Phase to all its frames, and keep its rows in the output.

### Requirement 5: Derived play metrics

**User Story:** As an analyst, I want per-play time to throw, pressure and receiver separation, so that I can measure passing performance.

#### Acceptance Criteria

1. WHEN a Play has exactly one `ball_snap` frame and exactly one `pass_forward` frame, THE Cleaning_Pipeline SHALL compute Time_To_Throw, in seconds, as (frame of `pass_forward` minus frame of `ball_snap`) divided by 10.0, without rounding.
2. IF a Play has no `pass_forward` frame or no `ball_snap` frame, THEN THE Cleaning_Pipeline SHALL set Time_To_Throw to null for that Play and SHALL keep the Play in the output.
3. IF a Play has a `pass_forward` frame that is earlier than its `ball_snap` frame, THEN THE Cleaning_Pipeline SHALL set Time_To_Throw to null for that Play.
4. WHEN a Play has at least one `pffScoutingData` row with `pff_hurry`, `pff_hit` or `pff_sack` equal to 1, THE Cleaning_Pipeline SHALL set the Pressure_Flag of the Play to true.
5. IF a Play has no `pffScoutingData` row with `pff_hurry`, `pff_hit` or `pff_sack` equal to 1, THEN THE Cleaning_Pipeline SHALL set the Pressure_Flag of the Play to false.
6. THE Cleaning_Pipeline SHALL store, for each Play, separate counts of `pff_hurry`, `pff_hit` and `pff_sack`, where each count is the number of `pffScoutingData` rows of that Play with the field equal to 1 (missing values count as 0).
7. WHEN a Play has a `pass_arrived` frame, THE Cleaning_Pipeline SHALL compute Min_Separation as the minimum Euclidean distance, in Normalized_Coordinates, between any player with `pff_role` equal to `Pass Route` and any player with `pff_role` equal to `Coverage` at that frame.
8. WHEN a Play has a `pass_arrived` frame, THE Cleaning_Pipeline SHALL store, for each `Pass Route` player in that frame, the distance to the nearest `Coverage` player at that frame, so that the API can rank players.
9. IF a Play has no `pass_arrived` frame, no `Pass Route` player or no `Coverage` player at that frame, THEN THE Cleaning_Pipeline SHALL set Min_Separation to null for that Play and SHALL store no per-player distances for it.
10. FOR ALL Plays, Min_Separation SHALL be greater than or equal to 0 when not null.
11. FOR ALL Plays, Time_To_Throw SHALL be greater than or equal to 0 when not null.
12. THE Cleaning_Pipeline SHALL join Play-level metrics to `plays.csv` on `gameId` and `playId`, and SHALL restrict the aggregates to dropback pass Plays, defined as rows with a non-null `passResult`.

### Requirement 6: Processed outputs and reproducibility

**User Story:** As a backend developer, I want pre-aggregated tables available when the server starts, so that the API answers instantly without runtime disk writes.

#### Acceptance Criteria

1. WHEN the Cleaning_Pipeline builds the Processed_Store, THE Cleaning_Pipeline SHALL produce exactly these tables: the clean play-level table, the ball-trajectory table, the receiver-level separation table and one pre-aggregated grid table per Layer, with no table missing and each table containing at least 1 row.
2. WHERE the Cleaning_Pipeline is run as a script, THE Cleaning_Pipeline SHALL save each table of the Processed_Store as one file under `data/processed/` in a format that pandas 2.2.3 reads and writes without additional dependencies, and the reloaded table SHALL have the same columns, column order, dtypes and row count as the table in memory.
3. THE Cleaning_Pipeline SHALL expose a function that builds the Processed_Store in memory and creates, modifies or deletes 0 files on disk.
4. THE Cleaning_Pipeline SHALL leave every original file under `data/` (excluding `data/processed/`) byte-for-byte unmodified, verified by an identical SHA-256 checksum before and after any run.
5. WHEN the Cleaning_Pipeline runs twice on the same input, THE Cleaning_Pipeline SHALL produce tables with identical column names, column order, dtypes, row order and cell values (numeric values compared with exact equality, and NaN values in the same positions).
6. WHEN the API starts and `data/processed/` contains one file for every table of the Processed_Store, THE API SHALL load the Processed_Store from those files and SHALL NOT run the Cleaning_Pipeline.
7. WHEN the API starts and `data/processed/` is absent or is missing at least one file of the Processed_Store, THE API SHALL build the complete Processed_Store in memory with the Cleaning_Pipeline and SHALL NOT create, modify or delete any file on disk.
8. IF `data/processed/` contains a file of the Processed_Store that cannot be read by pandas, THEN THE API SHALL treat `data/processed/` as incomplete, SHALL build the Processed_Store in memory with the Cleaning_Pipeline, and SHALL NOT modify or delete the unreadable file.
9. WHEN the Cleaning_Pipeline finishes building a table, THE Cleaning_Pipeline SHALL log one entry containing the table name, the elapsed time in seconds with at least 2 decimal places, and the output row count.
10. IF `data/processed/` is excluded by `.gitignore`, THEN THE project documentation SHALL state that the Processed_Store is rebuilt in memory at server startup, and that `data/processed/` is not delivered with the project unless the team changes `.gitignore`, a decision that belongs to the team.
11. WHERE the Cleaning_Pipeline is run as a script and `data/processed/` does not exist, THE Cleaning_Pipeline SHALL create the directory `data/processed/` before saving any table.
12. WHERE the Cleaning_Pipeline is run as a script, THE Cleaning_Pipeline SHALL write each table first to a temporary file name in `data/processed/` and then rename the temporary file to its final name, so that no file with a final table name is ever partially written.
13. IF writing a table to `data/processed/` fails, THEN THE Cleaning_Pipeline SHALL remove the temporary file of that table, log the table name and the error, and terminate with a failure indication.
14. THE API SHALL read `data/processed/` only at startup and SHALL NOT create, modify or delete `data/processed/` or any file in it at any time, because the server is ephemeral.
15. THE project documentation SHALL state that the user must run the Cleaning_Pipeline script locally (a Persist_Run) to persist the Processed_Store, so that later server restarts load the files instead of recomputing the tables.

### Requirement 7: API application, health and CORS

**User Story:** As a frontend developer, I want a predictable API shell, so that the dashboard and the hosting platform can reach it.

#### Acceptance Criteria

1. THE API SHALL expose `app` in `backend/main.py` as a FastAPI instance.
2. THE API SHALL define the function `cargar_env()` exactly as given in the project rules at the top of `backend/main.py`, before any import or use of boto3, and call it exactly once at module import.
3. WHEN a client sends `GET /health`, THE API SHALL respond with status 200 and the body `{"status": "ok"}`.
4. THE API SHALL place every data endpoint under the `/api/` prefix.
5. THE API SHALL expose only `GET /health`, `GET /api/filters` and `GET /api/heatmap` as application endpoints.
6. THE API SHALL accept cross-origin requests from the origin `http://localhost:5173` and include the matching CORS allow-origin header in its responses to those requests.
7. WHEN the API starts, THE API SHALL load the Processed_Store exactly once and keep it in memory for all subsequent requests, without reloading it per request.
8. WHILE the Processed_Store is loading, THE API SHALL respond to `GET /health` with status 200 and the body `{"status": "ok"}` within 1 second.
9. IF the Processed_Store cannot be loaded, THEN THE API SHALL respond to `GET /api/filters` and `GET /api/heatmap` with status 503 and a JSON body whose `detail` field is a non-empty string describing that the data is unavailable, and THE API SHALL keep responding to `GET /health` with status 200.
10. THE API SHALL start and serve `GET /health`, `GET /api/filters` and `GET /api/heatmap` when `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` are all unset, without reading, validating or logging those variables.

### Requirement 8: Filters endpoint

**User Story:** As a frontend developer, I want the real filter values from the dataset, so that the dashboard dropdowns only offer valid options.

#### Acceptance Criteria

1. WHEN a client sends `GET /api/filters` and the Processed_Store is loaded, THE API SHALL respond with status 200 and a JSON object containing exactly the keys `teams`, `downs`, `formations`, `coverages` and `pass_results`, where each value is an array.
2. WHEN a client sends `GET /api/filters`, THE API SHALL fill `teams` with the union of the distinct non-null, non-empty `possessionTeam` and `defensiveTeam` values found in `plays.csv`, sorted in ascending alphabetical order with no duplicates.
3. WHEN a client sends `GET /api/filters`, THE API SHALL return `downs` as `[1, 2, 3, 4]`, as integers in that order.
4. WHEN a client sends `GET /api/filters`, THE API SHALL fill `formations` with the distinct non-null, non-empty `offenseFormation` values found in the data, sorted in ascending alphabetical order with no duplicates.
5. WHEN a client sends `GET /api/filters`, THE API SHALL fill `coverages` with the distinct non-null, non-empty `pff_passCoverage` values found in the data, sorted in ascending alphabetical order with no duplicates.
6. WHEN a client sends `GET /api/filters`, THE API SHALL return `pass_results` as `["C", "I", "S", "R", "IN"]`, as strings in that order.
7. FOR ALL values returned in `teams`, `formations` and `coverages`, THE API SHALL return only values that appear in at least one Play of the Processed_Store (invariant).
8. WHEN `GET /api/filters` is called two or more times without a data change, THE API SHALL return byte-identical response bodies, with the same key content and array order (idempotence).
9. IF the Processed_Store is not loaded, THEN THE API SHALL respond with status 503 as defined in Requirement 7 and SHALL NOT return a partial filters object.
10. IF a column used for `formations` or `coverages` contains no non-null, non-empty values, THEN THE API SHALL respond with status 200 and return an empty array for that key.

### Requirement 9: Heatmap endpoint inputs

**User Story:** As a frontend developer, I want to filter the heatmap by situation and choose a layer, so that the dashboard shows the pattern the user is exploring.

#### Acceptance Criteria

1. WHEN a client sends `GET /api/heatmap`, THE API SHALL accept the optional query parameters `team`, `down`, `formation`, `coverage`, `pass_result` and `layer`.
2. WHEN `team` is provided, THE API SHALL keep only Plays where `possessionTeam` equals the value using an exact, case-sensitive match.
3. WHEN `down` is provided with an integer from 1 to 4, THE API SHALL keep only Plays where `down` equals the value.
4. WHEN `formation` is provided, THE API SHALL keep only Plays where `offenseFormation` equals the value using an exact, case-sensitive match.
5. WHEN `coverage` is provided, THE API SHALL keep only Plays where `pff_passCoverage` equals the value using an exact, case-sensitive match.
6. WHEN `pass_result` is provided with one of `C`, `I`, `S`, `R` or `IN`, THE API SHALL keep only Plays where `passResult` equals the value.
7. WHEN more than one filter is provided, THE API SHALL keep only Plays that satisfy all provided filters.
8. WHEN `layer` is omitted, THE API SHALL use the layer `targets`.
9. IF `layer` is not one of `targets`, `routes`, `pocket_pressure` or `separation`, THEN THE API SHALL respond with status 422 and a `detail` message that lists the four allowed values.
10. IF `down` is not an integer from 1 to 4, THEN THE API SHALL respond with status 422 and a `detail` message indicating that `down` must be an integer from 1 to 4.
11. IF `pass_result` is not one of `C`, `I`, `S`, `R` or `IN`, THEN THE API SHALL respond with status 422 and a `detail` message that lists the five allowed values.
12. IF `team`, `formation` or `coverage` is provided with a value that is not present in the filter lists, THEN THE API SHALL respond with status 200 and the empty result defined in Requirement 12.
13. IF any query parameter is rejected with status 422, THEN THE API SHALL return no heatmap data in that response.

### Requirement 10: Heatmap response schema

**User Story:** As a frontend developer, I want an exact response shape, so that the dashboard can bind to it without adapters.

#### Acceptance Criteria

1. WHEN a client sends a valid `GET /api/heatmap` request, THE API SHALL respond with status 200 and a JSON object with exactly the top-level keys `meta`, `grid`, `top_players` and `yards_by_down`, where `meta` is an object and `grid`, `top_players` and `yards_by_down` are arrays.
2. THE API SHALL return `meta` with exactly the keys `total_plays` (integer), `avg_yards` (number), `completion_pct` (number), `sack_rate` (number) and `avg_time_to_throw` (number).
3. THE API SHALL return each `grid` item with exactly the keys `x_bin` (integer, 0 or greater), `y_bin` (integer, 0 or greater), `intensity` (number), `plays_count` (integer, 1 or greater), `success_rate` (number) and `avg_epa_or_yards` (number), and no two `grid` items SHALL share the same pair of `x_bin` and `y_bin` values.
4. THE API SHALL return each `top_players` item with exactly the keys `nflId` (integer), `name` (string), `position` (string), `metric_value` (number) and `metric_label` (string), with at most 10 items, ordered by `metric_value` descending.
5. THE API SHALL define the response with Pydantic models whose fields, names and types match criteria 1 to 4 and criterion 11, including a model for each `yards_by_down` item.
6. THE API SHALL return `completion_pct` and `sack_rate` as percentages from 0 to 100 rounded to one decimal, `avg_yards` (in `meta` and in each `yards_by_down` item) rounded to one decimal and `avg_time_to_throw` rounded to two decimals.
7. THE API SHALL return `intensity` and `success_rate` as numbers from 0 to 1, rounded to two decimals, and `avg_epa_or_yards` rounded to one decimal.
8. THE API SHALL never return NaN or infinity in the JSON body.
9. FOR ALL responses, the sum of `plays_count` over `grid` SHALL be less than or equal to `meta.total_plays` multiplied by the maximum number of events a Play can contribute to the selected layer (invariant).
10. FOR ALL responses, every `intensity` value SHALL be less than or equal to 1 and the maximum `intensity` SHALL equal 1 when `grid` is not empty (invariant).
11. THE API SHALL return `yards_by_down` as an array of exactly 4 items, each with exactly the keys `down` (integer) and `avg_yards` (number), ordered by `down` with the values 1, 2, 3 and 4 in that order.

### Requirement 11: Heatmap metrics, grid and layers

**User Story:** As an analyst, I want each layer to map a clear football event onto the field, so that I can read where passing plays succeed or fail.

#### Acceptance Criteria

1. THE API SHALL compute `meta.total_plays` as the count of filtered Plays.
2. THE API SHALL compute `meta.avg_yards` as the mean of `playResult` over the filtered Plays, rounded as defined in Requirement 10.
3. THE API SHALL compute `meta.completion_pct` as 100 times the count of filtered Plays with `passResult` equal to `C` divided by the count of filtered Plays.
4. THE API SHALL compute `meta.sack_rate` as 100 times the count of filtered Plays with `passResult` equal to `S` divided by the count of filtered Plays.
5. THE API SHALL compute `meta.avg_time_to_throw` as the mean of Time_To_Throw, in seconds, over the filtered Plays where it is not null.
6. THE API SHALL divide the Normalized_Coordinates field into Grid_Cells of 5 by 5 yards, with `x_bin` as floor(`x_norm` / 5) times 5, clamped to the range 0 to 115, and `y_bin` as floor(`y_norm` / 5) times 5, clamped to the range 0 to 50.
7. WHERE `layer` is `targets`, THE API SHALL assign each Play to the Grid_Cell of the ball position at the `pass_arrived` frame, and SHALL set the Grid_Cell value to the number of Plays assigned to it.
8. WHERE `layer` is `routes`, THE API SHALL count the positions of players with `pff_role` equal to `Pass Route` at the `pass_arrived` frame per Grid_Cell, and SHALL set the Grid_Cell value to that count.
9. WHERE `layer` is `pocket_pressure`, THE API SHALL assign each Play to the Grid_Cell of the quarterback position at the `pass_forward` frame, or at the `ball_snap` frame when the `pass_forward` frame is missing, and SHALL set the Grid_Cell value to the number of Plays in the Grid_Cell with Pressure_Flag.
10. WHERE `layer` is `pocket_pressure`, THE API SHALL define `success_rate` as the count of Plays in the Grid_Cell without Pressure_Flag divided by `plays_count`, with a value from 0 to 1.
11. WHERE `layer` is `separation`, THE API SHALL assign each Play with a Min_Separation value to the Grid_Cell of the receiver nearest to a defender at the `pass_arrived` frame, SHALL set the Grid_Cell value to the mean Min_Separation in yards of the Plays in the Grid_Cell, and SHALL exclude Plays without a Min_Separation value from the grid.
12. THE API SHALL compute `plays_count` as the number of distinct Plays in the Grid_Cell, and `intensity` as the Grid_Cell value for the selected layer divided by the maximum Grid_Cell value over all Grid_Cells of the response.
13. IF the maximum Grid_Cell value is 0, THEN THE API SHALL return `intensity` equal to 0 for every Grid_Cell.
14. WHERE `layer` is `targets`, `routes` or `separation`, THE API SHALL define `success_rate` as the count of Plays in the Grid_Cell with `passResult` equal to `C` divided by `plays_count`, with a value from 0 to 1.
15. THE API SHALL define `avg_epa_or_yards` as the mean `playResult` in yards over the Plays of the Grid_Cell, because `plays.csv` has no expected points added column.
16. THE API SHALL return `top_players` with at most 10 items sorted from the highest to the lowest `metric_value`, and SHALL order items with equal `metric_value` by `name` in ascending alphabetical order.
17. WHERE `layer` is `targets` or `routes`, THE API SHALL rank receivers by the number of Plays in which the receiver was the targeted player, using the label `Targets`.
18. WHERE `layer` is `pocket_pressure`, THE API SHALL rank pass rushers (`pff_role` equal to `Pass Rush`) by the sum of `pff_hurry`, `pff_hit` and `pff_sack` over the filtered Plays, using the label `Presiones generadas`.
19. WHERE `layer` is `separation`, THE API SHALL rank receivers by the mean distance in yards to the nearest defender at the `pass_arrived` frame, only for receivers with at least 3 Plays, using the label `Yardas separación prom.`.
20. THE API SHALL take `name` from `players.csv` `displayName` and `position` from `players.csv` `officialPosition`, joined by `nflId`, and IF no `players.csv` row matches an `nflId`, THEN THE API SHALL return an empty string for `name` and `position` of that item and keep the item in `top_players`.
21. IF the targeted receiver of a Play is not identifiable from the data, THEN THE API SHALL exclude that Play from the `targets` ranking and keep the Play in the grid.
22. IF a Play lacks the frame required by the selected layer (`pass_arrived` for `targets`, `routes` and `separation`, or both `pass_forward` and `ball_snap` for `pocket_pressure`), THEN THE API SHALL exclude that Play from the Grid_Cells, and SHALL still count it in `meta.total_plays`.
23. THE API SHALL compute the `avg_yards` of each `yards_by_down` item as the mean of `playResult` over the filtered Plays whose `down` equals the `down` of that item, rounded to one decimal, independently of the selected `layer`.
24. WHEN the `down` filter is provided, THE API SHALL compute `yards_by_down` over the filtered Plays only, so that the item for the requested down carries the mean and the items for the other downs carry `avg_yards` equal to 0.
25. IF no filtered Play has a `down` equal to the `down` of a `yards_by_down` item, THEN THE API SHALL still include that item with `avg_yards` equal to 0.

### Requirement 12: Empty and edge results

**User Story:** As a frontend developer, I want a valid response even when filters match nothing, so that the dashboard can show an empty state without error handling.

#### Acceptance Criteria

1. IF the filters match no Play, THEN THE API SHALL respond with status 200, `meta.total_plays` equal to 0, all other numeric `meta` values equal to 0, `grid` equal to `[]`, `top_players` equal to `[]` and `yards_by_down` equal to four items for downs 1, 2, 3 and 4 in that order, each with `avg_yards` equal to 0.
2. IF a metric has no non-null input for the filtered Plays, THEN THE API SHALL return 0 for that metric instead of null, NaN or an error, and SHALL still respond with status 200.
3. IF the filters match at least one Play but fewer Plays than the number of items requested for `top_players`, THEN THE API SHALL return only the matching players in `top_players`, with no padding entries.
4. WHEN a client sends a request with an unknown query parameter, THE API SHALL ignore the parameter and return the same response as the request without that parameter, with status 200.
5. IF the filters match no Play, THEN THE API SHALL respond within 2 seconds, and the response body SHALL be valid JSON that contains no NaN or Infinity values.

### Requirement 13: Performance and runtime behavior

**User Story:** As a user of the dashboard, I want fast responses, so that changing a filter feels immediate.

#### Acceptance Criteria

1. WHEN the Processed_Store is loaded and a client requests `GET /api/filters`, THE API SHALL respond with a successful result within 100 ms, measured at the server from request receipt to the last response byte, at the 95th percentile over at least 100 sequential requests.
2. WHEN the Processed_Store is loaded and a client requests `GET /api/heatmap` with any valid combination of filters, THE API SHALL respond with a successful result within 500 ms, measured at the server from request receipt to the last response byte, at the 95th percentile over at least 100 sequential requests.
3. THE API SHALL serve every request from the Processed_Store held in memory and SHALL NOT read any Tracking_File while serving requests.
4. THE API SHALL NOT create, modify, or delete any file on disk after startup completes, including during request handling.
5. WHEN the API finishes building the Processed_Store at startup, THE API SHALL write one log entry stating the elapsed build time in seconds, rounded to at least one decimal place.
6. IF the Processed_Store build fails at startup, THEN THE API SHALL write a log entry indicating the failure and SHALL respond to the data endpoints as defined in Requirement 7.

### Requirement 14: Automated verification

**User Story:** As a developer, I want automated tests for the core logic, so that normalization, metrics and the API contract do not regress.

#### Acceptance Criteria

1. THE project SHALL include pytest tests under `backend/tests/` that run to completion with the command `.venv/bin/pytest`, use only the fixed stack dependencies (pytest 8.3.5 and httpx 0.28.1), and require no network access, no `.env` file and no AWS credentials.
2. WHEN the test suite runs, THE tests SHALL verify the normalization formulas of Requirement 3 on at least 4 input cases, including one case for each field direction, and SHALL verify the round-trip property of Requirement 3 on at least 3 inputs, with a maximum absolute difference of 1e-6 between the original and the recovered values.
3. WHEN the test suite runs, THE tests SHALL verify on a synthetic Play of at most 5 frames and at most 4 players that the phase labeling invariant holds, that Time_To_Throw equals the value computed by hand for that Play, and that Min_Separation equals the value computed by hand for that Play, with a maximum absolute difference of 1e-6.
4. WHEN the test suite runs, THE tests SHALL use `httpx` and the FastAPI test client to verify that a request to `/health` returns the body `{"status": "ok"}`, and that requests to `/api/filters` and `/api/heatmap` return a successful response whose fields and field types match the schemas of Requirements 7, 8 and 10, including `yards_by_down` with 4 items ordered by `down` 1 to 4.
5. WHEN the test suite sends a request to `/api/heatmap` with an invalid parameter defined in Requirement 9, THE tests SHALL verify that the response is a 422 response, and the tests SHALL cover at least one invalid case for each validation rule of Requirement 9.
6. WHEN the test suite sends a valid request to `/api/heatmap` whose filters match no Play (Requirement 12), THE tests SHALL verify that the response is successful, that it contains the empty result defined in Requirement 12 (including the four `yards_by_down` items with `avg_yards` equal to 0), and that it contains no error indication.
7. WHEN the test suite sends a request with the header `Origin: http://localhost:5173`, THE tests SHALL verify that the response includes the CORS header `Access-Control-Allow-Origin` with a value that permits `http://localhost:5173`.
8. IF any test in the suite fails, THEN THE pytest run SHALL finish with a non-zero exit status and report the name of each failing test.
9. WHEN the test suite runs, THE tests SHALL verify on a synthetic set of Plays with known `down` and `playResult` values that each `yards_by_down` item equals the hand-computed mean rounded to one decimal, that downs without Plays return `avg_yards` equal to 0, and that a request with a `down` filter returns 0 for the other three downs.
10. WHEN the test suite runs, THE tests SHALL verify on a temporary directory that a Persist_Run creates `data/processed/` when absent, leaves no temporary files after success, and that the API loads the saved tables without running the Cleaning_Pipeline.
