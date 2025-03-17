from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
import base64

TOKEN_PRICING = {  # (per 1K tokens)
    "llama3.2-vision"       : {"prompt": 0.005      , "completion": 0.015  },  
    # OpenAI
    "gpt-4-turbo"           : {"prompt": 0.010      , "completion": 0.03   },
    "gpt-4o"                : {"prompt": 0.0025     , "completion": 0.01   }, 
    # Google 
    "gemini-2.0-flash"      : {"prompt": 0.0001     , "completion": 0.0004 },  
    "gemini-2.0-flash-lite" : {"prompt": 0.000075   , "completion": 0.03   },  
    "gemini-1.5-flash"      : {"prompt": 0.000075   , "completion": 0.03   }, 
    "gemini-1.5-flash-8b"   : {"prompt": 0.0000375  , "completion": 0.015  }, 
    # Mistral
    "pixtral-large-latest"  : {"prompt": 0.002      , "completion": 0.006  }, 
    "pixtral-12b-2409"      : {"prompt": 0.00015    , "completion": 0.00015},
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
