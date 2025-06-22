// Distilled Translator JavaScript

// Application state
let translationHistory = JSON.parse(localStorage.getItem('translationHistory') || '[]');
let currentModelIndex = 0;

// DOM elements
const sourceText = document.getElementById('sourceText');
const sourceLang = document.getElementById('sourceLang');
const targetLang = document.getElementById('targetLang');
const translationResult = document.getElementById('translationResult');
const translateBtn = document.getElementById('translateBtn');
const swapBtn = document.getElementById('swapBtn');
const clearBtn = document.getElementById('clearBtn');
const pasteBtn = document.getElementById('pasteBtn');
const copyBtn = document.getElementById('copyBtn');
const speakBtn = document.getElementById('speakBtn');
const charCount = document.getElementById('charCount');
const detectedLang = document.getElementById('detectedLang');
const currentModel = document.getElementById('currentModel');
const currentDevice = document.getElementById('currentDevice');
const historyContainer = document.getElementById('historyContainer');
const loadingOverlay = document.getElementById('loadingOverlay');
const modelModal = new bootstrap.Modal(document.getElementById('modelModal'));
const modelList = document.getElementById('modelList');

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    loadModelInfo();
    displayHistory();
    setupEventListeners();
});

// Event listeners
function setupEventListeners() {
    // Text input
    sourceText.addEventListener('input', function() {
        updateCharCount();
        toggleTranslateButton();
    });

    // Translation
    translateBtn.addEventListener('click', performTranslation);
    
    // Keyboard shortcut for translation
    sourceText.addEventListener('keydown', function(e) {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            performTranslation();
        }
    });

    // Language swap
    swapBtn.addEventListener('click', swapLanguages);

    // Utility buttons
    clearBtn.addEventListener('click', clearText);
    pasteBtn.addEventListener('click', pasteText);
    copyBtn.addEventListener('click', copyTranslation);
    speakBtn.addEventListener('click', speakTranslation);

    // Settings
    document.getElementById('modelSelect').addEventListener('click', showModelModal);
    document.getElementById('clearHistory').addEventListener('click', clearHistory);
}

// Load model information
async function loadModelInfo() {
    try {
        const response = await fetch('/api/model-info/');
        const data = await response.json();
        
        if (response.ok) {
            currentModel.textContent = data.current_model || 'Unknown';
            currentDevice.textContent = data.device || 'Unknown';
            
            // Populate model selection modal
            populateModelModal(data.available_models || []);
        } else {
            console.error('Failed to load model info:', data.error);
        }
    } catch (error) {
        console.error('Error loading model info:', error);
        currentModel.textContent = 'Error';
        currentDevice.textContent = 'Error';
    }
}

// Populate model selection modal
function populateModelModal(models) {
    modelList.innerHTML = '';
    
    models.forEach((model, index) => {
        const listItem = document.createElement('div');
        listItem.className = `list-group-item list-group-item-action ${index === currentModelIndex ? 'active' : ''}`;
        listItem.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div>
                    <h6 class="mb-1">${model}</h6>
                    <small>Model ${index + 1}</small>
                </div>
                ${index === currentModelIndex ? '<i class="fas fa-check text-success"></i>' : ''}
            </div>
        `;
        
        listItem.addEventListener('click', () => switchModel(index));
        modelList.appendChild(listItem);
    });
}

// Switch model
async function switchModel(modelIndex) {
    try {
        showLoading('Switching model...');
        
        const response = await fetch('/api/switch-model/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model_index: modelIndex })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            currentModelIndex = modelIndex;
            currentModel.textContent = data.current_model;
            modelModal.hide();
            showSuccess('Model switched successfully');
            
            // Update modal
            populateModelModal(document.querySelectorAll('.list-group-item').length ? 
                Array.from(document.querySelectorAll('.list-group-item h6')).map(h => h.textContent) : []);
        } else {
            showError('Failed to switch model: ' + data.error);
        }
    } catch (error) {
        console.error('Error switching model:', error);
        showError('Error switching model');
    } finally {
        hideLoading();
    }
}

// Perform translation
async function performTranslation() {
    const text = sourceText.value.trim();
    if (!text) return;

    try {
        showLoading('Translating...');
        
        const requestData = {
            text: text,
            source_lang: sourceLang.value === 'auto' ? null : sourceLang.value,
            target_lang: targetLang.value,
            auto_detect: sourceLang.value === 'auto'
        };

        const response = await fetch('/api/translate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (response.ok && data.success !== false) {
            displayTranslation(data);
            addToHistory(text, data.translation, data.detected_language || sourceLang.value, targetLang.value);
        } else {
            showError('Translation failed: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Translation error:', error);
        showError('Network error occurred');
    } finally {
        hideLoading();
    }
}

// Display translation result
function displayTranslation(data) {
    translationResult.innerHTML = data.translation || 'No translation available';
    translationResult.classList.add('has-content', 'slide-in-up');
    
    // Update language detection info
    if (data.detected_language) {
        detectedLang.textContent = `Detected: ${getLanguageName(data.detected_language)}`;
    }
    
    // Enable action buttons
    copyBtn.disabled = false;
    speakBtn.disabled = false;
}

// Utility functions
function updateCharCount() {
    charCount.textContent = sourceText.value.length;
}

function toggleTranslateButton() {
    translateBtn.disabled = !sourceText.value.trim();
}

function swapLanguages() {
    if (sourceLang.value === 'auto') return;
    
    const sourceValue = sourceLang.value;
    const targetValue = targetLang.value;
    const sourceTextValue = sourceText.value;
    const translationValue = translationResult.textContent;
    
    sourceLang.value = targetValue;
    targetLang.value = sourceValue;
    sourceText.value = translationValue;
    translationResult.innerHTML = sourceTextValue || '<div class="text-center text-muted mt-5"><i class="fas fa-language fa-3x mb-3"></i><p>Translation will appear here</p></div>';
    
    updateCharCount();
    toggleTranslateButton();
    
    if (!sourceTextValue) {
        copyBtn.disabled = true;
        speakBtn.disabled = true;
        translationResult.classList.remove('has-content');
    }
}

function clearText() {
    sourceText.value = '';
    translationResult.innerHTML = '<div class="text-center text-muted mt-5"><i class="fas fa-language fa-3x mb-3"></i><p>Translation will appear here</p></div>';
    translationResult.classList.remove('has-content');
    detectedLang.textContent = '';
    copyBtn.disabled = true;
    speakBtn.disabled = true;
    updateCharCount();
    toggleTranslateButton();
}

async function pasteText() {
    try {
        const text = await navigator.clipboard.readText();
        sourceText.value = text;
        updateCharCount();
        toggleTranslateButton();
    } catch (error) {
        console.error('Failed to paste text:', error);
        showError('Failed to paste text from clipboard');
    }
}

async function copyTranslation() {
    try {
        await navigator.clipboard.writeText(translationResult.textContent);
        showSuccess('Translation copied to clipboard');
    } catch (error) {
        console.error('Failed to copy text:', error);
        showError('Failed to copy translation');
    }
}

function speakTranslation() {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(translationResult.textContent);
        utterance.lang = getLanguageCode(targetLang.value);
        speechSynthesis.speak(utterance);
    } else {
        showError('Text-to-speech not supported in this browser');
    }
}

// History management
function addToHistory(source, translation, sourceLang, targetLang) {
    const historyItem = {
        id: Date.now(),
        source: source,
        translation: translation,
        sourceLang: sourceLang,
        targetLang: targetLang,
        timestamp: new Date().toISOString()
    };
    
    translationHistory.unshift(historyItem);
    
    // Keep only last 50 translations
    if (translationHistory.length > 50) {
        translationHistory = translationHistory.slice(0, 50);
    }
    
    localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    displayHistory();
}

function displayHistory() {
    if (translationHistory.length === 0) {
        historyContainer.innerHTML = '<div class="text-center text-muted"><i class="fas fa-history fa-2x mb-2"></i><p>No translations yet</p></div>';
        return;
    }
    
    historyContainer.innerHTML = translationHistory.map(item => `
        <div class="history-item" onclick="loadHistoryItem('${item.id}')">
            <div class="d-flex justify-content-between align-items-start">
                <div class="flex-grow-1">
                    <div class="fw-bold text-primary mb-1">${escapeHtml(item.source)}</div>
                    <div class="text-success mb-2">${escapeHtml(item.translation)}</div>
                    <small class="text-muted">
                        ${getLanguageName(item.sourceLang)} → ${getLanguageName(item.targetLang)} • 
                        ${new Date(item.timestamp).toLocaleString()}
                    </small>
                </div>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="removeHistoryItem(event, '${item.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function loadHistoryItem(id) {
    const item = translationHistory.find(h => h.id == id);
    if (item) {
        sourceText.value = item.source;
        sourceLang.value = item.sourceLang;
        targetLang.value = item.targetLang;
        translationResult.innerHTML = item.translation;
        translationResult.classList.add('has-content');
        
        updateCharCount();
        toggleTranslateButton();
        copyBtn.disabled = false;
        speakBtn.disabled = false;
    }
}

function removeHistoryItem(event, id) {
    event.stopPropagation();
    translationHistory = translationHistory.filter(h => h.id != id);
    localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    displayHistory();
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all translation history?')) {
        translationHistory = [];
        localStorage.removeItem('translationHistory');
        displayHistory();
        showSuccess('Translation history cleared');
    }
}

// Modal functions
function showModelModal() {
    modelModal.show();
}

// UI feedback functions
function showLoading(message = 'Loading...') {
    loadingOverlay.querySelector('div:last-child').textContent = message;
    loadingOverlay.classList.add('show');
}

function hideLoading() {
    loadingOverlay.classList.remove('show');
}

function showSuccess(message) {
    // Create and show success toast/notification
    showNotification(message, 'success');
}

function showError(message) {
    // Create and show error toast/notification
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 10000; min-width: 300px;';
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Utility helper functions
function getLanguageName(code) {
    const languages = {
        'auto': 'Auto-detect',
        'deu_Latn': 'German',
        'eng_Latn': 'English',
        'fra_Latn': 'French',
        'spa_Latn': 'Spanish',
        'ita_Latn': 'Italian',
        'por_Latn': 'Portuguese',
        'nld_Latn': 'Dutch',
        'rus_Cyrl': 'Russian',
        'jpn_Jpan': 'Japanese',
        'kor_Hang': 'Korean',
        'zho_Hans': 'Chinese (Simplified)',
        'zho_Hant': 'Chinese (Traditional)',
        'ara_Arab': 'Arabic',
        'hin_Deva': 'Hindi',
        'ben_Beng': 'Bengali',
        'urd_Arab': 'Urdu'
    };
    return languages[code] || code;
}

function getLanguageCode(floresCode) {
    const mapping = {
        'deu_Latn': 'de',
        'eng_Latn': 'en',
        'fra_Latn': 'fr',
        'spa_Latn': 'es',
        'ita_Latn': 'it',
        'por_Latn': 'pt',
        'nld_Latn': 'nl',
        'rus_Cyrl': 'ru',
        'jpn_Jpan': 'ja',
        'kor_Hang': 'ko',
        'zho_Hans': 'zh-CN',
        'zho_Hant': 'zh-TW',
        'ara_Arab': 'ar',
        'hin_Deva': 'hi',
        'ben_Beng': 'bn',
        'urd_Arab': 'ur'
    };
    return mapping[floresCode] || 'en';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Service worker registration for PWA capabilities (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
} 