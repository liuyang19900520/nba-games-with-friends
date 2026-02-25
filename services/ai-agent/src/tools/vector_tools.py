import os
from typing import Optional

import requests
from langchain_core.tools import tool
from supabase import create_client, Client
from dotenv import load_dotenv
from tools.error_handler import handle_tool_error
from utils.logger import logger

load_dotenv()

_HUGGINGFACE_MODEL_URL = (
    "https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5"
)


def _get_supabase_client() -> Client:
    """Lazy-init Supabase client to avoid module-level side effects."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"
        )
    return create_client(url, key)


def _get_embedding(text: str) -> list[float]:
    """Generate a 384-dim embedding via HuggingFace Inference API (BAAI/bge-small-en-v1.5)."""
    api_key = os.getenv("HUGGINGFACE_API_KEY")
    if not api_key:
        raise EnvironmentError("HUGGINGFACE_API_KEY is not set")
    response = requests.post(
        _HUGGINGFACE_MODEL_URL,
        headers={"Authorization": f"Bearer {api_key}"},
        json={"inputs": text, "options": {"wait_for_model": True}},
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    # HF API returns a flat list of floats for single input
    if isinstance(data, list) and len(data) > 0:
        if isinstance(data[0], float):
            return data
        # Nested list: [[0.1, 0.2, ...]]
        if isinstance(data[0], list):
            return data[0]
    raise ValueError(f"Unexpected embedding response format: {type(data)}")


@tool
def query_vector_memory(query: str, filter_team: Optional[str] = None) -> str:
    """
    Performs semantic search across the NBA news vector database.
    Use this for: Retrieving recent NBA news, expert analysis, injury reports,
    and trade rumors that have been indexed from ESPN and other sources.
    Optionally filter by team name (e.g., 'Lakers', 'Celtics').
    """
    try:
        embedding = _get_embedding(query)
        supabase = _get_supabase_client()

        rpc_params: dict = {
            "query_embedding": embedding,
            "match_threshold": 0.4,
            "match_count": 5,
            # Always pass filter_tags to avoid PostgREST overload ambiguity
            # between the 3-param and 4-param versions of match_documents.
            # Empty array = no filtering.
            "filter_tags": [filter_team] if filter_team else [],
        }

        response = supabase.rpc("match_documents", rpc_params).execute()

        if not response.data:
            return f"No relevant documents found for: '{query}'"

        output = f"--- VECTOR SEARCH RESULTS: '{query}' ---\n"
        for i, doc in enumerate(response.data, 1):
            meta = doc.get("metadata", {})
            title = meta.get("title", "Untitled")
            source = meta.get("source", "Unknown")
            published = meta.get("published_at", "N/A")
            tags = meta.get("tags", [])
            similarity = doc.get("similarity", 0)
            content = doc.get("content", "")
            # Truncate content to 500 chars for readability
            snippet = content[:500] + "..." if len(content) > 500 else content

            output += (
                f"\n{i}. [{title}] (similarity: {similarity:.3f})\n"
                f"   Source: {source} | Date: {published} | Tags: {', '.join(tags)}\n"
                f"   {snippet}\n"
            )
        return output
    except Exception as e:
        logger.error(f"Vector search failed: {e}", exc_info=True)
        return f"Vector search failed: {str(e)}"


_ALLOWED_METADATA_KEYS = {"title", "source", "tags"}
_MAX_CONTENT_LENGTH = 10000


@tool
def save_to_vector_memory(content: str, metadata: dict) -> str:
    """
    Saves important analysis or insights to the vector database for future retrieval.
    metadata should include keys like 'title', 'source', 'tags' (list of team names).
    """
    if len(content) > _MAX_CONTENT_LENGTH:
        return f"Content too long ({len(content)} chars). Max is {_MAX_CONTENT_LENGTH}."
    filtered_metadata = {
        k: v for k, v in metadata.items() if k in _ALLOWED_METADATA_KEYS
    }
    try:
        embedding = _get_embedding(content)
        supabase = _get_supabase_client()

        supabase.table("documents").insert({
            "content": content,
            "metadata": filtered_metadata,
            "embedding": embedding,
        }).execute()

        return "Insights saved to vector memory successfully."
    except Exception as e:
        logger.error(f"Vector save failed: {e}", exc_info=True)
        return f"Failed to save to vector memory: {str(e)}"


# Export tools
vector_tools = [query_vector_memory, save_to_vector_memory]

for t in vector_tools:
    t.handle_tool_error = handle_tool_error
