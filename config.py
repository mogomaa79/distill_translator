# OpenNMT v3 models to evaluate
OPENNMT_MODELS = [
    {
        "name": "OpenNMT-v3-EN-DE-Large",
        "model_url": "https://s3.amazonaws.com/opennmt-models/v3-py/ende/ende-large-withoutBT.pt",
        "local_model_path": "ende-large-withoutBT.pt",
        "bpe_url": "https://s3.amazonaws.com/opennmt-models/v3-py/ende/subwords.en_de.bpe",
        "bpe_path": "subwords.en_de.bpe",
        "ct2_model_path": "ende-large-ct2"  # CTranslate2 converted model path
    }
]

# IWSLT14 Test Set Paths
IWSLT_TEST_SRC = "data/de-en/test.en"
IWSLT_TEST_REF = "data/de-en/test.de"

# Translation settings for OpenNMT (different from NLLB language codes)
SOURCE_LANGUAGE = "en"  # English source
TARGET_LANGUAGE = "de"  # German target

# Default model for web app
DEFAULT_MODEL_INDEX = 0

# Supported language pairs for the web app (updated for OpenNMT)
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'de': 'German',
}

# Legacy NLLB configuration (kept for backward compatibility)
NLLB_MODELS = [
    {
        "name": "NLLB-200-3.3B",
        "repo_id": "entai2965/nllb-200-3.3B-ctranslate2",
        "local_dir": "nllb-200-3.3B-ctranslate2"
    },
    {
        "name": "NLLB-200-1.3B-distilled",
        "repo_id": "entai2965/nllb-200-distilled-1.3B-ctranslate2",
        "local_dir": "nllb-200-distilled-1.3B-ctranslate2"
    },
    {
        "name": "NLLB-200-600M-distilled",
        "repo_id": "entai2965/nllb-200-distilled-600M-ctranslate2",
        "local_dir": "nllb-200-distilled-600M-ctranslate2"
    },
]

# SentencePiece model (legacy)
SPM_URL = "https://s3.amazonaws.com/opennmt-models/nllb-200/flores200_sacrebleu_tokenizer_spm.model"
SPM_PATH = "flores200_sacrebleu_tokenizer_spm.model"
