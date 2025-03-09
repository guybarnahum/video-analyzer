FROM python:3.11-slim

# Create a directory for pip cache
ENV PIP_CACHE_DIR=/pip_cache
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y ffmpeg git && rm -rf /var/lib/apt/lists/*

# Copy only requirements files first to leverage caching
COPY requirements.txt /app/
COPY video-analyzer-ui/pyproject.toml /app/video-analyzer-ui/ 

# Install dependencies separately before copying code
RUN pip install --cache-dir=$PIP_CACHE_DIR -r requirements.txt

# Now copy the actual application code
COPY setup.py readme.md /app/
COPY video_analyzer /app/video_analyzer
COPY video-analyzer-ui /app/video-analyzer-ui

# Install the main package in development mode
RUN pip install --cache-dir=$PIP_CACHE_DIR -e /app
RUN pip install --cache-dir=$PIP_CACHE_DIR -e /app/video-analyzer-ui

# Override config from our local dir
COPY default_config.json /app/config/default_config.json

EXPOSE 5000

CMD ["video-analyzer-ui", "--dev", "--host", "0.0.0.0", "--port", "5000"]