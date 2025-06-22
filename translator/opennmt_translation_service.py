import os
import urllib.request
import subprocess
import ctranslate2
import torch
import threading
import tempfile
import re
import sys
from typing import List, Tuple, Dict, Optional
from django.conf import settings
from config import OPENNMT_MODELS, DEFAULT_MODEL_INDEX, SUPPORTED_LANGUAGES


class OpenNMTTranslationService:
    """
    Translation service for OpenNMT v3 models with BPE tokenization
    and CTranslate2 conversion for optimized inference.
    """
    
    def __init__(self):
        self.translator = None
        self.current_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.compute_type = self._get_compute_type()
        self._lock = threading.Lock()
        self._dependencies_installed = False
        # Don't install dependencies at startup to avoid conflicts
        # self._install_dependencies()
        # self._initialize_default_model()
    
    def _get_compute_type(self) -> str:
        """Determine the best compute type based on device"""
        if self.device == "cuda":
            return "int8_float16"  # Good balance for GPU
        else:
            return "int8"  # CPU default
    
    def _install_dependencies(self):
        """Install required dependencies if not present"""
        if self._dependencies_installed:
            return
            
        # Don't check for OpenNMT or spacy to avoid import conflicts
        # Just ensure subword-nmt is available
        try:
            import subword_nmt
            print("subword-nmt is already available.")
            self._dependencies_installed = True
        except ImportError:
            print("Installing subword-nmt...")
            try:
                subprocess.run([sys.executable, "-m", "pip", "install", "subword-nmt"], 
                             check=True, capture_output=True)
                print("subword-nmt installed successfully.")
                self._dependencies_installed = True
            except subprocess.CalledProcessError as e:
                print(f"Failed to install subword-nmt: {e}")
    
    def _download_file(self, url: str, local_path: str) -> bool:
        """Download a file from URL to local path"""
        try:
            if not os.path.isfile(local_path):
                print(f"Downloading {local_path} from {url}...")
                urllib.request.urlretrieve(url, local_path)
                print(f"{local_path} downloaded.")
            else:
                print(f"{local_path} already exists.")
            return True
        except Exception as e:
            print(f"Error downloading {local_path}: {e}")
            return False
    
    def _convert_to_ct2(self, model_info: Dict) -> bool:
        """Convert OpenNMT model to CTranslate2 format"""
        if os.path.exists(model_info['ct2_model_path']):
            print(f"CTranslate2 model already exists at {model_info['ct2_model_path']}")
            return True
        
        print(f"Converting {model_info['local_model_path']} to CTranslate2 format...")
        
        try:
            # Use ct2-opennmt-py-converter command
            cmd = [
                "ct2-opennmt-py-converter",
                "--model_path", model_info['local_model_path'],
                "--output_dir", model_info['ct2_model_path'],
                "--quantization", "int8"
            ]
            
            result = subprocess.run(cmd, check=True, capture_output=True, text=True)
            print(f"Model converted to CTranslate2 format at {model_info['ct2_model_path']}")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Error converting model: {e}")
            print(f"stderr: {e.stderr}")
            return False
    
    def _apply_bpe_to_text(self, text_lines: List[str], bpe_model_path: str) -> List[List[str]]:
        """Apply BPE to a list of text lines"""
        if not self._dependencies_installed:
            self._install_dependencies()
            
        with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8') as temp_input:
            temp_input_path = temp_input.name
            for line in text_lines:
                temp_input.write(line + '\n')
        
        with tempfile.NamedTemporaryFile(mode='w', delete=False, encoding='utf-8') as temp_output:
            temp_output_path = temp_output.name
        
        try:
            # Apply BPE with basic settings first
            cmd = [
                "subword-nmt", "apply-bpe",
                "-c", bpe_model_path,
                "--input", temp_input_path,
                "--output", temp_output_path
            ]
            
            subprocess.run(cmd, check=True, capture_output=True)
            
        except subprocess.CalledProcessError as e:
            print(f"BPE application failed: {e}")
            return []
        
        # Read BPE-encoded text
        try:
            with open(temp_output_path, 'r', encoding='utf-8') as f:
                bpe_lines = [line.strip().split() for line in f]
        except Exception as e:
            print(f"Error reading BPE output: {e}")
            return []
        finally:
            # Clean up
            os.unlink(temp_input_path)
            os.unlink(temp_output_path)
        
        return bpe_lines
    
    def _detokenize_bpe(self, text: str) -> str:
        """Comprehensive BPE detokenization for OpenNMT models"""
        # Remove different types of BPE markers
        text = text.replace('@@ ', '').replace('@@', '')  # Standard BPE
        text = text.replace('￭ ', '').replace('￭', '')      # OpenNMT style
        text = text.replace('▁', ' ')                      # SentencePiece style
        
        # Remove special tokens
        text = re.sub(r'｟[^｠]*｠', '', text)  # Remove markup tokens
        text = re.sub(r'<unk>', '', text)     # Remove <unk> tokens
        text = re.sub(r'<s>', '', text)       # Remove start tokens
        text = re.sub(r'</s>', '', text)      # Remove end tokens
        
        # Fix tokenization artifacts
        text = re.sub(r'\s+', ' ', text)      # Multiple spaces to single space
        text = re.sub(r'\s+([,.!?;:])', r'\1', text)  # Space before punctuation
        text = re.sub(r'([,.!?;:])([a-zA-ZäöüßÄÖÜ])', r'\1 \2', text)  # Space after punctuation
        text = re.sub(r"'\s+", "'", text)     # Fix apostrophes
        text = re.sub(r'\s+"', '"', text)     # Fix quotes
        text = re.sub(r'"\s+', '"', text)     # Fix quotes
        
        return text.strip()
    
    def _initialize_default_model(self):
        """Initialize the default OpenNMT model"""
        try:
            default_model = OPENNMT_MODELS[DEFAULT_MODEL_INDEX]
            if self._setup_model(default_model):
                self._load_model(default_model)
        except Exception as e:
            print(f"Error initializing default model: {e}")
    
    def _setup_model(self, model_info: Dict) -> bool:
        """Setup model by downloading and converting if necessary"""
        # Download model and BPE files
        if not self._download_file(model_info['model_url'], model_info['local_model_path']):
            return False
        
        if not self._download_file(model_info['bpe_url'], model_info['bpe_path']):
            return False
        
        # Convert to CTranslate2 format
        return self._convert_to_ct2(model_info)
    
    def _load_model(self, model_info: Dict):
        """Load a specific OpenNMT model"""
        with self._lock:
            try:
                # Load CTranslate2 translator
                self.translator = ctranslate2.Translator(
                    model_info['ct2_model_path'], 
                    device=self.device,
                    compute_type=self.compute_type
                )
                
                self.current_model = model_info
                print(f"OpenNMT model {model_info['name']} loaded successfully on {self.device}")
                
            except Exception as e:
                print(f"Error loading model {model_info['name']}: {e}")
                raise e
    
    def switch_model(self, model_index: int) -> bool:
        """Switch to a different OpenNMT model"""
        if 0 <= model_index < len(OPENNMT_MODELS):
            model_info = OPENNMT_MODELS[model_index]
            try:
                if self._setup_model(model_info):
                    self._load_model(model_info)
                    return True
            except Exception as e:
                print(f"Error switching to model {model_info['name']}: {e}")
                return False
        return False
    
    def detect_language(self, text: str) -> str:
        """
        Simple language detection for English/German.
        Returns 'en' for English or 'de' for German.
        """
        # Simple heuristic: check for common German words/patterns
        german_indicators = [
            'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'nicht', 'ich', 'sie', 'er',
            'ß', 'ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü', 'von', 'zu', 'mit', 'auf', 'für', 'wird', 'werden'
        ]
        
        text_lower = text.lower()
        german_score = sum(1 for indicator in german_indicators if indicator in text_lower)
        
        # If we find German indicators, assume it's German
        if german_score > 0:
            return 'de'
        else:
            return 'en'
    
    def translate(
        self, 
        text: str, 
        source_lang: Optional[str] = None, 
        target_lang: Optional[str] = None,
        auto_detect: bool = True
    ) -> Dict[str, str]:
        """
        Translate text with bidirectional English-German support using OpenNMT
        
        Args:
            text: Text to translate
            source_lang: Source language code (en/de)
            target_lang: Target language code (en/de)
            auto_detect: Whether to auto-detect source language
            
        Returns:
            Dictionary with translation result and metadata
        """
        # Lazy initialization
        if not self.translator:
            print("Initializing OpenNMT model...")
            self._initialize_default_model()
        
        if not self.translator or not self.current_model:
            return {
                'translated_text': '',
                'source_language': source_lang or 'en',
                'target_language': target_lang or 'de',
                'error': 'OpenNMT translation model not initialized',
                'success': False
            }
        
        # Auto-detect source language if not provided
        if auto_detect and not source_lang:
            source_lang = self.detect_language(text)
        
        # Set target language based on source (bidirectional)
        if not target_lang:
            if source_lang == 'en':
                target_lang = 'de'
            elif source_lang == 'de':
                target_lang = 'en'
            else:
                target_lang = 'de'  # Default to German
        
        try:
            # Apply BPE to input text
            bpe_sentences = self._apply_bpe_to_text([text], self.current_model['bpe_path'])
            
            if not bpe_sentences:
                raise RuntimeError("BPE tokenization failed")
            
            bpe_tokens = bpe_sentences[0]
            
            # Translate using CTranslate2
            with self._lock:
                results = self.translator.translate_batch(
                    [bpe_tokens],
                    beam_size=4,              # Smaller beam size for faster inference
                    max_decoding_length=256,  # Allow longer outputs
                    length_penalty=0.8,       # Encourage longer outputs
                    repetition_penalty=1.1,   # Reduce repetition
                    no_repeat_ngram_size=3,   # Prevent 3-gram repetition
                    max_input_length=512      # Handle longer inputs
                )
            
            # Process result
            result = results[0]
            translation_tokens = result.hypotheses[0]
            
            # Join tokens and detokenize BPE
            raw_translation = ' '.join(translation_tokens)
            final_translation = self._detokenize_bpe(raw_translation)
            
            return {
                'translated_text': final_translation,
                'source_language': source_lang,
                'target_language': target_lang,
                'source_language_name': SUPPORTED_LANGUAGES.get(source_lang, source_lang),
                'target_language_name': SUPPORTED_LANGUAGES.get(target_lang, target_lang),
                'model_name': self.current_model['name'] if self.current_model else 'Unknown',
                'device_used': self.device,
                'success': True
            }
            
        except Exception as e:
            return {
                'translated_text': '',
                'source_language': source_lang,
                'target_language': target_lang,
                'error': str(e),
                'success': False
            }
    
    def get_model_info(self) -> Dict:
        """Get current model information"""
        return {
            'current_model': self.current_model['name'] if self.current_model else 'OpenNMT-v3-EN-DE-Large',
            'device': self.device,
            'compute_type': self.compute_type,
            'available_models': [model['name'] for model in OPENNMT_MODELS],
            'supported_languages': SUPPORTED_LANGUAGES,
            'model_type': 'OpenNMT v3'
        }


# Global OpenNMT translation service instance
opennmt_translation_service = OpenNMTTranslationService() 