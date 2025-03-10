// Global state
let currentSession = null;
let outputEventSource = null;

// DOM Elements
const uploadSection=document.getElementById('uploadSection')
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const configSection = document.getElementById('configSection');
const outputSection = document.getElementById('outputSection');
const analysisForm = document.getElementById('analysisForm');
const outputText = document.getElementById('outputText');
const commandPreview = document.getElementById('commandPreview');
const downloadResults = document.getElementById('downloadResults');
const newAnalysis = document.getElementById('newAnalysis');
const clientSelect = document.getElementById('client');
const ollamaSettings = document.getElementById('ollamaSettings');
const openaiSettings = document.getElementById('openaiSettings');

// Event Listeners
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
analysisForm.addEventListener('submit', handleAnalysis);
analysisForm.addEventListener('input', updateCommandPreview);
clientSelect.addEventListener('change', toggleClientSettings);
downloadResults.addEventListener('click', downloadAnalysisResults);
newAnalysis.addEventListener('click', resetUI);

// Initialize configuration on page load
document.addEventListener('DOMContentLoaded', () => {
    // Load default config as soon as the page loads
    loadDefaultConfig();
});

// Configuration loading via API endpoint
function loadDefaultConfig() {
    // Call a server endpoint that will read and return the config
    fetch('/get_config')
        .then(response => {
            if (!response.ok) {
                console.warn(`Could not load configuration: ${response.status}`);
                return null;
            }
            return response.json();
        })
        .then(config => {
            if (config) {
                initializeFormFromConfig(config);
                updateCommandPreview();
                console.log('Configuration loaded successfully');
            }
        })
        .catch(error => {
            console.error('Error loading configuration:', error);
            // Silently continue without the config
        });
}

function initializeFormFromConfig(config) {
    // Clear existing form values first
    analysisForm.reset();
    
    // ollama
    document.getElementById('ollama-url').value   = config.clients.ollama.url
    document.getElementById('ollama-model').value = config.clients.ollama.model

    // openai
    document.getElementById('api-key').value    = config.clients.openai_api.api_key
    document.getElementById('api-url').value    = config.clients.openai_api.api_url
    document.getElementById('api-model').value  = config.clients.openai_api.model
   
    // Set client type first as it affects which fields are visible
    if (config.clients.default) {
        clientSelect.value = config.clients.default;
        toggleClientSettings();
    }
}

// File Upload Handlers
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (isValidVideoFile(file)) {
        handleFile(file);
    } else {
        alert('Please upload a valid video file (MP4, AVI, MOV, or MKV)');
    }
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && isValidVideoFile(file)) {
        handleFile(file);
    }
}

function isValidVideoFile(file) {
    const validTypes = ['.mp4', '.avi', '.mov', '.mkv'];
    return validTypes.some(type => file.name.toLowerCase().endsWith(type));
}

async function handleFile(file) {
    const formData = new FormData();
    formData.append('video', file);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (response.ok) {
            currentSession = data.session_id;
            showConfigSection();
        } else {
            throw new Error(data.error || 'Upload failed');
        }
    } catch (error) {
        alert(`Error uploading file: ${error.message}`);
    }
}

function getArgsFromFormData( data ){ // FormData type

    // This function filters out no active client form data
    // It detects the active client and tests keys that are client dependent
    //
    var args = {}
    var active_client = false;

    for (var [key, value] of data.entries()) {
        
        
        if (key == 'client'){
            active_client = value // active client found!
        }

        if (value) { // Ignore empty args
            // client key-values are formatted client.key
            var client = false
            if (key.includes('.')) {
                [client, key] = key.split('.');
            }
            
            // skip all non active client key-values
            if (client && client != active_client){
                continue;
            }

            // arg belongs to active client or is clientless
            args[key] = value
        }
    }

    return args
}

// Analysis Handlers
async function handleAnalysis(e) {
    e.preventDefault();
    if (!currentSession) return;
    
    const data = new FormData(analysisForm)
    const args = getArgsFromFormData(data)
    showOutputSection();
    
    // Close any existing event source
    if (outputEventSource) {
        outputEventSource.close();
    }
    
    // Clear previous output and show loading
    outputText.textContent = '';

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading';
    loadingDiv.innerHTML = '<div class="loading-text">Analyzing video...</div>';
    outputText.parentElement.appendChild(loadingDiv);

    // Ensure the browser renders before measuring height
    requestAnimationFrame(() => {
        outputText.style.minHeight = `${loadingDiv.offsetHeight}px`;
    });

    try {
        // Make POST request to start analysis
        console.log('POST /analyze',args)
        const response = await fetch(`/analyze/${currentSession}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(args)
        });
        
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to start analysis');
        }
    } catch (error) {
        outputText.textContent = `Error starting analysis: ${error.message}\n`;
        document.querySelector('.output-actions').style.display = 'flex';
        downloadResults.style.display = 'none';
        loadingDiv.remove();
        return;
    }

    // Start SSE connection for output
    outputEventSource = new EventSource(`/analyze/${currentSession}/stream`);
    
    outputEventSource.onmessage = (event) => {
        // Remove loading indicator on first message
        if (loadingDiv.parentElement) {
            loadingDiv.remove();
        }
        
        outputText.textContent += event.data + '\n';
        
        requestAnimationFrame(() => {
            outputText.scrollTop = outputText.scrollHeight;
        });
        
        if (event.data.includes('Analysis completed successfully')) {
            outputEventSource.close();
            document.querySelector('.output-actions').style.display = 'flex';
            downloadResults.style.display = 'inline-block';
        } else if (event.data.includes('Analysis failed')) {
            outputEventSource.close();
            outputText.textContent += '\nAnalysis failed. Please check the output above for errors.\n';
            // Show new analysis button but not download button
            document.querySelector('.output-actions').style.display = 'flex';
            downloadResults.style.display = 'none';
        }
    };
    
    outputEventSource.onerror = (error) => {
        console.error('SSE Error:', error);
        outputEventSource.close();
        
        // Remove loading indicator if it exists
        if (loadingDiv.parentElement) {
            loadingDiv.remove();
        }
        
        outputText.textContent += '\nError: Connection to server lost. Please try again.\n';
        // Show new analysis button but not download button
        document.querySelector('.output-actions').style.display = 'flex';
        downloadResults.style.display = 'none';
    };
}

// UI Updates
function showConfigSection() {
    uploadSection.style.display = 'none';
    configSection.style.display = 'block';
    outputSection.style.display = 'none';
    updateCommandPreview();
}

function showOutputSection() {
    uploadSection.style.display = 'none';
    configSection.style.display = 'none';
    outputSection.style.display = 'block';
    document.querySelector('.output-actions').style.display = 'none';
}

function toggleClientSettings() {
    const client = clientSelect.value;
    
    if (client === 'ollama') {
        ollamaSettings.style.display = 'block';
        openaiSettings.style.display = 'none';
        
    } else {
        ollamaSettings.style.display = 'none';
        openaiSettings.style.display = 'block';
    }
    updateCommandPreview();
}

function updateCommandPreview() {
    const formData = new FormData(analysisForm);
    const args = getArgsFromFormData(formData)

    let command = 'video-analyzer <video_path>';
    
    for (const key in args) {
        if (args.hasOwnProperty(key)) {
            const value = args[key];
            if (value) {
                if (key === 'keep-frames') {
                    command += ` --${key}`;
                } else {
                    command += ` --${key} ${value}`;
                }
            }
        }
    }
    
    commandPreview.textContent = command;
}

// Results Handling
async function downloadAnalysisResults() {
    if (!currentSession) return;
    
    try {
        const response = await fetch(`/results/${currentSession}`);
        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Failed to fetch results');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analysis.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(`Error downloading results: ${error.message}`);
        console.error('Download error:', error);
    }
}

function resetUI() {
    // Clean up current session
    if (currentSession) {
        fetch(`/cleanup/${currentSession}`, { method: 'POST' })
            .catch(error => console.error('Cleanup error:', error));
    }
    
    // Reset state
    currentSession = null;
    if (outputEventSource) {
        outputEventSource.close();
    }
    
    // Reset form
    analysisForm.reset();
    
    // Reset UI
    uploadSection.style.display = 'block';
    configSection.style.display = 'none';
    outputSection.style.display = 'none';
    outputText.textContent = '';
    fileInput.value = '';
    
    // Reset client settings
    loadDefaultConfig();
}

// Initialize UI
toggleClientSettings();
