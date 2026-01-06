"""
Structured logging utility for NBA data synchronization.
Supports both JSON output (for programmatic extraction) and human-readable output.
"""
import json
import sys
from datetime import datetime
from typing import Optional, Dict, Any, List


class SyncLogger:
    """
    Structured logger for sync operations.
    
    Supports two output modes:
    - JSON mode: Machine-readable JSON format for log extraction
    - Standard mode: Human-readable format for console output
    """
    
    def __init__(self, json_mode: bool = False):
        """
        Initialize logger.
        
        Args:
            json_mode: If True, output logs in JSON format. Otherwise, use human-readable format.
        """
        self.json_mode = json_mode
        self.logs: List[Dict[str, Any]] = []
        self.command: Optional[str] = None
        self.start_time: Optional[datetime] = None
    
    def set_command(self, command: str) -> None:
        """Set the current command name."""
        self.command = command
        self.start_time = datetime.utcnow()
        self._log("SYNC", f"Starting {command}", command=command)
    
    def _log(self, level: str, message: str, **kwargs) -> None:
        """
        Internal method to log a message.
        
        Args:
            level: Log level (INFO, SUCCESS, ERROR, WARNING, SYNC)
            message: Log message
            **kwargs: Additional fields to include in log entry
        """
        timestamp = datetime.utcnow().isoformat() + "Z"
        local_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        log_entry = {
            "timestamp": timestamp,
            "level": level,
            "message": message,
            **kwargs
        }
        
        # Add command if set
        if self.command:
            log_entry["command"] = self.command
        
        # Store log entry
        self.logs.append(log_entry)
        
        if self.json_mode:
            # JSON output mode
            print(json.dumps(log_entry, ensure_ascii=False))
        else:
            # Human-readable output mode
            print(f"[{local_time}] [{level}] {message}")
            # Print additional fields if present (non-JSON mode)
            if kwargs:
                for key, value in kwargs.items():
                    if key not in ["command", "timestamp"]:
                        print(f"  {key}: {value}")
    
    def info(self, message: str, **kwargs) -> None:
        """Log an info message."""
        self._log("INFO", message, **kwargs)
    
    def success(self, message: str, **kwargs) -> None:
        """Log a success message."""
        self._log("SUCCESS", message, **kwargs)
    
    def error(self, message: str, **kwargs) -> None:
        """Log an error message."""
        self._log("ERROR", message, **kwargs)
    
    def warning(self, message: str, **kwargs) -> None:
        """Log a warning message."""
        self._log("WARNING", message, **kwargs)
    
    def debug(self, message: str, **kwargs) -> None:
        """Log a debug message."""
        self._log("DEBUG", message, **kwargs)
    
    def complete(self, status: str = "success", **kwargs) -> None:
        """
        Log command completion.
        
        Args:
            status: Completion status (success, failed, etc.)
            **kwargs: Additional fields (records_synced, duration_seconds, etc.)
        """
        duration = None
        if self.start_time:
            duration = (datetime.utcnow() - self.start_time).total_seconds()
            kwargs["duration_seconds"] = round(duration, 2)
        
        if status == "success":
            self.success(f"Completed {self.command}", **kwargs)
        else:
            self.error(f"Failed {self.command}", status=status, **kwargs)
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get summary of all logs for the current command.
        
        Returns:
            Dictionary with summary information
        """
        if not self.command:
            return {}
        
        duration = None
        if self.start_time:
            duration = (datetime.utcnow() - self.start_time).total_seconds()
        
        # Extract key information from logs
        errors = [log for log in self.logs if log.get("level") == "ERROR"]
        warnings = [log for log in self.logs if log.get("level") == "WARNING"]
        success_logs = [log for log in self.logs if log.get("level") == "SUCCESS"]
        
        # Try to extract records_synced from success logs
        records_synced = None
        for log in success_logs:
            if "records_synced" in log:
                records_synced = log["records_synced"]
                break
        
        return {
            "command": self.command,
            "status": "success" if not errors else "failed",
            "duration_seconds": round(duration, 2) if duration else None,
            "records_synced": records_synced,
            "error_count": len(errors),
            "warning_count": len(warnings),
            "errors": [log.get("message") for log in errors]
        }
