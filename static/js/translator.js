// OpenNMT Translator v2 JavaScript

// Application state
let translationHistory = JSON.parse(localStorage.getItem('translationHistory') || '[]');
let currentModelIndex = 0;

// DOM elements - Fixed IDs to match HTML template
const sourceText = document.getElementById('source-text');
const sourceLang = document.getElementById('source-lang');
const targetLang = document.getElementById('target-lang');
const translationResult = document.getElementById('translation-result');
const translateBtn = document.getElementById('translate-btn');
const swapBtn = document.getElementById('swap-languages');
const clearBtn = document.getElementById('clear-text');
const pasteBtn = document.getElementById('paste-text');
const copyBtn = document.getElementById('copy-translation');
const speakBtn = document.getElementById('speak-translation');
const charCount = document.getElementById('char-count');
const sourceLangDisplay = document.getElementById('source-lang-display');
const targetLangDisplay = document.getElementById('target-lang-display');
const translationInfo = document.getElementById('translation-info');
const currentModel = document.getElementById('current-model');
const deviceInfo = document.getElementById('device-info');
const historyContainer = document.getElementById('translation-history');
const clearHistoryBtn = document.getElementById('clear-history');
const loadingSpinner = document.getElementById('loading-spinner');

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    if (sourceText && sourceLang && targetLang && translateBtn) {
        loadModelInfo();
        displayHistory();
        setupEventListeners();
        updateCharCount();
        toggleTranslateButton();
    } else {
        console.error('Required DOM elements not found');
    }
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

    // Language change displays
    sourceLang.addEventListener('change', updateLanguageDisplays);
    targetLang.addEventListener('change', updateLanguageDisplays);

    // Model selection from dropdown
    document.querySelectorAll('.model-option').forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            const modelIndex = parseInt(this.getAttribute('data-model-index'));
            switchModel(modelIndex);
        });
    });

    // Clear history
    clearHistoryBtn.addEventListener('click', clearHistory);
}

// Update language displays
function updateLanguageDisplays() {
    sourceLangDisplay.textContent = sourceLang.value ? getLanguageName(sourceLang.value) : 'Auto-detect';
    targetLangDisplay.textContent = targetLang.value ? getLanguageName(targetLang.value) : 'Auto-determine';
}

// Load model information
async function loadModelInfo() {
    try {
        const response = await fetch('/api/model-info/');
        const data = await response.json();
        
        if (response.ok) {
            currentModel.textContent = data.current_model || 'Unknown';
            deviceInfo.textContent = (data.device || 'Unknown').toUpperCase();
        } else {
            console.error('Failed to load model info:', data.error);
        }
    } catch (error) {
        console.error('Error loading model info:', error);
        currentModel.textContent = 'Error';
        deviceInfo.textContent = 'Error';
    }
}

// Switch model
async function switchModel(modelIndex) {
    try {
        showLoading('Switching model...');
        
        const response = await fetch('/api/switch-model/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ model_index: modelIndex })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            currentModelIndex = modelIndex;
            currentModel.textContent = data.model_info.current_model;
            showSuccess('Model switched successfully');
            // Update device info
            deviceInfo.textContent = (data.model_info.device || 'Unknown').toUpperCase();
        } else {
            showError('Failed to switch model: ' + (data.error || 'Unknown error'));
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
            source_lang: sourceLang.value || null,
            target_lang: targetLang.value || null,
            auto_detect: !sourceLang.value || sourceLang.value === ''
        };

        const response = await fetch('/api/translate/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (response.ok) {
            if (data.success !== false && data.translated_text) {
                displayTranslation(data);
                addToHistory(text, data.translated_text, data.source_language, data.target_language);
            } else {
                showError('Translation failed: ' + (data.error || 'No translation result'));
            }
        } else {
            showError('Translation failed: ' + (data.error || 'Network error'));
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
    translationResult.innerHTML = `<div class="p-3">${escapeHtml(data.translated_text || 'No translation available')}</div>`;
    translationResult.classList.add('has-content');
    
    // Update language detection info
    if (data.source_language) {
        translationInfo.textContent = `${getLanguageName(data.source_language)} → ${getLanguageName(data.target_language)}`;
    }
    
    // Show and enable action buttons
    copyBtn.style.display = 'inline-block';
    speakBtn.style.display = 'inline-block';
    copyBtn.disabled = false;
    speakBtn.disabled = false;
}

// Utility functions
function updateCharCount() {
    if (charCount && sourceText) {
        charCount.textContent = sourceText.value.length;
    }
}

function toggleTranslateButton() {
    if (translateBtn && sourceText) {
        translateBtn.disabled = !sourceText.value.trim();
    }
}

function swapLanguages() {
    if (sourceLang.value === '' || sourceLang.value === 'auto') return;
    
    const sourceValue = sourceLang.value;
    const targetValue = targetLang.value;
    const sourceTextValue = sourceText.value;
    const translationValue = translationResult.textContent;
    
    sourceLang.value = targetValue;
    targetLang.value = sourceValue;
    sourceText.value = translationValue === 'Translation will appear here' ? '' : translationValue;
    
    if (sourceTextValue !== translationValue) {
        translationResult.innerHTML = `<div class="p-3">${escapeHtml(sourceTextValue)}</div>`;
        translationResult.classList.add('has-content');
    } else {
        translationResult.innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="fas fa-language fa-3x mb-3 opacity-50"></i>
                <p>Translation will appear here</p>
            </div>
        `;
        translationResult.classList.remove('has-content');
        copyBtn.style.display = 'none';
        speakBtn.style.display = 'none';
    }
    
    updateCharCount();
    toggleTranslateButton();
    updateLanguageDisplays();
}

function clearText() {
    sourceText.value = '';
    translationResult.innerHTML = `
        <div class="text-center text-muted mt-5">
            <i class="fas fa-language fa-3x mb-3 opacity-50"></i>
            <p>Translation will appear here</p>
        </div>
    `;
    translationResult.classList.remove('has-content');
    translationInfo.textContent = 'Ready to translate';
    copyBtn.style.display = 'none';
    speakBtn.style.display = 'none';
    updateCharCount();
    toggleTranslateButton();
}

async function pasteText() {
    try {
        const text = await navigator.clipboard.readText();
        sourceText.value = text;
        updateCharCount();
        toggleTranslateButton();
        showSuccess('Text pasted from clipboard');
    } catch (error) {
        console.error('Failed to paste text:', error);
        showError('Failed to paste text from clipboard');
    }
}

async function copyTranslation() {
    try {
        const textContent = translationResult.textContent.trim();
        await navigator.clipboard.writeText(textContent);
        showSuccess('Translation copied to clipboard');
    } catch (error) {
        console.error('Failed to copy text:', error);
        showError('Failed to copy translation');
    }
}

function speakTranslation() {
    if ('speechSynthesis' in window) {
        const textContent = translationResult.textContent.trim();
        const utterance = new SpeechSynthesisUtterance(textContent);
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
    if (!historyContainer) return;
    
    if (translationHistory.length === 0) {
        historyContainer.innerHTML = '<p class="text-muted text-center">No recent translations</p>';
        return;
    }
    
    historyContainer.innerHTML = translationHistory.map(item => `
        <div class="history-item border-bottom pb-3 mb-3" onclick="loadHistoryItem('${item.id}')">
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
        translationResult.innerHTML = `<div class="p-3">${escapeHtml(item.translation)}</div>`;
        translationResult.classList.add('has-content');
        
        updateCharCount();
        toggleTranslateButton();
        updateLanguageDisplays();
        copyBtn.style.display = 'inline-block';
        speakBtn.style.display = 'inline-block';
        copyBtn.disabled = false;
        speakBtn.disabled = false;
    }
}

function removeHistoryItem(event, id) {
    event.stopPropagation();
    translationHistory = translationHistory.filter(h => h.id != id);
    localStorage.setItem('translationHistory', JSON.stringify(translationHistory));
    displayHistory();
    showSuccess('Translation removed from history');
}

function clearHistory() {
    if (confirm('Are you sure you want to clear all translation history?')) {
        translationHistory = [];
        localStorage.removeItem('translationHistory');
        displayHistory();
        showSuccess('Translation history cleared');
    }
}

// UI feedback functions
function showLoading(message = 'Loading...') {
    if (loadingSpinner) {
        loadingSpinner.style.display = 'flex';
        if (loadingSpinner.querySelector('p')) {
            loadingSpinner.querySelector('p').textContent = message;
        }
    }
    if (translateBtn) {
        translateBtn.disabled = true;
    }
}

function hideLoading() {
    if (loadingSpinner) {
        loadingSpinner.style.display = 'none';
    }
    if (translateBtn && sourceText) {
        translateBtn.disabled = !sourceText.value.trim();
    }
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show position-fixed`;
    notification.style.cssText = 'top: 20px; right: 20px; z-index: 10000; min-width: 300px; max-width: 400px;';
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
        'de': 'German',
        'en': 'English',
        '': 'Auto-detect',
        // Legacy NLLB codes for backward compatibility
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
        // OpenNMT codes
        'de': 'de',
        'en': 'en',
        '': 'en',
        // Legacy NLLB codes for backward compatibility
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

function getCsrfToken() {
    // Get CSRF token from cookies or meta tag
    const cookieValue = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrftoken='))
        ?.split('=')[1];
    
    if (cookieValue) return cookieValue;
    
    // Fallback to meta tag
    const csrfMeta = document.querySelector('meta[name=csrf-token]');
    return csrfMeta ? csrfMeta.getAttribute('content') : '';
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