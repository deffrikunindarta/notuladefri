# 🎯 NotulaKika - AI Meeting Assistant

NotulaKika adalah asisten meeting AI yang powerful dan modern untuk merekam, mentranskrip, dan menganalisis meeting Anda menggunakan teknologi Gladia API dan Gemini 1.5 Flash AI.

## ✨ Fitur Utama

- 🎙️ **Rekam Audio Langsung**: Rekam meeting langsung di browser dengan MediaRecorder API
- 📁 **Upload File**: Drag & drop atau pilih file audio/video
- 🎵 **Transkrip Otomatis**: Powered by Gladia API dengan akurasi tinggi
- 🤖 **Ringkasan AI**: Analisis terstruktur menggunakan Gemini 1.5 Flash
- 📋 **Output Terorganisir**: Ringkasan eksekutif, poin diskusi, dan catatan detail
- 📝 **Catatan Tambahan**: Tambahkan catatan manual untuk konteks yang lebih lengkap
- 📄 **Export PDF**: Download hasil dalam format PDF profesional
- 👁️ **Baca Selengkapnya**: Smart text truncation untuk transkrip panjang
- 🎨 **UI Modern**: Interface React yang clean dengan Tailwind CSS
- ⚡ **Pemrosesan Cepat**: Pipeline yang dioptimasi untuk hasil cepat
- 📱 **Responsive Design**: Bekerja optimal di desktop, tablet, dan mobile

## 🏗️ Arsitektur

```
Rekam/Upload → Gladia Transcription → Gemini Analysis → Structured Display → PDF Export
```

**Frontend (React + Vite + Tailwind)** ↔️ **Backend (FastAPI)** ↔️ **APIs (Gladia + Gemini)**

## 📁 Struktur Proyek

```
notulakika/
│
├── backend/
│   ├── main.py              # FastAPI server dengan endpoint terpisah
│   ├── requirements.txt     # Dependencies Python
│   ├── .env                 # API keys (jaga keamanan!)
│   └── utils/
│       ├── __init__.py
│       ├── gladia_api.py    # Integrasi Gladia transcription
│       └── gemini_api.py    # Integrasi Gemini AI analysis
│
├── frontend/
│   ├── package.json         # Dependencies Node.js
│   ├── vite.config.js       # Konfigurasi Vite
│   ├── tailwind.config.js   # Konfigurasi Tailwind CSS
│   ├── src/
│   │   ├── App.jsx          # Aplikasi React utama
│   │   ├── main.jsx         # Entry point React
│   │   ├── index.css        # Global styles + Tailwind
│   │   └── components/
│   │       └── UploadComponent.jsx  # Interface utama
│   └── public/
│       └── index.html       # Template HTML
│
└── README.md               # File ini
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.8+** (for backend)
- **Node.js 16+** (for frontend)
- **API Keys** (see setup below)

### 1. 🔑 Get API Keys

#### Gladia API (Free)

1. Visit [Gladia Console](https://app.gladia.io/)
2. Sign up for free account
3. Get your API key from dashboard
4. Free tier: 10 hours of transcription per month

#### Gemini API (Free)

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with Google account
3. Generate API key
4. Free tier: 60 requests per minute

### 2. 🛠️ Setup Backend

```bash
# Navigasi ke direktori backend
cd notulakika/backend

# Buat virtual environment (direkomendasikan)
python -m venv venv

# Aktifkan virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Update file .env dengan API keys Anda
# Edit .env dan ganti dengan key yang sebenarnya:
GLADIA_API_KEY=your_gladia_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Jalankan server
uvicorn main:app --reload
```

**Backend akan berjalan di: http://localhost:8000**

### 3. 🎨 Setup Frontend

```bash
# Navigasi ke direktori frontend (terminal baru)
cd notulakika/frontend

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

**Frontend akan berjalan di: http://localhost:5173**

## 💡 Cara Penggunaan

1. **Jalankan kedua server** (backend di :8000, frontend di :5173)
2. **Buka browser** ke http://localhost:5173
3. **Pilih mode**:
   - **Tab "Rekam"**: Rekam audio langsung di browser
   - **Tab "Upload"**: Upload file yang sudah ada
4. **Format yang didukung**: MP3, WAV, MP4, AVI, MOV, M4A, FLAC, OGG
5. **Batas ukuran file**: 100MB maksimal
6. **Proses**:
   - Klik "Mulai Transkrip" untuk mendapatkan teks
   - Tambahkan catatan tambahan jika diperlukan
   - Klik "Proses & Ekstrak Wawasan" untuk analisis AI
7. **Download PDF**: Setelah analisis selesai, klik "Download PDF"

## 📊 Contoh Output

```
Ringkasan Eksekutif:
Tim meninjau status proyek saat ini dan membahas deadline yang akan datang.
Budget disetujui untuk sumber daya tambahan, dan tanggung jawab diberikan
untuk deliverable kuartal berikutnya.

Poin Diskusi Utama:
• Review timeline proyek
• Diskusi alokasi budget
• Penugasan tim untuk Q4

Catatan Terorganisir Detail:
• John menyelesaikan proposal budget sebelum Jumat
• Sarah berkoordinasi dengan tim design
• Jadwalkan follow-up meeting minggu depan
```

## 🔧 API Endpoints

### Backend Endpoints

- **GET /** - Health check dan info API
- **POST /transcribe** - Upload dan transkrip file audio
- **POST /summarize** - Analisis dan ringkasan dengan AI
- **GET /health** - Status sistem detail

### Contoh Penggunaan API

```bash
# Test health check
curl http://localhost:8000/

# Upload file untuk transkrip
curl -X POST "http://localhost:8000/transcribe" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@meeting.mp3"

# Ringkasan AI
curl -X POST "http://localhost:8000/summarize" \
  -H "accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"transcript": "teks transkrip meeting..."}'
```

## 🎯 Detail Pipeline

### 1. Input Audio

- **Rekam Langsung**: MediaRecorder API dengan kontrol pause/resume
- **Upload File**: Validasi tipe dan ukuran file
- **Format Support**: Audio dan video dengan ekstraksi audio otomatis

### 2. Transkrip Gladia

- Kirim audio ke Gladia API
- Deteksi bahasa otomatis
- Return teks transkrip lengkap

### 3. Analisis Gemini

- Kirim transkrip ke Gemini 1.5 Flash
- Prompt terstruktur untuk formatting konsisten
- Ekstrak ringkasan, poin diskusi, dan catatan detail

### 4. Export & Display

- Response JSON terstruktur
- UI display yang user-friendly
- Export PDF dengan format profesional

## 🛠️ Development

### Menjalankan Tests

```bash
# Backend tests (saat diimplementasikan)
cd backend
python -m pytest

# Frontend tests (saat diimplementasikan)
cd frontend
npm test
```

### Build untuk Production

```bash
# Frontend build
cd frontend
npm run build

# Backend deployment
cd backend
pip install gunicorn
gunicorn main:app --host 0.0.0.0 --port 8000
```

## 🔐 Catatan Keamanan

- **Jaga keamanan API keys** - jangan commit `.env` ke version control
- **Batas ukuran file** diterapkan untuk mencegah penyalahgunaan
- **CORS dikonfigurasi** untuk localhost development saja
- **Validasi tipe file** sebelum pemrosesan
- **Rate limiting** pada API endpoints

## 🚧 Fitur Saat Ini

- ✅ **Rekam audio langsung** dengan kontrol penuh
- ✅ **Upload file audio/video** dengan drag & drop
- ✅ **Transkrip otomatis** dengan Gladia API
- ✅ **Analisis AI terstruktur** dengan Gemini
- ✅ **Export PDF** dengan format profesional
- ✅ **Catatan tambahan** untuk konteks lengkap
- ✅ **UI responsif** untuk semua device
- ✅ **Smart text truncation** untuk konten panjang
- ✅ **Modern design** dengan Tailwind CSS

## 🔮 Pengembangan Selanjutnya

- 👥 **User accounts** dan autentikasi
- 💾 **History meeting** dan penyimpanan
- 🎭 **Speaker identification** dan diarization
- 🌍 **Multi-language** support
- 📱 **Mobile app** versi native
- 🔗 **Integrasi kalender** (Google Calendar, Outlook)
- 📊 **Dashboard analytics** untuk insights
- ⚙️ **Template summary** yang dapat dikustomisasi
- 🔄 **Real-time collaboration** untuk tim
- 📈 **Meeting insights** dan trend analysis

## 🐛 Troubleshooting

### Masalah Umum

**Backend tidak bisa start:**

- Cek versi Python (3.8+)
- Verifikasi API keys di `.env`
- Install semua requirements: `pip install -r requirements.txt`

**Frontend tidak loading:**

- Cek versi Node.js (16+)
- Install dependencies: `npm install`
- Clear cache: `npm run dev --force`

**Upload gagal:**

- Cek format file (supported: MP3, WAV, MP4, AVI, MOV, M4A, FLAC, OGG)
- Verifikasi ukuran file (<100MB)
- Pastikan backend berjalan di port 8000

**Error API:**

- Verifikasi API keys valid dan tidak expired
- Cek koneksi internet
- Monitor rate limits API

**Rekam audio tidak berfungsi:**

- Berikan permission microphone di browser
- Cek settings audio device
- Gunakan HTTPS untuk production (diperlukan untuk getUserMedia)

### Mode Debug

```bash
# Backend dengan debug logging
cd backend
uvicorn main:app --reload --log-level debug

# Frontend dengan verbose output
cd frontend
npm run dev -- --verbose
```

## 📄 Lisensi

Proyek ini adalah open source dan tersedia di bawah [MIT License](LICENSE).

## 🤝 Kontribusi

1. Fork repository
2. Buat feature branch (`git checkout -b feature/fitur-amazing`)
3. Commit perubahan (`git commit -m 'Tambah fitur amazing'`)
4. Push ke branch (`git push origin feature/fitur-amazing`)
5. Buka Pull Request

## 📞 Support

Untuk pertanyaan, issues, atau feature requests:

- Buka issue di GitHub
- Cek bagian troubleshooting di atas
- Review dokumentasi API: [Gladia](https://docs.gladia.io/) | [Gemini](https://ai.google.dev/docs)

---

**Dibuat dengan ❤️ untuk meeting yang lebih produktif di mana saja!**

_NotulaKika - Transformasi meeting Anda menjadi wawasan yang berharga_
