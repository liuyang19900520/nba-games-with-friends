import os
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from langchain_core.tools import tool
from langchain_tavily import TavilySearch
from tools.error_handler import handle_tool_error

_BLOCKED_HOSTS = frozenset({
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "169.254.169.254",
    "metadata.google.internal",
})


def _is_safe_url(url: str) -> bool:
    """Validate URL is safe to fetch (no SSRF to internal endpoints)."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    hostname = parsed.hostname or ""
    if hostname in _BLOCKED_HOSTS:
        return False
    # Block private IPv4 ranges
    if hostname.startswith(("10.", "192.168.")):
        return False
    if hostname.startswith("172."):
        parts = hostname.split(".")
        if len(parts) >= 2 and parts[1].isdigit():
            second = int(parts[1])
            if 16 <= second <= 31:
                return False
    return True


@tool
def search_internet(query: str, search_depth: str = "basic") -> str:
    """
    Generic internet search.
    Use this for: NBA news, betting odds, or general information not in the database.
    search_depth can be 'basic' (default) or 'advanced' for deep search.
    """
    tavily = TavilySearch(max_results=5, search_depth=search_depth)
    try:
        response = tavily.invoke(query)
        results = response.get("results", [])
        output = f"--- INTERNET SEARCH RESULTS: {query} ---\n"
        for i, res in enumerate(results, 1):
            output += f"{i}. [{res.get('url')}]: {res.get('content')}\n"
        return output
    except Exception as e:
        return f"Search failed: {str(e)}"


@tool
def search_nba_injuries(
    team: str, opponent: Optional[str] = None
) -> str:
    """
    Search for the latest NBA injury reports for a specific team.
    Use this for: Checking which players are Out, Doubtful, Questionable, or Probable
    before a game. Provide opponent name optionally for a more targeted search.
    """
    queries = [f"NBA injury report {team} today"]
    if opponent:
        queries.append(f"NBA injury report {opponent} today")

    tavily = TavilySearch(max_results=3, search_depth="advanced")
    output = "--- NBA INJURY REPORT ---\n"

    for query in queries:
        try:
            response = tavily.invoke(query)
            results = response.get("results", [])
            for i, res in enumerate(results, 1):
                url = res.get("url", "")
                content = res.get("content", "")
                output += f"\n[{query}] Result {i}:\n"
                output += f"  Source: {url}\n"
                output += f"  {content[:600]}\n"
        except Exception as e:
            output += f"\nSearch failed for '{query}': {str(e)}\n"

    if output.strip() == "--- NBA INJURY REPORT ---":
        output += "\nNo injury reports found.\n"

    return output


@tool
def fetch_web_page_content(url: str) -> str:
    """
    Extracts the main text from a specific URL.
    Use this when a search result looks promising but you need the full depth of the article or report.
    """
    if not _is_safe_url(url):
        return f"Blocked: URL '{url}' is not allowed (internal/private address)."
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")

        for script in soup(["script", "style"]):
            script.extract()

        text = soup.get_text(separator="\n")
        content = "\n".join(
            [line.strip() for line in text.splitlines() if line.strip()]
        )
        return f"--- CONTENT FROM {url} ---\n{content[:4000]}..."
    except Exception as e:
        return f"Failed to fetch content: {str(e)}"


# Note: query_technical_docs is an MCP bridge placeholder that performs no real
# operation. It is intentionally excluded from the exported tools list to avoid
# wasting LLM tokens. The code is kept for reference.

def _query_technical_docs_placeholder(query: str) -> str:
    """MCP bridge placeholder — not exported."""
    return f"Accessing technical bridge for: {query}..."


# Export tools — only real, functional tools
network_tools = [search_internet, search_nba_injuries, fetch_web_page_content]

for t in network_tools:
    t.handle_tool_error = handle_tool_error
