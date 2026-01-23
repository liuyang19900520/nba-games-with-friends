"""
Database module for Supabase client initialization.
Implements singleton pattern to ensure only one instance exists.
"""
from supabase import create_client, Client
from config import Config


class SupabaseDB:
    """Singleton class for Supabase client."""
    
    _instance = None
    _client = None
    
    def __new__(cls):
        """Ensure only one instance of SupabaseDB exists."""
        if cls._instance is None:
            cls._instance = super(SupabaseDB, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize the Supabase client if not already initialized."""
        if self._client is None:
            Config.validate()
            self._client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    
    @property
    def client(self) -> Client:
        """Get the Supabase client instance."""
        if self._client is None:
            Config.validate()
            self._client = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        return self._client
    
    @classmethod
    def get_client(cls) -> Client:
        """Get the Supabase client instance (class method)."""
        instance = cls()
        return instance.client


# Convenience function to get the Supabase client
def get_db() -> Client:
    """Get the Supabase client instance."""
    return SupabaseDB.get_client()

