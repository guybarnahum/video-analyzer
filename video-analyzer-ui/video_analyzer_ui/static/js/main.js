// Global state
let currentSession = null;
let outputEventSource = null;

// DOM Elements
const uploadSection=document.getElementById('uploadSection')
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const videoSection = document.getElementById('videoSection');
const videoPlayer = document.getElementById('videoPlayer');
const analysisContainer = document.getElementById("video-summary-analysis");
    
const framesSection = document.getElementById("framesSection");
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
const googleSettings = document.getElementById('googleSettings');
const mistralSettings = document.getElementById('mistralSettings');

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
            console.warn('Error loading configuration:', error);
            // Silently continue without the config
        });
}

const clientSettings = {
    "ollama"        : ollamaSettings, 
    "openai_api"    : openaiSettings, 
    "google_api"    : googleSettings,
    "mistral_api"   : mistralSettings,
};

function initializeFormFromConfig(config) {
    // Clear existing form values first
    analysisForm.reset();
    
    for (var [client_type, client_config] of Object.entries(config.clients)) {

        if (client_type === 'default') continue;

        var id = client_type +'-api-url'
        var el = document.getElementById(id)
        if (el) el.value = client_config.api_url

        id = client_type +'-api-key'
        el = document.getElementById(id)
        if (el) el.value = client_config.api_key

        id = client_type +'-model'
        el = document.getElementById(id)
        if (el) el.value = client_config.model
    }

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
    if (file) handleFile(file);
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

function isValidVideoFile(file) {
    const validTypes = ['.mp4', '.avi', '.mov', '.mkv'];
    return validTypes.some(type => file.name.toLowerCase().endsWith(type));
}

function loadVideoSection(data, auto_play = false){

    url = 'serve_file/' + data.session_id + '/' + data.video_name

    if (videoPlayer) {
        videoPlayer.src = url;
        videoPlayer.load(); // Ensures the new source is loaded
        if (auto_play) videoPlayer.play(); // Optionally auto-play the video
    } else {
        console.warn("Video player not found!");
    }
}

async function handleFile(file) {

    if (!isValidVideoFile(file)) {
        alert('Please upload a valid video file (MP4, AVI, MOV, or MKV)');
        return
    }

    const formData = new FormData();
    formData.append('video', file);
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (response.ok) {
            console.log(data)
            currentSession = data.session_id;
            loadVideoSection(data);
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
let poller = false

async function handleAnalysis(e) {
    e.preventDefault();
    if (!currentSession) return;
    
    const data = new FormData(analysisForm)
    const args = getArgsFromFormData(data)
    showOutputSection();
    
    poller = createPollingProcess(currentSession, 5000); // Poll every 5 second
    poller.startPolling()

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

        if (poller) poller.stopPolling(); 
        poller = false
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

            if (poller) poller.stopPolling(); 
            poller = false
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
    const client_selected = clientSelect.value;
    
    // Iterate over key-value pairs
    for (const [client_type, client_settings] of Object.entries(clientSettings)) {
        client_settings.style.display = (client_type == client_selected)? "block" : "none";
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
        
        // Get filename from Content-Disposition header if available
        let filename = `analysis_${currentSession}_df.zip`; // Default fallback
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1].replace(/['"]/g, '');
            }
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert(`Error downloading results: ${error.message}`);
        console.error('Download error:', error);
    }
}

function removeChildNodes(parent){
    
    if (parent){
        while (parent.firstChild) {
            parent.removeChild(parent.firstChild);
        }
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
    removeChildNodes(analysisContainer)
    removeChildNodes(framesSection)

    // Reset UI
    uploadSection.style.display = 'block';
    configSection.style.display = 'none';
    outputSection.style.display = 'none';
    outputText.textContent = '';
    fileInput.value = '';
    
    // Reset client settings
    loadDefaultConfig();
}

function renderFrame(frameData, session_id) {

    try{
        const frameId = `frame-${frameData.frame.idx}`;
    
        let frameElement = document.getElementById(frameId);

        // If the frame does not exist, create it
        if (!frameElement) {
            frameElement = document.createElement("div");
            frameElement.id = frameId;
            frameElement.className = "frame-container";
            framesSection.appendChild(frameElement);
        }

        // Store raw_response for later use
        let raw_response = frameData.response;
        raw_response = raw_response.replace(/```/g, "").trim();
        frameElement.setAttribute('data-raw-response', raw_response);

        let response = raw_response

        // look for prev raw_response 
        const prev_el = frameElement.previousElementSibling 
        if (prev_el){
            const prev_raw_response = prev_el.getAttribute('data-raw-response')
            if (prev_raw_response){
                response = highlightDiff( prev_raw_response, raw_response);
            }
        }

        frameElement.innerHTML = `
            <h3>Key Frame ${frameData.frame.idx} : #${frameData.frame.num}</h3>

            <div class="info-row">
                <span class="left">${frameData.frame.timestamp.toFixed(2)}s</span>
                <span class="right">Cost: $${frameData.token_usage.cost.toFixed(4).toLocaleString()}</span>
            </div>
            <div class="info-row">
                <span class="left"><strong>Score:</strong> ${frameData.frame.score.toFixed(2)}</span>
                <span class="right">${frameData.token_usage.total_tokens.toLocaleString()} tokens</span>
            </div>

            <img src="/serve_file/${session_id}/${frameData.frame.name}" 
                    alt="Frame ${frameData.frame.num}" 
                    class="frame-image" 
                    loading="lazy">
            <div class="frame-description">${response}</div>
        `;
    }
    catch( error ){
        console.warn( 'renderFrame', error , frameData)
    }
}

function renderVideoAnalysis(analysisData, session_id) {
    
    if (analysisContainer) {

        // Extract data
        const { total_tokens, total_cost } = analysisData.token_usage;

        // Remove code block markers from response text
        let response = analysisData.video_description.response;
        response = response.replace(/```/g, "").trim();

        // Create HTML structure
        analysisContainer.innerHTML = `
            <div class="analysis-content">
                <h2>Video Analysis</h2>
                <p><strong>Total Tokens Used:</strong> ${total_tokens.toLocaleString()}</p>
                <p><strong>Total Cost:</strong> $${total_cost.toFixed(3).toLocaleString()}</p>
                <br>
                <div class="video-description">${response}</div>
            </div>
        `;
    }
    else{
        console.warn("Element analysisContainer not found.");
    }
    // Re-render all the frames(!)
    for (const frameData of analysisData.frame_analyses) {
        renderFrame( frameData, session_id)
    }
}

function highlightDiff(oldText, newText) {

    let result = '';

    try {
        let diff = Diff.diffWords(oldText, newText);

        diff.forEach(part => {
            const value = part.value.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            if (part.added){
                result += `<span class='text-added'> ${value}</span>`;
            }
            else 
            if (part.removed){
                result += `<span class='text-removed'> ${value}</span>`;
            }
            else{
                result += value;
            }
        });
 
    } catch (error) {
        console.warn("Diff library might not be loaded or an error occurred:", error);
        result = newText;
    }

    return result;
}

function createPollingProcess(session_id, interval = 1000) {
    let ix = 0;
    let polling = null;

    async function checkFile(filePath) {
        console.log(`[DEBUG] Checking file: ${filePath}`);
        try {
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`[DEBUG] File not found: ${filePath}`);
            const jsonData = await response.json();
            console.log(`[DEBUG] Successfully read: ${filePath}`);
            return jsonData;
        } catch (error) {
            console.log(`[DEBUG] Error reading file: ${filePath} - ${error.message}`);
            return null; // File not found or fetch failed
        }
    }

    async function poll() {
        console.log(`[DEBUG] Polling started for session: ${session_id}`);

        const analysisFile = `/serve_file/${session_id}/analysis.json`;
        console.log(`[DEBUG] Checking for analysis file: ${analysisFile}`);

        const analysisData = await checkFile(analysisFile);
        if (analysisData) {
            console.log(`[SUCCESS] Analysis file found:`, analysisData);
            renderVideoAnalysis(analysisData, session_id)
            stopPolling();
            return;
        }

        const frameFile = `/serve_file/${session_id}/frame_${ix}.json`;
        console.log(`[DEBUG] Checking for frame file: ${frameFile}`);

        const frameData = await checkFile(frameFile);
        if (frameData) {
            console.log(`[SUCCESS] Frame ${ix} found:`, frameData);
            renderFrame(frameData, session_id)
            ix++; // Move to next frame
        } else {
            console.log(`[DEBUG] Frame ${ix} not available yet. Retrying...`);
        }
    }

    function startPolling() {
        if (!polling) {
            console.log(`[DEBUG] Starting polling every ${interval}ms...`);
            polling = setInterval(poll, interval);
        } else {
            console.log(`[DEBUG] Polling is already running.`);
        }
    }

    function stopPolling() {
        if (polling) {
            clearInterval(polling);
            polling = null;
            console.log(`[DEBUG] Polling stopped.`);
        } else {
            console.log(`[DEBUG] Polling was not running.`);
        }
    }

    return { startPolling, stopPolling };
}

// Initialize UI
toggleClientSettings();
