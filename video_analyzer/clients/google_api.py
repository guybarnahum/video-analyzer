import requests
from requests.exceptions import RequestException
import json
import time
import re
from typing import Optional, Dict, Any, Tuple
from .llm_client import LLMClient, TOKEN_PRICING
import logging
from pprint import pformat

logger = logging.getLogger(__name__)

# Constants
DEFAULT_MAX_RETRIES = 3
RATE_LIMIT_WAIT_TIME = 25  # seconds
DEFAULT_WAIT_TIME = 25  # seconds

'''
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=GEMINI_API_KEY" \
-H 'Content-Type: application/json' \
-X POST \
-d '{
  "contents": [{
    "parts":[{"text": "Explain how AI works"}]
    }]
   }'
'''
class GoogleAPIClient(LLMClient):
    def __init__(self, config, max_retries: int = DEFAULT_MAX_RETRIES):
        self.api_key = config['api_key']
        api_url = config['api_url']
        self.base_url = api_url.rstrip('/')  # Remove trailing slash if present
        self.generate_url = f"{self.base_url}/models/%model%/:generateContent"
        self.max_retries = max_retries
        self.usage = {}

    def generate(self,
        prompt: str,
        image_path: Optional[str] = None,
        stream: bool = False,
        model: str = "gemini-2.0-flash",
        temperature: float = 0.2,
        num_predict: int = 256) -> Dict[Any, Any]:
        """Generate response from OpenAI-compatible API."""

        generate_url = self.generate_url.replace('%model%', model)
 
        # Prepare the request payload
        if image_path:
            base64_image = self.encode_image(image_path)
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt},
                            {
                                "inline_data": {
                                    "mime_type": "image/jpeg",
                                    "data": base64_image
                                }
                            }
                        ]
                    }
                ]
            }
        else:
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": prompt}
                        ]
                    }
                ]
            }

        # Add any additional parameters
        params = {
            "key": self.api_key
        }
    
        # Initialize retry parameters
        retries = 0
        backoff_time = 2
        
        while retries <= self.max_retries:
            try:
                # Make the API request
                response = requests.post(generate_url, params=params, json=payload)
    
                # Check if successful
                if response.status_code == 200:
                    json_response = response.json()
                    try:
                        '''
                        "candidates": [
                            {
                            "content": {
                                "parts": [
                                {
                                    "text": "```\nFrame 24\nAction/Movement: ... Observe the construction site\n```"
                                }
                                ],
                                "role": "model"
                            },
                            "finishReason": "STOP",
                            "avgLogprobs": -0.6573867797851562
                            }
                        ],
                        '''
                        message = json_response["candidates"][0]["content"]["parts"][0]["text"]

                    except Exception as e:
                        logger.error(f'json_response parse Error : {str(e)}')

                    if not message :
                        raise Exception(f"No content in response message {json_response}")
                        
                    logger.info(f'>> {message}')

                    # Extract token usage information
                    '''
                    "usageMetadata": {
                        "promptTokenCount": 2153,
                        "candidatesTokenCount": 143,
                        "totalTokenCount": 2296,
                        "promptTokensDetails": [
                            {
                                "modality": "TEXT",
                                "tokenCount": 347
                            },
                            {
                                "modality": "IMAGE",
                                "tokenCount": 1806
                            }
                        ],
                        "candidatesTokensDetails": [
                            {
                                "modality": "TEXT",
                                "tokenCount": 143
                            }
                        ]
                    }
                    '''
                    # Calculate tokens
                    prompt_tokens     = json_response["usageMetadata"]["promptTokenCount"    ] 
                    completion_tokens = json_response["usageMetadata"]["candidatesTokenCount"] 
                    total_tokens      = json_response["usageMetadata"]["totalTokenCount"     ] 

                    # Calculate cost
                    model_pricing = TOKEN_PRICING.get(model, {"prompt": 0.0, "completion": 0.0})

                    cost = ((prompt_tokens * model_pricing["prompt"]) + (completion_tokens * model_pricing["completion"])) / 1000

                    logger.info(f"Token Usage - Prompt: {prompt_tokens}, Completion: {completion_tokens}, Total: {total_tokens}")
                    logger.info(f"Estimated Cost: ${cost:.6f}")

                    return {
                        "response": message,
                        "token_usage": {
                            "prompt_tokens": prompt_tokens,
                            "completion_tokens": completion_tokens,
                            "total_tokens": total_tokens,
                            "model_pricing": model_pricing,
                            "cost": cost
                        }
                    }
  
                # Handle rate limiting
                if response.status_code == 429 or response.status_code == 503:
                    # Get retry-after header if available
                    retry_after = None
                    if 'retry-after' in response.headers:
                        retry_after = int(response.headers['retry-after'])
                        logger.info(f"Using Retry-After header value: {retry_after} seconds")

                    # Use retry-after value or exponential backoff
                    wait_time = retry_after if retry_after else backoff_time
                    
                    if retries < self.max_retries:
                        logger.info(f"Rate limit hit. Retrying in {wait_time} seconds. (Attempt {retries+1}/{self.max_retries})")
                        time.sleep(wait_time)
                        retries += 1
                        backoff_time *= 2  # Exponential backoff
                    else:
                        logger.error(f"Max retries ({self.max_retries}) exceeded")
                        raise Exception(f"Max retries exceeded. Last status: {response.status_code}")
                else:
                    # If it's another error, raise immediately
                    raise Exception(f"API request failed with status code {response.status_code}: {response.text}")
                
            except RequestException as e:
                # Handle network errors
                if retries < self.max_retries:
                    logger.info(f"Network error: {str(e)}. Retrying in {backoff_time} seconds.")
                    time.sleep(backoff_time)
                    retries += 1
                    backoff_time *= 2
                else:
                    logger.error(f"Max retries ({self.max_retries}) exceeded")
                    raise
