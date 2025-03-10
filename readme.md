# Video Analysis using vision models like Llama3.2 Vision and OpenAI's Whisper Models

A video analysis tool that combines vision models like Llama's 11B vision model and Whisper to create a description by taking key frames, feeding them to the vision model to get details. It uses the details from each frame and the transcript, if available, to describe what's happening in the video. 

## Table of Contents
- [Features](#features)
- [Requirements](#requirements)
  - [System Requirements](#system-requirements)
  - [Installation](#installation)
  - [Ollama Setup](#ollama-setup)
  - [OpenAI-compatible API Setup](#openai-compatible-api-setup-optional)
- [Usage](#usage)
  - [Quick Start](#quick-start)
  - [Sample Output](#sample-output)
  - [Complete Usage Guide](docs/USAGES.md)
- [Design](#design)
  - [Detailed Design Documentation](docs/DESIGN.md)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Output](#output)
- [Uninstallation](#uninstallation)
- [License](#license)
- [Contributing](#contributing)

## Features
- 💻 Can run completely locally - no cloud services or API keys needed
- ☁️  Or, leverage any OpenAI API compatible LLM service (openrouter, openai, etc) for speed and scale
- 🎬 key frame extraction from videos
- 🔊  audio transcription using OpenAI's Whisper
- 👁️ Frame analysis using LLMs
- 📝 Natural language descriptions of video content
- 📊 JSON output of analysis results
- ⚙️ Configurable through command line arguments or config file

## Design
The system operates in three stages:

1. Frame Extraction & Audio Processing
   - Uses OpenCV to extract key frames
   - Processes audio using Whisper for transcription
   - Handles poor quality audio with confidence checks

2. Frame Analysis
   - Analyzes each frame using vision LLM
   - Each analysis includes context from previous frames
   - Maintains chronological progression
   - Uses frame_analysis.txt prompt template

3. Video Reconstruction
   - Combines frame analyses chronologically
   - Integrates audio transcript
   - Uses first frame to set the scene
   - Creates comprehensive video description

![Design](docs/design.png)

## Requirements

### System Requirements
- Python 3.11 or higher
- FFmpeg (required for audio processing)
- When running LLMs locally (not necessary when using openrouter)
  - At least 16GB RAM (32GB recommended)
  - GPU at least 12GB of VRAM or Apple M Series with at least 32GB

### Installation

1. Clone the repository:
```bash
git clone https://github.com/video-analyzer.git
cd video-analyzer
```

2. Docker Compose Build and Run:
```bash
> video-analyzer % ./docker-restart.sh
+ echo 'Stopping containers...'
Stopping containers...
+ docker compose down
[+] Running 2/2
 ✔ Container video-analyzer-server-1  Removed                                                 0.0s 
 ✔ Network video-analyzer_default     Removed                                                 0.3s 
+ echo 'Pruning unused Docker images...'
Pruning unused Docker images...
+ docker image prune -f
Deleted Images:
deleted: sha256:702d97d84fb185c2898cc94437f1478996ec4ed8c50bf5efe3daa2329561e8da

Total reclaimed space: 0B
+ docker volume prune -f
Total reclaimed space: 0B
+ echo 'Starting containers...'
Starting containers...
+ docker compose up --build
[+] Building 10.4s (19/19) FINISHED                                                                                                                                       docker:desktop-linux
 => [server internal] load build definition from Dockerfile                                   0.0s
 => => transferring dockerfile: 1. 
 .
 .
 .
=> [server] exporting to image                                                                0.1s 
 => => exporting layers                                                                       0.1s 
 => => writing image sha256:e11dd5be82ae454cd071f41ed14005d39ef6069dd7076cba2f05d9a03658ea0a  0.0s 
 => => naming to docker.io/library/video-analyzer-server                                      0.0s 
 => [server] resolving provenance for metadata file                                           0.0s 
[+] Running 3/3
 ✔ server                             Built                                                   0.0s 
 ✔ Network video-analyzer_default     Created                                                 0.1s 
 ✔ Container video-analyzer-server-1  Created                                                 0.1s 
Attaching to server-1
server-1  |  * Serving Flask app 'video_analyzer_ui.server'
server-1  |  * Debug mode: on
server-1  | 2025-03-10 03:18:01,171 - INFO - WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
server-1  |  * Running on all addresses (0.0.0.0)
server-1  |  * Running on http://127.0.0.1:5000
server-1  |  * Running on http://172.20.0.2:5000
server-1  | 2025-03-10 03:18:01,171 - INFO - Press CTRL+C to quit
server-1  | 2025-03-10 03:18:01,171 - INFO -  * Restarting with stat
server-1  | 2025-03-10 03:18:03,942 - WARNING -  * Debugger is active!
server-1  | 2025-03-10 03:18:03,943 - INFO -  * Debugger PIN: 411-000-445
server-1  | 2025-03-10 03:18:03,962 - INFO - 192.168.65.1 - - [10/Mar/2025 03:18:03] "GET / HTTP/1.1" 200 -
server-1  | 2025-03-10 03:18:03,998 - INFO - 192.168.65.1 - - [10/Mar/2025 03:18:03] "GET /static/css/styles.css HTTP/1.1" 304 -
server-1  | 2025-03-10 03:18:04,012 - INFO - 192.168.65.1 - - [10/Mar/2025 03:18:04] "GET /static/js/main.js HTTP/1.1" 200 -
server-1  | 2025-03-10 03:18:04,049 - INFO - config path : /app/config/default_config.json
server-1  | 2025-03-10 03:18:04,050 - INFO - 192.168.65.1 - - [10/Mar/2025 03:18:04] "GET /get_config HTTP/1.1" 200 -
server-1  | 2025-03-10 03:18:09,036 - INFO - 192.168.65.1 - - [10/Mar/2025 03:18:09] "POST /upload HTTP/1.1" 200 -
server-1  | 2025-03-10 03:18:11,218 - INFO - params : {'client': 'openai_api', 'api-key': 'sk-proj-7UoyHfI6ETRWU-...', 'api-url': 'https://api.openai.com/v1', 'model': 'gpt-4o', 'whisper-model': 'none', 'device': 'cpu'}
server-1  | 2025-03-10 03:18:11,219 - DEBUG - Set output directory to: /tmp/video-analyzer-ui/results/df6d5934-f34c-460a-880b-1c14fcb719b6
server-1  | 2025-03-10 03:18:11,219 - INFO - cmd : ['video-analyzer', '/tmp/video-analyzer-ui/uploads/df6d5934-f34c-460a-880b-1c14fcb719b6/cctv.mp4', '--client', 'openai_api', '--api-key', 'sk-proj-7UoyHfI6ETRWU-...', '--api-url', 'https://api.openai.com/v1', '--model', 'gpt-4o', '--whisper-model', 'none', '--device', 'cpu', '--output', '/tmp/video-analyzer-ui/results/df6d5934-f34c-460a-880b-1c14fcb719b6']
server-1  | 2025-03-10 03:18:11,219 - INFO - 192.168.65.1 - - [10/Mar/2025 03:18:11] "POST /analyze/df6d5934-f34c-460a-880b-1c14fcb719b6 HTTP/1.1" 200 -
server-1  | 2025-03-10 03:18:11,227 - DEBUG - Starting analysis with command: video-analyzer /tmp/video-analyzer-ui/uploads/df6d5934-f34c-460a-880b-1c14fcb719b6/cctv.mp4 --client openai_api --api-key sk-proj-7UoyHfI6ETRWU-... --api-url https://api.openai.com/v1 --model gpt-4o --whisper-model none --device cpu --output /tmp/video-analyzer-ui/results/df6d5934-f34c-460a-880b-1c14fcb719b6
server-1  | 2025-03-10 03:18:14,483 - DEBUG - Output: 2025-03-10 03:18:14,483 - INFO - args : {   'api_key': 'sk-proj-7UoyHfI6ETRWU-...',
server-1  | 2025-03-10 03:18:14,483 - INFO - 192.168.65.1 - - [10/Mar/2025 03:18:14] "GET /analyze/df6d5934-f34c-460a-880b-1c14fcb719b6/stream HTTP/1.1" 200 -
server-1  | 2025-03-10 03:18:14,484 - DEBUG - Output: 'api_url': 'https://api.openai.com/v1',
server-1  | 2025-03-10 03:18:14,484 - DEBUG - Output: 'client': 'openai_api',
server-1  | 2025-03-10 03:18:14,484 - DEBUG - Output: 'config': 'config',
server-1  | 2025-03-10 03:18:14,485 - DEBUG - Output: 'device': 'cpu',
server-1  | 2025-03-10 03:18:14,485 - DEBUG - Output: 'duration': None,
server-1  | 2025-03-10 03:18:14,485 - DEBUG - Output: 'keep_frames': False,
server-1  | 2025-03-10 03:18:14,485 - DEBUG - Output: 'language': None,
server-1  | 2025-03-10 03:18:14,485 - DEBUG - Output: 'log_level': 'INFO',
server-1  | 2025-03-10 03:18:14,486 - DEBUG - Output: 'max_frames': 9223372036854775807,
server-1  | 2025-03-10 03:18:14,486 - DEBUG - Output: 'model': 'gpt-4o',
server-1  | 2025-03-10 03:18:14,486 - DEBUG - Output: 'ollama_url': None,
server-1  | 2025-03-10 03:18:14,486 - DEBUG - Output: 'output': '/tmp/video-analyzer-ui/results/df6d5934-f34c-460a-880b-1c14fcb719b6',
server-1  | 2025-03-10 03:18:14,486 - DEBUG - Output: 'prompt': '',
server-1  | 2025-03-10 03:18:14,487 - DEBUG - Output: 'start_stage': 1,
server-1  | 2025-03-10 03:18:14,487 - DEBUG - Output: 'video_path': '/tmp/video-analyzer-ui/uploads/df6d5934-f34c-460a-880b-1c14fcb719b6/cctv.mp4',
server-1  | 2025-03-10 03:18:14,487 - DEBUG - Output: 'whisper_model': 'none'}
server-1  | 2025-03-10 03:18:14,487 - DEBUG - Output: 2025-03-10 03:18:14,483 - INFO - Initialize components for /tmp/video-analyzer-ui/uploads/df6d5934-f34c-460a-880b-1c14fcb719b6/cctv.mp4
server-1  | 2025-03-10 03:18:14,488 - DEBUG - Output: 2025-03-10 03:18:14,483 - INFO - No audio processing...
server-1  | 2025-03-10 03:18:14,488 - DEBUG - Output: 2025-03-10 03:18:14,483 - INFO - Extracting frames from video using model gpt-4o...
server-1  | 2025-03-10 03:18:14,647 - DEBUG - Output: 2025-03-10 03:18:14,647 - INFO - key_frame : 24
server-1  | 2025-03-10 03:18:14,661 - DEBUG - Output: 2025-03-10 03:18:14,661 - INFO - key_frame : 27
server-1  | 2025-03-10 03:18:14,677 - DEBUG - Output: 2025-03-10 03:18:14,676 - INFO - key_frame : 30
.
.
.
server-1  | 2025-03-10 03:18:14,873 - DEBUG - Output: 2025-03-10 03:18:14,873 - INFO - frame_path : output/frames/frame_0.jpg
server-1  | 2025-03-10 03:18:14,885 - DEBUG - Output: 2025-03-10 03:18:14,884 - INFO - frame_path : output/frames/frame_1.jpg
.
.
.
server-1  | 2025-03-10 03:18:15,005 - DEBUG - Output: 2025-03-10 03:18:15,004 - INFO - Analyzing frames...
server-1  | 2025-03-10 03:18:15,008 - DEBUG - Output: 2025-03-10 03:18:15,008 - INFO - prompt : `Frame Description Instructions
server-1  | 2025-03-10 03:18:15,009 - DEBUG - Output: Previous Notes Section
server-1  | 2025-03-10 03:18:15,009 - DEBUG - Output: [Previous ...`
server-1  | 2025-03-10 03:18:15,009 - DEBUG - Output: 2025-03-10 03:18:15,008 - INFO - model : gpt-4o
server-1  | 2025-03-10 03:18:16,153 - DEBUG - Output: 2025-03-10 03:18:16,152 - ERROR - HTTPError 429 : {   'error': {   'code': 'insufficient_quota',
server-1  | 2025-03-10 03:18:16,153 - DEBUG - Output: 'message': 'You exceeded your current quota, please check '
server-1  | 2025-03-10 03:18:16,153 - DEBUG - Output: 'your plan and billing details. For more '
server-1  | 2025-03-10 03:18:16,153 - DEBUG - Output: 'information on this error, read the docs: '
server-1  | 2025-03-10 03:18:16,153 - DEBUG - Output: 'https://platform.openai.com/docs/guides/error-codes/api-errors.',
server-1  | 2025-03-10 03:18:16,153 - DEBUG - Output: 'param': None,
server-1  | 2025-03-10 03:18:16,153 - DEBUG - Output: 'type': 'insufficient_quota'}}
.
.
.
server-1  | 2025-03-10 03:18:22,556 - DEBUG - Output: 2025-03-10 03:18:22,556 - INFO - Profiler results:
server-1  | 2025-03-10 03:18:22,556 - DEBUG - Output: 65886 function calls (64984 primitive calls) in 8.060 seconds
server-1  | 2025-03-10 03:18:22,557 - DEBUG - Output: Ordered by: cumulative time
server-1  | 2025-03-10 03:18:22,557 - DEBUG - Output: List reduced from 829 to 10 due to restriction <10>
server-1  | 2025-03-10 03:18:22,557 - DEBUG - Output: ncalls  tottime  percall  cumtime  percall filename:lineno(function)
server-1  | 2025-03-10 03:18:22,557 - DEBUG - Output: 12    0.004    0.000    7.525    0.627 /app/video_analyzer/clients/generic_openai_api.py:31(generate)
server-1  | 2025-03-10 03:18:22,557 - DEBUG - Output: 12    0.000    0.000    7.489    0.624 python3.11/site-packages/requests/api.py:103(post)
server-1  | 2025-03-10 03:18:22,557 - DEBUG - Output: 12    0.000    0.000    7.489    0.624 /python3.11/site-packages/requests/api.py:14(request)
server-1  | 2025-03-10 03:18:22,558 - DEBUG - Output: 12    0.000    0.000    7.487    0.624 /python3.11/site-packages/requests/sessions.py:500(request)
server-1  | 2025-03-10 03:18:22,558 - DEBUG - Output: 12    0.000    0.000    7.432    0.619 /python3.11/site-packages/requests/sessions.py:673(send)
server-1  | 2025-03-10 03:18:22,558 - DEBUG - Output: 12    0.000    0.000    7.425    0.619 /python3.11/site-packages/requests/adapters.py:613(send)
server-1  | 2025-03-10 03:18:22,558 - DEBUG - Output: 12    0.000    0.000    7.413    0.618 /python3.11/site-packages/urllib3/connectionpool.py:592(urlopen)
server-1  | 2025-03-10 03:18:22,558 - DEBUG - Output: 12    0.000    0.000    7.409    0.617 /python3.11/site-packages/urllib3/connectionpool.py:377(_make_request)
server-1  | 2025-03-10 03:18:22,558 - DEBUG - Output: 11    0.001    0.000    7.095    0.645 /app/video_analyzer/analyzer.py:54(analyze_frame)
server-1  | 2025-03-10 03:18:22,559 - DEBUG - Output: 12    0.001    0.000    6.170    0.514 /python3.11/site-packages/urllib3/connection.py:485(getresponse)
server-1  | 2025-03-10 03:18:22,961 - INFO - Analysis completed successfully

```

3. Use endpoints or built-in browser-based ui:
```bash
http://localhost:5000/
```


### Ollama Setup

Ollama is not supported at this time.

To add support we need to add it to the docker-compose as a service.


### OpenAI-compatible API 

To use OpenAI-compatible APIs (like OpenRouter or OpenAI):

1. Get an API key from your provider:
    - [OpenAI](https://platform.openai.com)
    - [OpenRouter](https://openrouter.ai)


2. Configure via command line:
   ```bash
   # For OpenRouter
   video-analyzer video.mp4 --client openai_api --api-key your-key --api-url https://openrouter.ai/api/v1 --model gpt-4o

   # For OpenAI
   video-analyzer video.mp4 --client openai_api --api-key your-key --api-url https://api.openai.com/v1 --model gpt-4o
   ```

   Or add to config/config.json:
   ```json
   {
     "clients": {
       "default": "openai_api",
       "openai_api": {
         "api_key": "your-api-key",
         "api_url": "https://api.openai.com/v1" # or "https://openrouter.ai/api/v1"   
       }
     }
   }
   ```

Note: With OpenRouter, you can use llama 3.2 11b vision for free by adding :free to the model name

## Project Structure

```
<pre>
.
├── Dockerfile
├── LICENSE
├── MANIFEST.in
├── data
├── default_config.example.json
├── default_config.json
├── docker-compose.yaml
├── docker-restart.sh
├── docs
│   ├── CONTRIBUTING.md
│   ├── DESIGN.md
│   ├── USAGES.md
│   ├── design.excalidraw
│   ├── design.png
│   └── sample_analysis.json
├── readme.md
├── requirements.txt
├── setup.py
├── test_prompt_loading.py
├── video-analyzer-ui
│   ├── MANIFEST.in
│   ├── README.md
│   ├── pyproject.toml
│   ├── requirements.txt
│   └── video_analyzer_ui
│       ├── __init__.py
│       ├── server.py
│       ├── static
│       │   ├── css
│       │   │   └── styles.css
│       │   └── js
│       │       └── main.js
│       └── templates
│           └── index.html
└── video_analyzer
    ├── __init__.py
    ├── analyzer.py
    ├── audio_processor.py
    ├── cli.py
    ├── clients
    │   ├── __init__.py
    │   ├── generic_openai_api.py
    │   ├── llm_client.py
    │   └── ollama.py
    ├── config
    ├── config.py
    ├── frame.py
    ├── prompt.py
    └── prompts
        └── frame_analysis
            ├── describe.txt
            └── frame_analysis.txt
</pre>
```

For detailed information about the project's design and implementation, including how to make changes, see [docs/DESIGN.md](docs/DESIGN.md).

## Usage

For detailed usage instructions and all available options, see [docs/USAGES.md](docs/USAGES.md).

### Quick Start

```bash
# Local analysis with Ollama (default)
video-analyzer video.mp4

# Cloud analysis with OpenRouter
video-analyzer video.mp4 \
    --client openai_api \
    --api-key your-key \
    --api-url https://openrouter.ai/api/v1 \
    --model meta-llama/llama-3.2-11b-vision-instruct:free

# Analysis with custom prompt (with defaults from default_config.json)
video-analyzer video.mp4 \
    --prompt "What activities are happening in this video?" \
    --whisper-model large
```

### Sample Output

**Video Summary**
Duration: 5 minutes and 67 seconds

The video begins with a person with long blonde hair, wearing a pink t-shirt and yellow shorts, standing in front of a black plastic tub or container on wheels. The ground appears to be covered in wood chips.

As the video progresses, the person remains facing away from the camera, looking down at something inside the tub. Their left hand is resting on their hip, while their right arm hangs loosely by their side. There are no new objects or people visible in this frame, but there appears to be some greenery and possibly fruit scattered around the ground behind the person.

The black plastic tub on wheels is present throughout the video, and the wood chips covering the ground remain consistent with those seen in Frame 0. The person's pink t-shirt matches the color of the shirt worn by the person in Frame 0.

As the video continues, the person remains stationary, looking down at something inside the tub. There are no significant changes or developments in this frame.

The key continuation point is to watch for the person to pick up an object from the tub and examine it more closely.

**Key Continuation Points:**

*   The person's pink t-shirt matches the color of the shirt worn by the person in Frame 0.
*   The black plastic tub on wheels is also present in Frame 0.
*   The wood chips covering the ground are consistent with those seen in Frame 0.


## Configuration

The tool uses a cascading configuration system with command line arguments taking highest priority, followed by user config (config/config.json), and finally the default config. See [docs/USAGES.md](docs/USAGES.md) for detailed configuration options.

## Output

The tool generates a JSON file (`analysis.json`) containing:
- Metadata about the analysis
- Audio transcript (if available)
- Frame-by-frame analysis
- Final video description

### Example Output Structure


## Uninstallation

To uninstall the package:
```bash
pip uninstall video-analyzer
```

## License

Apache License

