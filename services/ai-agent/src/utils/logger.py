import logging
import os
import sys

def setup_logger(name: str = "nba_agent") -> logging.Logger:
    """
    Configure and return a standardized logger.
    - Writes to Console (StreamHandler).
    - Writes to File (FileHandler) in /logs directory.
    - Writes to AWS CloudWatch Logs (Watchtower) if configured.
    - Format: Timestamp | Level | Component | Message
    """
    # 1. Ensure logs directory exists
    log_dir = os.path.join(os.getcwd(), "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "app.log")

    # 2. Create Logger
    logger = logging.getLogger(name)
    
    # Avoid duplicate handlers if setup specific logger multiple times
    if logger.hasHandlers():
        return logger
        
    logger.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())

    # 3. Define Format
    formatter = logging.Formatter(
        '%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 4. Console Handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # 5. File Handler
    file_handler = logging.FileHandler(log_file, encoding='utf-8')
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)

    # 6. CloudWatch Handler (Watchtower)
    try:
        import watchtower
        import boto3
        
        # We need boto3 to interact with AWS, and watchtower to stream logs
        # This streams to /aws/ec2/ai-agent created by Terraform
        cloudwatch_handler = watchtower.CloudWatchLogHandler(
            log_group_name='/aws/ec2/ai-agent',
            stream_name='python-app-logs',
            create_log_group=False, # We let Terraform manage the group
            boto3_client=boto3.client('logs', region_name=os.getenv('AWS_REGION', 'ap-northeast-1'))
        )
        cloudwatch_handler.setFormatter(formatter)
        logger.addHandler(cloudwatch_handler)
    except ImportError:
        logger.warning("Watchtower or boto3 not installed; CloudWatch logging is disabled.")
    except Exception as e:
        logger.warning(f"Could not attach CloudWatchLogHandler: {e}")

    return logger

# Singleton instance for easy import
logger = setup_logger()
