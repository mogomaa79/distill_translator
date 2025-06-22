// NLLB Translator JavaScript

class TranslatorApp {
    constructor() {
        this.initializeElements();
        this.attachEventListeners();
        this.loadTranslationHistory();
        this.updateLanguageDisplays();
    }

    initializeElements() {
        // Form elements
        this.sourceText = document.getElementById('source-text');
        this.sourceLang = document.getElementById('source-lang');
        this.targetLang = document.getElementById('target-lang');
        this.translateBtn = document.getElementById('translate-btn');
        this.swapBtn = document.getElementById('swap-languages');
        
        // Display elements
        this.translationResult = document.getElementById('translation-result');
        this.loadingSpinner = document.getElementById('loading-spinner');
        this.charCount = document.getElementById('char-count');
        this.translationInfo = document.getElementById('translation-info');
        this.sourceLangDisplay = document.getElementById('source-lang-display');
        this.targetLangDisplay = document.getElementById('target-lang-display');
        
        // Button elements
        this.clearTextBtn = document.getElementById('clear-text');
        this.pasteTextBtn = document.getElementById('paste-text');
        this.copyTranslationBtn = document.getElementById('copy-translation');
        this.speakTranslationBtn = document.getElementById('speak-translation');
        this.clearHistoryBtn = document.getElementById('clear-history');
        
        // History and model elements
        this.translationHistory = document.getElementById('translation-history');
        this.currentModelSpan = document.getElementById('current-model');
        this.modelOptions = document.querySelectorAll('.model-option');
        
        // Translation history array
        this.history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
    }

    attachEventListeners() {
        // Main translation functionality
        this.translateBtn.addEventListener('click', () => this.translateText());
        this.sourceText.addEventListener('input', () => this.updateCharCount());
        this.sourceText.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.translateText();
            }
        });

        // Language controls
        this.swapBtn.addEventListener('click', () => this.swapLanguages());
        this.sourceLang.addEventListener('change', () => this.updateLanguageDisplays());
        this.targetLang.addEventListener('change', () => this.updateLanguageDisplays());

        // Text controls
        this.clearTextBtn.addEventListener('click', () => this.clearText());
        this.pasteTextBtn.addEventListener('click', () => this.pasteText());
        this.copyTranslationBtn.addEventListener('click', () => this.copyTranslation());
        this.speakTranslationBtn.addEventListener('click', () => this.speakTranslation());

        // History controls
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // Model switching
        this.modelOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const modelIndex = parseInt(option.dataset.modelIndex);
                this.switchModel(modelIndex);
            });
        });

        // Auto-resize textarea
        this.sourceText.addEventListener('input', () => this.autoResizeTextarea());
    }

    updateCharCount() {
        const count = this.sourceText.value.length;
        this.charCount.textContent = count;
        
        // Update translate button state
        this.translateBtn.disabled = count === 0;
        
        if (count === 0) {
            this.translateBtn.innerHTML = '<i class="fas fa-arrows-alt-h me-2"></i>Translate';
        } else {
            this.translateBtn.innerHTML = '<i class="fas fa-arrows-alt-h me-2"></i>Translate (' + count + ' chars)';
        }
    }

    updateLanguageDisplays() {
        const sourceValue = this.sourceLang.value;
        const targetValue = this.targetLang.value;
        
        const sourceText = sourceValue ? this.getLanguageName(sourceValue) : 'Auto-detect';
        const targetText = targetValue ? this.getLanguageName(targetValue) : 'Auto-determine';
        
        this.sourceLangDisplay.textContent = sourceText;
        this.targetLangDisplay.textContent = targetText;
    }

    getLanguageName(code) {
        const languages = {
            'eng_Latn': '🇺🇸 English',
            'deu_Latn': '🇩🇪 German'
        };
        return languages[code] || code;
    }

    swapLanguages() {
        const sourceValue = this.sourceLang.value;
        const targetValue = this.targetLang.value;
        const sourceTextValue = this.sourceText.value;
        const translationText = this.getTranslationText();

        // Swap language selections
        this.sourceLang.value = targetValue;
        this.targetLang.value = sourceValue;

        // Swap text content if translation exists
        if (translationText && translationText !== 'Translation will appear here') {
            this.sourceText.value = translationText;
            this.updateCharCount();
        }

        this.updateLanguageDisplays();
        
        // Add visual feedback
        this.swapBtn.classList.add('pulse');
        setTimeout(() => this.swapBtn.classList.remove('pulse'), 1000);
    }

    async translateText() {
        const text = this.sourceText.value.trim();
        if (!text) return;

        this.showLoading(true);
        this.translateBtn.disabled = true;

        try {
            const response = await fetch('/api/translate/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({
                    text: text,
                    source_lang: this.sourceLang.value || null,
                    target_lang: this.targetLang.value || null,
                    auto_detect: true
                })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.displayTranslation(result);
                this.addToHistory(text, result);
            } else {
                this.showError(result.error || 'Translation failed');
            }
        } catch (error) {
            console.error('Translation error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.showLoading(false);
            this.translateBtn.disabled = false;
        }
    }

    displayTranslation(result) {
        const translationText = result.translated_text;
        
        this.translationResult.innerHTML = `
            <div class="translation-text fade-in">${this.escapeHtml(translationText)}</div>
        `;
        
        this.translationResult.classList.add('has-content');
        
        // Update info
        this.translationInfo.innerHTML = `
            <i class="fas fa-check-circle text-success me-1"></i>
            ${result.source_language_name} → ${result.target_language_name} 
            <span class="badge bg-primary ms-1">${result.model_name}</span>
        `;

        // Show action buttons
        this.copyTranslationBtn.style.display = 'inline-block';
        this.speakTranslationBtn.style.display = 'inline-block';

        // Update language displays with detected languages
        if (result.source_language) {
            this.sourceLangDisplay.textContent = result.source_language_name;
        }
        if (result.target_language) {
            this.targetLangDisplay.textContent = result.target_language_name;
        }
    }

    showError(message) {
        this.translationResult.innerHTML = `
            <div class="text-center text-danger mt-5 fade-in">
                <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
                <p>${this.escapeHtml(message)}</p>
            </div>
        `;
        this.translationResult.classList.remove('has-content');
        this.translationInfo.innerHTML = '<i class="fas fa-times-circle text-danger me-1"></i>Translation failed';
    }

    showLoading(show) {
        this.loadingSpinner.style.display = show ? 'block' : 'none';
        
        if (show) {
            this.translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Translating...';
        } else {
            this.updateCharCount(); // This will reset the button text
        }
    }

    getTranslationText() {
        const textDiv = this.translationResult.querySelector('.translation-text');
        return textDiv ? textDiv.textContent : '';
    }

    clearText() {
        this.sourceText.value = '';
        this.updateCharCount();
        this.sourceText.focus();
    }

    async pasteText() {
        try {
            const text = await navigator.clipboard.readText();
            this.sourceText.value = text;
            this.updateCharCount();
            this.sourceText.focus();
        } catch (error) {
            console.error('Paste failed:', error);
            // Fallback for browsers that don't support clipboard API
            this.sourceText.focus();
        }
    }

    async copyTranslation() {
        const translationText = this.getTranslationText();
        if (!translationText) return;

        try {
            await navigator.clipboard.writeText(translationText);
            
            // Visual feedback
            const originalText = this.copyTranslationBtn.innerHTML;
            this.copyTranslationBtn.innerHTML = '<i class="fas fa-check"></i>';
            this.copyTranslationBtn.classList.add('btn-success');
            
            setTimeout(() => {
                this.copyTranslationBtn.innerHTML = originalText;
                this.copyTranslationBtn.classList.remove('btn-success');
            }, 1500);
        } catch (error) {
            console.error('Copy failed:', error);
        }
    }

    speakTranslation() {
        const translationText = this.getTranslationText();
        if (!translationText || !('speechSynthesis' in window)) return;

        // Stop any ongoing speech
        speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(translationText);
        
        // Try to set appropriate language
        const targetLang = this.targetLang.value;
        if (targetLang === 'eng_Latn') {
            utterance.lang = 'en-US';
        } else if (targetLang === 'deu_Latn') {
            utterance.lang = 'de-DE';
        }

        // Visual feedback
        this.speakTranslationBtn.classList.add('pulse');
        utterance.onend = () => {
            this.speakTranslationBtn.classList.remove('pulse');
        };

        speechSynthesis.speak(utterance);
    }

    addToHistory(sourceText, result) {
        const historyItem = {
            id: Date.now(),
            source: sourceText,
            translation: result.translated_text,
            sourceLang: result.source_language_name,
            targetLang: result.target_language_name,
            model: result.model_name,
            timestamp: new Date().toLocaleString()
        };

        this.history.unshift(historyItem);
        this.history = this.history.slice(0, 10); // Keep only last 10 translations

        this.saveHistory();
        this.renderHistory();
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.translationHistory.innerHTML = '<p class="text-muted text-center">No recent translations</p>';
            return;
        }

        const historyHTML = this.history.map(item => `
            <div class="history-item fade-in" data-id="${item.id}">
                <div class="history-source">${this.escapeHtml(item.source)}</div>
                <div class="history-translation">${this.escapeHtml(item.translation)}</div>
                <div class="history-meta">
                    ${item.sourceLang} → ${item.targetLang} • ${item.model} • ${item.timestamp}
                </div>
            </div>
        `).join('');

        this.translationHistory.innerHTML = historyHTML;

        // Add click handlers for history items
        this.translationHistory.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', () => {
                const sourceText = item.querySelector('.history-source').textContent;
                this.sourceText.value = sourceText;
                this.updateCharCount();
                this.sourceText.scrollIntoView({ behavior: 'smooth' });
            });
        });
    }

    clearHistory() {
        this.history = [];
        this.saveHistory();
        this.renderHistory();
    }

    loadTranslationHistory() {
        this.renderHistory();
    }

    saveHistory() {
        localStorage.setItem('translationHistory', JSON.stringify(this.history));
    }

    async switchModel(modelIndex) {
        try {
            const response = await fetch('/api/switch-model/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCSRFToken()
                },
                body: JSON.stringify({ model_index: modelIndex })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                this.currentModelSpan.textContent = result.model_info.current_model;
                
                // Show success notification
                this.showNotification('Model switched successfully!', 'success');
            } else {
                this.showNotification(result.error || 'Failed to switch model', 'error');
            }
        } catch (error) {
            console.error('Model switch error:', error);
            this.showNotification('Network error', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type === 'error' ? 'danger' : 'success'} fade-in position-fixed`;
        notification.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-triangle' : 'check-circle'} me-2"></i>
            ${message}
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    autoResizeTextarea() {
        // Auto-resize functionality could be added here if needed
    }

    getCSRFToken() {
        // Get CSRF token from cookie
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'csrftoken') {
                return value;
            }
        }
        return '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TranslatorApp();
});

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