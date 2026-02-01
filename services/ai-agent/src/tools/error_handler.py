from langchain_core.tools import ToolException
from utils.logger import logger


def handle_tool_error(error: ToolException) -> str:
    """
    Standardized Error Handler for NBA Tools.
    Captures exceptions raised during tool execution and returns a user-friendly
    error message to the Agent, allowing it to self-correct.
    """
    # Log the full error stack trace for debugging
    logger.error(f"Tool execution failed: {error}", exc_info=True)
    
    return f"TOOL_ERROR: Execution failed with error: {str(error)}. Please verify input parameters (Team ID, Date format, etc.) and try again."
