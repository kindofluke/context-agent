# Getting Started

To show you the power of context agents, lets take a workable example. For household and corporate budgets, there are range of micro and macro-economic factors that can play apart in spending. 

What if we could get the most accurate economic statistics and use the m in data analysis? 

Lets do it. To economic data we will use [FRED](https://fred.stlouisfed.org/)

```
FRED® stands for Federal Reserve Economic Data. FRED® contains frequently updated US macro and regional economic time series at annual, quarterly, monthly, weekly, and daily frequencies. FRED® aggregates economic data from a variety of sources- most of which are US government agencies. The economic time series in FRED® contain observation or measurement periods associated with data values. For instance, the US unemployment rate for the month of January, 1990 was 5.4 percent and for the month of January, 2000 was 4.0 percent.
```

## Setup and Authentication

<alert green>If you plan on just trying this in our [Playground] you can skip this section. In the playground, we have injected an API key on your behalf</alert>

If you are going to be following along using the [cli](./command-line.md) then now is when you need a [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html). 

Create an envrionment variable with this key:

```
export CT_PY_FRED_API_KEY=<your-key>
```

Note the CT_PY prefix. Context Agent will only allow your agent to access environment variables with a CT_PY_ prefix. This is a good security measure esnuring your agent has only what it needs to succeed. 

<alert>
This is experimental software. The LLM can and will log the environment variable to files that it will read. If your organizaiton has strict rules about API Key visibility maybe wait on trying out Context Agents. 
</alert>

## Initialize Your Agent 

Create an empty directory that will will hold your agent: 

```
mkdir economic-advisor
cd economic-advisor
```


Or you can open the agent in the playground: 

<play>
OPEN EMPTY PLAYGROUND use docs-site/assets/EmptyPlayground.gif
</play>


You can now add or create a "SystemPrompt.md" which will be used as the instructions for the agnet. 



<play>
SHOW ADDING SYSTEM PROMPT in PLayground  add docs-site/assets/AddingSystemPrompts.gif
</play>

## Hello World 

Drop in an OpenAPI spec and the agent immediately understands the shape of the API — endpoints, parameters, and response types. It can now reason about how to call the service, even before any code is written.

Next add the openapi spec for the Fred API and ask the agent "Test connectivty and develop a javascript function to access monthly statistics."

This takes a minute but the agent explores the javascript environment and determines how to call teh FRED API. Once it finds a pattern, it creates a `fred-tools.js` which will javascript functions it can continue to reference. Its essentially writing its own tools. 

In my testing, it will call 15 or 30 permutations until gets a file that it likes. But now the agent has tools it feels comfortable with and the next invocation is much faster. 

<play>SHOW docs-site/assets/Creating Tools.gif</play>


## More More More please 

You can add more context too. You don't have to follow a special setup for skills just add new markdown in a directory. The agent has tree and it will understand whether it wants to go search out those documents or not. 

<play>docs-site/assets/AddingContext.gif show this one </play>

