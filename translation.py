from google.cloud import translate

PARENT = 'projects/{}'.format('e6998-podcast-creator')
TRANSLATE = translate.TranslationServiceClient()

def translate_my_line(line:str, target_language:str = "es-ES") -> str:
    """Translate a single line of text to the target language."""
    data = {
        'contents': [line],
        'parent': PARENT,
        'target_language_code': target_language,
    }
    
    try:
        rsp = TRANSLATE.translate_text(request=data)
    except TypeError:
        rsp = TRANSLATE.translate_text(**data)
    
    return rsp.translations[0].translated_text
