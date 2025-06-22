from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import json
import logging
from config import OPENNMT_MODELS, SUPPORTED_LANGUAGES

logger = logging.getLogger(__name__)

def get_translation_service():
    """Lazy import of translation service to avoid startup conflicts"""
    from .opennmt_translation_service import opennmt_translation_service
    return opennmt_translation_service

def index(request):
    """Main translation interface"""
    try:
        service = get_translation_service()
        model_info = service.get_model_info()
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        model_info = {
            'current_model': 'OpenNMT-v3-EN-DE-Large',
            'device': 'CPU',
            'model_type': 'OpenNMT v3'
        }
    
    context = {
        'supported_languages': SUPPORTED_LANGUAGES,
        'available_models': [model['name'] for model in OPENNMT_MODELS],
        'model_info': model_info
    }
    return render(request, 'translator/index.html', context)

@api_view(['POST'])
def translate_text(request):
    """
    API endpoint for text translation using OpenNMT
    
    Expected JSON payload:
    {
        "text": "Hello world",
        "source_lang": "en",        # optional, auto-detect if not provided
        "target_lang": "de",        # optional, auto-determined if not provided
        "auto_detect": true         # optional, default true
    }
    """
    try:
        data = request.data
        text = data.get('text', '').strip()
        
        if not text:
            return Response(
                {'error': 'Text field is required and cannot be empty'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get translation parameters
        source_lang = data.get('source_lang')
        target_lang = data.get('target_lang')
        auto_detect = data.get('auto_detect', True)
        
        # Validate language codes if provided
        if source_lang and source_lang not in SUPPORTED_LANGUAGES:
            return Response(
                {'error': f'Unsupported source language: {source_lang}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if target_lang and target_lang not in SUPPORTED_LANGUAGES:
            return Response(
                {'error': f'Unsupported target language: {target_lang}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform translation using OpenNMT
        service = get_translation_service()
        result = service.translate(
            text=text,
            source_lang=source_lang,
            target_lang=target_lang,
            auto_detect=auto_detect
        )
        
        if result['success']:
            return Response(result, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': result.get('error', 'Translation failed')}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except json.JSONDecodeError:
        return Response(
            {'error': 'Invalid JSON payload'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Translation error: {str(e)}")
        return Response(
            {'error': 'Internal server error'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def model_info(request):
    """Get current model information and available options"""
    try:
        service = get_translation_service()
        info = service.get_model_info()
        return Response(info, status=status.HTTP_200_OK)
    except Exception as e:
        logger.error(f"Error getting model info: {str(e)}")
        return Response(
            {'error': 'Failed to get model information'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def switch_model(request):
    """
    Switch to a different OpenNMT model
    
    Expected JSON payload:
    {
        "model_index": 0  # Index of model in OPENNMT_MODELS
    }
    """
    try:
        data = request.data
        model_index = data.get('model_index')
        
        if model_index is None:
            return Response(
                {'error': 'model_index field is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not isinstance(model_index, int) or model_index < 0 or model_index >= len(OPENNMT_MODELS):
            return Response(
                {'error': f'model_index must be between 0 and {len(OPENNMT_MODELS)-1}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = get_translation_service()
        success = service.switch_model(model_index)
        
        if success:
            info = service.get_model_info()
            return Response({
                'success': True,
                'message': f'Successfully switched to {OPENNMT_MODELS[model_index]["name"]}',
                'model_info': info
            }, status=status.HTTP_200_OK)
        else:
            return Response(
                {'error': 'Failed to switch model'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
            
    except Exception as e:
        logger.error(f"Error switching model: {str(e)}")
        return Response(
            {'error': 'Internal server error'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def detect_language(request):
    """
    Detect the language of input text
    
    Expected JSON payload:
    {
        "text": "Hello world"
    }
    """
    try:
        data = request.data
        text = data.get('text', '').strip()
        
        if not text:
            return Response(
                {'error': 'Text field is required and cannot be empty'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        service = get_translation_service()
        detected_lang = service.detect_language(text)
        
        return Response({
            'detected_language': detected_lang,
            'language_name': SUPPORTED_LANGUAGES.get(detected_lang, detected_lang),
            'confidence': 'medium'  # Simple heuristic, so confidence is medium
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Language detection error: {str(e)}")
        return Response(
            {'error': 'Internal server error'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def health_check(request):
    """Health check endpoint"""
    try:
        service = get_translation_service()
        model_loaded = service.translator is not None
        return Response({
            'status': 'healthy' if model_loaded else 'unhealthy',
            'model_loaded': model_loaded,
            'device': service.device,
            'model_type': 'OpenNMT v3',
            'timestamp': request.META.get('HTTP_DATE', 'unknown')
        }, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({
            'status': 'unhealthy',
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
