from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import base64

TOKEN_PRICING = {
    "llama3.2-vision": {"prompt": 0.005, "completion": 0.015},  # Example values (per 1K tokens)
    "gpt-4-turbo": {"prompt": 0.01, "completion": 0.03},
    "gpt-4o": {"prompt": 0.0025, "completion": 0.01},  # GPT-4o pricing (per 1K tokens)
    "pixtral-12b-2409": {"prompt": 0.00015, "completion": 0.00015}, # mistral 1K tokens
}

class LLMClient(ABC):


    def encode_image(self, image_path: str) -> str:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    @abstractmethod
    def generate(self,
        prompt: str,
        image_path: Optional[str] = None,
        stream: bool = False,
        model: str = "llama3.2-vision",
        temperature: float = 0.2,
        num_predict: int = 256) -> Dict[Any, Any]:
        pass
