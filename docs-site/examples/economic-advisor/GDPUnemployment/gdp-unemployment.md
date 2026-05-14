# GDP and Unemployment Analysis

**Objective:** To provide specialized analysis on economic growth (GDP) and labor market conditions (unemployment).

**Key Concepts:**
*   **Gross Domestic Product (GDP):** The total monetary or market value of all the finished goods and services produced within a country's borders in a specific time period.
*   **Real GDP:** GDP adjusted for inflation.
*   **GDP Components:** Personal Consumption Expenditures, Gross Private Domestic Investment, Net Exports, and Government Consumption Expenditures and Gross Investment.
*   **Unemployment Rate:** The percentage of the labor force that is jobless.
*   **Labor Force Participation Rate:** The percentage of the working-age population that is either working or actively looking for work.
*   **Non-Farm Payrolls:** A measure of the number of U.S. workers in the economy that excludes farm workers, private household employees, or non-profit organization employees.

**Relevant FRED Series IDs:**
*   `GDP`: Gross Domestic Product
*   `GDPC1`: Real Gross Domestic Product
*   `PCEC`: Personal Consumption Expenditures
*   `GPDI`: Gross Private Domestic Investment
*   `NETEXP`: Net Exports of Goods and Services
*   `GCE`: Government Consumption Expenditures and Gross Investment
*   `UNRATE`: Civilian Unemployment Rate
*   `CIVPART`: Labor Force Participation Rate
*   `PAYEMS`: Total Nonfarm Payrolls

**Analytical Workflow:**
1.  **Identify the Core Question:** Is the user asking about overall economic growth, the components of GDP, the state of the labor market, or the relationship between them?
2.  **Select the Right Metric:**
    *   For economic growth, use `GDPC1` (Real GDP).
    *   To understand the drivers of growth, analyze the components (`PCEC`, `GPDI`, `NETEXP`, `GCE`).
    *   For the headline unemployment number, use `UNRATE`.
    *   For a broader view of the labor market, look at `CIVPART` and `PAYEMS`.
3.  **Retrieve and Analyze Data:**
    *   Fetch the relevant time series data from FRED.
    *   Calculate quarter-over-quarter or year-over-year growth rates for GDP.
    *   Analyze the contributions of different components to GDP growth.
    *   Examine trends in the unemployment rate and labor force participation.
    *   Look at job creation numbers from Non-Farm Payrolls.
4.  **Synthesize and Report:**
    *   Explain the current state of economic growth and the labor market in historical context.
    *   Discuss the relationship between GDP growth and unemployment (Okun's Law).
    *   Analyze the health of the labor market beyond the headline unemployment rate.
    *   Provide an outlook based on the latest data.
