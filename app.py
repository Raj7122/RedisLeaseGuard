import gradio as gr

# from mcp.client.stdio import StdioServerParameters
from smolagents import ToolCollection, CodeAgent
from smolagents import CodeAgent, InferenceClientModel
from smolagents.mcp_client import MCPClient


try:
    mcp_client = MCPClient(
        {"url": "https://huggingface.co/spaces/Raj718/mcp-client"}
    )
    tools = mcp_client.get_tools()

    model = InferenceClientModel()
    agent = CodeAgent(tools=[*tools], model=model)

    demo = gr.ChatInterface(
        fn=lambda message, history: str(agent.run(message)),
        type="messages",
        examples=["Prime factorization of 68"],
        title="Agent with MCP Tools",
        description="This is a simple agent that uses MCP tools to answer questions.",
    )

    demo.launch()
except Exception as e:
    print(e)
finally:
    mcp_client.close() 