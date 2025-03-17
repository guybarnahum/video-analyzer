#!/usr/bin/env python3
import argparse
import json
import logging
import os
import subprocess
import sys
import tempfile
import uuid
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file, Response
from werkzeug.utils import secure_filename
import tempfile
import shutil

# Initialize logger
logger = logging.getLogger(__name__)

def archive_dir(src_dir, archive_name, *exclude_patterns):
    # Create a temporary directory and get its path
    temp_dir_parent = tempfile.mkdtemp()
    temp_dir = os.path.join(temp_dir_parent, "contents")
    
    if exclude_patterns:
        # Create the ignore function using the provided patterns
        ignore_function = shutil.ignore_patterns(*exclude_patterns)
        # Use shutil.copytree with the ignore parameter
        shutil.copytree(src_dir, temp_dir, ignore=ignore_function)
    else:
        # Copy without any filtering
        shutil.copytree(src_dir, temp_dir)
    
    # Create the archive from the filtered directory
    archive_path = shutil.make_archive(archive_name, 'zip', temp_dir)
    
    # Cleanup temporary directory
    shutil.rmtree(temp_dir_parent)
    
    return archive_path


def sanitize_cmd_list(args):
    sanitized_args = []
    
    i = 0
    while i < len(args):
        sanitized_args.append(args[i])
        arg_match = args[i].lower().replace('-','_')
        if 'api_key' in arg_match and i + 1 < len(args):
            value = args[i+1][:6] + '****...'
            sanitized_args.append(value)  # Replace API key value
            i += 1  # Skip the next argument (the sensitive value)
        i += 1
    
    return sanitized_args


class VideoAnalyzerUI:
    def __init__(self, host='localhost', port=5000, dev_mode=False):
        self.app = Flask(__name__)
        self.host = host
        self.port = port
        self.dev_mode = dev_mode
        self.sessions = {}
        
        # Ensure tmp directories exist
        self.tmp_root = Path(tempfile.gettempdir()) / 'video-analyzer-ui'
        self.tmp_root.mkdir(parents=True, exist_ok=True)
        
        self.setup_routes()
        
    def setup_routes(self):
        @self.app.route('/')
        def index():
            return render_template('index.html')
            
        @self.app.route('/serve_file/<session_id>/<filename>')
        def serve_file(session_id, filename):
            if session_id not in self.sessions:
                logger.error('Invalid session_id {session_id}')
                return jsonify({'error': 'Invalid session'}), 401

            session_path = self.tmp_root / session_id
            filepath = session_path / filename

            try:
                return send_file( filepath )

            except FileNotFoundError:
                logger.error('File not found - session_id : {session_id}, filename : {filename}, filepath : {filepath}')
                return jsonify({'error': 'File not found'}), 404
            
            except PermissionError:
                logger.error('Permission denied- session_id : {session_id}, filename : {filename}, filepath : {filepath}')
                return jsonify({'error': 'Permission denied'}), 403
            
            except Exception as e:
                logger.error('Unexpected error - session_id : {session_id}, filename : {filename}, filepath : {filepath}')
                return jsonify({'error': 'Unexpected error'}), 500


        @self.app.route('/upload', methods=['POST'])
        def upload_file():
            if 'video' not in request.files:
                return jsonify({'error': 'No video file provided'}), 400
                
            file = request.files['video']
            if file.filename == '':
                return jsonify({'error': 'No selected file'}), 400
                
            if not file.filename.lower().endswith(('.mp4', '.avi', '.mov', '.mkv')):
                return jsonify({'error': 'Invalid file type'}), 400
                
            try:
                # Create session
                session_id  = str(uuid.uuid4())
                session_path = self.tmp_root / session_id
                
                session_path.mkdir(parents=True)
                
                # Save file
                filename = secure_filename(file.filename)
                filepath = session_path / filename
                file.save(filepath)
                
                self.sessions[session_id] = {
                    'video_path' : str(filepath),
                    'results_dir': str(session_path),
                    'filename'   : filename
                }
                
                return jsonify({
                    'session_id': session_id,
                    'video_name': filename,
                    'message': 'File uploaded successfully'
                })
                
            except Exception as e:
                logger.error(f"Upload error: {e}")
                return jsonify({'error': str(e)}), 500
                
        @self.app.route('/analyze/<session_id>', methods=['POST'])
        def analyze(session_id):
            if session_id not in self.sessions:
                return jsonify({'error': 'Invalid session'}), 404
                
            session = self.sessions[session_id]
            
            # Build command
            cmd = ['video-analyzer', session['video_path']]
            
            # Add optional parameters
            params = request.get_json()
            
            for param, value in params.items():
                if value:  # Only add parameters with values
                    if param in ['keep-frames', 'dev']:  # Flags without values
                        cmd.append(f'--{param}')
                    else:
                        cmd.extend([f'--{param}', value])
                        
            # Create output directory if it doesn't exist
            results_dir = Path(session['results_dir'])
            results_dir.mkdir(parents=True, exist_ok=True)
            
            # Add output directory
            cmd.extend(['--output', str(results_dir)])
            
            # Store output directory in session for later use
            session['output_dir'] = str(results_dir)
            logger.debug(f"Set output directory to: {results_dir}")
            
            # Store command in session for streaming
            session['cmd'] = cmd
            logger.debug(f"cmd : {sanitize_cmd_list(cmd)}")

            return jsonify({'message': 'Analysis started'})
            
        @self.app.route('/analyze/<session_id>/stream')
        def stream_output(session_id):
            if session_id not in self.sessions:
                return jsonify({'error': 'Invalid session'}), 404
                
            session = self.sessions[session_id]
            if 'cmd' not in session:
                return jsonify({'error': 'Analysis not started'}), 400
                
            def generate_output():

                sanitized_cmd = sanitize_cmd_list(session['cmd'])
                logger.info(f"Starting analysis with command: {' '.join(sanitized_cmd)}")
                
                try:
                    process = subprocess.Popen(
                        session['cmd'],
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        universal_newlines=True,
                        bufsize=1
                    )
                    
                    for line in process.stdout:
                        line = line.strip()
                        if line:  # Only send non-empty lines
                            logger.debug(f"Output: {line}")
                            yield f"data: {line}\n\n"
                    
                    process.wait()
                    if process.returncode == 0:
                        logger.info("Analysis completed successfully")
                        yield f"data: Analysis completed successfully\n\n"
                    else:
                        logger.error(f"Analysis failed with code {process.returncode}")
                        yield f"data: Analysis failed with code {process.returncode}\n\n"
                except Exception as e:
                    logger.error(f"Error during analysis: {e}")
                    yield f"data: Error during analysis: {str(e)}\n\n"
                    yield f"data: Analysis failed\n\n"
                    
            return Response(
                generate_output(),
                mimetype='text/event-stream',
                headers={
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            )
            
        @self.app.route('/results/<session_id>')
        def get_results(session_id):
            import shutil

            if session_id not in self.sessions:
                return jsonify({'error': 'Invalid session'}), 401
                
            session = self.sessions[session_id]
            results_dir = Path(session['results_dir'])
            
            if not results_dir.exists():
                err_msg = f"Results directory not found: {results_dir}"
                logger.error(err_msg)
                return jsonify({'error': err_msg }), 404
            
            # List all files in results directory for debugging
            logger.debug(f"Archiving results directory {results_dir}:")
            for file in results_dir.glob('**/*'):
                logger.debug(f"- {file}")
            
            # Set the archive name inside the same directory
            archive_name = os.path.join(results_dir, f'results-{session_id}' )
            
            # Create the ZIP archive - exclude the video
            archive_path = archive_dir(results_dir, archive_name, "*.mp4", "*.mov")

            logger.info(f"Archive created at {archive_path}")

            # Check both the results directory and the default 'output' directory
                 
            try:
                return send_file(
                    archive_path,
                    mimetype='application/zip',
                    as_attachment=True,
                    download_name= os.path.basename(archive_path)
                )
            except Exception as e:
                err_msg = f"Error sending file: {str(e)}"
                logger.error(err_msg)
                return jsonify({'error': err_msg }), 500
        

        @self.app.route('/get_config')
        def get_config():
            
            config_path = os.path.abspath('/app/config/default_config.json')
            logger.info(f'config path : {config_path}')

            try:
                with open(config_path, 'r') as f:
                    config = json.load(f)
                return jsonify(config)
            except FileNotFoundError as e:
                err_msg = f'Configuration file {config_path} : {str(e)}'
                logger.error(err_msg)
                return jsonify({"error": err_msg}), 404
            except json.JSONDecodeError as e:
                err_msg = f"Invalid JSON format in configuration file - {str(e)}"
                logger.error( err_msg )
                return jsonify({"error": err_msg }), 500


        @self.app.route('/cleanup/<session_id>', methods=['POST'])
        def cleanup_session(session_id):
            if session_id not in self.sessions:
                return jsonify({'error': 'Invalid session'}), 404
                
            try:
                session = self.sessions[session_id]
                # Clean up upload directory
                upload_dir = Path(session['video_path']).parent
                if upload_dir.exists():
                    for file in upload_dir.glob('*'):
                        file.unlink()
                    upload_dir.rmdir()
                
                # Clean up results directory
                results_dir = Path(session['results_dir'])
                if results_dir.exists():
                    for file in results_dir.glob('**/*'):
                        if file.is_file():
                            file.unlink()
                    for dir_path in sorted(results_dir.glob('**/*'), reverse=True):
                        if dir_path.is_dir():
                            dir_path.rmdir()
                    results_dir.rmdir()
                
                # Clean up default output directory if it exists
                default_output_dir = Path('output')
                if default_output_dir.exists():
                    for file in default_output_dir.glob('**/*'):
                        if file.is_file():
                            file.unlink()
                    for dir_path in sorted(default_output_dir.glob('**/*'), reverse=True):
                        if dir_path.is_dir():
                            dir_path.rmdir()
                    default_output_dir.rmdir()
                
                del self.sessions[session_id]
                return jsonify({'message': 'Session cleaned up successfully'})
                
            except Exception as e:
                logger.error(f"Cleanup error: {e}")
                return jsonify({'error': str(e)}), 500
    
    def run(self):
        self.app.run(
            host=self.host,
            port=self.port,
            debug=self.dev_mode
        )

def main():
    parser = argparse.ArgumentParser(description="Video Analyzer UI Server")
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5000, help='Port to listen on')
    parser.add_argument('--dev', action='store_true', help='Enable development mode')
    parser.add_argument('--log-file', help='Log file path')
    
    args = parser.parse_args()
    
    # Configure logging
    log_config = {
        'level': logging.DEBUG if args.dev else logging.INFO,
        'format': '%(asctime)s - %(levelname)s - %(message)s',
    }
    if args.log_file:
        log_config['filename'] = args.log_file
    logging.basicConfig(**log_config)
    
    try:
        # Check if video-analyzer is installed
        subprocess.run(['video-analyzer', '--help'], capture_output=True, check=True)
    except subprocess.CalledProcessError:
        logger.error("video-analyzer command not found. Please install video-analyzer package.")
        sys.exit(1)
    except FileNotFoundError:
        logger.error("video-analyzer command not found. Please install video-analyzer package.")
        sys.exit(1)
    
    # Start server
    server = VideoAnalyzerUI(
        host=args.host,
        port=args.port,
        dev_mode=args.dev
    )
    server.run()

if __name__ == '__main__':
    main()
