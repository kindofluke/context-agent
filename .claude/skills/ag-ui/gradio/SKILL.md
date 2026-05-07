---
name: gradio
description: Information about gradio chat bot interfacs and use with fastapi
---

# Building a UI for an LLM Agent



The Gradio Chatbot can natively display intermediate thoughts and tool usage in a collapsible accordion next to a chat message. This makes it perfect for creating UIs for LLM agents and chain-of-thought (CoT) or reasoning demos. This guide will show you how to display thoughts and tool usage with `gr.Chatbot` and `gr.ChatInterface`.

![](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/gradio-guides/nested-thoughts.png)

## The `ChatMessage` dataclass

Every element of the chatbot value is a dictionary of `role` and `content` keys. You can always use plain python dictionaries to add new values to the chatbot but Gradio also provides the `ChatMessage` dataclass to help you with IDE autocompletion. The schema of `ChatMessage` is as follows:

 ```py
MessageContent = Union[str, FileDataDict, FileData, Component]

@dataclass
class ChatMessage:
    content: MessageContent | [MessageContent]
    role: Literal["user", "assistant"]
    metadata: MetadataDict = None
    options: list[OptionDict] = None

class MetadataDict(TypedDict):
    title: NotRequired[str]
    id: NotRequired[int | str]
    parent_id: NotRequired[int | str]
    log: NotRequired[str]
    duration: NotRequired[float]
    status: NotRequired[Literal["pending", "done"]]

class OptionDict(TypedDict):
    label: NotRequired[str]
    value: str
 ```


For our purposes, the most important key is the `metadata` key, which accepts a dictionary. If this dictionary includes a `title` for the message, it will be displayed in a collapsible accordion representing a thought. It's that simple! Take a look at this example:


```python
import gradio as gr

with gr.Blocks() as demo:
    chatbot = gr.Chatbot(
        value=[
            gr.ChatMessage(
                role="user", 
                content="What is the weather in San Francisco?"
            ),
            gr.ChatMessage(
                role="assistant", 
                content="I need to use the weather API tool?",
                metadata={"title":  "🧠 Thinking"}
            )
        ]
    )

demo.launch()
```



In addition to `title`, the dictionary provided to `metadata` can take several optional keys:

* `log`: an optional string value to be displayed in a subdued font next to the thought title.
* `duration`: an optional numeric value representing the duration of the thought/tool usage, in seconds. Displayed in a subdued font next inside parentheses next to the thought title.
* `status`: if set to `"pending"`, a spinner appears next to the thought title and the accordion is initialized open.  If `status` is `"done"`, the thought accordion is initialized closed. If `status` is not provided, the thought accordion is initialized open and no spinner is displayed.
* `id` and `parent_id`: if these are provided, they can be used to nest thoughts inside other thoughts.

Below, we show several complete examples of using `gr.Chatbot` and `gr.ChatInterface` to display tool use or thinking UIs.

## Building with Agents

### A real example using transformers.agents

We'll create a Gradio application simple agent that has access to a text-to-image tool.
            
Tip: Make sure you read the <a href="https://huggingface.co/docs/smolagents/index">smolagents documentation</a> first
                

We'll start by importing the necessary classes from transformers and gradio. 

```python
import gradio as gr
from gradio import ChatMessage
from transformers import Tool, ReactCodeAgent  # type: ignore
from transformers.agents import stream_to_gradio, HfApiEngine  # type: ignore

# Import tool from Hub
image_generation_tool = Tool.from_space(
    space_id="black-forest-labs/FLUX.1-schnell",
    name="image_generator",
    description="Generates an image following your prompt. Returns a PIL Image.",
    api_name="/infer",
)

llm_engine = HfApiEngine("Qwen/Qwen2.5-Coder-32B-Instruct")
# Initialize the agent with both tools and engine
agent = ReactCodeAgent(tools=[image_generation_tool], llm_engine=llm_engine)
```

Then we'll build the UI:

```python
def interact_with_agent(prompt, history):
    messages = []
    yield messages
    for msg in stream_to_gradio(agent, prompt):
        messages.append(asdict(msg))
        yield messages
    yield messages


demo = gr.ChatInterface(
    interact_with_agent,
    chatbot= gr.Chatbot(
        label="Agent",
        avatar_images=(
            None,
            "https://em-content.zobj.net/source/twitter/53/robot-face_1f916.png",
        ),
    ),
    examples=[
        ["Generate an image of an astronaut riding an alligator"],
        ["I am writing a children's book for my daughter. Can you help me with some illustrations?"],
    ],
)
```

You can see the full demo code [here](https://huggingface.co/spaces/gradio/agent_chatbot/blob/main/app.py).


![transformers_agent_code](https://github.com/freddyaboulton/freddyboulton/assets/41651716/c8d21336-e0e6-4878-88ea-e6fcfef3552d)


### A real example using langchain agents

We'll create a UI for langchain agent that has access to a search engine.

We'll begin with imports and setting up the langchain agent. Note that you'll need an .env file with the following environment variables set - 

```
SERPAPI_API_KEY=
HF_TOKEN=
OPENAI_API_KEY=
```

```python
from langchain import hub
from langchain.agents import AgentExecutor, create_openai_tools_agent, load_tools
from langchain_openai import ChatOpenAI
from gradio import ChatMessage
import gradio as gr

from dotenv import load_dotenv

load_dotenv()

model = ChatOpenAI(temperature=0, streaming=True)

tools = load_tools(["serpapi"])

# Get the prompt to use - you can modify this!
prompt = hub.pull("hwchase17/openai-tools-agent")
agent = create_openai_tools_agent(
    model.with_config({"tags": ["agent_llm"]}), tools, prompt
)
agent_executor = AgentExecutor(agent=agent, tools=tools).with_config(
    {"run_name": "Agent"}
)
```

Then we'll create the Gradio UI

```python
async def interact_with_langchain_agent(prompt, messages):
    messages.append(ChatMessage(role="user", content=prompt))
    yield messages
    async for chunk in agent_executor.astream(
        {"input": prompt}
    ):
        if "steps" in chunk:
            for step in chunk["steps"]:
                messages.append(ChatMessage(role="assistant", content=step.action.log,
                                  metadata={"title": f"🛠️ Used tool {step.action.tool}"}))
                yield messages
        if "output" in chunk:
            messages.append(ChatMessage(role="assistant", content=chunk["output"]))
            yield messages


with gr.Blocks() as demo:
    gr.Markdown("# Chat with a LangChain Agent 🦜⛓️ and see its thoughts 💭")
    chatbot = gr.Chatbot(
        label="Agent",
        avatar_images=(
            None,
            "https://em-content.zobj.net/source/twitter/141/parrot_1f99c.png",
        ),
    )
    input = gr.Textbox(lines=1, label="Chat Message")
    input.submit(interact_with_langchain_agent, [input_2, chatbot_2], [chatbot_2])

demo.launch()
```

![langchain_agent_code](https://github.com/freddyaboulton/freddyboulton/assets/41651716/762283e5-3937-47e5-89e0-79657279ea67)

That's it! See our finished langchain demo [here](https://huggingface.co/spaces/gradio/langchain-agent).


## Building with Visibly Thinking LLMs


The Gradio Chatbot can natively display intermediate thoughts of a _thinking_ LLM. This makes it perfect for creating UIs that show how an AI model "thinks" while generating responses. Below guide will show you how to build a chatbot that displays Gemini AI's thought process in real-time.


### A real example using Gemini 2.0 Flash Thinking API

Let's create a complete chatbot that shows its thoughts and responses in real-time. We'll use Google's Gemini API for accessing Gemini 2.0 Flash Thinking LLM and Gradio for the UI.

We'll begin with imports and setting up the gemini client. Note that you'll need to [acquire a Google Gemini API key](https://aistudio.google.com/apikey) first -

```python
import gradio as gr
from gradio import ChatMessage
from typing import Iterator
import google.generativeai as genai

genai.configure(api_key="your-gemini-api-key")
model = genai.GenerativeModel("gemini-2.0-flash-thinking-exp-1219")
```

First, let's set up our streaming function that handles the model's output:

```python
def stream_gemini_response(user_message: str, messages: list) -> Iterator[list]:
    """
    Streams both thoughts and responses from the Gemini model.
    """
    # Initialize response from Gemini
    response = model.generate_content(user_message, stream=True)
    
    # Initialize buffers
    thought_buffer = ""
    response_buffer = ""
    thinking_complete = False
    
    # Add initial thinking message
    messages.append(
        ChatMessage(
            role="assistant",
            content="",
            metadata={"title": "⏳Thinking: *The thoughts produced by the Gemini2.0 Flash model are experimental"}
        )
    )
    
    for chunk in response:
        parts = chunk.candidates[0].content.parts
        current_chunk = parts[0].text
        
        if len(parts) == 2 and not thinking_complete:
            # Complete thought and start response
            thought_buffer += current_chunk
            messages[-1] = ChatMessage(
                role="assistant",
                content=thought_buffer,
                metadata={"title": "⏳Thinking: *The thoughts produced by the Gemini2.0 Flash model are experimental"}
            )
            
            # Add response message
            messages.append(
                ChatMessage(
                    role="assistant",
                    content=parts[1].text
                )
            )
            thinking_complete = True
            
        elif thinking_complete:
            # Continue streaming response
            response_buffer += current_chunk
            messages[-1] = ChatMessage(
                role="assistant",
                content=response_buffer
            )
            
        else:
            # Continue streaming thoughts
            thought_buffer += current_chunk
            messages[-1] = ChatMessage(
                role="assistant",
                content=thought_buffer,
                metadata={"title": "⏳Thinking: *The thoughts produced by the Gemini2.0 Flash model are experimental"}
            )
        
        yield messages
```

Then, let's create the Gradio interface:

```python
with gr.Blocks() as demo:
    gr.Markdown("# Chat with Gemini 2.0 Flash and See its Thoughts 💭")
    
    chatbot = gr.Chatbot(
        label="Gemini2.0 'Thinking' Chatbot",
        render_markdown=True,
    )
    
    input_box = gr.Textbox(
        lines=1,
        label="Chat Message",
        placeholder="Type your message here and press Enter..."
    )
    
    # Set up event handlers
    msg_store = gr.State("")  # Store for preserving user message
    
    input_box.submit(
        lambda msg: (msg, msg, ""),  # Store message and clear input
        inputs=[input_box],
        outputs=[msg_store, input_box, input_box],
        queue=False
    ).then(
        user_message,  # Add user message to chat
        inputs=[msg_store, chatbot],
        outputs=[input_box, chatbot],
        queue=False
    ).then(
        stream_gemini_response,  # Generate and stream response
        inputs=[msg_store, chatbot],
        outputs=chatbot
    )

demo.launch()
```

This creates a chatbot that:

- Displays the model's thoughts in a collapsible section
- Streams the thoughts and final response in real-time
- Maintains a clean chat history

 That's it! You now have a chatbot that not only responds to users but also shows its thinking process, creating a more transparent and engaging interaction. See our finished Gemini 2.0 Flash Thinking demo [here](https://huggingface.co/spaces/ysharma/Gemini2-Flash-Thinking).


 ## Building with Citations 

The Gradio Chatbot can display citations from LLM responses, making it perfect for creating UIs that show source documentation and references. This guide will show you how to build a chatbot that displays Claude's citations in real-time.

### A real example using Anthropic's Citations API
Let's create a complete chatbot that shows both responses and their supporting citations. We'll use Anthropic's Claude API with citations enabled and Gradio for the UI.

We'll begin with imports and setting up the Anthropic client. Note that you'll need an `ANTHROPIC_API_KEY` environment variable set:

```python
import gradio as gr
import anthropic
import base64
from typing import List, Dict, Any

client = anthropic.Anthropic()
```

First, let's set up our message formatting functions that handle document preparation:

```python
def encode_pdf_to_base64(file_obj) -> str:
    """Convert uploaded PDF file to base64 string."""
    if file_obj is None:
        return None
    with open(file_obj.name, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')

def format_message_history(
    history: list, 
    enable_citations: bool,
    doc_type: str,
    text_input: str,
    pdf_file: str
) -> List[Dict]:
    """Convert Gradio chat history to Anthropic message format."""
    formatted_messages = []
    
    # Add previous messages
    for msg in history[:-1]:
        if msg["role"] == "user":
            formatted_messages.append({"role": "user", "content": msg["content"]})
    
    # Prepare the latest message with document
    latest_message = {"role": "user", "content": []}
    
    if enable_citations:
        if doc_type == "plain_text":
            latest_message["content"].append({
                "type": "document",
                "source": {
                    "type": "text",
                    "media_type": "text/plain",
                    "data": text_input.strip()
                },
                "title": "Text Document",
                "citations": {"enabled": True}
            })
        elif doc_type == "pdf" and pdf_file:
            pdf_data = encode_pdf_to_base64(pdf_file)
            if pdf_data:
                latest_message["content"].append({
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_data
                    },
                    "title": pdf_file.name,
                    "citations": {"enabled": True}
                })
    
    # Add the user's question
    latest_message["content"].append({"type": "text", "text": history[-1]["content"]})
    
    formatted_messages.append(latest_message)
    return formatted_messages
```

Then, let's create our bot response handler that processes citations:

```python
def bot_response(
    history: list,
    enable_citations: bool,
    doc_type: str,
    text_input: str,
    pdf_file: str
) -> List[Dict[str, Any]]:
    try:
        messages = format_message_history(history, enable_citations, doc_type, text_input, pdf_file)
        response = client.messages.create(model="claude-3-5-sonnet-20241022", max_tokens=1024, messages=messages)
        
        # Initialize main response and citations
        main_response = ""
        citations = []
        
        # Process each content block
        for block in response.content:
            if block.type == "text":
                main_response += block.text
                if enable_citations and hasattr(block, 'citations') and block.citations:
                    for citation in block.citations:
                        if citation.cited_text not in citations:
                            citations.append(citation.cited_text)
        
        # Add main response
        history.append({"role": "assistant", "content": main_response})
        
        # Add citations in a collapsible section
        if enable_citations and citations:
            history.append({
                "role": "assistant",
                "content": "\n".join([f"• {cite}" for cite in citations]),
                "metadata": {"title": "📚 Citations"}
            })
        
        return history
            
    except Exception as e:
        history.append({
            "role": "assistant",
            "content": "I apologize, but I encountered an error while processing your request."
        })
        return history
```

Finally, let's create the Gradio interface:

```python
with gr.Blocks() as demo:
    gr.Markdown("# Chat with Citations")
    
    with gr.Row(scale=1):
        with gr.Column(scale=4):
            chatbot = gr.Chatbot(bubble_full_width=False, show_label=False, scale=1)
            msg = gr.Textbox(placeholder="Enter your message here...", show_label=False, container=False)
            
        with gr.Column(scale=1):
            enable_citations = gr.Checkbox(label="Enable Citations", value=True, info="Toggle citation functionality" )
            doc_type_radio = gr.Radio( choices=["plain_text", "pdf"], value="plain_text", label="Document Type", info="Choose the type of document to use")
            text_input = gr.Textbox(label="Document Content", lines=10, info="Enter the text you want to reference")
            pdf_input = gr.File(label="Upload PDF", file_types=[".pdf"], file_count="single", visible=False)
    
    # Handle message submission
    msg.submit(
        user_message,
        [msg, chatbot, enable_citations, doc_type_radio, text_input, pdf_input],
        [msg, chatbot]
    ).then(
        bot_response,
        [chatbot, enable_citations, doc_type_radio, text_input, pdf_input],
        chatbot
    )

demo.launch()
```

This creates a chatbot that:
- Supports both plain text and PDF documents for Claude to cite from 
- Displays Citations in collapsible sections using our `metadata` feature
- Shows source quotes directly from the given documents

The citations feature works particularly well with the Gradio Chatbot's `metadata` support, allowing us to create collapsible sections that keep the chat interface clean while still providing easy access to source documentation.

That's it! You now have a chatbot that not only responds to users but also shows its sources, creating a more transparent and trustworthy interaction. See our finished Citations demo [here](https://huggingface.co/spaces/ysharma/anthropic-citations-with-gradio-metadata-key).



# Building a Web App with the Gradio Python Client



In this guide, we will demonstrate how to use the `gradio_client` [Python library](getting-started-with-the-python-client/), which enables developers to make requests to a Gradio app programmatically, by creating an end-to-end example web app using FastAPI. The web app we will be building is called "Acapellify," and it will allow users to upload video files as input and return a version of that video without instrumental music. It will also display a gallery of generated videos.

**Prerequisites**

Before we begin, make sure you are running Python 3.9 or later, and have the following libraries installed:

- `gradio_client`
- `fastapi`
- `uvicorn`

You can install these libraries from `pip`:

```bash
$ pip install gradio_client fastapi uvicorn
```

You will also need to have ffmpeg installed. You can check to see if you already have ffmpeg by running in your terminal:

```bash
$ ffmpeg version
```

Otherwise, install ffmpeg [by following these instructions](https://www.hostinger.com/tutorials/how-to-install-ffmpeg).

## Step 1: Write the Video Processing Function

Let's start with what seems like the most complex bit -- using machine learning to remove the music from a video.

Luckily for us, there's an existing Space we can use to make this process easier: [https://huggingface.co/spaces/abidlabs/music-separation](https://huggingface.co/spaces/abidlabs/music-separation). This Space takes an audio file and produces two separate audio files: one with the instrumental music and one with all other sounds in the original clip. Perfect to use with our client!

Open a new Python file, say `main.py`, and start by importing the `Client` class from `gradio_client` and connecting it to this Space:

```py
from gradio_client import Client, handle_file

client = Client("abidlabs/music-separation")

def acapellify(audio_path):
    result = client.predict(handle_file(audio_path), api_name="/predict")
    return result[0]
```

That's all the code that's needed -- notice that the API endpoints returns two audio files (one without the music, and one with just the music) in a list, and so we just return the first element of the list.

---

**Note**: since this is a public Space, there might be other users using this Space as well, which might result in a slow experience. You can duplicate this Space with your own [Hugging Face token](https://huggingface.co/settings/tokens) and create a private Space that only you have will have access to and bypass the queue. To do that, simply replace the first two lines above with:

```py
from gradio_client import Client

client = Client.duplicate("abidlabs/music-separation", token=YOUR_HF_TOKEN)
```

Everything else remains the same!

---

Now, of course, we are working with video files, so we first need to extract the audio from the video files. For this, we will be using the `ffmpeg` library, which does a lot of heavy lifting when it comes to working with audio and video files. The most common way to use `ffmpeg` is through the command line, which we'll call via Python's `subprocess` module:

Our video processing workflow will consist of three steps:

1. First, we start by taking in a video filepath and extracting the audio using `ffmpeg`.
2. Then, we pass in the audio file through the `acapellify()` function above.
3. Finally, we combine the new audio with the original video to produce a final acapellified video.

Here's the complete code in Python, which you can add to your `main.py` file:

```python
import subprocess

def process_video(video_path):
    old_audio = os.path.basename(video_path).split(".")[0] + ".m4a"
    subprocess.run(['ffmpeg', '-y', '-i', video_path, '-vn', '-acodec', 'copy', old_audio])

    new_audio = acapellify(old_audio)

    new_video = f"acap_{video_path}"
    subprocess.call(['ffmpeg', '-y', '-i', video_path, '-i', new_audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-strict', 'experimental', f"static/{new_video}"])
    return new_video
```

You can read up on [ffmpeg documentation](https://ffmpeg.org/ffmpeg.html) if you'd like to understand all of the command line parameters, as they are beyond the scope of this tutorial.

## Step 2: Create a FastAPI app (Backend Routes)

Next up, we'll create a simple FastAPI app. If you haven't used FastAPI before, check out [the great FastAPI docs](https://fastapi.tiangolo.com/). Otherwise, this basic template, which we add to `main.py`, will look pretty familiar:

```python
import os
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

videos = []

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(
        "home.html", {"request": request, "videos": videos})

@app.post("/uploadvideo/")
async def upload_video(video: UploadFile = File(...)):
    video_path = video.filename
    with open(video_path, "wb+") as fp:
        fp.write(video.file.read())

    new_video = process_video(video.filename)
    videos.append(new_video)
    return RedirectResponse(url='/', status_code=303)
```

In this example, the FastAPI app has two routes: `/` and `/uploadvideo/`.

The `/` route returns an HTML template that displays a gallery of all uploaded videos.

The `/uploadvideo/` route accepts a `POST` request with an `UploadFile` object, which represents the uploaded video file. The video file is "acapellified" via the `process_video()` method, and the output video is stored in a list which stores all of the uploaded videos in memory.

Note that this is a very basic example and if this were a production app, you will need to add more logic to handle file storage, user authentication, and security considerations.

## Step 3: Create a FastAPI app (Frontend Template)

Finally, we create the frontend of our web application. First, we create a folder called `templates` in the same directory as `main.py`. We then create a template, `home.html` inside the `templates` folder. Here is the resulting file structure:

```csv
├── main.py
├── templates
│   └── home.html
```

Write the following as the contents of `home.html`:

```html
&lt;!DOCTYPE html> &lt;html> &lt;head> &lt;title>Video Gallery&lt;/title>
&lt;style> body { font-family: sans-serif; margin: 0; padding: 0;
background-color: #f5f5f5; } h1 { text-align: center; margin-top: 30px;
margin-bottom: 20px; } .gallery { display: flex; flex-wrap: wrap;
justify-content: center; gap: 20px; padding: 20px; } .video { border: 2px solid
#ccc; box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.2); border-radius: 5px; overflow:
hidden; width: 300px; margin-bottom: 20px; } .video video { width: 100%; height:
200px; } .video p { text-align: center; margin: 10px 0; } form { margin-top:
20px; text-align: center; } input[type="file"] { display: none; } .upload-btn {
display: inline-block; background-color: #3498db; color: #fff; padding: 10px
20px; font-size: 16px; border: none; border-radius: 5px; cursor: pointer; }
.upload-btn:hover { background-color: #2980b9; } .file-name { margin-left: 10px;
} &lt;/style> &lt;/head> &lt;body> &lt;h1>Video Gallery&lt;/h1> {% if videos %}
&lt;div class="gallery"> {% for video in videos %} &lt;div class="video">
&lt;video controls> &lt;source src="{{ url_for('static', path=video) }}"
type="video/mp4"> Your browser does not support the video tag. &lt;/video>
&lt;p>{{ video }}&lt;/p> &lt;/div> {% endfor %} &lt;/div> {% else %} &lt;p>No
videos uploaded yet.&lt;/p> {% endif %} &lt;form action="/uploadvideo/"
method="post" enctype="multipart/form-data"> &lt;label for="video-upload"
class="upload-btn">Choose video file&lt;/label> &lt;input type="file"
name="video" id="video-upload"> &lt;span class="file-name">&lt;/span> &lt;button
type="submit" class="upload-btn">Upload&lt;/button> &lt;/form> &lt;script> //
Display selected file name in the form const fileUpload =
document.getElementById("video-upload"); const fileName =
document.querySelector(".file-name"); fileUpload.addEventListener("change", (e)
=> { fileName.textContent = e.target.files[0].name; }); &lt;/script> &lt;/body>
&lt;/html>
```

## Step 4: Run your FastAPI app

Finally, we are ready to run our FastAPI app, powered by the Gradio Python Client!

Open up a terminal and navigate to the directory containing `main.py`. Then run the following command in the terminal:

```bash
$ uvicorn main:app
```

You should see an output that looks like this:

```csv
Loaded as API: https://abidlabs-music-separation.hf.space ✔
INFO:     Started server process [1360]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

And that's it! Start uploading videos and you'll get some "acapellified" videos in response (might take seconds to minutes to process depending on the length of your videos). Here's how the UI looks after uploading two videos:

![](https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/gradio-guides/acapellify.png)

If you'd like to learn more about how to use the Gradio Python Client in your projects, [read the dedicated Guide](/guides/getting-started-with-the-python-client/).
