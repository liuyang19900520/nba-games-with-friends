"""
Configuration module for loading environment variables.
Supports multiple environments: development, production
"""
import os
from dotenv import load_dotenv

# Determine environment (default to development)
ENV = os.getenv("ENVIRONMENT", "development").lower()

# Load environment-specific .env file
if ENV == "production":
    env_file = ".env.production"
elif ENV == "development" or ENV == "dev":
    env_file = ".env.development"
else:
    env_file = ".env"

# Try to load environment-specific file, fallback to .env (optional)
#
# In local/dev environments, we typically have .env.development / .env.production
# files. On AWS Lambda, we usually rely on environment variables configured
# in the Lambda console instead of shipping .env files with the code.
#
# Therefore: if no .env* file exists, we DO NOT raise, and simply rely on
# os.environ (Lambda env vars). This fixes the FileNotFoundError you saw.
if os.path.exists(env_file):
    load_dotenv(env_file)
elif os.path.exists(".env"):
    load_dotenv(".env")
else:
    # No env file present – this is fine on Lambda where env vars are set
    # via the console. We just log a warning to help local debugging.
    print(
        f"[config] Warning: No environment file found for ENV={ENV}. "
        "Relying on existing environment variables only."
    )


class Config:
    """Configuration class to manage environment variables."""
    
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    # Support multiple key variable names (prefer service role key for data sync)
    SUPABASE_KEY = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY") or 
        os.getenv("SUPABASE_KEY") or 
        os.getenv("SUPABASE_ANON_KEY")
    )
    
    @classmethod
    def validate(cls):
        """Validate that required environment variables are set."""
        if not cls.SUPABASE_URL:
            raise ValueError("SUPABASE_URL environment variable is not set")
        if not cls.SUPABASE_KEY:
            raise ValueError(
                "SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY, or SUPABASE_ANON_KEY "
                "environment variable must be set"
            )
        return True

