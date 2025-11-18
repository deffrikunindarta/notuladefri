"""
Gemini API Integration Module (Google GenAI SDK)

This module handles the interaction with Google's Gemini API using the official
google-genai SDK. It takes transcribed text and returns a structured summary.

Docs: https://ai.google.dev/gemini-api/docs
"""

import requests
import json
from typing import Optional, Dict
from google import genai
from google.genai import types


def generate_meeting_summary(transcript: str, api_key: str) -> Optional[Dict[str, str]]:
    """
    Sends transcribed text to Gemini 1.5 Flash API for meeting summarization.
    
    Args:
        transcript (str): The transcribed text from the meeting
        api_key (str): Gemini API key from environment variables
        
    Returns:
        dict: Structured summary with agenda, summary, and action items
        None: If summarization fails
        
    Flow:
        1. Create a detailed prompt for meeting summarization
        2. Send POST request to Gemini API
        3. Extract and structure the summary response
        4. Return formatted summary object
    """
    # Preferred model order using the SDK. We'll try these in sequence.
    candidate_models = [
        "gemini-2.5-flash",  # fast and supports Thinking
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro-latest",
        "gemini-1.5-pro",
    ]
    
    # Create a comprehensive prompt for meeting summarization
    prompt = f"""
    Analisis transkrip rapat berikut dan berikan ringkasan terstruktur PERSIS dalam format di bawah ini dalam bahasa Indonesia.
    PENTING: Gunakan format heading yang TEPAT seperti contoh ini:

    **AGENDA:**
    - [Daftar topik utama yang dibahas dalam rapat, dalam bentuk bullet points]

    **RINGKASAN:**
    [Berikan ringkasan singkat dari diskusi utama, keputusan yang dibuat, dan poin penting yang dibahas. Jangan sertakan agenda atau action items di sini.]

    **ACTION ITEMS:**
    - [Daftar tugas spesifik, penugasan, atau tindak lanjut yang disebutkan dalam rapat, dalam bentuk bullet points]

    Transkrip Rapat:
    {transcript}

    INSTRUKSI PENTING:
    1. Gunakan TEPAT format heading: **AGENDA:**, **RINGKASAN:**, **ACTION ITEMS:**
    2. Agenda dan Action Items harus dalam bentuk bullet points (gunakan -)
    3. Ringkasan harus terpisah dan tidak berisi agenda atau action items
    4. Gunakan bahasa Indonesia untuk semua respons
    5. Jika tidak ada informasi untuk salah satu bagian, tulis "Tidak tersedia"
    """
    
    # Request payload for Gemini API
    # Build SDK client
    try:
        client = genai.Client(api_key=api_key) if api_key else genai.Client()
    except Exception as e:
        print(f"❌ Failed to initialize Google GenAI client: {e}")
        return {"_error": True, "status": None, "details": str(e)}
    
    try:
        print(f"🤖 Sending transcript to Gemini API (SDK) for summarization...")
        print(f"📝 Transcript length: {len(transcript)} characters")

        last_err = None
        for model in candidate_models:
            print(f"🌐 Trying model via SDK: {model}")
            try:
                resp = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        temperature=0.3,
                        max_output_tokens=800,
                        top_p=0.9,
                        top_k=40,
                        thinking_config=types.ThinkingConfig(thinking_budget=0) if model.startswith("gemini-2.5-") else None,
                    ),
                )
                text = getattr(resp, "text", None)
                if not text:
                    # Attempt to extract from candidates if available
                    try:
                        cands = getattr(resp, "candidates", []) or []
                        if cands:
                            parts = cands[0].get("content", {}).get("parts", [])
                            text = parts[0].get("text") if parts else None
                    except Exception:
                        pass
                if text:
                    print("✅ Summary generated successfully via SDK!")
                    print(f"📄 Summary length: {len(text)} characters")
                    return parse_gemini_response(text)
                else:
                    last_err = {"error": "no_text", "model": model}
                    print(f"⚠️ SDK returned no text for model {model}")
            except Exception as e:
                last_err = {"error": str(e), "model": model}
                print(f"❌ SDK error for model {model}: {e}")

        print(f"❌ All SDK model attempts failed. Last error: {last_err}")
        return {"_error": True, "status": None, "details": last_err}

    except Exception as e:
        print(f"❌ Error during summarization: {str(e)}")
        return {"_error": True, "status": None, "details": str(e)}


def parse_gemini_response(generated_text: str) -> Dict[str, str]:
    """
    Parses the Gemini response to extract structured summary sections.
    
    Args:
        generated_text (str): Raw response from Gemini API
        
    Returns:
        dict: Structured summary with agenda, summary, and action_items keys
    """
    
    # Initialize the response structure
    summary_data = {
        "agenda": "",
        "summary": "",
        "action_items": ""
    }
    
    try:
        # Split the response into lines for parsing
        lines = generated_text.strip().split('\n')
        current_section = None
        section_content = []
        
        for line in lines:
            line = line.strip()
            
            # Check for section headers (both formats)
            if (line.lower().startswith('**agenda:**') or 
                line.lower().startswith('agenda:') or
                'agenda' in line.lower() and ':' in line):
                if current_section and section_content:
                    summary_data[current_section] = '\n'.join(section_content).strip()
                current_section = "agenda"
                section_content = []
                # Add any content after the header on the same line
                if ':' in line:
                    after_colon = line.split(':', 1)[1].strip()
                    if after_colon and after_colon != '**':
                        section_content.append(after_colon)
                    
            elif (line.lower().startswith('**ringkasan:**') or 
                  line.lower().startswith('ringkasan:') or
                  line.lower().startswith('**summary:**') or
                  line.lower().startswith('summary:') or
                  ('ringkasan' in line.lower() and ':' in line) or
                  ('summary' in line.lower() and ':' in line)):
                if current_section and section_content:
                    summary_data[current_section] = '\n'.join(section_content).strip()
                current_section = "summary"
                section_content = []
                # Add any content after the header on the same line
                if ':' in line:
                    after_colon = line.split(':', 1)[1].strip()
                    if after_colon and after_colon != '**':
                        section_content.append(after_colon)
                    
            elif (line.lower().startswith('**action items:**') or 
                  line.lower().startswith('action items:') or
                  ('action items' in line.lower() and ':' in line)):
                if current_section and section_content:
                    summary_data[current_section] = '\n'.join(section_content).strip()
                current_section = "action_items"
                section_content = []
                # Add any content after the header on the same line
                if ':' in line:
                    after_colon = line.split(':', 1)[1].strip()
                    if after_colon and after_colon != '**':
                        section_content.append(after_colon)
                    
            elif current_section and line and not line.startswith('**'):
                # Add content to current section, skip markdown formatting
                clean_line = line.replace('*', '').strip()
                if clean_line:
                    section_content.append(clean_line)
        
        # Don't forget the last section
        if current_section and section_content:
            summary_data[current_section] = '\n'.join(section_content).strip()
        
        # Fallback: if parsing fails, put everything in summary
        if not any(summary_data.values()):
            summary_data["summary"] = generated_text.strip()
            summary_data["agenda"] = "Tidak dapat mengurai agenda dari transkrip"
            summary_data["action_items"] = "Tidak dapat mengurai action items dari transkrip"
        
        return summary_data
        
    except Exception as e:
        print(f"⚠️ Error parsing Gemini response: {str(e)}")
        # Fallback response
        return {
            "agenda": "Error saat mengurai agenda",
            "summary": generated_text.strip(),
            "action_items": "Error saat mengurai action items"
        }


def format_summary_for_frontend(summary_data: Dict[str, str]) -> Dict[str, str]:
    """
    Formats the summary data for frontend display.
    
    Args:
        summary_data (dict): Parsed summary data
        
    Returns:
        dict: Formatted summary ready for frontend consumption
    """
    
    # Create a nicely formatted summary string
    formatted_summary = f"""Agenda:
{summary_data.get('agenda', 'Tidak ada agenda yang teridentifikasi')}

Ringkasan:
{summary_data.get('summary', 'Tidak ada ringkasan tersedia')}

Action Items:
{summary_data.get('action_items', 'Tidak ada action items yang teridentifikasi')}"""

    return {
        "summary": formatted_summary,
        "agenda": summary_data.get('agenda', 'Tidak ada agenda yang teridentifikasi'),
        "key_points": summary_data.get('summary', 'Tidak ada ringkasan tersedia'),
        "action_items": summary_data.get('action_items', 'Tidak ada action items yang teridentifikasi')
    }