"""
Cloudinary utilities for handling file uploads and downloads
"""

import cloudinary
import cloudinary.uploader
import cloudinary.api
import requests
import tempfile
import os
from typing import Optional

# Configure Cloudinary using environment variable
def configure_cloudinary():
    """Configure Cloudinary from CLOUDINARY_URL environment variable"""
    cloudinary_url = os.getenv("CLOUDINARY_URL")
    if cloudinary_url:
        # Parse the CLOUDINARY_URL (format: cloudinary://api_key:api_secret@cloud_name)
        import re
        match = re.match(r"cloudinary://([^:]+):([^@]+)@(.+)", cloudinary_url)
        if match:
            api_key, api_secret, cloud_name = match.groups()
            cloudinary.config(
                cloud_name=cloud_name,
                api_key=api_key,
                api_secret=api_secret,
                secure=True
            )
            print(f"✅ Cloudinary configured for cloud: {cloud_name}")
            return True
        else:
            print("❌ Invalid CLOUDINARY_URL format")
            return False
    else:
        print("❌ CLOUDINARY_URL not found in environment")
        return False

def download_file_from_cloudinary(file_url: str) -> Optional[str]:
    """
    Download file from Cloudinary URL to temporary file
    
    Args:
        file_url (str): Cloudinary secure URL
        
    Returns:
        str: Path to temporary file or None if failed
    """
    try:
        print(f"📥 Downloading file from Cloudinary: {file_url}")
        
        # Download file
        response = requests.get(file_url, stream=True, timeout=300)
        response.raise_for_status()
        
        # Determine file extension from URL or content type
        file_extension = '.wav'  # Default
        if 'audio/mp3' in response.headers.get('content-type', ''):
            file_extension = '.mp3'
        elif 'audio/wav' in response.headers.get('content-type', ''):
            file_extension = '.wav'
        elif 'video/mp4' in response.headers.get('content-type', ''):
            file_extension = '.mp4'
        elif file_url.lower().endswith(('.mp3', '.wav', '.mp4', '.m4a', '.flac', '.ogg')):
            file_extension = '.' + file_url.split('.')[-1].split('?')[0]
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        
        # Write content in chunks
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                temp_file.write(chunk)
        
        temp_file.close()
        
        # Verify file size
        file_size = os.path.getsize(temp_file.name)
        print(f"✅ File downloaded successfully: {file_size} bytes")
        
        return temp_file.name
        
    except requests.exceptions.RequestException as e:
        print(f"❌ Error downloading from Cloudinary: {e}")
        return None
    except Exception as e:
        print(f"❌ Unexpected error downloading file: {e}")
        return None

def cleanup_temp_file(file_path: str) -> None:
    """
    Clean up temporary file
    
    Args:
        file_path (str): Path to temporary file to delete
    """
    try:
        if file_path and os.path.exists(file_path):
            os.unlink(file_path)
            print(f"🗑️  Temporary file cleaned up: {file_path}")
    except Exception as e:
        print(f"⚠️  Error cleaning up temp file {file_path}: {e}")

def get_cloudinary_info(public_id: str) -> Optional[dict]:
    """
    Get information about a Cloudinary resource
    
    Args:
        public_id (str): Cloudinary public ID
        
    Returns:
        dict: Resource information or None if failed
    """
    try:
        result = cloudinary.api.resource(public_id, resource_type="auto")
        return result
    except Exception as e:
        print(f"❌ Error getting Cloudinary info for {public_id}: {e}")
        return None
