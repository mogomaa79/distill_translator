from django.urls import path
from . import views

app_name = 'translator'

urlpatterns = [
    # Web interface
    path('', views.index, name='index'),
    
    # API endpoints
    path('api/translate/', views.translate_text, name='translate_text'),
    path('api/model-info/', views.model_info, name='model_info'),
    path('api/switch-model/', views.switch_model, name='switch_model'),
    path('api/detect-language/', views.detect_language, name='detect_language'),
    path('api/health/', views.health_check, name='health_check'),
] 