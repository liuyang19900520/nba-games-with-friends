"""
Utility functions for NBA data synchronization.
"""
from datetime import datetime


def get_current_nba_season():
    """
    Get the current NBA season based on the current date.
    
    NBA seasons typically start in October:
    - If current month >= 10, season is current_year - (current_year+1)
    - If current month < 10, season is (current_year-1) - current_year
    
    Returns:
        str: Season in format 'YYYY-YY' (e.g., '2024-25')
    """
    now = datetime.now()
    current_year = now.year
    current_month = now.month
    
    if current_month >= 10:
        # Season started this year, ends next year
        season = f"{current_year}-{str(current_year + 1)[-2:]}"
    else:
        # Season started last year, ends this year
        season = f"{current_year - 1}-{str(current_year)[-2:]}"
    
    return season

