# Inflation and Cost of Living Analysis

**Objective:** To provide specialized analysis on consumer prices, inflation, and cost of living adjustments (COLA).

**Key Concepts:**
*   **Inflation:** The rate at which the general level of prices for goods and services is rising, and subsequently, purchasing power is falling.
*   **Consumer Price Index (CPI):** A measure that examines the weighted average of prices of a basket of consumer goods and services, such as transportation, food, and medical care.
*   **Producer Price Index (PPI):** A measure of the average change over time in the selling prices received by domestic producers for their output.
*   **Personal Consumption Expenditures (PCE) Price Index:** A measure of price changes in consumer goods and services. It is the primary inflation measure used by the Federal Reserve.
*   **Cost of Living Adjustment (COLA):** An increase in Social Security benefits to counteract inflation.

**Relevant FRED Series IDs:**
*   `CPIAUCSL`: Consumer Price Index for All Urban Consumers: All Items in U.S. City Average
*   `PCEPI`: Personal Consumption Expenditures: Chain-type Price Index
*   `PPIACO`: Producer Price Index for All Commodities
*   `CPIFABSL`: Consumer Price Index for All Urban Consumers: Food and Beverages in U.S. City Average
*   `CPIENGSL`: Consumer Price Index for All Urban Consumers: Energy in U.S. City Average
*   `CUSR0000SA0L1E`: Consumer Price Index for All Urban Consumers: All items less food and energy in U.S. City Average (Core CPI)

**Analytical Workflow:**
1.  **Identify the Core Question:** Is the user asking about overall inflation, price changes in a specific category (e.g., food, energy), or how inflation impacts wages and benefits (COLA)?
2.  **Select the Right Metric:**
    *   For general consumer inflation, use `CPIAUCSL`.
    *   For the Fed's preferred measure, use `PCEPI`.
    *   To understand producer-level price pressures, use `PPIACO`.
    *   For "core" inflation, excluding volatile food and energy, use `CUSR0000SA0L1E`.
3.  **Retrieve and Analyze Data:**
    *   Fetch the relevant time series data from FRED.
    *   Calculate year-over-year and month-over-month percentage changes to show inflation rates.
    *   Compare different inflation measures to provide a comprehensive picture.
    *   Analyze trends in core vs. headline inflation.
4.  **Synthesize and Report:**
    *   Explain the current inflation rate in the context of historical data and central bank targets (e.g., the Fed's 2% target).
    *   Discuss the drivers of inflation (e.g., supply chain issues, demand, energy prices).
    *   If asked about COLA, explain how it is typically calculated based on CPI changes.
