import os
import gradio as gr

# from mcp.client.stdio import StdioServerParameters
from smolagents import ToolCollection, CodeAgent
from smolagents import CodeAgent, InferenceClientModel
from smolagents.mcp_client import MCPClient


try:
    mcp_client = MCPClient(
        {"url": "https://abidlabs-mcp-tools.hf.space/gradio_api/mcp/sse"}
    )
    tools = mcp_client.get_tools()

    # Using a simpler model configuration
    model = InferenceClientModel(
        model_id="mistralai/Mistral-7B-Instruct-v0.2",
        api_url="https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2"
    )
    agent = CodeAgent(tools=[*tools], model=model)

    demo = gr.ChatInterface(
        fn=lambda message, history: str(agent.run(message)),
        type="messages",
        examples=["Prime factorization of 68"],
        title="Agent with MCP Tools",
        description="This is a simple agent that uses MCP tools to answer questions.",
    )

    demo.launch()
finally:
    if hasattr(mcp_client, "close"):
        mcp_client.close() 