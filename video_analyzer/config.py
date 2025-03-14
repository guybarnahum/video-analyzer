import argparse
from pathlib import Path
import json
from typing import Any
import logging
import pkg_resources

logger = logging.getLogger(__name__)

class Config:
    def __init__(self, config_dir: str = "config"):
        # Handle user-provided config directory
        self.config_dir = Path(config_dir)
        self.user_config = self.config_dir / "config.json"
        
        # First try to find default_config.json in the user-provided directory
        self.default_config = self.config_dir / "default_config.json"
        
        # If not found, fallback to package's default config
        if not self.default_config.exists():
            try:
                default_config_path = pkg_resources.resource_filename('video_analyzer', 'config/default_config.json')
                self.default_config = Path(default_config_path)
                logger.debug(f"Using packaged default config from {self.default_config}")
            except Exception as e:
                logger.error(f"Error finding default config: {e}")
                raise
            
        self.load_config()

    def load_config(self):
        """Load configuration from JSON file with cascade:
        1. Try user config (config.json)
        2. Fall back to default config (default_config.json)
        """
        try:
            if self.user_config.exists():
                logger.debug(f"Loading user config from {self.user_config}")
                with open(self.user_config) as f:
                    self.config = json.load(f)
            else:
                logger.debug(f"No user config found, loading default config from {self.default_config}")
                with open(self.default_config) as f:
                    self.config = json.load(f)
                    
            # Ensure prompts is a list
            if not isinstance(self.config.get("prompts", []), list):
                logger.warning("Prompts in config is not a list, setting to empty list")
                self.config["prompts"] = []
                
        except Exception as e:
            logger.error(f"Error loading config: {e}")
            raise

    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value with optional default."""
        val = self.config.get(key, default)
        # logger.debug(f'config get - key : {key}, default : {default} => val : {val}')
        return val

    def update_from_args(self, args: argparse.Namespace):
        """Update configuration with command-line arguments."""
        client = None

        for key, value in vars(args).items():
            if value is not None:  # Only update if argument was provided
                if key == "output":
                    self.config["output_dir"] = value  # Ensure the config reflects this update
                elif key == "client":
                    client = value
                    self.config["clients"]["default"] = value
                elif key == "api_key":
                    self.config["clients"][client]["api_key"] = value
                elif key == "api_url":
                    self.config["clients"][client]["api_url"] = value
                elif key == "model":
                    self.config["clients"][client]["model"] = value
                elif key == "prompt":
                    self.config["prompt"] = value
                elif key == "whisper_model":
                    self.config["audio"]["whisper_model"] = value
                elif key == "language":
                    if value is not None:
                        self.config["audio"]["language"] = value
                elif key == "device":
                    self.config["audio"]["device"] = value
                elif key not in ["start_stage", "max_frames"]:  # Ignore these as they're command-line only
                    self.config[key] = value

    def save_user_config(self):
        """Save current configuration to user config file."""
        try:
            self.config_dir.mkdir(parents=True, exist_ok=True)
            with open(self.user_config, 'w') as f:
                json.dump(self.config, f, indent=2)
            logger.debug(f"Saved user config to {self.user_config}")
        except Exception as e:
            logger.error(f"Error saving user config: {e}")
            raise

def get_client(config: Config, client_type: str) -> dict:
    """Get the appropriate client configuration based on configuration."""
    
    if client_type not in ['ollama','openai_api','google_api']:
        raise ValueError(f"Invalid client type : {client_type}")

    try:
        client_config = config.get("clients", {}).get(client_type, {})
        api_key = client_config.get("api_key")
        api_url = client_config.get("api_url")
        model   = client_config.get("model")

    except Exception as e:
        logger.error(f'get_client - Error : {str(e)}')

    if not api_key and client_type not in [ 'ollama' ]:
        raise ValueError(f"api_key is required for {client_type} client")

    if not api_url:
        raise ValueError(f"api_url is required for {client_type} client")
    
    return {
        "api_key": api_key,
        "api_url": api_url,
        "model"  : model
    }
