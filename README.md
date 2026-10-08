# Ask Classes — Online Tuition & Coaching Academy Platform

A full-stack, responsive tuition academy web application built with **Node.js, Express, SQLite, and vanilla HTML/CSS/JavaScript**. It includes separate portals for **Students** and **Administrators**, real-time live class scheduling with meeting links (Google Meet, Zoom, etc.), study notes sharing, assignment tracking, and access-controlled student enrollment.

---

## 🚀 Quick Start (Run Locally)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
node server.js
```
The server will start at: **http://localhost:8000**

---

## 👥 Portals & Direct Links

| Portal | URL | Default Credentials | Key Features |
|---|---|---|---|
| **Public Website** | `http://localhost:8000/index.html` | — | Course catalog, inquiry form, interactive registration |
| **Admin Portal** | `http://localhost:8000/admin_dashboard.html` | `admin@askclasses.com` / `admin123` | Schedule live classes with meeting links, enroll/authorize students, upload notes, publish assignments |
| **Student Portal** | `http://localhost:8000/dashboard.html` | `student@askclasses.com` / `student123` | **One-click "Join Live Class"**, download notes, view assignments, track schedule |

---

## 📹 How Live Classes Work

### Admin Side (Adding / Updating Live Class Link):
1. Navigate to **Admin Dashboard** (`http://localhost:8000/admin_dashboard.html`).
2. In the **"Schedule a Live Class"** section, enter:
   - Course (e.g., Class 10 Science & Maths)
   - Class Topic (e.g., *Physics Light Reflection Session*)
   - Instructor name, Date, and Time
   - **Meeting Link**: Paste your Google Meet (`https://meet.google.com/...`) or Zoom link.
   - Status: Set to **`Live Now`** or **`Upcoming`**.
3. Click **Schedule Class**. The link is immediately saved to the database.

### Student Side (Joining the Live Class):
1. Navigate to **Student Dashboard** (`http://localhost:8000/dashboard.html`).
2. Switch to the **"Session Join"** tab.
3. Students will see the active/upcoming class card with:
   - Green badge for **Live Now**
   - Timing & Instructor info
   - **Direct "Join Live Session" button** that immediately opens the meeting link in a new tab!

---

## 🔒 Tuition Access Control
- Only students enrolled and authorized by the tuition administrator can sign in to the Student Dashboard.
- Administrators can add, edit, or revoke student access at any time from the **"Enrolled Students Roster"** in the Admin Portal.

---

## 📦 How to Upload to Your GitHub Repository

If you haven't created a GitHub repository yet:
1. Go to [GitHub New Repository](https://github.com/new).
2. Name your repository (e.g. `ask-classes`), choose Public or Private, and click **Create repository**.
3. In your terminal, run:

```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git

# Set main branch
git branch -M main

# Push all files to GitHub
git push -u origin main
```

---

## 🛠️ Tech Stack
- **Backend**: Node.js, Express, SQLite3, JWT Authentication, Multer (file uploads), Bcrypt (password hashing)
- **Frontend**: Responsive HTML5, CSS3 (Modern Glassmorphism & Cards), Vanilla JavaScript (REST API connector)
- **Database**: SQLite (`database.sqlite`) auto-initialized on first run
