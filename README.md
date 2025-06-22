# NLLB Translator - German ↔ English Web App

A beautiful, modern web application for bidirectional German-English translation using Distilled LLMs for optimized inference.

## Features

- 🌐 **Bidirectional Translation**: Seamless German ↔ English translation
- 🤖 **Multiple Models**: Support for Distilled LLMs
- 🚀 **GPU/CPU Support**: Automatic device detection with optimal compute type selection
- 🎨 **Beautiful UI**: Modern, responsive interface with Bootstrap 5
- 📱 **Mobile Friendly**: Optimized for all screen sizes
- 🔄 **Auto-Detection**: Smart language detection for seamless translation
- 📚 **Translation History**: Keep track of recent translations
- 🎯 **Real-time Features**: Character count, copy/paste, text-to-speech
- ⚡ **Fast Inference**: Optimized with Parallelization and Caching

## Requirements

- Python 3.11+
- CUDA-compatible GPU (optional, will fallback to CPU)
- At least 8GB RAM
- 10GB+ disk space for models

## Installation

1. **Clone the repository**:
```bash
git clone <repository-url>
cd distill_translator
```

2. **Create and activate virtual environment**:
```bash
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**:
```bash
pip install -r requirements.txt
```

4. **Run database migrations**:
```bash
python manage.py migrate
```

5. **Start the development server**:
```bash
python manage.py runserver
```

The app will be available at `http://localhost:8000`

## Configuration

### GPU Configuration

The app automatically detects and uses GPU if available:
- CUDA support with automatic compute type selection
- Fallback to CPU if GPU is not available
- Optimized batch processing

## Usage

### Web Interface

1. **Open the app** in your browser at `http://localhost:8000`
2. **Enter text** to translate in the source text area
3. **Select languages** or use auto-detection
4. **Click "Translate"** or press Ctrl+Enter
5. **View results** with language detection and model information
6. **Use additional features**:
   - Copy translation to clipboard
   - Text-to-speech for translations
   - View translation history
   - Switch between models

### API Endpoints

The app provides RESTful API endpoints:

#### Translate Text
```bash
POST /api/translate/
Content-Type: application/json

{
    "text": "Hello world",
    "source_lang": "eng_Latn",  # optional
    "target_lang": "deu_Latn",  # optional
    "auto_detect": true
}
```

#### Get Model Information
```bash
GET /api/model-info/
```

#### Switch Model
```bash
POST /api/switch-model/
Content-Type: application/json

{
    "model_index": 2  # 0-2 for the three available models
}
```

#### Language Detection
```bash
POST /api/detect-language/
Content-Type: application/json

{
    "text": "Hallo Welt"
}
```

## Performance Optimization

### GPU Optimization
- Uses int8_float16 precision for memory efficiency
- Automatic compute type selection based on GPU capabilities
- Batch processing for multiple translations

### CPU Optimization
- int8 quantization for CPU inference
- Conservative batch sizes
- Memory-efficient loading

### Caching
- Model persistence across requests
- Translation history cached locally
- Static file optimization

## Troubleshooting

### Common Issues

1. **CUDA out of memory**: Switch to a smaller model or reduce batch size
2. **Model download fails**: Check internet connection and disk space
3. **Slow translations**: Ensure GPU is properly detected and used
4. **Import errors**: Verify all dependencies are installed correctly

### Logging

Check Django logs for detailed error information:
```bash
python manage.py runserver --verbosity=2
```