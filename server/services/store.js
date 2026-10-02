import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const INITIAL_DATA = {
  users: [
    {
      id: 'user-hr-01',
      name: 'Sarah Lin',
      email: 'hr@tidalats.com',
      password: 'password123',
      role: 'hr',
      title: 'Head of Talent Acquisition',
      company: 'Tidal Technologies'
    },
    {
      id: 'user-app-01',
      name: 'Jordan Hayes',
      email: 'jordan.hayes@example.com',
      password: 'password123',
      role: 'applicant',
      title: 'Senior Software Engineer',
      phone: '+1 (555) 234-5678'
    },
    {
      id: 'user-app-02',
      name: 'Elena Rostova',
      email: 'elena.rostova@example.com',
      password: 'password123',
      role: 'applicant',
      title: 'Product Designer',
      phone: '+1 (555) 876-5432'
    }
  ],
  jobs: [
    {
      id: 'job-01',
      title: 'Senior Full Stack Engineer (React & Node.js)',
      department: 'Engineering',
      location: 'Remote / San Francisco, CA',
      type: 'Full-time',
      experienceLevel: 'Senior (5+ years)',
      salaryRange: '$145,000 - $185,000 USD',
      status: 'open',
      description: 'We are seeking an experienced Full Stack Engineer to lead architecture on our cloud applications. You will design resilient APIs, build high-performance React frontends, and collaborate with product teams on high-impact scalable services.\n\nRequirements:\n- 5+ years of experience with React, TypeScript/JavaScript, and Node.js.\n- Strong understanding of REST APIs, database schemas, and microservices.\n- Experience with cloud infrastructure and CI/CD pipelines.\n- Passion for clean architecture, automated testing, and developer experience.',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7
    },
    {
      id: 'job-02',
      title: 'Lead AI / ML Solutions Architect',
      department: 'AI & Data Science',
      location: 'Hybrid / New York, NY',
      type: 'Full-time',
      experienceLevel: 'Lead / Principal',
      salaryRange: '$175,000 - $220,000 USD',
      status: 'open',
      description: 'Lead the next generation of AI-driven recruiting and enterprise productivity intelligence. In this role, you will architect multimodal LLM pipelines, implement retrieval-augmented generation (RAG) frameworks, and deploy secure enterprise AI workflows.\n\nRequirements:\n- Deep expertise in foundation models, Gemini API, PyTorch, or Hugging Face.\n- Experience deploying scalable LLM systems in production.\n- Proven background in software engineering and distributed computing.',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5
    },
    {
      id: 'job-03',
      title: 'Senior Product Designer (Design Systems)',
      department: 'Product & Design',
      location: 'Remote / Worldwide',
      type: 'Full-time',
      experienceLevel: 'Mid-Senior (4+ years)',
      salaryRange: '$120,000 - $155,000 USD',
      status: 'open',
      description: 'Join our design team to craft state-of-the-art user experiences for enterprise workflow products. You will maintain our design system, facilitate user research, and build interactive prototypes.\n\nRequirements:\n- Proven portfolio showcasing high-fidelity UI/UX design and design tokens.\n- Mastery of Figma, component architecture, and accessibility (WCAG AA).\n- Strong communication skills and cross-functional leadership.',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3
    }
  ],
  applications: [
    {
      id: 'app-01',
      jobId: 'job-01',
      userId: 'user-app-01',
      name: 'Jordan Hayes',
      email: 'jordan.hayes@example.com',
      phone: '+1 (555) 234-5678',
      role: 'Senior Full Stack Developer',
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker', 'GraphQL', 'Vite'],
      experienceSummary: '6 years developing enterprise SaaS platforms. Led frontend redesign reducing latency by 40%. Extensive hands-on backend Node.js and REST API engineering.',
      resumeText: `JORDAN HAYES\nSenior Full Stack Developer\njordan.hayes@example.com | +1 (555) 234-5678 | San Francisco, CA\n\nSUMMARY\nAccomplished Full Stack Software Engineer with 6+ years of specialized experience designing and maintaining high-throughput web applications using React, TypeScript, Node.js, and relational databases. Strong focus on clean architecture, component reusability, and automated testing.\n\nEXPERIENCE\nSenior Software Engineer - CloudScale Technologies (2022 - Present)\n- Led a squad of 5 engineers delivering high-performance customer dashboard.\n- Re-architected legacy backend services into modular Node.js REST APIs.\n- Built real-time WebSocket notifications and data pipelines.\n\nFull Stack Developer - NextGen Systems (2019 - 2022)\n- Created dynamic React components and optimized client bundle sizes.\n- Authored unit and integration test suites achieving 88% coverage.\n\nEDUCATION\nB.S. in Computer Science - University of California, Berkeley (2019)\n\nSKILLS\nReact, Node.js, Express, JavaScript, TypeScript, PostgreSQL, TailwindCSS, Docker, CI/CD, Jest`,
      fileName: 'Jordan_Hayes_Resume.pdf',
      fileSize: 42000,
      stage: 'Shortlisted',
      geminiScore: 92,
      geminiRationale: 'Exceptional match. Candidate boasts 6+ years of direct React and Node.js expertise with proven architectural leadership and cloud delivery.',
      isScreening: false,
      geminiError: null,
      interview: {
        scheduledAt: '2026-10-06T15:00:00Z',
        interviewer: 'Sarah Lin & David Chen (Eng Lead)',
        type: 'Technical System Design',
        meetingLink: 'https://meet.google.com/ats-tech-interview',
        notes: 'Prepare to discuss REST API decoupling and React state caching.'
      },
      recruiterNotes: 'Candidate demonstrated strong technical communication in the initial screening. Impressed by their system design experience.',
      evaluation: {
        rating: 5,
        recommendation: 'Strong Hire',
        comments: 'Excellent culture fit, depth in Node and React architecture.',
        evaluatedBy: 'Sarah Lin',
        evaluatedAt: Date.now() - 1000 * 60 * 60 * 12
      },
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 4,
      updatedAt: Date.now() - 1000 * 60 * 60 * 12
    },
    {
      id: 'app-02',
      jobId: 'job-03',
      userId: 'user-app-02',
      name: 'Elena Rostova',
      email: 'elena.rostova@example.com',
      phone: '+1 (555) 876-5432',
      role: 'Lead UI/UX Designer',
      skills: ['Figma', 'Design Systems', 'Design Tokens', 'User Research', 'Prototyping', 'WCAG AA'],
      experienceSummary: '5 years crafting design systems and enterprise SaaS UX at scale. Strong advocate for accessible, human-centric design.',
      resumeText: `ELENA ROSTOVA\nLead Product Designer\nelena.rostova@example.com | New York, NY\n\nPROFESSIONAL SUMMARY\nProduct Designer with 5+ years of experience leading design system initiatives and building complex user flows for enterprise B2B software.\n\nEXPERIENCE\nSenior UI/UX Designer - Apex Design Lab (2021 - Present)\n- Built comprehensive multi-brand design system in Figma.\n- Conducted 60+ usability testing sessions to streamline applicant workflows.\n\nSKILLS\nFigma, Design Systems, Design Tokens, User Testing, Wireframing, CSS/HTML fundamentals`,
      fileName: 'Elena_Rostova_Portfolio_Resume.pdf',
      fileSize: 38000,
      stage: 'Initial Screening',
      geminiScore: 88,
      geminiRationale: 'Strong alignment with the Design Systems role. Extensive Figma component architecture and research experience.',
      isScreening: false,
      geminiError: null,
      interview: null,
      recruiterNotes: 'Reviewing portfolio case studies. Clean aesthetic and solid design system governance.',
      evaluation: null,
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 1
    }
  ],
  notifications: [
    {
      id: 'notif-01',
      applicationId: 'app-01',
      jobId: 'job-01',
      recipientEmail: 'jordan.hayes@example.com',
      recipientName: 'Jordan Hayes',
      stage: 'Shortlisted',
      subject: 'Update on your application: Senior Full Stack Engineer (React & Node.js)',
      body: 'Hi Jordan,\n\nWe are pleased to inform you that your application for Senior Full Stack Engineer (React & Node.js) has been shortlisted!\n\nOur recruiting team was very impressed with your background. We will be reaching out soon with next steps regarding scheduling your technical interview.\n\nBest regards,\nTidal Talent Team',
      sentAt: Date.now() - 1000 * 60 * 60 * 12,
      read: false
    }
  ]
};

class Store {
  constructor() {
    this._ensureDir();
    this.data = this._loadData();
  }

  _ensureDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  _loadData() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          users: parsed.users || INITIAL_DATA.users,
          jobs: parsed.jobs || INITIAL_DATA.jobs,
          applications: parsed.applications || INITIAL_DATA.applications,
          notifications: parsed.notifications || INITIAL_DATA.notifications
        };
      }
    } catch (err) {
      console.warn('[Store] Failed to read db.json, falling back to initial data:', err);
    }
    this._saveData(INITIAL_DATA);
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }

  _saveData(dataToSave) {
    try {
      this._ensureDir();
      fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave || this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('[Store] Failed to persist data to db.json:', err);
    }
  }

  save() {
    this._saveData(this.data);
  }

  // --- Users ---
  getUsers() {
    return this.data.users;
  }

  getUserById(id) {
    return this.data.users.find(u => u.id === id);
  }

  getUserByEmail(email) {
    return this.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  getUserByEmailAndPassword(email, password) {
    return this.data.users.find(
      u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
  }

  createUser(userData) {
    const newUser = {
      id: userData.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: Date.now(),
      ...userData
    };
    this.data.users.push(newUser);
    this.save();
    return newUser;
  }

  // --- Jobs ---
  getJobs() {
    return [...this.data.jobs].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  getJobById(id) {
    return this.data.jobs.find(j => j.id === id);
  }

  createJob(jobData) {
    const newJob = {
      id: jobData.id || `job-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      title: jobData.title || 'Untitled Role',
      department: jobData.department || 'General',
      location: jobData.location || 'Remote',
      type: jobData.type || 'Full-time',
      experienceLevel: jobData.experienceLevel || 'Mid-Senior',
      salaryRange: jobData.salaryRange || 'Competitive',
      status: jobData.status || 'open',
      description: jobData.description || '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.data.jobs.unshift(newJob);
    this.save();
    return newJob;
  }

  updateJob(id, updates) {
    const index = this.data.jobs.findIndex(j => j.id === id);
    if (index === -1) return null;
    this.data.jobs[index] = {
      ...this.data.jobs[index],
      ...updates,
      updatedAt: Date.now()
    };
    this.save();
    return this.data.jobs[index];
  }

  deleteJob(id) {
    const index = this.data.jobs.findIndex(j => j.id === id);
    if (index === -1) return false;
    this.data.jobs.splice(index, 1);
    this.save();
    return true;
  }

  // --- Applications ---
  getApplications() {
    return [...this.data.applications].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  getApplicationById(id) {
    return this.data.applications.find(a => a.id === id);
  }

  getApplicationsByUserId(userId) {
    return this.data.applications
      .filter(a => a.userId === userId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  getApplicationsByJobId(jobId) {
    return this.data.applications
      .filter(a => a.jobId === jobId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  createApplication(appData) {
    const newApp = {
      id: appData.id || `app-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      jobId: appData.jobId,
      userId: appData.userId || null,
      name: appData.name,
      email: appData.email,
      phone: appData.phone || '',
      role: appData.role || '',
      skills: Array.isArray(appData.skills) ? appData.skills : [],
      experienceSummary: appData.experienceSummary || '',
      resumeText: appData.resumeText || '',
      fileName: appData.fileName || '',
      fileSize: appData.fileSize || 0,
      stage: appData.stage || 'Application Submitted',
      geminiScore: appData.geminiScore ?? null,
      geminiRationale: appData.geminiRationale || null,
      isScreening: false,
      geminiError: null,
      interview: appData.interview || null,
      recruiterNotes: appData.recruiterNotes || '',
      evaluation: appData.evaluation || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.data.applications.unshift(newApp);
    this.save();
    return newApp;
  }

  updateApplication(id, updates) {
    const index = this.data.applications.findIndex(a => a.id === id);
    if (index === -1) return null;
    this.data.applications[index] = {
      ...this.data.applications[index],
      ...updates,
      updatedAt: Date.now()
    };
    this.save();
    return this.data.applications[index];
  }

  deleteApplication(id) {
    const index = this.data.applications.findIndex(a => a.id === id);
    if (index === -1) return false;
    this.data.applications.splice(index, 1);
    this.save();
    return true;
  }

  // --- Notifications ---
  getNotifications() {
    return [...this.data.notifications].sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
  }

  getNotificationsForUser(email) {
    if (!email) return [];
    return this.data.notifications
      .filter(n => n.recipientEmail.toLowerCase() === email.toLowerCase())
      .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
  }

  createNotification(notifData) {
    const notif = {
      id: notifData.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      applicationId: notifData.applicationId,
      jobId: notifData.jobId,
      recipientEmail: notifData.recipientEmail,
      recipientName: notifData.recipientName,
      stage: notifData.stage,
      subject: notifData.subject,
      body: notifData.body,
      sentAt: Date.now(),
      read: false
    };
    this.data.notifications.unshift(notif);
    this.save();
    return notif;
  }

  markNotificationAsRead(id) {
    const notif = this.data.notifications.find(n => n.id === id);
    if (notif) {
      notif.read = true;
      this.save();
    }
    return notif;
  }
}

export const store = new Store();
