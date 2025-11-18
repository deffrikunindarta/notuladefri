"""
AI Meeting Assistant - FastAPI Backend

This is the main FastAPI application that serves as the backend for the AI Meeting Assistant.
It provides an endpoint to upload audio/video files, transcribe them using Gladia API,
and summarize them using Gemini 1.5 Flash API.

Pipeline Flow:
1. User uploads audio/video file via /upload endpoint
2. File is sent to Gladia API for transcription
3. Transcript is sent to Gemini API for structured summarization
4. Structured summary is returned to frontend

Author: AI Meeting Assistant Team
Version: 1.0.0 (MVP)
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import uvicorn

# Import our custom API utilities
from utils.gladia_api import transcribe_audio_from_upload
from utils.gemini_api import generate_meeting_summary, format_summary_for_frontend
from utils.cloudinary_utils import (
    configure_cloudinary, 
    download_file_from_cloudinary, 
    cleanup_temp_file
)

# Load environment variables from .env file (check project root first, then backend/)
load_dotenv(dotenv_path="../.env")  # Try project root first
load_dotenv()  # Fallback to backend/.env if exists

# Configure Cloudinary
configure_cloudinary()

# Initialize FastAPI app
app = FastAPI(
    title="NotulaKika API",
    description="Upload meeting audio/video files for automatic transcription and summarization",
    version="1.0.0"
)

# Configure CORS middleware to allow frontend connections
# This enables the React frontend to make requests to this API
# Configure origins based on environment
allowed_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://notulakika.vercel.app",  # Your production frontend domain
]

# Add production origins from environment variable
production_origin = os.getenv("FRONTEND_URL")
if production_origin:
    allowed_origins.append(production_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Get API keys from environment variables
GLADIA_API_KEY = os.getenv("GLADIA_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL")

# Validate API keys on startup
if not GLADIA_API_KEY:
    raise ValueError("❌ GLADIA_API_KEY not found in environment variables")
if not GEMINI_API_KEY:
    raise ValueError("❌ GEMINI_API_KEY not found in environment variables")
if not CLOUDINARY_URL:
    raise ValueError("❌ CLOUDINARY_URL not found in environment variables")

print("✅ API keys loaded successfully")
print(f"🔑 Gladia API Key: {GLADIA_API_KEY[:10]}...")
print(f"🔑 Gemini API Key: {GEMINI_API_KEY[:10]}...")
print(f"☁️ Cloudinary URL: {CLOUDINARY_URL[:20]}...")

# Data models
class TranscribeURLRequest(BaseModel):
    file_url: str
    file_name: str
    file_size: int
    cloudinary_public_id: str = None


@app.get("/")
async def root():
    """
    Health check endpoint to verify the API is running.
    
    Returns:
        dict: Status message and available endpoints
    """
    return {
        "message": "🎯 NotulaKika - AI Meeting Assistant API is running!",
        "version": "1.0.0",
        "endpoints": {
            "transcribe": "/transcribe - POST - Upload audio/video file for transcription only",
            "transcribe-url": "/transcribe-url - POST - Transcribe from Cloudinary URL",
            "summarize": "/summarize - POST - Generate AI summary from transcript text",
            "upload": "/upload - POST - Upload and process file (full pipeline - legacy)",
            "health": "/ - GET - Health check"
        },
        "workflow": "📁 Upload → ☁️ Cloudinary → 🎵 Transcribe → 🤖 Summarize",
        "status": "✅ Ready to process meeting files",
        "features": ["🚀 No file size limits", "☁️ Cloudinary integration", "🌐 Global CDN"]
    }


@app.post("/transcribe")
async def transcribe_only(file: UploadFile = File(...)):
    """
    Endpoint for transcription only - first step of the separated workflow.
    
    Args:
        file (UploadFile): Audio/video file uploaded by user
        
    Returns:
        JSONResponse: Transcribed text only
    """
    
    # Validate file upload
    if not file:
        raise HTTPException(status_code=400, detail="❌ No file uploaded")
    
    # Check file size (limit to 100MB for MVP)
    content = await file.read()
    file_size = len(content)
    
    if file_size > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=413, detail="❌ File too large. Maximum size is 100MB")
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="❌ Empty file uploaded")
    
    # Validate file type
    allowed_extensions = ['.mp3', '.wav', '.mp4', '.avi', '.mov', '.m4a', '.flac', '.ogg']
    file_extension = os.path.splitext(file.filename.lower())[1]
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"❌ Unsupported file type: {file_extension}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    print(f"📁 Transcribing file: {file.filename}")
    
    try:
        # Transcribe audio using Gladia API
        transcript, transcribe_error = transcribe_audio_from_upload(
            file_content=content,
            filename=file.filename,
            api_key=GLADIA_API_KEY
        )
        
        if not transcript:
            raise HTTPException(
                status_code=500, 
                detail={
                    "message": "❌ Failed to transcribe audio. Please check file format and try again.",
                    "provider": "gladia",
                    "error": transcribe_error
                }
            )
        
        print(f"✅ Transcription completed. Length: {len(transcript)} characters")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "✅ Transcription completed successfully!",
                "data": {
                    "filename": file.filename,
                    "file_size_mb": round(file_size / (1024*1024), 2),
                    "transcript": transcript,
                    "transcript_length": len(transcript)
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error during transcription: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"❌ Internal server error: {str(e)}"
        )


@app.post("/summarize")
async def summarize_transcript(request: Request):
    """
    Endpoint for summarization only - second step of the separated workflow.
    
    Args:
        request (Request): JSON request with transcript text
        
    Returns:
        JSONResponse: AI-generated summary
    """
    
    try:
        body = await request.json()
        transcript = body.get("transcript", "").strip()
    except Exception:
        raise HTTPException(status_code=400, detail="❌ Invalid JSON request")
    
    if not transcript:
        raise HTTPException(status_code=400, detail="❌ No transcript provided")
    
    if len(transcript) < 10:
        raise HTTPException(status_code=400, detail="❌ Transcript too short to summarize")
    
    print(f"🤖 Summarizing transcript of {len(transcript)} characters")
    
    try:
        # Generate summary using Gemini API
        summary_data = generate_meeting_summary(
            transcript=transcript,
            api_key=GEMINI_API_KEY
        )
        
        if not summary_data or summary_data.get("_error"):
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "❌ Failed to generate summary from Gemini.",
                    "provider": "gemini",
                    "error": summary_data.get("details") if isinstance(summary_data, dict) else "Gemini API failed",
                }
            )
        
        # Format response for frontend
        formatted_summary = format_summary_for_frontend(summary_data)
        
        print("✅ Summarization completed successfully!")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "✅ Summary generated successfully!",
                "data": {
                    "transcript_length": len(transcript),
                    "summary": formatted_summary["summary"],
                    "structured_data": {
                        "agenda": formatted_summary["agenda"],
                        "key_points": formatted_summary["key_points"],
                        "action_items": formatted_summary["action_items"]
                    }
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error during summarization: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"❌ Internal server error: {str(e)}"
        )


@app.post("/transcribe-url")
async def transcribe_from_cloudinary_url(request: TranscribeURLRequest):
    """
    Transcribe audio from Cloudinary URL - bypasses Vercel file size limits
    
    Args:
        request: TranscribeURLRequest with Cloudinary file details
        
    Returns:
        JSONResponse: Transcribed text only
    """
    temp_file_path = None
    
    try:
        print(f"📁 Processing Cloudinary file: {request.file_name}")
        print(f"📊 File size: {request.file_size / (1024*1024):.2f} MB")
        print(f"🔗 File URL: {request.file_url}")
        
        # Step 1: Download file from Cloudinary
        temp_file_path = download_file_from_cloudinary(request.file_url)
        if not temp_file_path:
            raise HTTPException(
                status_code=500, 
                detail="❌ Failed to download file from Cloudinary"
            )
        
        # Step 2: Transcribe using Gladia API
        print(f"🎵 Starting transcription...")
        
        # Read file content for Gladia API
        with open(temp_file_path, 'rb') as f:
            file_content = f.read()
        
        transcript, transcribe_error = transcribe_audio_from_upload(
            file_content=file_content,
            filename=request.file_name,
            api_key=GLADIA_API_KEY
        )
        
        if not transcript:
            raise HTTPException(
                status_code=500, 
                detail={
                    "message": "❌ Failed to transcribe audio. Please check file format and try again.",
                    "provider": "gladia",
                    "error": transcribe_error
                }
            )
        
        print(f"✅ Transcription completed. Length: {len(transcript)} characters")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "✅ Transcription completed successfully!",
                "data": {
                    "filename": request.file_name,
                    "file_size_mb": round(request.file_size / (1024*1024), 2),
                    "transcript": transcript,
                    "transcript_length": len(transcript),
                    "cloudinary_url": request.file_url
                }
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected error during transcription: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"❌ Internal server error: {str(e)}"
        )
    finally:
        # Always cleanup temporary file
        if temp_file_path:
            cleanup_temp_file(temp_file_path)


@app.post("/upload")
async def upload_and_process_meeting(file: UploadFile = File(...)):
    """
    Main endpoint for uploading and processing meeting audio/video files.
    
    This endpoint orchestrates the entire pipeline:
    1. Receives uploaded file from frontend
    2. Validates file type and size
    3. Sends file to Gladia API for transcription
    4. Sends transcript to Gemini API for summarization
    5. Returns structured summary to frontend
    
    Args:
        file (UploadFile): Audio/video file uploaded by user
        
    Returns:
        JSONResponse: Structured meeting summary with agenda, key points, and action items
        
    Raises:
        HTTPException: If file processing fails at any stage
    """
    
    # Validate file upload
    if not file:
        raise HTTPException(status_code=400, detail="❌ No file uploaded")
    
    # Check file size (limit to 100MB for MVP)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    
    if file_size > 100 * 1024 * 1024:  # 100MB limit
        raise HTTPException(status_code=413, detail="❌ File too large. Maximum size is 100MB")
    
    if file_size == 0:
        raise HTTPException(status_code=400, detail="❌ Empty file uploaded")
    
    # Validate file type (basic check)
    allowed_extensions = ['.mp3', '.wav', '.mp4', '.avi', '.mov', '.m4a', '.flac', '.ogg']
    file_extension = os.path.splitext(file.filename.lower())[1]
    
    if file_extension not in allowed_extensions:
        raise HTTPException(
            status_code=400, 
            detail=f"❌ Unsupported file type: {file_extension}. Allowed: {', '.join(allowed_extensions)}"
        )
    
    print(f"📁 Processing file: {file.filename}")
    print(f"📊 File size: {file_size / (1024*1024):.2f} MB")
    print(f"🎵 File type: {file_extension}")
    
    try:
        # Step 1: Transcribe audio using Gladia API
        print("\n🎯 Step 1: Starting transcription with Gladia API...")
        transcript, transcribe_error = transcribe_audio_from_upload(
            file_content=content,
            filename=file.filename,
            api_key=GLADIA_API_KEY
        )
        
        if not transcript:
            raise HTTPException(
                status_code=500, 
                detail={
                    "message": "❌ Failed to transcribe audio. Please check file format and try again.",
                    "provider": "gladia",
                    "error": transcribe_error
                }
            )
        
        print(f"✅ Transcription completed. Length: {len(transcript)} characters")
        
        # Step 2: Generate summary using Gemini API
        print("\n🎯 Step 2: Starting summarization with Gemini API...")
        summary_data = generate_meeting_summary(
            transcript=transcript,
            api_key=GEMINI_API_KEY
        )
        
        if not summary_data or summary_data.get("_error"):
            raise HTTPException(
                status_code=502,
                detail={
                    "message": "❌ Failed to generate summary from Gemini. Please verify the model availability and try again.",
                    "provider": "gemini",
                    "error": summary_data.get("details") if isinstance(summary_data, dict) else "All Gemini endpoints failed or returned no candidates",
                    "status": summary_data.get("status") if isinstance(summary_data, dict) else None,
                }
            )
        
        # Step 3: Format response for frontend
        print("\n🎯 Step 3: Formatting response for frontend...")
        formatted_summary = format_summary_for_frontend(summary_data)
        
        print("✅ Processing completed successfully!")
        
        # Return structured response
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "message": "✅ Meeting processed successfully!",
                "data": {
                    "filename": file.filename,
                    "file_size_mb": round(file_size / (1024*1024), 2),
                    "transcript_length": len(transcript),
                    "transcript": transcript,  # Add full transcript
                    "summary": formatted_summary["summary"],
                    "structured_data": {
                        "agenda": formatted_summary["agenda"],
                        "key_points": formatted_summary["key_points"],
                        "action_items": formatted_summary["action_items"]
                    }
                }
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        print(f"❌ Unexpected error during processing: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"❌ Internal server error: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """
    Detailed health check endpoint for monitoring.
    
    Returns:
        dict: System status and API key availability
    """
    return {
        "status": "healthy",
        "timestamp": "2024-01-01T00:00:00Z",
        "api_keys": {
            "gladia": "✅ Available" if GLADIA_API_KEY else "❌ Missing",
            "gemini": "✅ Available" if GEMINI_API_KEY else "❌ Missing"
        },
        "version": "1.0.0"
    }


# Vercel serverless handler
handler = app

# Run the application
if __name__ == "__main__":
    print("🚀 Starting AI Meeting Assistant API...")
    print("📡 Server will be available at: http://localhost:8000")
    print("📖 API Documentation: http://localhost:8000/docs")
    print("🔄 Auto-reload enabled for development")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload for development
        log_level="info"
    )