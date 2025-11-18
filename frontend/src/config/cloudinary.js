/**
 * Cloudinary Configuration for NotulaKika
 * 
 * Handles file uploads to Cloudinary to bypass Vercel file size limits
 */

// Cloudinary configuration
export const CLOUDINARY_CONFIG = {
  cloudName: 'ddpwyzjdr', // Your cloud name from CLOUDINARY_URL
  uploadPreset: 'notulakika_audio', // Unsigned upload preset (create in Cloudinary dashboard)
  apiUrl: 'https://api.cloudinary.com/v1_1/ddpwyzjdr/upload'
};

/**
 * Upload file to Cloudinary
 * @param {File|Blob} file - File to upload
 * @param {Function} onProgress - Progress callback (optional)
 * @returns {Promise<Object>} Cloudinary response
 */
export const uploadToCloudinary = async (file, onProgress = null) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
  formData.append('resource_type', 'auto'); // Auto detect file type
  formData.append('folder', 'notulakika/audio'); // Organize files in folder

  try {
    const xhr = new XMLHttpRequest();
    
    return new Promise((resolve, reject) => {
      // Setup progress tracking
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            onProgress(percentComplete);
          }
        });
      }

      // Setup response handlers
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch (error) {
            reject(new Error('Invalid response format'));
          }
        } else {
          reject(new Error(`Upload failed with status: ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      // Configure and send request
      xhr.timeout = 300000; // 5 minutes timeout
      xhr.open('POST', CLOUDINARY_CONFIG.apiUrl);
      xhr.send(formData);
    });

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
};

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Validate audio/video file type
 * @param {File} file - File to validate
 * @returns {boolean} Is valid audio/video file
 */
export const isValidAudioVideo = (file) => {
  const allowedTypes = [
    'audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a',
    'audio/aac', 'audio/flac', 'audio/webm',
    'video/mp4', 'video/avi', 'video/mov', 'video/webm', 'video/quicktime'
  ];
  
  const allowedExtensions = [
    '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.webm',
    '.mp4', '.avi', '.mov', '.quicktime'
  ];
  
  // Check MIME type
  if (allowedTypes.includes(file.type)) {
    return true;
  }
  
  // Fallback: check file extension
  const fileName = file.name.toLowerCase();
  return allowedExtensions.some(ext => fileName.endsWith(ext));
};
