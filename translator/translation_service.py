import os
import urllib.request
import subprocess
import ctranslate2
import transformers
import torch
import threading
from typing import List, Tuple, Dict, Optional
from django.conf import settings
from config import NLLB_MODELS, SPM_URL, SPM_PATH, DEFAULT_MODEL_INDEX, SUPPORTED_LANGUAGES


class TranslationService:
    """
    Translation service that supports bidirectional German-English translation
    with automatic GPU/CPU detection and model management.
    """
    
    def __init__(self):
        self.translator = None
        self.tokenizer = None
        self.current_model = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.compute_type = self._get_compute_type()
        self._lock = threading.Lock()
        self._initialize_default_model()
    
    def _get_compute_type(self) -> str:
        """Determine the best compute type based on device"""
        if self.device == "cuda":
            # Try different compute types for GPU
            cuda_options = ["int8_float16", "float16", "float32"]
            return cuda_options[0]  # Default to int8_float16
        else:
            return "int8"  # CPU default
    
    def _download_sentencepiece_model(self):
        """Download SentencePiece model if not present"""
        if not os.path.isfile(SPM_PATH):
            print(f"Downloading SentencePiece model from {SPM_URL}...")
            urllib.request.urlretrieve(SPM_URL, SPM_PATH)
            print("SentencePiece model downloaded.")
    
    def _download_model(self, model_info: Dict) -> bool:
        """Download a model from HuggingFace Hub"""
        try:
            if not os.path.isdir(model_info["local_dir"]):
                print(f"Downloading {model_info['name']} from HuggingFace Hub...")
                subprocess.run([
                    "python3.11", "-c",
                    f"from huggingface_hub import snapshot_download; snapshot_download(repo_id='{model_info['repo_id']}', local_dir='{model_info['local_dir']}')"
                ], check=True)
                print(f"{model_info['name']} downloaded.")
            return True
        except Exception as e:
            print(f"Error downloading {model_info['name']}: {e}")
            return False
    
    def _initialize_default_model(self):
        """Initialize the default model (600M distilled)"""
        try:
            self._download_sentencepiece_model()
            default_model = NLLB_MODELS[DEFAULT_MODEL_INDEX]
            self._download_model(default_model)
            self._load_model(default_model)
        except Exception as e:
            print(f"Error initializing default model: {e}")
    
    def _load_model(self, model_info: Dict):
        """Load a specific model"""
        with self._lock:
            try:
                # Load translator with GPU/CPU support
                if self.device == "cuda":
                    compute_type_cuda_options = ["int8_float16", "float16", "float32"]
                    translator = None
                    for c_type in compute_type_cuda_options:
                        try:
                            translator = ctranslate2.Translator(
                                model_info["local_dir"], 
                                device=self.device, 
                                compute_type=c_type
                            )
                            print(f"Using compute_type='{c_type}' on GPU.")
                            break
                        except ValueError:
                            print(f"Warning: {c_type} not supported on this GPU. Trying next option.")
                    if translator is None:
                        raise RuntimeError("No supported compute type found for GPU.")
                    self.translator = translator
                else:
                    self.translator = ctranslate2.Translator(
                        model_info["local_dir"], 
                        device=self.device, 
                        compute_type="int8"
                    )
                
                # Load tokenizer
                self.tokenizer = transformers.AutoTokenizer.from_pretrained(
                    model_info["local_dir"], 
                    sp_model_kwargs={"model_file": SPM_PATH}
                )
                
                self.current_model = model_info
                print(f"Model {model_info['name']} loaded successfully on {self.device}")
                
            except Exception as e:
                print(f"Error loading model {model_info['name']}: {e}")
                raise e
    
    def switch_model(self, model_index: int) -> bool:
        """Switch to a different model"""
        if 0 <= model_index < len(NLLB_MODELS):
            model_info = NLLB_MODELS[model_index]
            try:
                if not os.path.isdir(model_info["local_dir"]):
                    if not self._download_model(model_info):
                        return False
                self._load_model(model_info)
                return True
            except Exception as e:
                print(f"Error switching to model {model_info['name']}: {e}")
                return False
        return False
    
    def detect_language(self, text: str) -> str:
        """
        Simple language detection based on common patterns.
        Returns 'eng_Latn' for English or 'deu_Latn' for German.
        """
        # Simple heuristic: check for common German words/patterns
        german_indicators = [
            'der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'nicht', 'ich', 'sie', 'er',
            'ß', 'ä', 'ö', 'ü', 'Ä', 'Ö', 'Ü'
        ]
        
        text_lower = text.lower()
        german_score = sum(1 for indicator in german_indicators if indicator in text_lower)
        
        # If we find German indicators, assume it's German
        if german_score > 0:
            return 'deu_Latn'
        else:
            return 'eng_Latn'
    
    def translate(
        self, 
        text: str, 
        source_lang: Optional[str] = None, 
        target_lang: Optional[str] = None,
        auto_detect: bool = True
    ) -> Dict[str, str]:
        """
        Translate text with bidirectional German-English support
        
        Args:
            text: Text to translate
            source_lang: Source language code (optional if auto_detect=True)
            target_lang: Target language code (optional if auto_detect=True)
            auto_detect: Whether to auto-detect source language
            
        Returns:
            Dictionary with translation result and metadata
        """
        if not self.translator or not self.tokenizer:
            raise RuntimeError("Translation model not initialized")
        
        # Auto-detect source language if not provided
        if auto_detect and not source_lang:
            source_lang = self.detect_language(text)
        
        # Set target language based on source (bidirectional)
        if not target_lang:
            if source_lang == 'eng_Latn':
                target_lang = 'deu_Latn'
            elif source_lang == 'deu_Latn':
                target_lang = 'eng_Latn'
            else:
                target_lang = 'eng_Latn'  # Default to English
        
        try:
            # Tokenize input
            self.tokenizer.src_lang = source_lang
            token_ids = self.tokenizer.encode(text.strip(), add_special_tokens=True)
            tokens_as_strings = self.tokenizer.convert_ids_to_tokens(token_ids)
            tokens_as_strings = [source_lang] + tokens_as_strings
            
            # Translate
            target_prefix = [[target_lang]]
            
            with self._lock:
                translations = self.translator.translate_batch(
                    [tokens_as_strings],
                    beam_size=2,
                    target_prefix=target_prefix,
                    max_decoding_length=128,
                    repetition_penalty=1.0,
                )
            
            # Process result
            translation = translations[0]
            tgt_tokens = translation.hypotheses[0]
            
            # Clean up tokens
            if tgt_tokens and tgt_tokens[0] == target_lang:
                tgt_tokens = tgt_tokens[1:]
            if tgt_tokens and tgt_tokens[-1] == "</s>":
                tgt_tokens = tgt_tokens[:-1]
            
            # Detokenize
            detokenized_text = self.tokenizer.decode(
                self.tokenizer.convert_tokens_to_ids(tgt_tokens), 
                skip_special_tokens=True
            )
            
            # Clean up SentencePiece spaces
            SP_SPACE_CHAR = '\u2581'
            final_text = detokenized_text.replace(SP_SPACE_CHAR, ' ').strip()
            
            return {
                'translated_text': final_text,
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
            'current_model': self.current_model['name'] if self.current_model else 'None',
            'device': self.device,
            'compute_type': self.compute_type,
            'available_models': [model['name'] for model in NLLB_MODELS],
            'supported_languages': SUPPORTED_LANGUAGES
        }


# Global translation service instance
translation_service = TranslationService() 