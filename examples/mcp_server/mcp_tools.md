# Available MCP Tools

## `query_datarobot_dataset`

Query DataRobot using a use case context.

Args:
    query: SQL to execute in DataRobot Wrangle/Preview.
    title: Title for the resulting dataset.
    description: Description for the resulting dataset.
    dataset_ids: List of DataRobot dataset IDs to use in the query.
    use_case_id: DataRobot use case identifier to scope the query. If not provided, a default use case will be used.
    persist: When True, both dataset and datastore are preserved in DataRobot

DataRobot uses spark SQL. Refer to the datasets by t0, t1, etc, and enclosed in ``
Example:
query=SELECT * from `t0`

Returns:
    DatasetRef: Panel dataset stored in the staging area for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `query` | `string` | - | **Yes** |
| `title` | `string` | - | **Yes** |
| `description` | `string` | - | **Yes** |
| `dataset_ids` | `array` | - | **Yes** |
| `use_case_id` | `any` | - | No |
| `persist` | `boolean` | - | No |

---

## `list_datastores`

List all available datastores or data connections for the current user.
Args:
    show_all: Whether to show all datastores, including those created by other users.
Returns:
    A list of datastore information.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `show_all` | `boolean` | - | No |

---

## `browse_datastore`

Browse a datastore connection at a path (folders, catalogs, schemas, tables).

Args:
    datastore_id: The ID of the datastore to browse.
    path: The path to browse. Default is "/". (Databases/schemas/etc)
    offset: The offset of the browse.
    limit: The limit of the browse.
    search: The search of the browse.

Returns:
    A dictionary with the browse results. If path is down to the table, it returns the columns of the table.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `datastore_id` | `string` | - | **Yes** |
| `path` | `string` | - | No |
| `offset` | `integer` | - | No |
| `limit` | `integer` | - | No |
| `search` | `string` | - | No |

---

## `query_datastore`

Query a datastore using a use case context.
* Ensure you are using the correct SQL Dialect.
* Ensure you are quoting table names and column names to avoid case sensitivity issues.
* If you only need a quick glance of the data - use preview_data_source instead.
* Queries that return fewer than 1000 rows are served via preview for faster results.

Args:
    datastore_id: The ID of the datastore to query.
    query: The SQL query to execute.
    title: The title for the resulting dataset.
    description: The description for the resulting dataset.
    use_case_id: DataRobot use case identifier to scope the query. If not provided, a default use case will be used.
    persist: When True, always create and keep a DataRobot dataset. When False (default), use quick mode (if possible) for small results.

Returns:
    DatasetRef: Panel dataset containing query results, stored in the staging panel for
    use with other panel tools

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `datastore_id` | `string` | - | **Yes** |
| `query` | `string` | - | **Yes** |
| `title` | `string` | - | **Yes** |
| `description` | `string` | - | **Yes** |
| `use_case_id` | `any` | - | No |
| `persist` | `boolean` | - | No |

---

## `get_datarobot_dataset_as_panel`

Convert a DataRobot dataset to a Panel dataset.

Args:
    dr_dataset_id: The ID of the DataRobot dataset to convert.

Returns:
    DatasetRef: Panel dataset containing the DataRobot data, stored in the staging
    panel for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `dr_dataset_id` | `string` | - | **Yes** |

---

## `upload_panel_dataset_to_datarobot`

Upload a panel dataset to DataRobot.

Args:
    panel_dataset: Panel dataset to upload.
    use_case_id: DataRobot use case identifier to scope the dataset. If not provided, a default use case will be used.

Returns:
    str: The DataRobot dataset ID of the uploaded dataset.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `panel_dataset` | `any` | - | **Yes** |
| `use_case_id` | `any` | - | No |

---

## `list_datarobot_datasets`

List datasets. Optionally search string and limit the number of results. Default limit is 10.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `search_string` | `any` | - | No |
| `limit` | `integer` | - | No |

---

## `get_deployment_info`

Get information about a DataRobot deployment including its expected input columns,
target, model type, and time series configuration. Use this tool before making
predictions to understand the required shape of the scoring dataset.

Args:
    deployment_id: The ID of the DataRobot deployment.

Returns:
    JSON string with deployment details including features and time series config.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `deployment_id` | `string` | - | **Yes** |

---

## `get_prediction_history`

Retrieve forecast data from a DataRobot deployment.

Args:
    deployment_id: The DataRobot deployment object
    lookback_weeks: Number of weeks to look back
    lookahead_weeks: Number of weeks to look ahead

Returns:
    DatasetRef: Panel dataset containing forecast data from the deployment, stored in the
    staging panel for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `deployment_id` | `string` | - | **Yes** |
| `lookback_weeks` | `integer` | - | No |
| `lookahead_weeks` | `integer` | - | No |

---

## `deploy_model`

Deploy a model by creating a new DataRobot deployment.

Args:
    project_id: The ID of the DataRobot project containing the model.
    model_id: Optional model ID to deploy. If omitted, the best (top leaderboard)
        model is used.
    label: Optional deployment label. Defaults to '<project_name> - <model_type>'.
    description: Optional description for the deployment.
Returns:
    JSON string with deployment details, or error message.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `project_id` | `string` | - | **Yes** |
| `model_id` | `any` | - | No |
| `label` | `any` | - | No |
| `description` | `string` | - | No |

---

## `preview_data_source`

Preview a TABULAR data source and return a structured summary.

This tool is for tabular data (DataFrames) only. For Json panels, use view_json_panel instead.

Args:
    request: DataSourceRequest object containing the data source type and ID

    request.kind (str, required): The type of data source to preview:
        - "datarobot_dataset": Preview a DataRobot dataset
        - "datastore_query": Preview results of a datastore SQL query
        - "panel_dataset": Preview a Dataset panel (NOT Json panels - use view_json_panel for those)
    request.dataset_id (str, optional): The ID of the DataRobot dataset to preview
    request.datastore_id (str, optional): The ID of the datastore to preview
    request.query (str, optional): The query to execute on the datastore
    request.dataset_ref.id (str, optional): The ID of the Dataset panel to preview (type must be "dataset")
    request.sample_size (int, optional): The number of rows to sample from the data source

Returns:
    dict: Structured summary of the data source including columns, types, and sample rows

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `request` | `any` | - | **Yes** |

---

## `inspect_panel`

Inspect a panel and its parents recursively to understand the data lineage and execution context.

Returns information about the panel's execution context, parent relationships, and graph structure
without reading the actual payload data.

Args:
    panel_id: The unique identifier of the panel to inspect

Returns:
    str: Text description of the panel inspection including execution context and parent graph

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `panel_id` | `string` | - | **Yes** |

---

## `view_json_panel`

View the contents of a Json panel.

Use this tool to retrieve structured JSON data stored in a Json panel.
For tabular data, use preview_data_source with a DatasetRef instead.

Note: Large data structures are automatically truncated to preserve structure
while limiting output size. Arrays show first 5 items with remaining count,
strings are limited to 200 chars, and nesting is limited to 6 levels.

Args:
    json_ref: Reference to the Json panel (e.g. {"type": "json", "id": "abc123"})

Returns:
    dict: The JSON data stored in the panel, including:
        - title: Panel title
        - schema_name: Schema used for validation (if any)
        - data: The actual JSON data (truncated if large)

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `json_ref` | `any` | - | **Yes** |

---

## `is_eligible_for_timeseries_training`

Check if a dataset is eligible for time series training. Always call before training.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `dataset` | `any` | - | **Yes** |
| `target_column_name` | `string` | - | **Yes** |
| `datetime_column_name` | `string` | - | **Yes** |
| `series_id_column` | `string` | - | **Yes** |

---

## `run_autopilot`

Train a machine learning model using DataRobot's AutoML platform.

This tool supports three different modeling approaches based on your data structure
and prediction requirements:

**CV (Cross Validation)**:
- Use for: Standard ML problems with independent observations
- Data split: Random shuffling into train/validation/holdout sets
- Requirements: Pre-prepared target column
- Example use cases: Customer churn, fraud detection, image classification

**OTV (Out of Time Validation)**:
- Use for: Time-ordered data where you want to predict future outcomes
- Data split: Chronological split (older data for training, recent for validation)
- Requirements: Pre-prepared target column, datetime column for ordering
- Example use cases: Next month's sales (single value), customer lifetime value prediction

**TS (Time Series)**:
- Use for: Multi-step forecasting of sequential data with temporal patterns
- Data split: Time-aware preparation with chronological splitting
- Requirements: Regular time intervals, datetime column, series ID, numeric target
- Target: Automatically infers "next {forecast_horizon} observations of {target_column_name}"
- Example use cases: 7-day demand forecasting, multi-period inventory planning

**CRITICAL - Time Series Prerequisites**:
Before using partition_method="TS", you MUST call is_eligible_for_timeseries_training
to verify data eligibility. Time series modeling requires:
- Valid datetime column with consistent intervals
- Numeric target column
- Series ID column to identify different time series
- Minimum 20 rows per series
- No duplicate timestamps within each series
- Regular/predictable time intervals

Args:
    dr_dataset_id: DataRobot dataset ID. Upload datasets to DataRobot before training.
    partition_method: Data splitting strategy - "CV", "OTV", or "TS"
    target_column_name: Name of the column containing values to predict
    datetime_column_name: Name of the datetime column (required for OTV and TS)
    series_id_column: Column identifying different time series (required for TS,
        e.g., store_id, product_id). Not used for CV or OTV.
    forecast_horizon: Number of future time steps to predict (required for TS only,
        e.g., 7 for 7-day forecast). Not used for CV or OTV.
    use_case_id: Optional DataRobot use case ID for experiment organization

Returns:
    str: URL to the DataRobot experiment where you can monitor training progress,
        compare models, and deploy the best performer

Raises:
    ValueError: If TS is selected but data doesn't meet time series requirements

Example:
    # Time series forecasting (check eligibility first!)
    experiment_url = run_autopilot(
        dr_dataset_id="abc123",
        partition_method="TS",
        target_column_name="sales_amount",
        datetime_column_name="date",
        series_id_column="store_id",
        forecast_horizon=7
    )

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `dr_dataset_id` | `string` | - | **Yes** |
| `partition_method` | `string` | - | **Yes** |
| `target_column_name` | `string` | - | **Yes** |
| `datetime_column_name` | `any` | - | No |
| `series_id_column` | `any` | - | No |
| `forecast_horizon` | `any` | - | No |
| `use_case_id` | `any` | - | No |

---

## `get_time_series_scoring_dataset_panel`

To make time series predictions against a deployment we need to apply some transformations to the dataset.
These Transformations depend on the deployment and the forecast point.

Use this function to prepare a dataset to make time series predictions against a deployment.

Args:
    forecast_point: The forecast point for the predictions.
    dataset: Panel dataset to prepare for scoring.
    deployment_id: The DataRobot deployment ID to use for predictions.

Returns:
    DatasetRef: Panel dataset containing prepared scoring data, stored in the staging
    panel for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `forecast_point` | `string` | - | **Yes** |
| `dataset` | `any` | - | **Yes** |
| `deployment_id` | `string` | - | **Yes** |

---

## `predict_with_deployment`

Make predictions using a deployment on the scoring dataset provided.
If the deployment is a time series deployment, always use the get_time_series_scoring_dataset_panel to prepare a scoring dataset
to ensure the scoring dataset is correctly prepared for time series predictions.

If add_explanations is True, the predictions will include explanations for the predictions. This will be slow, only use it if needed!

Args:

    scoring_data: Panel dataset containing scoring data.
    deployment_id: The DataRobot deployment ID to use for predictions.
    add_explanations: Whether to include prediction explanations (slow).
    forecast_point: The forecast point for the predictions (only required for time series deployments)

Returns:
    DatasetRef: Panel dataset containing prediction results from the deployment, stored
    in the staging panel for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `scoring_data` | `any` | - | **Yes** |
| `deployment_id` | `string` | - | **Yes** |
| `add_explanations` | `boolean` | - | No |
| `forecast_point` | `any` | - | No |

---

## `apply_what_if`

Apply simple in-place-style what-if adjustments to a Polars scoring dataset.

Each adjustment is a dict with keys:
  - "column": str                     # column to modify
  - "op": str                         # one of {"mul", "add", "set"}; default: "mul"
  - "value": float                    # scalar to use with op
  - "from_date": str|date|datetime    # optional inclusive start (compared on date)
  - "to_date": str|date|datetime      # optional inclusive end (compared on date)
  - "series": list[str]               # optional list of series ids to filter

Notes:
  - Operations are applied sequentially in the order provided.
  - Date comparisons are done on the date portion (no time component).
  - Returns a new DataFrame; assign back to mutate your reference.

Example adjustment:
    {
        "column": "price",
        "op": "mul",
        "value": 0.9,
        "from_date": "2025-01-01",
        "to_date": "2025-03-31",
        "series": ["store_001", "store_007"],
    }

Args:
    scoring_data: Panel dataset to apply adjustments to.
    deployment_id: The DataRobot deployment ID (for context).
    adjustments: List of what-if adjustments to apply.

Returns:
    DatasetRef: Panel dataset containing adjusted scoring data, stored in the staging
    panel for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `scoring_data` | `any` | - | **Yes** |
| `deployment_id` | `string` | - | **Yes** |
| `adjustments` | `array` | - | **Yes** |

---

## `list_models`

List all models for a DataRobot experiment with summary information.

Use this tool to explore models trained in an experiment before deciding which
one to deploy or inspect in detail.

Args:
    experiment_id: The ID of the DataRobot experiment.

Returns:
    Formatted list of models with model_id, model_type, sample_pct,
    featurelist_name, and primary metric scores.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `experiment_id` | `string` | - | **Yes** |

---

## `get_model_info`

Get detailed information and insights for a specific DataRobot model.

Always returns model metrics across all data splits, feature impact, and
cross-validation scores. When include_insights is True, also fetches deeper
diagnostic data: missing values report, ROC curve with optimal threshold
(classification), lift chart (classification), and residuals chart (regression).
Use this after list_models to inspect a candidate model before deploying it.

Args:
    experiment_id: The ID of the DataRobot experiment.
    model_id: The ID of the model to inspect.
    include_insights: When True, fetch additional diagnostic insights —
        missing values report, ROC curve summary, lift chart, and residuals
        chart. These may take longer to retrieve. Defaults to False.

Returns:
    JSON string with detailed model info including full metrics, feature impact
    (top contributing features), and optionally deeper diagnostic insights.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `experiment_id` | `string` | - | **Yes** |
| `model_id` | `string` | - | **Yes** |
| `include_insights` | `boolean` | - | No |

---

## `list_staging`

List panels currently present in the staging area.

If WREN_CONVERSATION_ID is set, lists panels from the conversation-scoped staging area.
Otherwise, lists panels from the default staging area.

*No parameters required.*

---

## `transform_panel_dataset`

Transform panel data into a new tabular dataset panel.

Does not add / acquire new data. Only returns a single dataset. Call multiple times
to create multiple datasets.

To create datasets from scratch, this tool can be called with an empty list of data.

Args:
    code: Python imports and function definition; function must be named `transform`
        and have signature:
        - For Dataset panels: transform(*data: pd.DataFrame) -> pd.DataFrame
        - For Json panels: transform(*data: dict) -> pd.DataFrame
        - Mixed inputs are supported (receives DataFrame or dict based on panel type)
    data: The Panel(s) to be transformed (DatasetRef or JsonRef).
    return_desc: Title for the output dataset.
    func_name: Name of the function to execute.


Returns:
    DatasetRef: Panel dataset containing transformed data, stored in the staging panel
    for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `code` | `string` | - | **Yes** |
| `data` | `array` | - | **Yes** |
| `return_desc` | `string` | - | **Yes** |
| `func_name` | `string` | - | No |

---

## `create_chart_panel`

Execute a python function to make a chart from panel data and return a reference.

Args:
    code: Python imports and function definition; function must be named `create_chart`
        and have signature:
        - For Dataset panels: create_chart(df: pd.DataFrame) -> Figure/Chart/Map
        - For Json panels: create_chart(data: dict) -> Figure/Chart/Map
        Returns a Plotly Figure, Altair Chart, or Folium Map.
        Plotly does not support pandas Periods, so convert to datetime or string instead.
        Ensure the charts are dark mode compatible.
    data: The panel(s) to be plotted (DatasetRef or JsonRef).
    return_desc: Title for the resulting chart.
    func_name: Name of the function to execute (default: "create_chart").
Returns:
    ChartRef: Panel chart containing the chart, stored in the staging panel
    for use with other panel tools.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `code` | `string` | - | **Yes** |
| `data` | `any` | - | **Yes** |
| `return_desc` | `string` | - | **Yes** |
| `func_name` | `string` | - | No |

---

## `create_json_panel`

Transform panel data into a Json panel or create a Json panel from code.

    Use this to convert Dataset panels to Json format
    or to create a Json panel from hardcoded data in code.

    Args:
        code: Python imports and function definition; function must be named `to_json`
            and have signature:
            - No input data: to_json() -> dict
            - For Dataset panels: to_json(df: pd.DataFrame) -> dict
            - For Json panels: to_json(data: dict) -> dict
            - Mixed inputs: to_json(*data) -> dict
            Must return a Python dictionary.
        return_desc: Title for the resulting Json panel.
        data: Optional panel(s) to transform (DatasetRef or JsonRef). If not provided,
            the function should generate data without inputs.
        func_name: Name of the function to execute (default: "to_json").
        schema_name: Optional schema name for validation.

    Returns:
        JsonRef: Reference to the created Json panel.

    Example:
        ```python
        # Convert a Dataset to cuOpt MILP format
        code = '''
import pandas as pd

def to_json(df: pd.DataFrame) -> dict:
    # Build cuOpt native MILP format from dataframe
    ...
    return {
        "csr_constraint_matrix": {...},
        "variable_types": ["I", "C"],
        ...
    }
        ```

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `code` | `string` | - | **Yes** |
| `return_desc` | `string` | - | **Yes** |
| `data` | `any` | - | No |
| `func_name` | `string` | - | No |
| `schema_name` | `any` | - | No |

---

## `create_text_panel`

Make a new text panel from text content.

Args:
    text: The text content to include in the panel.
    title: The title of the panel.
    description: Optional description of the panel.
    parent_ids: Optional list of parent panel IDs.
Returns:
    TextRef: Reference to the created text panel.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `text` | `string` | - | **Yes** |
| `title` | `string` | - | **Yes** |
| `description` | `any` | - | No |
| `parent_ids` | `any` | - | No |

---

## `list_use_cases`

List use cases. Optionally search string and limit the number of results. Default limit is 10.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `search_string` | `any` | - | No |
| `limit` | `integer` | - | No |

---

## `list_datarobot_use_case_assets`

List datasets, deployments, and experiments for a DataRobot use case.

Args:
    use_case_id: DataRobot use case identifier to scope the assets. If not provided, a default use case will be used.

Returns:
    str: A list of datasets, deployments, and experiments for the given use case.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `use_case_id` | `any` | - | No |

---

## `list_vdbs`

List all deployed Vector Databases (VDBs).

This tool lists VDB deployments by querying all deployments and filtering
for those with target type 'VectorDatabase'.

Args:
    use_case_id: Optional DataRobot use case identifier to filter VDBs.
        If not provided, lists VDBs from all accessible use cases.
    search: Optional search string to filter VDBs by name.
    limit: Maximum number of VDBs to return. Default is 100.
    offset: Number of VDBs to skip for pagination. Default is 0.

Returns:
    A list of VDB deployment information including id, name, and status.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `use_case_id` | `any` | - | No |
| `search` | `any` | - | No |
| `limit` | `integer` | - | No |
| `offset` | `integer` | - | No |

---

## `query_vdb`

Query a deployed Vector Database (VDB) with a natural language query.

This tool performs a semantic search against the specified deployed Vector Database
and returns the most relevant chunks/documents using the deployment prediction API.

Args:
    vdb_id: The ID of the VDB deployment to query.
    query: The natural language query to search for.
    num_results: Number of documents to retrieve. Default is 5. Must be greater than 0.
    add_neighbor_chunks: If True, include neighboring chunks for each result
        to provide more context. Default is False.
    retrieval_mode: Optional retrieval mode. Either "similarity" (default) or
        "maximal_marginal_relevance" (balances relevance with diversity).
    maximal_marginal_relevance_lambda: Optional float between 0.0 and 1.0.
        Only used when retrieval_mode is "maximal_marginal_relevance".
        Higher values prioritize similarity, lower values prioritize diversity.

Returns:
    A list of matching documents, each containing the text content
    and associated metadata.

Raises:
    ValueError: If num_results is less than 1.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `vdb_id` | `string` | - | **Yes** |
| `query` | `string` | - | **Yes** |
| `num_results` | `integer` | - | No |
| `add_neighbor_chunks` | `boolean` | - | No |
| `retrieval_mode` | `any` | - | No |
| `maximal_marginal_relevance_lambda` | `any` | - | No |

---

## `list_schemas`

List all available schemas for Json panel validation.

Use this to discover what schemas are available before creating
structured data panels. Schemas are organized by namespace (e.g., "cuopt").

Args:
    namespace: Optional filter (e.g., "cuopt" to list only cuOpt schemas)

Returns:
    Dictionary of schema names with descriptions and field summaries.

Example:
    >>> await list_schemas(namespace="cuopt")
    {
        "cuopt.VRPData": {
            "name": "cuopt.VRPData",
            "description": "Vehicle Routing Problem payload",
            "required_fields": ["depot", "customers"],
            "optional_fields": ["num_vehicles", "vehicle_capacity"]
        },
        "cuopt.NativeMILPData": {
            "name": "cuopt.NativeMILPData",
            "description": "Native cuOpt MILP/LP format (CSR matrix)",
            "required_fields": ["csr_constraint_matrix", "constraint_bounds", "objective_data", "variable_bounds", "variable_types"],
            "optional_fields": ["variable_names", "maximize", "solver_config"]
        },
        ...
    }

Available namespaces:
    - "cuopt": NVIDIA cuOpt optimization schemas (VRP, MILP, LP)

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `namespace` | `any` | - | No |

---

## `describe_schema`

Get detailed description of a schema including all fields, types, and examples.

Use this to understand exactly what data structure a schema expects
before creating a Json panel or calling cuopt_solve.

Args:
    schema_name: Full schema name (e.g., "cuopt.VRPData", "cuopt.NativeMILPData")

Returns:
    Detailed schema description with:
    - name: Schema name
    - description: Full documentation
    - fields: All fields with types, required status, defaults, descriptions
    - json_schema: Full JSON Schema (for reference)
    - example: Example valid data structure

Example:
    >>> await describe_schema("cuopt.VRPData")
    {
        "name": "cuopt.VRPData",
        "description": "Vehicle Routing Problem payload.",
        "fields": {
            "depot": {
                "type": "Coordinate",
                "required": true,
                "nested_schema": "Coordinate"
            },
            "customers": {
                "type": "list[VRPNode]",
                "required": true,
                "items_schema": "VRPNode"
            },
            "num_vehicles": {
                "type": "int | None",
                "required": false,
                "default": null
            },
            ...
        },
        "example": {
            "depot": {"x": 0, "y": 0},
            "customers": [
                {"id": "A", "x": 10, "y": 20, "demand": 5}
            ],
            "num_vehicles": 3
        }
    }

Common cuOpt schemas:
    - cuopt.VRPData: Vehicle Routing Problem (delivery, TSP)
    - cuopt.NativeMILPData: Mixed Integer/Linear Programming (native cuOpt format)
    - cuopt.Coordinate: Location coordinates (x/y or lat/lng)
    - cuopt.VRPNode: Customer/location node with demand
    - cuopt.Constraints: Solver constraints
    - cuopt.SolverConfig: Solver configuration

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `schema_name` | `string` | - | **Yes** |

---

## `validate_data`

Validate data against a schema without creating a panel.

Use this to check if your data structure is correct before passing it
to cuopt_solve or creating a Json panel.

Args:
    schema_name: Schema to validate against (e.g., "cuopt.VRPData")
    data: Data to validate

Returns:
    On success: {"valid": true, "normalized_data": {...}}
    On failure: {"valid": false, "errors": [...], "hint": "..."}

Example:
    >>> await validate_data(
    ...     schema_name="cuopt.VRPData",
    ...     data={
    ...         "depot": {"x": 0, "y": 0},
    ...         "customers": [{"id": "A", "x": 10, "y": 20}]
    ...     }
    ... )
    {
        "valid": true,
        "normalized_data": {
            "depot": {"x": 0.0, "y": 0.0},
            "customers": [{"id": "A", "x": 10.0, "y": 20.0}]
        }
    }

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `schema_name` | `string` | - | **Yes** |
| `data` | `object` | - | **Yes** |

---

## `search_knowledge_base`

Search the Drilling Knowledge Base for technical information.

Queries a vector database of 25 drilling PDFs covering drilling products
and equipment, engineering formulas, Permian Basin
geology, safety standards, and drilling fluids reference.

Use this tool when the user asks about:
- Product specifications or comparisons
- Drilling formulas and engineering calculations
- Formation properties and geology
- Safety standards and regulations
- Mud/fluids properties and recommendations

Do NOT use this tool for real-time drilling data — use the data tools instead.

Args:
    query: Natural language search query describing what information to find.
    num_results: Number of results to return (1-10, default 3).
Returns:
    JSON array of matching text passages from the knowledge base,
    or an error message if the knowledge base is not configured.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `query` | `string` | - | **Yes** |
| `num_results` | `integer` | - | No |

---

## `get_available_wells`

Get a list of wells available for analysis.

Returns well IDs, names, locations, current status, and basic metadata.
Use this tool when the user asks about available wells or what data is accessible.

*No parameters required.*

---

## `get_realtime_drilling_data`

Get a full real-time drilling data snapshot for a well.

Returns the current state of all drilling systems including drilling
parameters (WOB, RPM, ROP, torque, MSE), hydraulics (mud weight, flow
rate, standpipe pressure, ECD), vibration (stick-slip index, 3-axis
levels), well path (MD, TVD, inclination, azimuth), and overall status.

Args:
    well_id: The well identifier (e.g. "HAL-DEMO-001").
Returns:
    JSON object with drillingParameters, hydraulics, vibration,
    wellPath, and status sections.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `well_id` | `string` | - | **Yes** |

---

## `get_drilling_history`

Get time-indexed drilling history records over a depth range.

Returns a list of records, each containing drilling parameters and
vibration data at regular depth intervals. Useful for trend analysis,
identifying parameter changes across formations, and reviewing
historical performance.

Args:
    well_id: The well identifier (e.g. "HAL-DEMO-001").
    start_depth: Starting measured depth in feet. Defaults to 0 (surface).
    end_depth: Ending measured depth in feet. Defaults to current bit depth.
Returns:
    JSON array of time-indexed drilling records with parameters,
    vibration, and formation data at each depth interval.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `well_id` | `string` | - | **Yes** |
| `start_depth` | `number` | - | No |
| `end_depth` | `number` | - | No |

---

## `get_vibration_analysis`

Get vibration and stick-slip analysis for a well.

Returns the Stick-Slip Index (SSI) with severity classification,
3-axis vibration levels (axial, lateral, torsional) in g-force with
Low/Medium/High ratings, RPM statistics, and recommended mitigation
actions from Drilling Automation and Vibration Control systems.

SSI thresholds: <0.05 Stable, 0.05-0.5 Moderate, >0.5 Severe.

Args:
    well_id: The well identifier (e.g. "HAL-DEMO-001").
Returns:
    JSON object with SSI, severity, 3-axis vibration levels,
    RPM statistics, and mitigation recommendations.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `well_id` | `string` | - | **Yes** |

---

## `get_mse_efficiency`

Get Mechanical Specific Energy (MSE) efficiency analysis.

Calculates MSE using Teale's equation and compares it to the formation's
Confined Compressive Strength (CCS) to produce an efficiency rating.
High MSE relative to CCS indicates energy waste from bit wear, vibration,
or sub-optimal parameters.

Efficiency ratings: >80% Excellent, >60% Good, >40% Fair, <=40% Poor.

Args:
    well_id: The well identifier (e.g. "HAL-DEMO-001").
Returns:
    JSON object with MSE, formation CCS, efficiency percentage,
    rating, current parameters, and optimization recommendations.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `well_id` | `string` | - | **Yes** |

---

## `get_rop_optimization`

Get Rate of Penetration (ROP) optimization recommendations.

Performs founder point analysis to determine optimal WOB and RPM
settings. The founder point is where additional WOB no longer improves
ROP and instead wastes energy. Returns current vs optimal parameters
with estimated ROP improvement percentage.

Args:
    well_id: The well identifier (e.g. "HAL-DEMO-001").
Returns:
    JSON object with current parameters, optimal WOB/RPM targets,
    founder point threshold, estimated ROP improvement, and analysis.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `well_id` | `string` | - | **Yes** |

---

## `get_well_trajectory`

Get directional survey data for the well trajectory.

Returns survey stations at regular intervals from surface to current
bit depth. Each station includes measured depth, inclination, azimuth,
true vertical depth, northing, easting, and dogleg severity. Covers
all phases: vertical surface hole, intermediate, build section curve
to horizontal, and lateral.

Args:
    well_id: The well identifier (e.g. "HAL-DEMO-001").
Returns:
    JSON array of survey stations with MD, inclination, azimuth,
    TVD, northing, easting, phase, and dogleg severity.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `well_id` | `string` | - | **Yes** |

---

## `get_drilling_events`

Get drilling events, alarms, and advisories for a well.

Returns active events at the current drilling depth including status
updates, stick-slip alerts, MSE inefficiency warnings, formation
change advisories, and bit wear trends. Each event includes severity
level, description, and recommended actions.

Severity levels: info, advisory, warning, critical.

Args:
    well_id: The well identifier (e.g. "HAL-DEMO-001").
    severity: Optional filter by severity level (e.g. "critical",
        "warning", "advisory", "info"). Empty string returns all events.
Returns:
    JSON array of event objects with event_id, timestamp, type,
    severity, message, and recommended_action fields.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `well_id` | `string` | - | **Yes** |
| `severity` | `string` | - | No |

---

## `get_recent_seismic_traces`

Get the 5 most recent seismic traces available for waveform visualization.

Returns trace_name_original values ordered by trace_start_time descending.
Results are cached for the lifetime of the server process since the dataset
is static. Use the returned trace_name_original values with
get_seismic_waveform_chart to visualize a waveform.
Args:
    just_quake: If True, only return traces that are likely earthquake events based on metadata flags.
Returns:
    JSON array of objects with trace_name_original and trace_start_time fields.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `just_quake` | `boolean` | - | No |

---

## `get_seismic_waveform_chart`

Fetch a seismic waveform from BigQuery and return it as a Plotly chart panel.

Queries stead_metadata to resolve the trace, then loads the 3-component
waveform (Z/N/E channels) from stead_waveforms, downsamples to max_points,
and renders a dark-mode Plotly figure with P and S arrival markers.

Args:
    trace_name_original: The original trace name from stead_metadata (e.g. "YH.B061.2013.274.09.00.00.0180").
    max_points: Maximum number of samples per channel after downsampling (default 500).
    return_json: If True, returns the Plotly figure as a JSON string instead of a ChartRef.
Returns:
    ChartRef | str: Panel chart stored in staging for use with other panel tools, or JSON string if return_json is True.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `trace_name_original` | `string` | - | **Yes** |
| `max_points` | `integer` | - | No |
| `return_json` | `boolean` | - | No |

---

## `get_seismic_magnitude`

Get the estimated magnitude for a seismic trace using a fine-tuned LLM.

The model takes in the waveform data and automatically looks up the necessary waveforms.
call get_recent_seismic_traces to get trace name values

Args:
    trace_name: The system  trace name (e.g. "bucket229$447,:3,:6000").
Returns:
    JSON string with the predicted magnitude.

### Parameters

| Name | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `trace_name` | `string` | - | **Yes** |

---

