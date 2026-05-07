# Natural Language Agent Builder 

The goal of this project is to create a simply ReACT Style with an Perception Action Loop but the agent takes in all of its context goals from a local directory and is able to actually code its own tools. 

# High Level Architecture

Under the hood we have a simple agent in a pydantic ai. 

You can access documentation for pydantic-AI at @pydantic-documentation/pydantic-ai

1. invocation: invocation getsin the user prompt, message history and creates the initial state for that turn, it ensures the user has passed a valid "execute_directory" the agent will treat that as ROOT 

the sytem prompt is sourced from the SystemPrompt.md at the execute_directory

During Invocation a state obeject should be created AND we should create a Javascript runtime (powered by deno which will be used by the tool call )

2. Tools: 

The agent has ONLY 1 tool.

 
`execute_js`: allows the agent to write Javascript Arrow function that is run on the Deno platform. During the invocation ste


3. Deno environment: 

The deno environment should use `deno run` with a strict set of permissions `--allow-read=<execute_directory> --allow-write<execute_directory> --deny-read=.env`

the allow read should be customized to ONLY load JS/TS,JSON/YAML/YML and Markdown files 

we should also have --allow-net to get a user list of domains that is passed in via invocation

**Environment Variables**

We should allow the deno execution environment to have access to any environment variable with a `NL_PY_` prefix

**Built in Funcitons**  

with in the JS Deno Runtime we should add to global the following tools/functions which agent can invoke

`cat`: to read files
`find`: to find files 
`grep`: to find text 
`tree`: to understand the files available for context. 
`write`: to create a new file or overwrite a new file
`search_and_replace`: to change the text of a new file

The agent can also write arrow functions which can be executed 

```
async () => {
  const data = await fred.request({
    method: 'GET',
    path: '/fred/series/observations',
    params: { series_id: 'GDP' }
  });
  return data;
}
```

the JS/Deno runtime should also run and execute any JS files it identifies in the execution_directory. This effectively allows the agent to write its own tools. 

# User Journey. 

Pretend the user wants to write an application that trades stocks. 

1. User creates an empty directory "stock_trader"
2. within "stock_trader" the user authors a System prompt about the trading strategy. 
3. the add an environment variable NL_PY_ALPACA_TOKEN which contains authentication tokens for the Alpaca trading service. 
4. The user runs a command in cli "nl-agent serve  --exec_dir "./stock_trader" a fastapi server starts and the user visits http://localhost:9101 and sees a simple chat interface. 
5. THe user enters "Go ahead and connect to Alpaca and make sure you can make trades on our account" the agent is then invoked via AG-UI


now the agent does the following 

6. takes in the user input and begins a turn with the agent. 

7. The Agent identifies SystemPrompt.md. The agent (pydantic ai) adds in some information about how to use the execute-js tool including documentation of the file directory functions `cat`, `find` etc. 

8. The agent writes JS 

`execute_js(tree(3))` and gets back 
```
|
--SystemPrompt.md
```

the agent then tests functionality to alpaca somehting like 

```
async () => {
  const token = Deno.env.get('NL_PY_ALPACA_TOKEN');
  
  if (!token) {
    throw new Error('Environment variable NL_PY_ALPACA_TOKEN is not set.');
  }

  const response = await fetch('https://paper-api.alpaca.markets/v2/account', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Alpaca API Error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Return the full account data
  return data;
}
```

9. Now that this works the agent authors tools.js which is saved in the execute directory 


```
write('tools.js', <TEXT OF JS FUNCITONs>)
```

this allos the agent to have functions for trading right off the bat on the next turn tools.js should already be loaded. 

10. agent fetches data and returns repsonse to user. 


## Implementation details

this project uses uv so to add packages use `uv add` and then use `uv build` to test builds . 

