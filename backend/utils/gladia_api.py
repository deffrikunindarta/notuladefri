"""
Gladia API Integration Module

This module handles the interaction with Gladia's Audio Transcription API.
It takes an audio/video file and returns the transcribed text.

Gladia API Documentation: https://docs.gladia.io/
"""

import requests
import os
from typing import Optional, Tuple


def transcribe_audio(file_path: str, api_key: str) -> Optional[str]:
    """
    Sends an audio/video file to Gladia API for transcription.
    
    Args:
        file_path (str): Path to the audio/video file to transcribe
        api_key (str): Gladia API key from environment variables
        
    Returns:
        str: Transcribed text from the audio file
        None: If transcription fails
        
    Flow:
        1. Open the audio/video file
        2. Send POST request to Gladia transcription endpoint
        3. Extract and return the transcript text from response
    """
    
    # Gladia API endpoint for audio transcription
    url = "https://api.gladia.io/audio/text/audio-transcription/"
    
    # Headers for the API request
    headers = {
        "x-gladia-key": api_key,
        "accept": "application/json",
    }
    
    try:
        # Open and read the audio file
        with open(file_path, "rb") as audio_file:
            # Prepare the file for upload
            files = {
                "audio": audio_file
            }
            
            # Additional parameters for transcription
            data = {
                "toggle_diarization": "false",  # Don't separate speakers for MVP
                "language_behaviour": "automatic"  # Auto-detect language
            }
            
            print(f"📤 Sending file to Gladia API for transcription...")
            
            # Make the API request
            response = requests.post(url, headers=headers, files=files, data=data)
            
            # Check if request was successful
            if response.status_code == 200:
                result = response.json()
                
                # Extract transcript from response
                # Gladia returns transcript in 'prediction' field
                if "prediction" in result:
                    transcript = result["prediction"]
                    print(f"✅ Transcription successful! Length: {len(transcript)} characters")
                    return transcript
                else:
                    print(f"❌ No transcript found in response: {result}")
                    return None
                    
            else:
                print(f"❌ Gladia API error: {response.status_code} - {response.text}")
                return None
                
    except FileNotFoundError:
        print(f"❌ File not found: {file_path}")
        return None
    except Exception as e:
        print(f"❌ Error during transcription: {str(e)}")
        return None


def _guess_mime_type(filename: str) -> str:
    """Return a best-effort MIME type for the given filename extension."""
    ext = os.path.splitext(filename.lower())[1]
    return {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".flac": "audio/flac",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".mp4": "video/mp4",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
    }.get(ext, "application/octet-stream")


def _extract_transcript(result: dict) -> Optional[str]:
    """Try multiple keys/paths to retrieve transcript text from Gladia response."""
    # Legacy/path used in older docs
    if isinstance(result, dict) and "prediction" in result:
        pred = result["prediction"]
        if isinstance(pred, str):
            return pred
        # If prediction is a list, join all string or dict values
        if isinstance(pred, list):
            texts = []
            for item in pred:
                if isinstance(item, dict):
                    # Try all common keys, prefer 'transcription', then 'transcript', 'text', 'sentence', 'segment'
                    for k in ("transcription", "transcript", "text", "sentence", "segment"):
                        val = item.get(k)
                        if isinstance(val, str):
                            texts.append(val)
                            break
                elif isinstance(item, str):
                    texts.append(item)
            if texts:
                return "\n".join(texts)
        # If prediction is a dict, look for transcript/text keys
        if isinstance(pred, dict):
            for k in ("transcript", "text", "sentence", "segment"):
                if k in pred and isinstance(pred[k], str):
                    return pred[k]

    # Some APIs return a `text` or `transcription` field at root
    for k in ("text", "transcription", "full_text"):
        if isinstance(result, dict) and isinstance(result.get(k), str):
            return result[k]

    # Sometimes nested under `result` or `data`
    for container_key in ("result", "data"):
        container = result.get(container_key)
        if isinstance(container, dict):
            for k in ("text", "transcription", "full_text", "prediction"):
                val = container.get(k)
                if isinstance(val, str):
                    return val
    return None


from typing import Tuple, Union


def transcribe_audio_from_upload(file_content: bytes, filename: str, api_key: str) -> Tuple[Optional[str], Optional[Union[str, dict]]]:
    """
    Transcribes audio directly from uploaded file content (for FastAPI file uploads).
    
    Args:
        file_content (bytes): Raw file content from upload
        filename (str): Original filename
        api_key (str): Gladia API key
        
    Returns:
        (transcript, error):
          - transcript (str | None): Transcribed text on success, None on failure
          - error (str | dict | None): Error details if any
    """
    
    url = "https://api.gladia.io/audio/text/audio-transcription/"
    
    headers = {
        "x-gladia-key": api_key,
        "accept": "application/json",
    }
    
    try:
        # Prepare the file for upload directly from memory with an explicit MIME type
        mime = _guess_mime_type(filename)
        files = {"audio": (filename, file_content, mime)}
        data = {"toggle_diarization": "false", "language_behaviour": "automatic single language"}

        print(f"📤 Sending uploaded file '{filename}' to Gladia API...")
        response = requests.post(url, headers=headers, files=files, data=data, timeout=60)

        if response.status_code == 200:
            try:
                result = response.json()
            except ValueError:
                msg = f"Gladia returned non-JSON 200 response: {response.text[:500]}..."
                print(f"❌ {msg}")
                return None, msg

            transcript = _extract_transcript(result)
            if transcript:
                print(f"✅ Transcription successful! Length: {len(transcript)} characters")
                return transcript, None

            # Log the first few items and their keys/types from the prediction list
            pred = result.get("prediction")
            pred_raw = result.get("prediction_raw")
            print(f"[DEBUG] Gladia 'prediction' type: {type(pred)} length: {len(pred) if isinstance(pred, list) else 'n/a'}")
            if isinstance(pred, list):
                for i, item in enumerate(pred[:3]):
                    print(f"[DEBUG] prediction[{i}] type: {type(item)} value: {repr(item)[:300]}")
                    if isinstance(item, dict):
                        print(f"[DEBUG] prediction[{i}] keys: {list(item.keys())}")
            print(f"[DEBUG] Gladia 'prediction_raw' type: {type(pred_raw)} keys: {list(pred_raw.keys()) if isinstance(pred_raw, dict) else 'n/a'}")

            print(f"❌ No transcript found in response payload. Keys: {list(result.keys())}")
            return None, {"message": "No transcript field in response", "keys": list(result.keys()), "prediction_type": str(type(pred)), "prediction_raw_type": str(type(pred_raw))}
        else:
            # Provide more context on common error shapes
            try:
                err = response.json()
            except ValueError:
                err = {"raw": response.text[:1000]}
            print(f"❌ Gladia API error: {response.status_code} - {err}")
            return None, {"status": response.status_code, "error": err}

    except Exception as e:
        print(f"❌ Error during transcription: {str(e)}")
        return None, str(e)