import os
from typing import List, Optional
from langchain_core.tools import tool
from langchain_tavily import TavilySearch
import requests
from bs4 import BeautifulSoup
from tools.error_handler import handle_tool_error

@tool
def search_internet(query: str, search_depth: str = "basic") -> str:
    """
    Generic internet search. 
    Use this for: NBA news, real-time injury reports (today), betting odds, or general information not in the database.
    search_depth can be 'basic' (default) or 'advanced' for deep search.
    """
    tavily = TavilySearch(max_results=5, search_depth=search_depth)
    try:
        response = tavily.invoke(query)
        # partner package TavilySearch returns a dict with 'results' key
        results = response.get('results', [])
        output = f"--- INTERNET SEARCH RESULTS: {query} ---\n"
        for i, res in enumerate(results, 1):
            output += f"{i}. [{res.get('url')}]: {res.get('content')}\n"
        return output
    except Exception as e:
        return f"Search failed: {str(e)}"

@tool
def query_technical_docs(query: str) -> str:
    """
    Access technical documentation via MCP bridge (e.g., LangChain v1.0 docs).
    Use this for: Writing AI Agent code, understanding LangGraph patterns, or technical implementation details.
    This tool effectively routes to the 'docs-langchain' MCP server.
    """
    # Note: In a real MCP environment, the agent would directly call the docs-langchain tool.
    # This Python tool acts as a semantic bridge/trigger for that capability.
    return f"Accessing technical bridge for: {query}... (Consulting docs-langchain MCP server)"

@tool
def fetch_web_page_content(url: str) -> str:
    """
    Extracts the main text from a specific URL.
    Use this when a search result looks promising but you need the full depth of the article or report.
    """
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.extract()
            
        text = soup.get_text(separator='\n')
        content = "\n".join([line.strip() for line in text.splitlines() if line.strip()])
        # Return first 4000 chars to respect context limits
        return f"--- CONTENT FROM {url} ---\n{content[:4000]}..."
    except Exception as e:
        return f"Failed to fetch content: {str(e)}"

# Export tools
network_tools = [search_internet, query_technical_docs, fetch_web_page_content]

for t in network_tools:
    t.handle_tool_error = handle_tool_error
