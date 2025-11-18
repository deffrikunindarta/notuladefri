import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { API_BASE_URL } from '../config';
import { 
  uploadToCloudinary, 
  formatFileSize, 
  isValidAudioVideo 
} from '../config/cloudinary';

// NotulaKika - AI Meeting Assistant UI with separated transcription and summarization
export default function UploadComponent() {
  // State
  const [selectedFile, setSelectedFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [transcriptionComplete, setTranscriptionComplete] = useState(false);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [notesCharCount, setNotesCharCount] = useState(0);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [transcribeStatus, setTranscribeStatus] = useState('');
  
  // Recording states
  const [activeTab, setActiveTab] = useState('record'); // 'record' or 'upload'
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  
  // Refs for recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  
  // File and audio blob state
  const [file, setFile] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);

  // Cleanup effect for recording resources
  useEffect(() => {
    return () => {
      // Cleanup on component unmount
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Use environment configuration

  // Handle file selection with Cloudinary validation
  const handleFileSelect = (event) => {
    const selectedFile = event.target.files?.[0];
    setError(null);
    setSummary(null);
    setTranscript('');
    setUploadProgress(0);
    setTranscriptionComplete(false);
    setTranscribeStatus('');

    if (!selectedFile) {
      setFile(null);
      return;
    }

    // Validate file type
    if (!isValidAudioVideo(selectedFile)) {
      setError('Silakan pilih file audio/video yang valid (MP3, WAV, MP4, AVI, MOV, M4A, FLAC, OGG).');
      setFile(null);
      event.target.value = '';
      return;
    }

    // No file size limit with Cloudinary!
    setFile(selectedFile);
    console.log(`File selected: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
  };

  // Transcribe with Cloudinary upload
  const handleTranscribeWithCloudinary = async () => {
    // Determine which file to use
    let fileToTranscribe = null;
    let filename = '';

    if (activeTab === 'record' && audioBlob) {
      fileToTranscribe = audioBlob;
      filename = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.wav`;
    } else if (activeTab === 'upload' && file) {
      fileToTranscribe = file;
      filename = file.name;
    }

    if (!fileToTranscribe) {
      setError('Silakan rekam audio atau pilih file terlebih dahulu.');
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setTranscript('');
    setUploadProgress(0);
    setTranscribeStatus('Mengupload file ke cloud...');

    try {
      // Step 1: Upload to Cloudinary
      const cloudinaryResponse = await uploadToCloudinary(fileToTranscribe, (progress) => {
        setUploadProgress(Math.round(progress * 0.3)); // Upload is 30% of total progress
        setTranscribeStatus(`Mengupload file... ${Math.round(progress)}%`);
      });

      console.log('Cloudinary upload success:', cloudinaryResponse);
      setUploadProgress(30);
      setTranscribeStatus('Memproses transkrip...');

      // Step 2: Send Cloudinary URL to backend for transcription
      const response = await axios.post(`${API_BASE_URL}/transcribe-url`, {
        file_url: cloudinaryResponse.secure_url,
        file_name: filename,
        file_size: cloudinaryResponse.bytes,
        cloudinary_public_id: cloudinaryResponse.public_id
      }, {
        timeout: 300000, // 5 minutes
      });

      setUploadProgress(100);

      if (response.data?.success) {
        setTranscript(response.data.data.transcript);
        setTranscriptionComplete(true);
        setTranscribeStatus('');
      } else {
        throw new Error(response.data?.message || 'Transcription failed');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setUploadProgress(0);
      setTranscribeStatus('');
      
      if (err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (detail) {
          setError(`Error: ${err.response.data?.message || 'Server error occurred.'}`);
        } else {
          setError(err.response.data?.message || `Server error (${err.response.status})`);
        }
      } else if (err.message.includes('Upload failed')) {
        setError('Gagal mengupload file. Silakan periksa koneksi internet dan coba lagi.');
      } else {
        setError('Terjadi kesalahan saat memproses file. Silakan coba lagi.');
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  // Legacy transcribe function (keep for fallback)
  const handleTranscribe = async () => {
    // Determine which file to use
    let fileToTranscribe = null;
    let filename = '';

    if (activeTab === 'record' && audioBlob) {
      fileToTranscribe = audioBlob;
      filename = `recording_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.wav`;
    } else if (activeTab === 'upload' && selectedFile) {
      fileToTranscribe = selectedFile;
      filename = selectedFile.name;
    }

    if (!fileToTranscribe) {
      setError('Please record audio or choose a file first.');
      return;
    }

    setIsTranscribing(true);
    setError(null);
    setTranscript('');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', fileToTranscribe, filename);

      const response = await axios.post(`${API_BASE_URL}/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (evt) => {
          if (!evt.total) return;
          const pct = Math.round((evt.loaded * 100) / evt.total);
          setUploadProgress(pct);
        },
        timeout: 300000, // 5 min
      });

      if (response.data?.success) {
        setTranscript(response.data.data.transcript);
        setTranscriptionComplete(true);
        setUploadProgress(100);
      } else {
        const detail = response.data?.detail;
        if (detail) {
          setError(typeof detail === 'string' ? detail : {
            message: response.data?.message || 'Transcription failed',
            detail
          });
        } else {
          throw new Error(response.data?.message || 'Transcription failed');
        }
      }
    } catch (err) {
      if (err.response) {
        const detail = err.response.data?.detail;
        if (typeof detail === 'string') {
          setError(detail);
        } else if (detail) {
          setError({
            message: err.response.data?.message || 'Server error occurred.',
            status: err.response.status,
            provider: detail?.provider || 'gladia',
            error: detail?.error || detail
          });
        } else {
          setError(err.response.data?.message || `Server error (${err.response.status})`);
        }
      } else if (err.request) {
        setError('Unable to reach backend at http://127.0.0.1:8000. Is it running?');
      } else {
        setError(`Transcription failed: ${err.message}`);
      }
      setUploadProgress(0);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Separate function for summarization
  const handleSummarize = async () => {
    if (!transcript) {
      setError('Please transcribe the audio first.');
      return;
    }

    setIsSummarizing(true);
    setError(null);

    try {
      // Combine transcript with additional notes if available
      const combinedText = additionalNotes.trim() 
        ? `${transcript}\n\nCatatan Tambahan:\n${additionalNotes}`
        : transcript;

      const response = await axios.post(`${API_BASE_URL}/summarize`, {
        transcript: combinedText
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 120000, // 2 min
      });

      if (response.data?.success) {
        setSummary(response.data.data);
      } else {
        const detail = response.data?.detail;
        setError(detail || 'Summarization failed');
      }
    } catch (err) {
      if (err.response) {
        setError(err.response.data?.message || `Summarization error (${err.response.status})`);
      } else if (err.request) {
        setError('Unable to reach backend for summarization.');
      } else {
        setError(`Summarization failed: ${err.message}`);
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSummary(null);
    setError(null);
    setUploadProgress(0);
    setIsTranscribing(false);
    setIsSummarizing(false);
    setTranscript('');
    setTranscriptionComplete(false);
    setAdditionalNotes('');
    setNotesCharCount(0);
    setShowFullTranscript(false);
    
    // Reset recording states
    discardRecording();
    setActiveTab('record');
    
    const input = document.getElementById('file-input');
    if (input) input.value = '';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  // Generate PDF function
  const generatePDF = () => {
    if ((!summary || !summary.structured_data) && !transcript) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = 30;

    // Helper function to add text with word wrapping
    const addWrappedText = (text, x, y, maxWidth, fontSize = 11) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", "normal"); // Changed from default to normal
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + (lines.length * (fontSize * 0.35));
    };

    // Header
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text('Wawasan Meeting - NotulaKika AI', margin, yPosition);
    
    // Date
    yPosition += 15;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${new Date().toLocaleDateString('id-ID', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`, margin, yPosition);

    // File info
    if (selectedFile?.name) {
      yPosition += 10;
      doc.text(`File: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`, margin, yPosition);
    }

    yPosition += 20;

    // Add Transcript Section first
    if (transcript) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text('Transkrip Audio', margin, yPosition);
      yPosition += 10;
      
      // Add transcript content with smaller font
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const transcriptLines = doc.splitTextToSize(transcript, contentWidth);
      
      // Check if transcript is too long and needs multiple pages
      const linesPerPage = Math.floor((doc.internal.pageSize.height - 60) / 4); // Approximate lines per page
      
      for (let i = 0; i < transcriptLines.length; i++) {
        if (yPosition > doc.internal.pageSize.height - 30) {
          doc.addPage();
          yPosition = 30;
        }
        doc.text(transcriptLines[i], margin, yPosition);
        yPosition += 4;
      }
      
      yPosition += 15; // Extra space before next section
    }

    // Add sections
    if (summary.structured_data.key_points) {
      // Executive Summary
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text('Ringkasan Eksekutif', margin, yPosition);
      yPosition += 10;
      
      yPosition = addWrappedText(summary.structured_data.key_points, margin, yPosition, contentWidth);
      yPosition += 15;
    }

    if (summary.structured_data.agenda) {
      // Check if we need a new page
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 30;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text('Poin Diskusi Utama', margin, yPosition);
      yPosition += 10;
      
      const agendaPoints = summary.structured_data.agenda.split('\n').filter(line => line.trim());
      agendaPoints.forEach((point, index) => {
        const cleanPoint = point.replace(/^[•\-\*]\s*/, '');
        yPosition = addWrappedText(`• ${cleanPoint}`, margin, yPosition, contentWidth);
        yPosition += 5;
      });
      yPosition += 10;
    }

    if (summary.structured_data.action_items) {
      // Check if we need a new page
      if (yPosition > 220) {
        doc.addPage();
        yPosition = 30;
      }

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text('Catatan Terorganisir Detail', margin, yPosition);
      yPosition += 10;
      
      yPosition = addWrappedText(summary.structured_data.action_items, margin, yPosition, contentWidth);
    }

    // Footer
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`NotulaKika AI - Page ${i} of ${totalPages}`, margin, doc.internal.pageSize.height - 10);
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const fileName = `meeting-summary-${timestamp}.pdf`;
    
    // Save the PDF
    doc.save(fileName);
  };

  // Handle notes input with character count
  const handleNotesChange = (e) => {
    const value = e.target.value;
    setAdditionalNotes(value);
    setNotesCharCount(value.length);
  };

  // Truncate transcript for "read more" functionality
  const truncateTranscript = (text, maxLength = 500) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    
    // Find the last complete sentence within the limit
    const truncated = text.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf('.'),
      truncated.lastIndexOf('!'),
      truncated.lastIndexOf('?')
    );
    
    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }
    
    // If no sentence end found, just truncate at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  };

  const toggleTranscriptView = () => {
    setShowFullTranscript(!showFullTranscript);
  };

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      // Reset chunks
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(blob);
        setRecordedAudioUrl(URL.createObjectURL(blob));
        
        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      streamRef.current = stream;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      intervalRef.current = timer;

    } catch (err) {
      setError('Unable to access microphone. Please check permissions.');
      console.error('Error accessing microphone:', err);
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      clearInterval(intervalRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      intervalRef.current = timer;
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      clearInterval(intervalRef.current);
      setIsRecording(false);
      setIsPaused(false);
      
      // Stop all tracks to release microphone
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const discardRecording = () => {
    // Alias untuk resetToInitialRecordingState untuk backward compatibility
    resetToInitialRecordingState();
  };

  const resetToInitialRecordingState = () => {
    // Clean up refs terlebih dahulu untuk menghindari event handler
    if (mediaRecorderRef.current) {
      // Remove event handlers untuk mencegah onstop dari mengeset audioBlob
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.ondataavailable = null;
      
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      clearInterval(intervalRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Reset semua state recording kembali ke tampilan awal
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setRecordedAudioUrl(null);
    setError('');
    setTranscript('');
    setSummary(null);
    setTranscriptionComplete(false);
    
    // Clean up refs
    mediaRecorderRef.current = null;
    streamRef.current = null;
    audioChunksRef.current = [];
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-6 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo/Icon */}
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              
              {/* Brand */}
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  NotulaKika
                </h1>
                <p className="text-sm text-gray-500 font-medium">AI Meeting Assistant</p>
              </div>
            </div>
          </div>
          
          {/* Tagline */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>Powered by Gemini AI</span>
            </div>
            <span className="text-gray-300">•</span>
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secure & Fast Processing</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Single Column Layout */}
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        
        {/* Upload Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Perekaman & Upload Audio</h2>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab('record')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'record'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={isTranscribing || isSummarizing}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Mulai Rekam
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={isTranscribing || isSummarizing}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Audio
            </button>
          </div>

          {/* Recording Tab Content */}
          {activeTab === 'record' && (
            <div className="space-y-4">
              {!isRecording && !audioBlob && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <div className="mb-4">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <button
                    onClick={startRecording}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
                    disabled={isTranscribing || isSummarizing}
                  >
                    Mulai Rekam
                  </button>
                  <p className="mt-2 text-xs text-gray-500">Klik untuk mulai merekam audio</p>
                </div>
              )}

              {isRecording && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-red-700 font-medium">
                      {isPaused ? 'Rekaman Dijeda' : 'Sedang Merekam'}
                    </span>
                  </div>
                  
                  <div className="text-3xl font-mono font-bold text-red-700 mb-4">
                    {formatTime(recordingTime)}
                  </div>

                  <div className="flex items-center justify-center gap-3">
                    {!isPaused ? (
                      <button
                        onClick={pauseRecording}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 transition-colors"
                      >
                        Jeda
                      </button>
                    ) : (
                      <button
                        onClick={resumeRecording}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-700 bg-green-100 hover:bg-green-200 transition-colors"
                      >
                        Lanjut
                      </button>
                    )}
                    
                    <button
                      onClick={stopRecording}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                      Selesai
                    </button>
                    
                    <button
                      onClick={resetToInitialRecordingState}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Buang
                    </button>
                  </div>
                </div>
              )}

              {audioBlob && !isRecording && (
                <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-green-700 font-medium">Rekaman Selesai</span>
                    </div>
                    <span className="text-sm text-green-600">Durasi: {formatTime(recordingTime)}</span>
                  </div>
                  
                  {recordedAudioUrl && (
                    <div className="mb-4">
                      <audio controls className="w-full">
                        <source src={recordedAudioUrl} type="audio/wav" />
                        Browser Anda tidak mendukung audio player.
                      </audio>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={resetToInitialRecordingState}
                      className="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                    >
                      Rekam Ulang
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Tab Content */}
          {activeTab === 'upload' && (
            <div>
              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
                <input
                  id="file-input"
                  type="file"
                  onChange={handleFileSelect}
                  accept="audio/*,video/*,.mp3,.wav,.mp4,.avi,.mov,.m4a,.flac,.ogg"
                  className="hidden"
                  disabled={isTranscribing || isSummarizing}
                />

                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>

                <label
                  htmlFor="file-input"
                  className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                    isTranscribing || isSummarizing ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  } transition-colors duration-200`}
                >
                  {file ? 'Ubah File' : 'Upload Audio'}
                </label>

                <p className="mt-2 text-xs text-gray-500">Mendukung file besar • MP3, WAV, MP4, dll.</p>
              </div>

              {/* File Info with Cloudinary Benefits */}
              {file && (
                <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <p>📁 Ukuran: <span className="font-medium">{formatFileSize(file.size)}</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setFile(null);
                        setTranscript('');
                        setSummary(null);
                        setError('');
                        setTranscriptionComplete(false);
                        document.getElementById('file-input').value = '';
                      }} 
                      className="text-red-600 hover:text-red-800 text-xs font-medium ml-4"
                      disabled={isTranscribing || isSummarizing}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Button - Transcribe */}
          <div className="mt-6">
            <button
              onClick={handleTranscribeWithCloudinary}
              disabled={
                (!file && !audioBlob) || 
                isTranscribing || 
                isSummarizing ||
                (activeTab === 'record' && isRecording)
              }
              className={`w-full py-3 px-4 rounded-md text-sm font-medium transition-colors ${
                (!file && !audioBlob) || isTranscribing || isSummarizing || (activeTab === 'record' && isRecording)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : transcriptionComplete
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isTranscribing ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"></path>
                  </svg>
                  {transcribeStatus || 'Memproses...'}
                </div>
              ) : transcriptionComplete ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  Transkrip Selesai
                </div>
              ) : (
                `Mulai Transkrip ${activeTab === 'record' ? 'Rekaman' : 'File'}`
              )}
            </button>
          </div>

          {/* Progress */}
          {isTranscribing && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Mentranskripsikan audio...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }} 
                />
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-1 text-sm text-red-700">
                    {typeof error === 'string' ? error : error.message || 'Terjadi kesalahan'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transcript Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Tinjau & Tambah Catatan</h2>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">Transkrip Otomatis</h3>
              </div>

              {/* Progress for summarization */}
              {isSummarizing && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Membuat rangkuman AI...</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 w-full animate-pulse" />
                  </div>
                </div>
              )}

              {/* Success message */}
              {summary && (
                <div className="mb-3 bg-green-50 border border-green-200 rounded-md p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-green-700 font-medium">
                      Catatan berhasil diproses! Lihat hasil di bawah.
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 min-h-[200px] mb-4">
                {transcript ? (
                  <div>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {showFullTranscript ? transcript : truncateTranscript(transcript)}
                    </p>
                    {transcript.length > 500 && (
                      <button
                        onClick={toggleTranscriptView}
                        className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        {showFullTranscript ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                            </svg>
                            Lihat lebih sedikit
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                            Baca selengkapnya
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Transkrip akan muncul di sini setelah upload dan pemrosesan audio...</p>
                )}
              </div>

              {/* Process & Extract Insights Button */}
            </div>

            {/* Additional Notes Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Catatan Tambahan 
                  <span className="text-xs text-gray-500 font-normal ml-1">(Opsional, untuk melengkapi transkrip)</span>
                </h3>
                <span className="text-xs text-gray-500">
                  Panjang catatan manual: {notesCharCount} karakter
                </span>
              </div>
              <div className="relative">
                <textarea
                  value={additionalNotes}
                  onChange={handleNotesChange}
                  placeholder="Ketik atau tempel catatan tambahan, poin penting, atau konteks di sini..."
                  className="w-full min-h-[120px] p-4 text-sm border border-gray-200 rounded-md resize-y focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={isSummarizing}
                />
                {additionalNotes && (
                  <button
                    onClick={() => {
                      setAdditionalNotes('');
                      setNotesCharCount(0);
                    }}
                    className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Hapus catatan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {additionalNotes && (
                <p className="text-xs text-blue-600 mt-1">
                  💡 Catatan ini akan digabungkan dengan transkrip untuk menghasilkan rangkuman yang lebih lengkap.
                </p>
              )}
            </div>

            {/* Process & Extract Insights Button */}
            {transcriptionComplete && (
              <div className="text-center mt-6">
                <button
                  onClick={handleSummarize}
                  disabled={!transcriptionComplete || isSummarizing}
                  className={`inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-colors ${
                    !transcriptionComplete || isSummarizing
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : summary
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {isSummarizing ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z"></path>
                      </svg>
                      Memproses...
                    </div>
                  ) : summary ? (
                    'Proses Ulang Wawasan'
                  ) : (
                    'Proses & Ekstrak Wawasan'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary Section */}
        {summary && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-sm">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Wawasan yang Diproses</h3>
                <p className="text-sm text-gray-600">Berikut adalah yang diekstrak Gemini AI dari catatan Anda.</p>
              </div>
            </div>

            <div className="space-y-6 mt-6">
              {/* Ringkasan Eksekutif */}
              {summary.structured_data?.key_points && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-gray-900">Ringkasan Eksekutif</h4>
                  </div>
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{summary.structured_data.key_points}</p>
                  </div>
                </div>
              )}

              {/* Poin Diskusi Utama */}
              {summary.structured_data?.agenda && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-yellow-100 rounded flex items-center justify-center">
                      <span className="text-yellow-600 text-xs">💡</span>
                    </div>
                    <h4 className="font-semibold text-gray-900">Poin Diskusi Utama</h4>
                  </div>
                  <div className="space-y-2">
                    {summary.structured_data.agenda.split('\n').filter(line => line.trim()).map((point, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2 flex-shrink-0"></div>
                        <p className="text-sm text-gray-800">{point.replace(/^[•\-\*]\s*/, '')}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Catatan Terorganisir Detail */}
              {summary.structured_data?.action_items && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-green-100 rounded flex items-center justify-center">
                      <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    <h4 className="font-semibold text-gray-900">Catatan Terorganisir Detail</h4>
                  </div>
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{summary.structured_data.action_items}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>File: {selectedFile?.name} ({formatFileSize(selectedFile?.size || 0)})</span>
                <button 
                  onClick={handleReset} 
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors duration-200"
                >
                  Proses File Baru
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Download PDF Button - Outside Summary Section */}
        {(transcript || summary) && (
          <div className="flex justify-center mt-8">
            <button 
              onClick={generatePDF}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="mt-16 bg-white border-t border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Brand Section */}
            <div className="md:col-span-1">
              <h3 className="text-lg font-bold text-gray-900 mb-2">NotulaKika</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                AI-powered meeting assistant yang membantu Anda mengubah rekaman audio menjadi wawasan yang bermakna dan terstruktur.
              </p>
            </div>

            {/* Features Section */}
            <div className="md:col-span-1">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Fitur Utama</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Rekam Audio Langsung
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Transkrip Otomatis
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Ringkasan AI
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Export PDF
                </li>
              </ul>
            </div>

            {/* Tech Section */}
            <div className="md:col-span-1">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Teknologi</h4>
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  Powered by Gemini AI
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Gladia Speech-to-Text
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Real-time Processing
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="mt-8 pt-6 border-t border-gray-300">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-500">
                © 2025 NotulaKika. Dibuat untuk produktivitas yang lebih baik.
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Secure & Private
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Fast Processing
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}