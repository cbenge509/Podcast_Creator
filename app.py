import os
import ast
from pydub import AudioSegment
from flask import Flask, request, jsonify, render_template, send_from_directory
from werkzeug.utils import secure_filename
import PyPDF2
import anthropic
from google.cloud import texttospeech
from script import generate_script
from translation import *

AudioSegment.converter = "C:/media/ffmpeg/bin/ffmpeg.exe"

app = Flask(__name__)

# Configure API clients
anthropic_client = anthropic.Anthropic(
    api_key=os.environ.get("ANTHROPIC_API_KEY")
)
tts_client = texttospeech.TextToSpeechClient()

UPLOAD_FOLDER = "uploads"
ALLOWED_EXTENSIONS = {"pdf"}

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def extract_text_from_pdf(file_path):
    with open(file_path, "rb") as file:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
    return text


# Audio configuration for speech synthesis
audio_config = texttospeech.AudioConfig(
    audio_encoding=texttospeech.AudioEncoding.LINEAR16,
    speaking_rate=1
)


def synthesize_speech(line, voice_params):
    """Synthesize speech for a single line of text."""
    input_text = texttospeech.SynthesisInput(text=line)
    response = tts_client.synthesize_speech(
        request={
            "input": input_text,
            "voice": voice_params,
            "audio_config": audio_config,
        }
    )
    # Convert the response's audio content to a pydub AudioSegment
    audio_segment = AudioSegment(
        data=response.audio_content,
        sample_width=2,  # 2 bytes for LINEAR16
        frame_rate=24000,  # Adjust according to TTS settings
        channels=1,  # Mono
    )
    return audio_segment


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/app")
def app_index():
    return render_template("app_index.html")


@app.route("/get-voices")
def get_voices():
    voices = tts_client.list_voices().voices
    all_voices = [
        {
            "name": voice.name,
            "gender": texttospeech.SsmlVoiceGender(voice.ssml_gender).name,
            "language_code": voice.language_codes[0]
        }
        for voice in voices
        if voice.language_codes[0] in ["en-US", "es-ES", "de-DE", "fr-FR"]
    ]
    return jsonify(all_voices)


@app.route("/generate-podcast", methods=["POST"])
def generate_podcast():
    if "pdfFile" not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files["pdfFile"]
    mood = request.form.get("mood")
    host_voice = request.form.get("hostVoice")
    guest_voice = request.form.get("guestVoice")
    podcast_length = int(request.form.get("podcastLength", 300))  # Default to 300
    output_language = request.form.get("outputLanguage", "en-US")  # Default to en-US

    if file.filename == "":
        return jsonify({"error": "No selected file"}), 400

    if file and allowed_file(file.filename):
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        file.save(file_path)
        
        # prepare voice parameters based on the speaker roles and output language
        voice_parameters = {
            "host": texttospeech.VoiceSelectionParams(
                language_code=output_language,
                name=host_voice
            ),
            "guest": texttospeech.VoiceSelectionParams(
                language_code=output_language,
                name=guest_voice
            )
        }
        
        combined_audio = AudioSegment.silent(duration=100)  # Short silence
        crossfade_duration = 50  # Crossfade duration in milliseconds
        pause_duration = 250  # Pause duration in milliseconds (0.25 seconds)
        
        pdf_text = extract_text_from_pdf(file_path)
        script = generate_script(
            pdf_text, mood, podcast_length, anthropic_client=anthropic_client
        )
        
        # Save the script to a file
        script_filename = f"{os.path.splitext(file.filename)[0]}_script.txt"
        script_path = os.path.join(app.config["UPLOAD_FOLDER"], script_filename)
        
        #modify the script for saving to file / displaying to screen
        script_output = script.strip().replace('"host",', '"host":').replace('"guest",', '"guest":')\
            .replace("[", "").replace("]", "").replace("(", "").replace(")", "")\
            .replace("\\", "'").replace("\"", "").replace("\n    ", "\n").split("\n")
        
        with open(script_path, 'w') as script_file:
            for line in script_output:
                if len(line) > 0:
                    if line[-1] == ",":
                        line = line[:-1]
                    line += "\n\n"
                    script_file.write(line)
        
        for speaker, line in ast.literal_eval(script):
            if output_language != "en-US":
                line = translate_my_line(line, output_language)
            segment = synthesize_speech(line, voice_parameters[speaker])

            # Append a pause after each segment, except before the first one
            if combined_audio.duration_seconds > 0:
                combined_audio += AudioSegment.silent(duration=pause_duration)
            combined_audio = combined_audio.append(
                segment, crossfade=crossfade_duration
            )

        audio_filename = f"{os.path.splitext(file.filename)[0]}.mp3"
        audio_path = os.path.join(app.config["UPLOAD_FOLDER"], audio_filename)
        
        # Generate a unique filename for the MP3
        combined_audio.export(audio_path, format="mp3", tags={
            'artist': 'Podcast Creator',
            'comments': 'This podcast is awesome!'
        })

        return jsonify({
            "audioUrl": f"/uploads/{audio_filename}",
            "scriptUrl": f"/uploads/{script_filename}"
        })

    return jsonify({"error": "Invalid file type"}), 400


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


if __name__ == "__main__":
    app.run(debug=True)
