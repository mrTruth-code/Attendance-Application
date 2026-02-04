# 🎓 AttendQR - Global QR Code Attendance System

A modern, real-time attendance tracking application with QR code scanning and cloud synchronization.

## ✨ Features

- 📱 **Universal QR Scanning** - Students scan with native phone camera
- 🌍 **Global Access** - Works from anywhere in the world
- ☁️ **Cloud Sync** - Real-time data synchronization across all devices
- 💾 **Persistent Storage** - Data saved to Upstash Redis (via Vercel KV)
- 📊 **Admin Dashboard** - Manage sessions and view attendance records
- 📥 **CSV Export** - Download attendance data
- 🎨 **Premium UI** - Beautiful, modern interface

## 🚀 Quick Start

### Local Development

1. **Clone and Install**
   ```bash
   cd c:\Users\mavhu\.gemini\antigravity\scratch\attendance-app
   npm install
   ```

2. **Run Development Server**
   ```bash
   npm run dev
   ```

3. **Open Browser**
   - Navigate to `http://localhost:3003`
   - App works locally with in-memory storage (no database needed for testing)

### Global Deployment (Vercel)

#### Step 1: Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (free)

#### Step 2: Create Upstash Redis Database
1. In Vercel Dashboard, go to **Storage** tab
2. Click **Create Database**
3. Select **Upstash Redis** (formerly KV)
4. Choose a name (e.g., "attendqr-db")
5. Select region closest to your users
6. Click **Create**

#### Step 3: Deploy Your App

**Option A: Via Vercel Dashboard (Easiest)**
1. In Vercel Dashboard, click **Add New** → **Project**
2. Click **Import** and select your project folder
3. Vercel auto-detects Next.js settings
4. Click **Deploy**
5. Wait ~2 minutes for deployment
6. Get your URL: `https://attendance-app-xyz.vercel.app`

**Option B: Via GitHub (Recommended for Updates)**
1. Initialize Git (if not already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Create GitHub repository and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/attendance-app.git
   git push -u origin main
   ```

3. In Vercel Dashboard:
   - Click **Import Project**
   - Connect GitHub
   - Select your repository
   - Click **Deploy**

4. **Link Database**:
   - In Vercel project settings, go to **Storage**
   - Click **Connect** next to your Upstash Redis database
   - Environment variables are automatically added!

#### Step 4: Test Your Deployment
1. Visit your Vercel URL
2. Go to **Admin** → **New Broadcast**
3. Create a test session
4. Scan the QR code with your phone
5. Register and verify data appears in admin view

## 🔧 Environment Variables

For local development with database (optional):

1. Copy `.env.example` to `.env.local`:
   ```bash
   copy .env.example .env.local
   ```

2. Get your Upstash Redis credentials from Vercel Dashboard:
   - Go to **Storage** → Your Database → **Settings**
   - Copy `KV_REST_API_URL` and `KV_REST_API_TOKEN`

3. Add to `.env.local`:
   ```env
   KV_REST_API_URL=your_url_here
   KV_REST_API_TOKEN=your_token_here
   ```

**Note**: Local development works without database (uses in-memory fallback).

## 📱 How It Works

### For Students:
1. Admin shares QR code or link
2. Student scans with phone camera → Opens browser automatically
3. Student enters name and ID
4. Attendance recorded instantly

### For Admins:
1. Create a session (e.g., "Math Class - Lab 4")
2. Display QR code to students
3. Watch attendance records appear in real-time
4. Export data as CSV when needed

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (React)
- **Database**: Upstash Redis (via Vercel KV)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **QR Generation**: qrcode.react
- **QR Scanning**: html5-qrcode

## 📊 Database Schema

```typescript
interface Database {
  activeSession: {
    id: string;
    name: string;
  } | null;
  records: Array<{
    id: string;
    studentName: string;
    studentId: string;
    timestamp: string;
    day: string;
    sessionId: string;
    sessionName: string;
  }>;
}
```

## 🔒 Security Notes

**Current Implementation**: Open access (suitable for classroom use)

**For Production**, consider adding:
- Admin authentication (password protection)
- Rate limiting (prevent spam)
- Session validation (verify QR codes)
- Student ID verification

## 🐛 Troubleshooting

### Local Development Issues

**Port already in use**:
```bash
# Kill process on port 3003
netstat -ano | findstr :3003
taskkill /PID <PID> /F
```

**Build errors**:
```bash
npm run build
```

### Deployment Issues

**Database not connected**:
- Verify environment variables in Vercel Dashboard
- Check Storage tab shows database is linked

**QR codes not working**:
- Ensure you're using the production URL in QR codes
- Check browser console for errors

**Data not persisting**:
- Verify Upstash Redis is connected in Vercel
- Check deployment logs for errors

## 📝 Commands

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm start            # Start production server

# Deployment
vercel               # Deploy to Vercel (if CLI installed)
vercel --prod        # Deploy to production
```

## 🌟 Features Roadmap

- [ ] Admin authentication
- [ ] Email notifications
- [ ] Attendance analytics
- [ ] Multi-session support
- [ ] Student profiles with photos
- [ ] Geolocation verification

## 📄 License

MIT

## 🤝 Support

For issues or questions, check the deployment guide in the artifacts folder.

---

**Made with ❤️ for seamless attendance tracking**
