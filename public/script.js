// Ask Classes Interactive Script & Backend REST API Connector

const API_BASE = '';

// --- AUTH & TOKEN STORAGE ---
function getToken() {
  return localStorage.getItem('ask_classes_token') || sessionStorage.getItem('ask_classes_token');
}

function setToken(token) {
  localStorage.setItem('ask_classes_token', token);
  sessionStorage.setItem('ask_classes_token', token);
}

function getCurrentUser() {
  const userJson = localStorage.getItem('ask_classes_user') || sessionStorage.getItem('ask_classes_user');
  try {
    return userJson ? JSON.parse(userJson) : null;
  } catch (e) {
    return null;
  }
}

function setCurrentUser(user) {
  const json = JSON.stringify(user);
  localStorage.setItem('ask_classes_user', json);
  sessionStorage.setItem('ask_classes_user', json);
}

function clearAuth() {
  localStorage.removeItem('ask_classes_token');
  localStorage.removeItem('ask_classes_user');
  sessionStorage.removeItem('ask_classes_token');
  sessionStorage.removeItem('ask_classes_user');
}

function handleSignOut(event) {
  if (event) event.preventDefault();
  clearAuth();
  alert('You have been signed out.');
  window.location.href = 'index.html';
}

// --- API FETCH HELPER ---
async function apiFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });
    const data = await res.json();
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    return { success: false, message: err.message || 'Network request failed' };
  }
}

// --- MOTIVATIONAL QUOTES FOR REGISTRATION POPUP ---
const MOTIVATIONAL_QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "Excellence is not an act, but a habit. What we repeatedly do is who we become.", author: "Aristotle" },
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "The capacity to learn is a gift; the ability to learn is a skill; the willingness to learn is a choice.", author: "Brian Herbert" }
];

let pendingQuoteCallback = null;

function showMotivationalQuote(callback) {
  const overlay = document.getElementById('quoteModalOverlay');
  const quoteText = document.getElementById('quoteModalText');
  const quoteAuthor = document.getElementById('quoteModalAuthor');

  if (!overlay || !quoteText || !quoteAuthor) {
    const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
    alert(`Motivational Quote:\n\n"${quote.text}"\n— ${quote.author}`);
    callback();
    return;
  }

  const quote = MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)];
  quoteText.textContent = `"${quote.text}"`;
  quoteAuthor.textContent = `— ${quote.author}`;
  
  pendingQuoteCallback = callback;
  overlay.classList.add('active');
}

function closeQuoteModal() {
  const overlay = document.getElementById('quoteModalOverlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
  if (pendingQuoteCallback) {
    pendingQuoteCallback();
    pendingQuoteCallback = null;
  }
}

// Intercept Register Click
function handleRegisterClick(targetUrl = null) {
  showMotivationalQuote(() => {
    if (targetUrl) {
      window.location.href = targetUrl;
    } else {
      toggleFormDirect('register');
    }
  });
}

// --- LANDING PAGE FUNCTIONS ---
function scrollToCourses() {
  const element = document.getElementById('courses');
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

function toggleForm(formType) {
  if (formType === 'register') {
    handleRegisterClick();
  } else {
    toggleFormDirect(formType);
  }
}

function toggleFormDirect(formType) {
  const tabRegister = document.getElementById('tab-register');
  const tabLogin = document.getElementById('tab-login');
  const formRegister = document.getElementById('form-register-page');
  const formLogin = document.getElementById('form-login-page');

  if (!tabRegister || !tabLogin) return;

  if (formType === 'register') {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    if (formRegister) formRegister.style.display = 'block';
    if (formLogin) formLogin.style.display = 'none';
  } else {
    tabRegister.classList.remove('active');
    tabLogin.classList.add('active');
    if (formRegister) formRegister.style.display = 'none';
    if (formLogin) formLogin.style.display = 'block';
  }
}

// --- BACKEND-CONNECTED REGISTRATION ---
async function handleRegistration(event) {
  event.preventDefault();
  const nameInput = document.getElementById('reg-fullname');
  const emailInput = document.getElementById('reg-email-address');
  const passInput = document.getElementById('reg-pass');
  const classInput = document.getElementById('reg-class');

  const name = nameInput ? nameInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value : '';

  if (!name || !email || !password) {
    alert('Please provide your name, email, and password.');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating Account...';
  }

  try {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, courseId: classInput ? classInput.value : 'c10' })
    });

    if (res.success) {
      setToken(res.token);
      setCurrentUser(res.user);
      alert(`🎉 Welcome ${res.user.name}! Your account has been registered and activated. Let's explore your courses!`);
      window.location.href = 'dashboard.html';
    } else {
      alert(res.message);
    }
  } catch (err) {
    alert('Failed to connect to backend server. Please make sure the server is running.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register & Continue';
    }
  }
}

// --- BACKEND-CONNECTED LOGIN ---
async function handleLogin(event) {
  event.preventDefault();
  const userInput = document.getElementById('login-user');
  const passInput = document.getElementById('login-pass');

  const email = userInput ? userInput.value.trim() : '';
  const password = passInput ? passInput.value : '';

  if (!email || !password) {
    alert('Please enter your email/username and password.');
    return;
  }

  const submitBtn = event.target.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
  }

  try {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (res.success) {
      setToken(res.token);
      setCurrentUser(res.user);
      alert(`Welcome back, ${res.user.name}!`);
      if (res.user.role === 'admin') {
        window.location.href = 'admin_dashboard.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    } else {
      alert(`Login failed: ${res.message}`);
    }
  } catch (err) {
    alert('Failed to connect to backend server. Please verify the server is running.');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }
}

// URL Params processing on DOM load
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get('tab');
  if (tabParam === 'login' || tabParam === 'signin') {
    toggleFormDirect('login');
  } else if (tabParam === 'register') {
    handleRegisterClick();
  }
});

// --- FLOATING CHAT WIDGET & INQUIRIES ---
let chatOpen = false;

function toggleChatPanel() {
  const panel = document.getElementById('chatPanel');
  const bubble = document.getElementById('chatBubble');
  if (!panel) return;

  chatOpen = !chatOpen;
  if (chatOpen) {
    panel.style.display = 'flex';
    if (bubble) bubble.style.display = 'none';
  } else {
    panel.style.display = 'none';
    if (bubble) bubble.style.display = 'block';
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const messagesDiv = document.getElementById('chatMessages');
  if (!input || !messagesDiv || input.value.trim() === '') return;

  const text = input.value.trim();
  const user = getCurrentUser();

  const msgOut = document.createElement('div');
  msgOut.className = 'chat-msg outgoing';
  msgOut.textContent = text;
  messagesDiv.appendChild(msgOut);
  
  input.value = '';
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  apiFetch('/api/inquiries', {
    method: 'POST',
    body: JSON.stringify({
      name: user ? user.name : 'Web Visitor',
      email: user ? user.email : '',
      message: text
    })
  });

  setTimeout(() => {
    const msgIn = document.createElement('div');
    msgIn.className = 'chat-msg incoming';
    
    let reply = 'Thanks for reaching out! A student support assistant will connect with you in a moment.';
    const lowerText = text.toLowerCase();
    if (lowerText.includes('class') || lowerText.includes('course') || lowerText.includes('syllabus')) {
      reply = 'We offer standard curriculum preparation for Class 9 and Class 10. Our classes run in both online + offline modes. Would you like to schedule a counseling call?';
    } else if (lowerText.includes('fee') || lowerText.includes('cost') || lowerText.includes('price')) {
      reply = 'Our course packages vary. We offer offline classroom study at our center and live interactive online courses. Please enter your contact number so we can reach you.';
    } else if (lowerText.includes('join') || lowerText.includes('class link') || lowerText.includes('zoom')) {
      reply = 'Live classes can be joined directly from the Today\'s Session tab of your dashboard by clicking the active Join Class button.';
    }

    msgIn.textContent = reply;
    messagesDiv.appendChild(msgIn);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }, 800);
}

async function openRequestCourse() {
  const course = prompt('Which class course would you like to request? (e.g. Class 9, Class 10)');
  if (course) {
    const user = getCurrentUser();
    await apiFetch('/api/inquiries', {
      method: 'POST',
      body: JSON.stringify({
        name: user ? user.name : 'Web Visitor',
        email: user ? user.email : '',
        message: `Requested Course: ${course}`
      })
    });
    alert(`Thank you for requesting "${course}" course! Our academic team will review your interest and notify you when it launches.`);
  }
}

// --- STUDENT DASHBOARD HELPERS ---
function switchTab(index) {
  const panels = document.querySelectorAll('.tab-panel');
  panels.forEach(panel => panel.classList.remove('active'));

  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => btn.classList.remove('active'));

  const selectedPanel = document.getElementById(`panel-${index}`);
  if (selectedPanel) {
    selectedPanel.classList.add('active');
  }
  if (tabBtns[index]) {
    tabBtns[index].classList.add('active');
  }
}

function toggleFaq(element) {
  const faqItem = element.parentElement;
  faqItem.classList.toggle('active');
}

function copyReferralCode() {
  const code = document.getElementById('referCode');
  if (code) {
    code.select();
    code.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(code.value);
    alert('Referral code copied to clipboard: ' + code.value);
  }
}

function formatScheduleTime(item) {
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dateObj = new Date(item.date);
  const dayName = isNaN(dateObj.getTime()) ? '' : daysOfWeek[dateObj.getDay()];
  const todayStr = new Date().toISOString().split('T')[0];
  const dateStr = item.date === todayStr ? 'Today' : item.date;
  return `${dateStr}, ${item.timeStart} - ${item.timeEnd}`;
}

function getDayFromDate(dateStr) {
  const dateObj = new Date(dateStr);
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return isNaN(dateObj.getTime()) ? 'Day' : daysOfWeek[dateObj.getDay()];
}

let cachedCourses = [];
function getCourseName(courseId) {
  const course = cachedCourses.find(c => c.id === courseId);
  return course ? course.name : (courseId === 'c10' ? 'Class 10' : (courseId === 'c9' ? 'Class 9' : 'General Course'));
}

// --- STUDENT DASHBOARD RENDERING (FROM BACKEND) ---
async function renderStudentDashboard() {
  const user = getCurrentUser();
  const nameEl = document.getElementById('student-display-name');
  if (nameEl) {
    nameEl.textContent = user ? user.name : 'Anushka Singh';
  }

  const [coursesRes, assignmentsRes, scheduleRes, materialsRes] = await Promise.all([
    apiFetch('/api/courses'),
    apiFetch('/api/assignments'),
    apiFetch('/api/schedule'),
    apiFetch('/api/materials')
  ]);

  const courses = (coursesRes.success && coursesRes.courses) ? coursesRes.courses : [];
  cachedCourses = courses;
  const assignments = (assignmentsRes.success && assignmentsRes.assignments) ? assignmentsRes.assignments : [];
  const schedule = (scheduleRes.success && scheduleRes.schedule) ? scheduleRes.schedule : [];
  const materials = (materialsRes.success && materialsRes.materials) ? materialsRes.materials : [];

  const statCourseEl = document.getElementById('stat-course-value');
  const statLiveEl = document.getElementById('stat-live-value');
  const liveCount = schedule.filter(s => s.status === 'live').length;
  const upcomingCount = schedule.filter(s => s.status !== 'live').length;

  if (statCourseEl) {
    statCourseEl.textContent = `${courses.length} Active`;
  }
  if (statLiveEl) {
    statLiveEl.textContent = liveCount > 0 ? `${liveCount} Live Now` : `${upcomingCount} Scheduled`;
    statLiveEl.style.color = liveCount > 0 ? '#ff5722' : 'var(--primary-blue)';
  }

  // 1. Render Active Live Sessions
  const activeSessionsDiv = document.querySelector('#panel-0 .session-list');
  if (activeSessionsDiv) {
    const liveItems = schedule.filter(s => s.status === 'live');
    if (liveItems.length === 0) {
      activeSessionsDiv.innerHTML = `<div style="text-align:center; padding: 25px; color: var(--text-muted); background: white; border-radius: 8px; border: 1px solid var(--border-color);">No live classes running right now. Check back during scheduled timings.</div>`;
    } else {
      activeSessionsDiv.innerHTML = liveItems.map(item => {
        const link = item.meetingLink || item.meeting_link || 'https://meet.google.com/ask-live-class';
        return `
        <div class="session-item" style="border-left-color: #ff5722;">
          <div class="session-info">
            <h4>${item.courseName || getCourseName(item.courseId)}: ${item.title}</h4>
            <p>Instructor: ${item.instructor} | Time: ${formatScheduleTime(item)} (Live Now)</p>
          </div>
          <button class="btn-join" style="background-color: #ff5722;" onclick="window.open('${link}', '_blank')">🔴 Join Live Class</button>
        </div>
      `;
      }).join('');
    }
  }

  // 2. Render Pending Homework
  const homeworkDiv = document.getElementById('student-homework-card');
  if (homeworkDiv) {
    if (assignments.length === 0) {
      homeworkDiv.innerHTML = `
        <h2 class="panel-card-title">Pending Homework</h2>
        <p style="font-size: 14px; color: var(--text-muted); padding: 10px 0;">No pending homework worksheets. All caught up!</p>
      `;
    } else {
      homeworkDiv.innerHTML = `
        <h2 class="panel-card-title">Pending Homework</h2>
        <div style="display:flex; flex-direction:column; gap:12px; margin-top:10px;">
          ${assignments.map(item => `
            <div style="padding:10px; border: 1px solid var(--border-color); border-radius:6px; background:#fafafa;">
              <span class="badge badge-purple" style="margin-left:0; margin-bottom:5px;">${item.courseName || getCourseName(item.courseId)}</span>
              <div style="font-weight:600; font-size:14px; color:var(--text-dark);">${item.title}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${item.description}</div>
              <div style="font-size:11px; color:#ef4444; font-weight:600; margin-top:5px;">Due Date: ${item.dueDate}</div>
            </div>
          `).join('')}
        </div>
      `;
    }
  }

  // 3. Render Enrolled Programs Cards
  const coursesListDiv = document.querySelector('#panel-1 .courses-list');
  if (coursesListDiv) {
    coursesListDiv.innerHTML = courses.map(course => {
      const courseAssignments = assignments.filter(a => a.courseId === course.id || a.course_id === course.id);

      const assignmentListHtml = courseAssignments.length === 0
        ? `<p style="font-size: 13px; color: var(--text-muted); margin-top: 10px;">No assignments published yet. Check back after your instructor uploads them.</p>`
        : `<div style="margin-top: 12px; display: flex; flex-direction: column; gap: 8px;">
            ${courseAssignments.map(item => `
              <div style="padding: 10px; border: 1px solid var(--border-color); border-radius: 6px; background: #fafafa;">
                <div style="font-weight: 600; font-size: 14px; color: var(--text-dark);">${item.title}</div>
                <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">${item.description}</div>
                <div style="font-size: 11px; color: #ef4444; font-weight: 600; margin-top: 5px;">Due: ${item.dueDate}</div>
              </div>
            `).join('')}
          </div>`;

      return `
        <div class="course-progress-card">
          <div class="course-prog-header ${course.category}">
            <h3>${course.name}</h3>
            <p>${course.description || 'Regular Batch & Test Prep Support'}</p>
          </div>
          <div class="course-prog-body">
            <div class="prog-labels">
              <span>Published Assignments</span>
              <span>${courseAssignments.length}</span>
            </div>
            <div class="prog-bar-container">
              <div class="prog-bar-fill" style="width: ${courseAssignments.length > 0 ? 100 : 0}%;"></div>
            </div>
            ${assignmentListHtml}
          </div>
          <div class="course-prog-footer">
            <span style="font-size: 13px; font-weight: 600; color: var(--primary-blue);">Active Access</span>
            <button class="btn-join" style="padding: 5px 12px; font-size: 12px;" onclick="switchTab(4)">View Material</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 4. Render Live Class Feed
  const liveClassFeedDiv = document.querySelector('#panel-2 .session-list');
  if (liveClassFeedDiv) {
    const upcomingSessions = schedule.filter(s => s.status !== 'live');
    if (upcomingSessions.length === 0) {
      liveClassFeedDiv.innerHTML = `<div style="text-align:center; padding: 25px; color: var(--text-muted); background: white; border-radius: 8px; border: 1px solid var(--border-color);">No upcoming live classes scheduled.</div>`;
    } else {
      liveClassFeedDiv.innerHTML = upcomingSessions.map(item => {
        const link = item.meetingLink || item.meeting_link || 'https://meet.google.com/ask-live-class';
        return `
        <div class="session-item" style="border-left-color: #4caf50;">
          <div class="session-info">
            <h4>${item.courseName || getCourseName(item.courseId)}: ${item.title}</h4>
            <p>Instructor: ${item.instructor} | Time: ${formatScheduleTime(item)}</p>
          </div>
          <button class="btn-join" onclick="window.open('${link}', '_blank')">🔗 Join Link</button>
        </div>
      `;
      }).join('');
    }
  }

  // 5. Render Weekly Schedule Calendar
  const scheduleCalendarDiv = document.querySelector('#panel-3 .schedule-list');
  if (scheduleCalendarDiv) {
    if (schedule.length === 0) {
      scheduleCalendarDiv.innerHTML = `<div style="text-align:center; padding: 25px; color: var(--text-muted); background: white; border-radius: 8px; border: 1px solid var(--border-color);">No classes scheduled in calendar.</div>`;
    } else {
      scheduleCalendarDiv.innerHTML = schedule.map(item => {
        const link = item.meetingLink || item.meeting_link || 'https://meet.google.com/ask-live-class';
        return `
        <div class="schedule-item">
          <div class="session-info">
            <h4>${getDayFromDate(item.date)}: ${item.courseName || getCourseName(item.courseId)} - ${item.title}</h4>
            <p>Instructor: ${item.instructor} | Timing: ${item.timeStart} - ${item.timeEnd} (${item.date})</p>
            <div style="margin-top: 4px;">
              <a href="${link}" target="_blank" style="font-size: 12px; color: var(--primary-blue); font-weight: 600; text-decoration: none;">🔗 Class Meeting Link</a>
            </div>
          </div>
          <span style="font-weight: 600; font-size: 13px; color: ${item.status === 'live' ? '#ff5722' : 'var(--text-muted)'};">${item.status.toUpperCase()}</span>
        </div>
      `;
      }).join('');
    }
  }

  // 6. Render Course Materials
  const materialsGridDiv = document.getElementById('student-materials-grid');
  if (materialsGridDiv) {
    if (materials.length === 0) {
      materialsGridDiv.innerHTML = `<div style="text-align:center; padding: 25px; color: var(--text-muted); grid-column: 1/-1; background: var(--bg-light); border-radius: 8px; border: 1px dashed var(--border-color);">No study notes or materials uploaded yet by the admin.</div>`;
    } else {
      materialsGridDiv.innerHTML = materials.map(item => `
        <div style="border: 1px solid var(--border-color); padding: 15px; border-radius: 8px; background-color: var(--white); display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm);">
          <div>
            <h4 style="color: var(--primary-blue); margin-bottom: 5px;">${item.courseName || getCourseName(item.courseId)}: ${item.title}</h4>
            <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 12px;">${item.description}</p>
          </div>
          <a href="/api/materials/${item.id}/download" class="btn-join" style="text-decoration:none; text-align:center; padding: 6px 12px; font-size: 12px; align-self: flex-start;" target="_blank">Download Notes</a>
        </div>
      `).join('');
    }
  }
}

// --- ADMIN DASHBOARD AND BACKEND CRUD ---
let editingAssignmentId = null;
let editingScheduleId = null;
let editingMaterialId = null;
let editingStudentId = null;

let adminCachedAssignments = [];
let adminCachedSchedule = [];
let adminCachedMaterials = [];
let adminCachedStudents = [];

function cancelAdminEdit(type) {
  if (type === 'assignments') {
    editingAssignmentId = null;
    document.getElementById('form-admin-assignment').reset();
    const submitBtn = document.querySelector('#form-admin-assignment button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Publish Assignment';
  } else if (type === 'schedule') {
    editingScheduleId = null;
    document.getElementById('form-admin-schedule').reset();
    const submitBtn = document.querySelector('#form-admin-schedule button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Schedule Class';
  } else if (type === 'materials') {
    editingMaterialId = null;
    document.getElementById('form-admin-material').reset();
    const submitBtn = document.querySelector('#form-admin-material button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Upload Notes';
  }
  renderAdminDashboard();
}

// Student Roster Rendering
function renderAdminStudentsList(students) {
  const listDiv = document.getElementById('admin-students-list');
  if (!listDiv) return;
  if (!students || students.length === 0) {
    listDiv.innerHTML = `<div style="padding:15px; color:var(--text-muted); font-size:13px; text-align:center;">No students enrolled yet. Use the form on the left to add authorized students.</div>`;
    return;
  }

  listDiv.innerHTML = students.map(s => `
    <div class="admin-list-item" style="border-left: 4px solid #38bdf8;">
      <div class="admin-item-info">
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="badge badge-blue">${getCourseName(s.courseId)}</span>
          <span class="badge ${s.status === 'active' ? 'badge-green' : 'badge-orange'}">${(s.status || 'active').toUpperCase()}</span>
        </div>
        <div class="admin-item-title" style="margin-top: 5px; font-weight:700;">${s.name}</div>
        <div class="admin-item-subtitle" style="font-family:monospace; color:#0284c7; font-size:12px;">📧 ${s.email}</div>
        ${s.phone ? `<div class="admin-item-subtitle" style="font-size:11px; color:var(--text-muted);">📞 ${s.phone}</div>` : ''}
      </div>
      <div style="display:flex; flex-direction:column; gap:5px;">
        <button class="admin-btn admin-btn-accent" style="padding:5px 8px; font-size:11px;" onclick="editAdminStudent(${s.id})">Edit / Pass</button>
        <button class="btn-delete" style="padding:5px 8px; font-size:11px;" onclick="deleteAdminStudent(${s.id})">Revoke</button>
      </div>
    </div>
  `).join('');
}

async function renderAdminDashboard() {
  const [coursesRes, assignmentsRes, scheduleRes, materialsRes, studentsRes] = await Promise.all([
    apiFetch('/api/courses'),
    apiFetch('/api/assignments'),
    apiFetch('/api/schedule'),
    apiFetch('/api/materials'),
    apiFetch('/api/admin/students')
  ]);

  const courses = (coursesRes.success && coursesRes.courses) ? coursesRes.courses : [];
  cachedCourses = courses;
  const assignments = (assignmentsRes.success && assignmentsRes.assignments) ? assignmentsRes.assignments : [];
  const schedule = (scheduleRes.success && scheduleRes.schedule) ? scheduleRes.schedule : [];
  const materials = (materialsRes.success && materialsRes.materials) ? materialsRes.materials : [];
  const students = (studentsRes.success && studentsRes.students) ? studentsRes.students : [];

  adminCachedAssignments = assignments;
  adminCachedSchedule = schedule;
  adminCachedMaterials = materials;
  adminCachedStudents = students;

  const statAssign = document.getElementById('admin-stat-assignments');
  const statSchedule = document.getElementById('admin-stat-schedule');
  const statMaterials = document.getElementById('admin-stat-materials');
  const statStudents = document.getElementById('admin-stat-students');
  if (statAssign) statAssign.textContent = assignments.length;
  if (statSchedule) statSchedule.textContent = schedule.length;
  if (statMaterials) statMaterials.textContent = materials.length;
  if (statStudents) statStudents.textContent = students.length;

  const selectors = document.querySelectorAll('.admin-course-select');
  selectors.forEach(sel => {
    const currentVal = sel.value;
    sel.innerHTML = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    if (currentVal && courses.some(c => c.id === currentVal)) {
      sel.value = currentVal;
    }
  });

  renderAdminStudentsList(students);

  // Render Assignments List
  const assignListDiv = document.getElementById('admin-assignments-list');
  if (assignListDiv) {
    if (assignments.length === 0) {
      assignListDiv.innerHTML = `<div style="padding:15px; color:var(--text-muted); font-size:13px; text-align:center;">No assignments created yet. Add one using the form on the left.</div>`;
    } else {
      assignListDiv.innerHTML = assignments.map(item => `
        <div class="admin-list-item">
          <div class="admin-item-info">
            <span class="badge badge-purple">${item.courseName || getCourseName(item.courseId)}</span>
            <div class="admin-item-title" style="margin-top: 5px;">${item.title}</div>
            <div class="admin-item-subtitle">${item.description}</div>
            <div class="admin-item-subtitle" style="font-weight:600; color:#ef4444;">Due: ${item.dueDate}</div>
          </div>
          <div style="display:flex; gap:5px;">
            <button class="admin-btn admin-btn-accent" style="padding:6px 10px; font-size:12px;" onclick="editAdminItem('assignments', '${item.id}')">Edit</button>
            <button class="btn-delete" style="padding:6px 10px;" onclick="deleteAdminItem('assignments', '${item.id}')">Delete</button>
          </div>
        </div>
      `).join('');
    }
  }

  // Render Schedule List
  const scheduleListDiv = document.getElementById('admin-schedule-list');
  if (scheduleListDiv) {
    if (schedule.length === 0) {
      scheduleListDiv.innerHTML = `<div style="padding:15px; color:var(--text-muted); font-size:13px; text-align:center;">No classes scheduled yet. Add one using the form on the left.</div>`;
    } else {
      scheduleListDiv.innerHTML = schedule.map(item => `
        <div class="admin-list-item">
          <div class="admin-item-info">
            <span class="badge badge-blue">${item.courseName || getCourseName(item.courseId)}</span>
            <span class="badge ${item.status === 'live' ? 'badge-green' : 'badge-orange'}">${item.status}</span>
            <div class="admin-item-title" style="margin-top: 5px;">${item.title}</div>
            <div class="admin-item-subtitle">Instructor: ${item.instructor} | Timings: ${item.timeStart} - ${item.timeEnd}</div>
            <div class="admin-item-subtitle">Date: ${item.date} (${getDayFromDate(item.date)})</div>
            <div class="admin-item-subtitle" style="font-size:11px; margin-top:3px; color:#0284c7; word-break:break-all;">
              🔗 Meeting URL: <a href="${item.meetingLink || item.meeting_link || '#'}" target="_blank" style="color:#0284c7; font-weight:600;">${item.meetingLink || item.meeting_link || 'Default link'}</a>
            </div>
          </div>
          <div style="display:flex; gap:5px;">
            <button class="admin-btn admin-btn-accent" style="padding:6px 10px; font-size:12px;" onclick="editAdminItem('schedule', '${item.id}')">Edit</button>
            <button class="btn-delete" style="padding:6px 10px;" onclick="deleteAdminItem('schedule', '${item.id}')">Delete</button>
          </div>
        </div>
      `).join('');
    }
  }

  // Render Materials List
  const materialsListDiv = document.getElementById('admin-materials-list');
  if (materialsListDiv) {
    if (materials.length === 0) {
      materialsListDiv.innerHTML = `<div style="padding:15px; color:var(--text-muted); font-size:13px; text-align:center;">No study materials uploaded yet. Upload one using the form on the left.</div>`;
    } else {
      materialsListDiv.innerHTML = materials.map(item => `
        <div class="admin-list-item">
          <div class="admin-item-info">
            <span class="badge badge-green">${item.courseName || getCourseName(item.courseId)}</span>
            <div class="admin-item-title" style="margin-top: 5px;">${item.title}</div>
            <div class="admin-item-subtitle">${item.description}</div>
            <div class="admin-item-subtitle" style="font-family:monospace; font-size:11px;">File: ${item.fileName}</div>
          </div>
          <div style="display:flex; gap:5px;">
            <a href="/api/materials/${item.id}/download" target="_blank" class="admin-btn" style="text-decoration:none; padding:6px 10px; font-size:12px; background:#0284c7;">View</a>
            <button class="admin-btn admin-btn-accent" style="padding:6px 10px; font-size:12px;" onclick="editAdminItem('materials', '${item.id}')">Edit</button>
            <button class="btn-delete" style="padding:6px 10px;" onclick="deleteAdminItem('materials', '${item.id}')">Delete</button>
          </div>
        </div>
      `).join('');
    }
  }

  // Load worldwide network status & tunnel links
  loadNetworkStatus();
}

// --- WORLDWIDE ACCESS & GLOBAL TUNNEL CONTROLLERS ---
let currentNetworkStatus = null;

async function loadNetworkStatus() {
  const globalInput = document.getElementById('admin-global-url');
  const localInput = document.getElementById('admin-local-url');
  const ipEl = document.getElementById('admin-tunnel-ip');
  const badge = document.getElementById('tunnel-status-badge');

  if (!globalInput && !localInput) return;

  try {
    const res = await apiFetch('/api/network-status');
    if (res.success) {
      currentNetworkStatus = res;
      if (localInput) {
        localInput.value = res.lanUrl || `http://localhost:${res.port || 8000}`;
      }
      if (ipEl) {
        ipEl.textContent = res.publicIP || 'Auto-detected';
      }

      if (res.publicUrl) {
        if (globalInput) globalInput.value = res.publicUrl;
        if (badge) {
          badge.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #34d399; display: inline-block;"></span> Worldwide Gateway Active';
          badge.style.background = 'rgba(16, 185, 129, 0.2)';
          badge.style.color = '#34d399';
          badge.style.borderColor = '#059669';
        }
      } else {
        if (globalInput) globalInput.value = 'Connecting worldwide tunnel...';
        if (badge) {
          badge.innerHTML = '<span style="width: 8px; height: 8px; border-radius: 50%; background: #fbbf24; display: inline-block;"></span> Initializing Worldwide Gateway...';
          badge.style.background = 'rgba(245, 158, 11, 0.2)';
          badge.style.color = '#fbbf24';
          badge.style.borderColor = '#d97706';
        }
        setTimeout(loadNetworkStatus, 3000);
      }
    }
  } catch (err) {
    console.error('Error fetching network status:', err);
  }
}

async function copyGlobalInviteLink() {
  const globalInput = document.getElementById('admin-global-url');
  const url = globalInput ? globalInput.value.trim() : '';

  if (!url || !url.startsWith('http')) {
    alert('Worldwide tunnel is still initializing. Please wait a few seconds and try again!');
    return;
  }

  const ip = currentNetworkStatus && currentNetworkStatus.publicIP ? currentNetworkStatus.publicIP : '';
  const message = `🎓 Ask Classes — Live Online Tuition\nJoin our live interactive class sessions and access study materials from anywhere!\n\n👉 Join Link: ${url}\n(Open from Mobile 4G/5G, Tablet, or PC)\n${ip ? `\n🔑 Password (if asked): ${ip}` : ''}`;

  try {
    await navigator.clipboard.writeText(message);
    alert('📋 Student Worldwide Invite copied to clipboard!\nYou can now paste it on WhatsApp, Telegram, or SMS.');
  } catch (err) {
    if (globalInput) {
      globalInput.select();
      document.execCommand('copy');
      alert('📋 Link copied to clipboard!');
    }
  }
}

function copyLocalLink() {
  const localInput = document.getElementById('admin-local-url');
  if (!localInput) return;
  localInput.select();
  document.execCommand('copy');
  alert('📱 Local WiFi link copied!');
}

function shareToWhatsApp() {
  const globalInput = document.getElementById('admin-global-url');
  const url = globalInput ? globalInput.value.trim() : '';

  if (!url || !url.startsWith('http')) {
    alert('Worldwide tunnel is still initializing. Please wait a few seconds and try again!');
    return;
  }

  const ip = currentNetworkStatus && currentNetworkStatus.publicIP ? currentNetworkStatus.publicIP : '';
  const message = `🎓 *Ask Classes — Online Coaching*\nJoin our live class session from anywhere:\n👉 ${url}\n${ip ? `\n🔑 Password (if asked): ${ip}` : ''}`;
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(whatsappUrl, '_blank');
}

async function refreshGlobalTunnel() {
  const globalInput = document.getElementById('admin-global-url');
  const badge = document.getElementById('tunnel-status-badge');

  if (globalInput) globalInput.value = 'Reconnecting global gateway...';
  if (badge) {
    badge.innerHTML = '🔄 Reconnecting...';
  }

  try {
    const res = await apiFetch('/api/tunnel/start', { method: 'POST' });
    if (res.success) {
      setTimeout(loadNetworkStatus, 3000);
    } else {
      alert('Error restarting tunnel: ' + res.message);
    }
  } catch (err) {
    alert('Error connecting to backend: ' + err.message);
  }
}

// Edit Item trigger
function editAdminItem(type, id) {
  if (type === 'assignments') {
    const item = adminCachedAssignments.find(x => x.id === id);
    if (!item) return;

    document.getElementById('assign-course').value = item.courseId;
    document.getElementById('assign-title').value = item.title;
    document.getElementById('assign-desc').value = item.description;
    document.getElementById('assign-date').value = item.dueDate;

    editingAssignmentId = id;
    const submitBtn = document.querySelector('#form-admin-assignment button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Assignment';

  } else if (type === 'schedule') {
    const item = adminCachedSchedule.find(x => x.id === id);
    if (!item) return;

    document.getElementById('sched-course').value = item.courseId;
    document.getElementById('sched-title').value = item.title;
    document.getElementById('sched-instructor').value = item.instructor;
    document.getElementById('sched-date').value = item.date;
    document.getElementById('sched-time-start').value = item.timeStart;
    document.getElementById('sched-time-end').value = item.timeEnd;
    document.getElementById('sched-status').value = item.status;
    const linkInput = document.getElementById('sched-link');
    if (linkInput) linkInput.value = item.meetingLink || item.meeting_link || '';

    editingScheduleId = id;
    const submitBtn = document.querySelector('#form-admin-schedule button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Class Details';

  } else if (type === 'materials') {
    const item = adminCachedMaterials.find(x => x.id === id);
    if (!item) return;

    document.getElementById('mat-course').value = item.courseId;
    document.getElementById('mat-title').value = item.title;
    document.getElementById('mat-desc').value = item.description;

    editingMaterialId = id;
    const submitBtn = document.querySelector('#form-admin-material button[type="submit"]');
    if (submitBtn) submitBtn.textContent = 'Update Study Notes';
  }

  window.scrollTo({ top: 300, behavior: 'smooth' });
}

// Add/Update Submit Handlers connected to backend
async function addAssignmentHandler(event) {
  event.preventDefault();
  const courseId = document.getElementById('assign-course').value;
  const title = document.getElementById('assign-title').value.trim();
  const description = document.getElementById('assign-desc').value.trim();
  const dueDate = document.getElementById('assign-date').value;

  if (!title || !dueDate) {
    alert('Please fill in the title and due date.');
    return;
  }

  const payload = { courseId, title, description, dueDate };

  if (editingAssignmentId) {
    const res = await apiFetch(`/api/assignments/${editingAssignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (res.success) {
      alert('Assignment updated successfully in database!');
      editingAssignmentId = null;
      const submitBtn = document.querySelector('#form-admin-assignment button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Publish Assignment';
    } else {
      alert('Error updating assignment: ' + res.message);
    }
  } else {
    const res = await apiFetch('/api/assignments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success) {
      alert('Assignment published and stored in database!');
    } else {
      alert('Error publishing assignment: ' + res.message);
    }
  }

  document.getElementById('form-admin-assignment').reset();
  renderAdminDashboard();
}

async function scheduleClassHandler(event) {
  event.preventDefault();
  const courseId = document.getElementById('sched-course').value;
  const title = document.getElementById('sched-title').value.trim();
  const instructor = document.getElementById('sched-instructor').value.trim();
  const date = document.getElementById('sched-date').value;
  const timeStart = document.getElementById('sched-time-start').value;
  const timeEnd = document.getElementById('sched-time-end').value;
  const status = document.getElementById('sched-status').value;
  const linkInput = document.getElementById('sched-link');
  const meetingLink = linkInput ? linkInput.value.trim() : 'https://meet.google.com/ask-live-class';

  if (!title || !instructor || !date || !timeStart || !timeEnd) {
    alert('Please fill in all schedule fields.');
    return;
  }

  const payload = { courseId, title, instructor, date, timeStart, timeEnd, status, meetingLink };

  if (editingScheduleId) {
    const res = await apiFetch(`/api/schedule/${editingScheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (res.success) {
      alert('Class schedule details updated in database!');
      editingScheduleId = null;
      const submitBtn = document.querySelector('#form-admin-schedule button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Schedule Class';
    } else {
      alert('Error updating schedule: ' + res.message);
    }
  } else {
    const res = await apiFetch('/api/schedule', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (res.success) {
      alert('Class scheduled successfully in database!');
    } else {
      alert('Error scheduling class: ' + res.message);
    }
  }

  document.getElementById('form-admin-schedule').reset();
  renderAdminDashboard();
}

async function uploadMaterialHandler(event) {
  event.preventDefault();
  const courseId = document.getElementById('mat-course').value;
  const title = document.getElementById('mat-title').value.trim();
  const description = document.getElementById('mat-desc').value.trim();
  const fileInput = document.getElementById('mat-file');
  
  if (!title) {
    alert('Please provide a title for the study notes.');
    return;
  }

  const formData = new FormData();
  formData.append('courseId', courseId);
  formData.append('title', title);
  formData.append('description', description);
  if (fileInput.files.length > 0) {
    formData.append('file', fileInput.files[0]);
  } else {
    formData.append('fileName', `${title.replace(/\s+/g, '_')}.pdf`);
  }

  if (editingMaterialId) {
    const res = await apiFetch(`/api/materials/${editingMaterialId}`, {
      method: 'PUT',
      body: formData
    });
    if (res.success) {
      alert('Study notes updated successfully in database!');
      editingMaterialId = null;
      const submitBtn = document.querySelector('#form-admin-material button[type="submit"]');
      if (submitBtn) submitBtn.textContent = 'Upload Notes';
    } else {
      alert('Error updating study material: ' + res.message);
    }
  } else {
    const res = await apiFetch('/api/materials', {
      method: 'POST',
      body: formData
    });
    if (res.success) {
      alert('Study notes uploaded and stored in database!');
    } else {
      alert('Error uploading notes: ' + res.message);
    }
  }

  document.getElementById('form-admin-material').reset();
  renderAdminDashboard();
}

async function deleteAdminItem(type, id) {
  if (!confirm(`Are you sure you want to delete this ${type.slice(0, -1)}?`)) {
    return;
  }

  const res = await apiFetch(`/api/${type}/${id}`, {
    method: 'DELETE'
  });

  if (res.success) {
    alert('Item deleted successfully from database.');
  } else {
    alert('Error deleting item: ' + res.message);
  }

  if (type === 'assignments' && editingAssignmentId === id) {
    cancelAdminEdit('assignments');
  } else if (type === 'schedule' && editingScheduleId === id) {
    cancelAdminEdit('schedule');
  } else if (type === 'materials' && editingMaterialId === id) {
    cancelAdminEdit('materials');
  }

  renderAdminDashboard();
}

// Reset database data
async function resetSystemData() {
  if (confirm('This will clear all assignments, scheduled classes, and study materials from the database. Do you want to proceed?')) {
    const res = await apiFetch('/api/admin/reset', { method: 'POST' });
    if (res.success) {
      alert('Database reset successfully!');
      if (document.getElementById('admin-assignments-list')) {
        renderAdminDashboard();
      } else {
        renderStudentDashboard();
      }
    }
  }
}

// --- STUDENT ENROLLMENT & WHITELIST HANDLERS ---
async function addStudentHandler(event) {
  event.preventDefault();
  const name = document.getElementById('student-name').value.trim();
  const email = document.getElementById('student-email').value.trim();
  const password = document.getElementById('student-pass').value.trim();
  const courseId = document.getElementById('student-course').value;
  const phone = document.getElementById('student-phone').value.trim();

  if (!name || !email) {
    alert('Please enter student name and email.');
    return;
  }

  if (editingStudentId) {
    const res = await apiFetch(`/api/admin/students/${editingStudentId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, email, password, courseId, phone })
    });
    if (res.success) {
      alert('Student details & password updated successfully!');
      cancelStudentEdit();
    } else {
      alert('Error updating student: ' + res.message);
    }
  } else {
    if (!password) {
      alert('Please set a password for the student.');
      return;
    }
    const res = await apiFetch('/api/admin/students', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, courseId, phone })
    });
    if (res.success) {
      alert(`🎉 Student "${name}" (${email}) enrolled and authorized to log in!`);
      const form = document.getElementById('form-admin-student');
      if (form) form.reset();
    } else {
      alert('Error adding student: ' + res.message);
    }
  }

  renderAdminDashboard();
}

function editAdminStudent(id) {
  const student = adminCachedStudents.find(s => s.id === id);
  if (!student) return;

  document.getElementById('student-name').value = student.name;
  document.getElementById('student-email').value = student.email;
  document.getElementById('student-pass').value = '';
  document.getElementById('student-pass').placeholder = 'Leave blank to keep current password';
  document.getElementById('student-course').value = student.courseId || 'c10';
  document.getElementById('student-phone').value = student.phone || '';

  editingStudentId = id;
  const submitBtn = document.querySelector("#form-admin-student button[type='submit']");
  if (submitBtn) submitBtn.textContent = 'Update Student Details';
  const cancelBtn = document.getElementById('btn-cancel-student-edit');
  if (cancelBtn) cancelBtn.style.display = 'block';

  window.scrollTo({ top: 300, behavior: 'smooth' });
}

function cancelStudentEdit() {
  editingStudentId = null;
  const form = document.getElementById('form-admin-student');
  if (form) form.reset();
  const submitBtn = document.querySelector("#form-admin-student button[type='submit']");
  if (submitBtn) submitBtn.textContent = '+ Add & Authorize Student';
  const cancelBtn = document.getElementById('btn-cancel-student-edit');
  if (cancelBtn) cancelBtn.style.display = 'none';
  const passInput = document.getElementById('student-pass');
  if (passInput) passInput.placeholder = 'e.g. Rahul@2026';
}

async function deleteAdminStudent(id) {
  if (!confirm("Are you sure you want to revoke this student's access? They will no longer be able to log in.")) {
    return;
  }

  const res = await apiFetch(`/api/admin/students/${id}`, { method: 'DELETE' });
  if (res.success) {
    alert('Student access revoked and removed from roster.');
    if (editingStudentId === id) {
      cancelStudentEdit();
    }
  } else {
    alert('Error revoking access: ' + res.message);
  }
  renderAdminDashboard();
}

// Attach helpers to window
window.deleteAdminItem = deleteAdminItem;
window.editAdminItem = editAdminItem;
window.cancelAdminEdit = cancelAdminEdit;
window.resetSystemData = resetSystemData;
window.switchTab = switchTab;
window.handleSignOut = handleSignOut;
window.handleRegistration = handleRegistration;
window.handleLogin = handleLogin;
window.toggleForm = toggleForm;
window.toggleFormDirect = toggleFormDirect;
window.handleRegisterClick = handleRegisterClick;
window.closeQuoteModal = closeQuoteModal;
window.toggleChatPanel = toggleChatPanel;
window.sendChatMessage = sendChatMessage;
window.openRequestCourse = openRequestCourse;
window.addStudentHandler = addStudentHandler;
window.editAdminStudent = editAdminStudent;
window.cancelStudentEdit = cancelStudentEdit;
window.deleteAdminStudent = deleteAdminStudent;
window.loadNetworkStatus = loadNetworkStatus;
window.copyGlobalInviteLink = copyGlobalInviteLink;
window.copyLocalLink = copyLocalLink;
window.shareToWhatsApp = shareToWhatsApp;
window.refreshGlobalTunnel = refreshGlobalTunnel;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('panel-0')) {
    renderStudentDashboard();
  }

  if (document.getElementById('admin-assignments-list')) {
    renderAdminDashboard();
    
    const formAssign = document.getElementById('form-admin-assignment');
    if (formAssign) formAssign.addEventListener('submit', addAssignmentHandler);

    const formSched = document.getElementById('form-admin-schedule');
    if (formSched) formSched.addEventListener('submit', scheduleClassHandler);

    const formMat = document.getElementById('form-admin-material');
    if (formMat) formMat.addEventListener('submit', uploadMaterialHandler);

    const formStudent = document.getElementById('form-admin-student');
    if (formStudent) formStudent.addEventListener('submit', addStudentHandler);
  }
});
