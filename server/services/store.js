import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'node:crypto';
import { hashPassword, isPasswordHash, verifyPassword } from './passwordService.js';
import { DEFAULT_SCORECARD_CRITERIA, ensureApplicationTimeline } from './atsHelper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const MAX_BACKUPS = Math.max(3, Number(process.env.DB_MAX_BACKUPS || 10));
const BACKUP_INTERVAL_MS = Math.max(30_000, Number(process.env.DB_BACKUP_INTERVAL_MS || 5 * 60 * 1000));

const INITIAL_DATA = {
  users: [
    {
      id: 'user-hr-01',
      name: 'Sarah Lin',
      email: 'hr@tidalats.com',
      passwordHash: 'scrypt$16384$8$1$718d2cbe691211c434971e82d93d6be1$ace78bdbc68276cccb5b364a9c8e4b6353eca9081033526b3d2254b4fb31a17403c16f017d3751b20952c9379c28f4b7d9f70d446109bb782911f889762a2e07',
      role: 'hr',
      title: 'Head of Talent Acquisition',
      company: 'Tidal Technologies',
      emailVerified: true
    },
    {
      id: 'user-app-01',
      name: 'Jordan Hayes',
      email: 'jordan.hayes@example.com',
      passwordHash: 'scrypt$16384$8$1$718d2cbe691211c434971e82d93d6be1$ace78bdbc68276cccb5b364a9c8e4b6353eca9081033526b3d2254b4fb31a17403c16f017d3751b20952c9379c28f4b7d9f70d446109bb782911f889762a2e07',
      role: 'applicant',
      title: 'Senior Software Engineer',
      phone: '+1 (555) 234-5678',
      emailVerified: true
    },
    {
      id: 'user-app-02',
      name: 'Elena Rostova',
      email: 'elena.rostova@example.com',
      passwordHash: 'scrypt$16384$8$1$718d2cbe691211c434971e82d93d6be1$ace78bdbc68276cccb5b364a9c8e4b6353eca9081033526b3d2254b4fb31a17403c16f017d3751b20952c9379c28f4b7d9f70d446109bb782911f889762a2e07',
      role: 'applicant',
      title: 'Product Designer',
      phone: '+1 (555) 876-5432',
      emailVerified: true
    }
  ],
  jobs: [
    {
      id: 'job-01',
      title: 'Senior Full Stack Engineer (React & Node.js)',
      department: 'Engineering',
      location: 'Bonifacio Global City (BGC), Taguig',
      type: 'Full-time',
      experienceLevel: 'Senior (5+ years)',
      salaryRange: '₱120,000 - ₱175,000 / mo',
      status: 'open',
      scoringWeights: { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 },
      requiredSkills: ["React", "TypeScript", "JavaScript", "Node.js", "REST APIs", "database", "microservices", "cloud", "CI/CD"],
      nonRequiredSkills: ["GraphQL", "Docker", "TailwindCSS", "automated testing"],
      description: 'We are seeking an experienced Full Stack Engineer to lead architecture on our cloud applications. You will design resilient APIs, build high-performance React frontends, and collaborate with product teams on high-impact scalable services.\n\nRequirements:\n- 5+ years of experience with React, TypeScript/JavaScript, and Node.js.\n- Strong understanding of REST APIs, database schemas, and microservices.\n- Experience with cloud infrastructure and CI/CD pipelines.\n- Passion for clean architecture, automated testing, and developer experience.',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 7,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 7
    },
    {
      id: 'job-02',
      title: 'Lead AI / ML Solutions Architect',
      department: 'AI & Data Science',
      location: 'Makati City, Metro Manila',
      type: 'Full-time',
      experienceLevel: 'Lead / Principal',
      salaryRange: '₱150,000 - ₱220,000 / mo',
      status: 'open',
      scoringWeights: { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 },
      requiredSkills: ["foundation models", "Gemini API", "PyTorch", "Hugging Face", "LLM", "production", "software engineering", "distributed computing"],
      nonRequiredSkills: ["RAG", "multimodal", "retrieval augmented generation"],
      description: 'Lead the next generation of AI-driven recruiting and enterprise productivity intelligence. In this role, you will architect multimodal LLM pipelines, implement retrieval-augmented generation (RAG) frameworks, and deploy secure enterprise AI workflows.\n\nRequirements:\n- Deep expertise in foundation models, Gemini API, PyTorch, or Hugging Face.\n- Experience deploying scalable LLM systems in production.\n- Proven background in software engineering and distributed computing.',
      createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
      updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5
    },
    {
      id: 'job-03',
      title: 'Senior Product Designer (Design Systems)',
      department: 'Product & Design',
      location: 'Cebu IT Park, Cebu City (Remote / Hybrid)',
      type: 'Full-time',
      experienceLevel: 'Mid-Senior (4+ years)',
      salaryRange: '₱85,000 - ₱130,000 / mo',
      status: 'open',
      scoringWeights: { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 },
      requiredSkills: ["Figma", "design systems", "design tokens", "component architecture", "accessibility", "user research"],
      nonRequiredSkills: ["prototyping", "wireframing", "CSS", "HTML"],
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
  ],
  sessions: [],
  emailLogs: [],
  emailQueue: []
};

class Store {
  constructor(options = {}) {
    this.dataDir = options.dataDir || DATA_DIR;
    this.dbFile = options.dbFile || path.join(this.dataDir, 'db.json');
    this.backupDir = options.backupDir || path.join(this.dataDir, 'backups');
    this.maxBackups = Math.max(3, Number(options.maxBackups || MAX_BACKUPS));
    this.backupIntervalMs = Math.max(30_000, Number(options.backupIntervalMs || BACKUP_INTERVAL_MS));
    this.lastBackupAt = 0;
    this._ensureDir();
    this.data = this._loadData();
  }

  _ensureDir() {
    fs.mkdirSync(this.dataDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });
  }

  _backupFiles() {
    if (!fs.existsSync(this.backupDir)) return [];
    return fs.readdirSync(this.backupDir)
      .filter(name => /^db-\d{8}-\d{6}[-.]\d{3}\.(?:json|bak)$/.test(name))
      .map(name => ({ name, path: path.join(this.backupDir, name) }))
      .filter(item => { try { return fs.statSync(item.path).isFile(); } catch { return false; } })
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  _pruneBackups() {
    const files = this._backupFiles();
    for (const item of files.slice(this.maxBackups)) {
      try { fs.unlinkSync(item.path); } catch (err) { console.warn('[Store] Failed to prune backup:', err.message); }
    }
  }

  _createBackup(reason = 'scheduled') {
    if (!fs.existsSync(this.dbFile)) return null;
    this._ensureDir();
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:]/g, '').replace('T', '-').replace('Z', '');
    const filePath = path.join(this.backupDir, `db-${stamp}.json`);
    fs.copyFileSync(this.dbFile, filePath);
    this.lastBackupAt = Date.now();
    this._pruneBackups();
    return { filePath, reason, createdAt: this.lastBackupAt };
  }

  createBackup(reason = 'manual') {
    return this._createBackup(reason);
  }

  getPersistenceStatus() {
    const backup = this._backupFiles()[0] || null;
    return {
      dbFile: this.dbFile,
      databaseExists: fs.existsSync(this.dbFile),
      latestBackupAt: backup ? fs.statSync(backup.path).mtimeMs : null,
      backupCount: this._backupFiles().length
    };
  }

  _loadLatestValidBackup() {
    for (const item of this._backupFiles()) {
      try {
        const parsed = JSON.parse(fs.readFileSync(item.path, 'utf8'));
        if (!parsed || typeof parsed !== 'object') continue;
        console.warn(`[Store] Recovering database from backup: ${item.name}`);
        this._writeAtomic(parsed);
        this.lastBackupAt = Date.now();
        return parsed;
      } catch (err) {
        console.warn(`[Store] Ignoring invalid backup ${item.name}:`, err.message);
      }
    }
    return null;
  }

  _writeAtomic(dataToSave) {
    this._ensureDir();
    const tempFile = `${this.dbFile}.${process.pid}.${Date.now()}.tmp`;
    const json = JSON.stringify(dataToSave, null, 2);
    fs.writeFileSync(tempFile, json, { encoding: 'utf8', mode: 0o600 });
    try {
      fs.renameSync(tempFile, this.dbFile);
    } catch (err) {
      // Windows cannot rename over an existing file. Keep the temp/write step
      // and replace the target as a fallback.
      if (err.code !== 'EEXIST' && err.code !== 'EPERM') throw err;
      try { fs.rmSync(this.dbFile, { force: true }); } catch {}
      fs.renameSync(tempFile, this.dbFile);
    } finally {
      try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch {}
    }
  }

  _loadData() {
    const normalizeData = (parsed) => {
      const savedUsers = Array.isArray(parsed.users) ? parsed.users : [];
      let needsMigrationSave = false;

      const seedUsers = INITIAL_DATA.users.map(seed => {
        const saved = savedUsers.find(u => u.id === seed.id);
        if (!saved) return { ...seed };
        const restored = { ...seed, ...saved };
        for (const [key, value] of Object.entries(seed)) {
          if (restored[key] == null) restored[key] = value;
        }
        return restored;
      });

      const seedIds = new Set(INITIAL_DATA.users.map(u => u.id));
      const customUsers = savedUsers
        .filter(u => !seedIds.has(u.id))
        .map(u => ({ ...u, emailVerified: u.emailVerified !== false }));

      const users = [...seedUsers, ...customUsers].map(user => {
        const migrated = { ...user };
        if (!isPasswordHash(migrated.passwordHash) && migrated.password) {
          migrated.passwordHash = hashPassword(migrated.password);
          delete migrated.password;
          needsMigrationSave = true;
        }
        if (Object.prototype.hasOwnProperty.call(migrated, 'password')) {
          delete migrated.password;
          needsMigrationSave = true;
        }
        return migrated;
      });

      const applications = Array.isArray(parsed.applications) ? parsed.applications : INITIAL_DATA.applications;
      const notifications = (Array.isArray(parsed.notifications) ? parsed.notifications : INITIAL_DATA.notifications).map(notification => {
        if (notification.recipientUserId) return notification;
        const app = applications.find(item => item.id === notification.applicationId);
        const user = app?.userId
          ? users.find(item => item.id === app.userId)
          : users.find(item => String(item.email || '').toLowerCase() === String(notification.recipientEmail || '').toLowerCase());
        if (user) needsMigrationSave = true;
        return user ? { ...notification, recipientUserId: user.id } : notification;
      });

      // Phase 4 notification migration: existing applications were historically
      // recorded only against the applicant. Give each HR account its own
      // in-app application notification so the HR portal has useful history
      // without sharing notification ownership between accounts.
      const hrUsers = users.filter(user => user.role === 'hr');
      for (const application of applications) {
        const job = (Array.isArray(parsed.jobs) ? parsed.jobs : INITIAL_DATA.jobs).find(item => item.id === application.jobId);
        for (const hr of hrUsers) {
          const alreadyExists = notifications.some(notification =>
            notification.emailType === 'hr-internal' &&
            notification.applicationId === application.id &&
            notification.recipientUserId === hr.id
          );
          if (alreadyExists) continue;

          notifications.push({
            id: `notif-hr-${application.id}-${hr.id}`,
            applicationId: application.id,
            recipientUserId: hr.id,
            jobId: application.jobId,
            recipientEmail: hr.email,
            recipientName: hr.name,
            stage: application.stage || 'Application Submitted',
            subject: `Application activity: ${job?.title || application.role || 'Job Application'}`,
            body: `Candidate: ${application.name || 'Candidate'}\nPosition: ${job?.title || application.role || 'Position'}\nCurrent stage: ${application.stage || 'Application Submitted'}\n\nReview this application in the HR portal.`,
            deliveryStatus: 'internal',
            deliveryError: null,
            providerMessageId: null,
            emailType: 'hr-internal',
            sentAt: application.updatedAt || application.createdAt || Date.now(),
            read: false
          });
          needsMigrationSave = true;
        }
      }

      const data = {
        users,
        jobs: (Array.isArray(parsed.jobs) ? parsed.jobs : INITIAL_DATA.jobs).map(job => {
          const seed = INITIAL_DATA.jobs.find(item => item.id === job.id) || {};
          return {
            ...seed,
            ...job,
            scoringWeights: job.scoringWeights || seed.scoringWeights || { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 },
            requiredSkills: Array.isArray(job.requiredSkills) ? job.requiredSkills : (seed.requiredSkills || []),
            nonRequiredSkills: Array.isArray(job.nonRequiredSkills) ? job.nonRequiredSkills : (seed.nonRequiredSkills || [])
          };
        }),
        applications,
        notifications,
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
        emailLogs: Array.isArray(parsed.emailLogs) ? parsed.emailLogs : [],
        // Queue state must survive restarts when the JSON adapter is used.
        emailQueue: Array.isArray(parsed.emailQueue) ? parsed.emailQueue : []
      };
      return { data, needsMigrationSave };
    };

    const tryRead = (filePath) => {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      return normalizeData(parsed);
    };

    if (fs.existsSync(this.dbFile)) {
      try {
        const { data, needsMigrationSave } = tryRead(this.dbFile);
        if (needsMigrationSave) this._saveData(data);
        return data;
      } catch (err) {
        console.warn('[Store] db.json is unreadable or invalid:', err.message);
      }
    }

    const recovered = this._loadLatestValidBackup();
    if (recovered) {
      const { data, needsMigrationSave } = normalizeData(recovered);
      if (needsMigrationSave) this._saveData(data);
      return data;
    }

    console.warn('[Store] No valid database or backup was available. Creating initial data.');
    const fresh = JSON.parse(JSON.stringify(INITIAL_DATA));
    this._saveData(fresh, { skipBackup: true });
    return fresh;
  }

  _saveData(dataToSave, { skipBackup = false } = {}) {
    const data = dataToSave || this.data;
    try {
      this._ensureDir();
      if (!skipBackup && fs.existsSync(this.dbFile) && Date.now() - this.lastBackupAt >= this.backupIntervalMs) {
        try { this._createBackup('pre-write'); } catch (backupErr) { console.warn('[Store] Backup before write failed:', backupErr.message); }
      }
      this._writeAtomic(data);
    } catch (err) {
      console.error('[Store] Failed to persist database:', err);
      throw err;
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
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return this.data.users.find(u => String(u.email || '').toLowerCase() === normalizedEmail);
  }

  getUserByEmailAndPassword(email, password) {
    const user = this.getUserByEmail(email);
    return user && verifyPassword(password, user.passwordHash) ? user : null;
  }

  createSession(userId, ttlMs = 12 * 60 * 60 * 1000) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = Date.now();
    this.data.sessions = (this.data.sessions || []).filter(session => session.expiresAt > now);
    this.data.sessions.push({
      id: crypto.randomBytes(16).toString('hex'),
      userId,
      tokenHash,
      createdAt: now,
      expiresAt: now + ttlMs
    });
    this.save();
    return token;
  }

  getUserBySessionToken(token) {
    if (!token) return null;
    const now = Date.now();
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const sessions = Array.isArray(this.data.sessions) ? this.data.sessions : [];
    const activeSessions = sessions.filter(session => session.expiresAt > now);

    if (activeSessions.length !== sessions.length) {
      this.data.sessions = activeSessions;
      this.save();
    }

    const session = activeSessions.find(item => item.tokenHash === tokenHash);
    return session ? this.getUserById(session.userId) : null;
  }

  deleteSession(token) {
    if (!token || !Array.isArray(this.data.sessions)) return false;
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(session => session.tokenHash !== tokenHash);
    if (this.data.sessions.length !== before) this.save();
    return this.data.sessions.length !== before;
  }

  deleteSessionsForUser(userId) {
    if (!userId || !Array.isArray(this.data.sessions)) return 0;
    const before = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(session => session.userId !== userId);
    if (this.data.sessions.length !== before) this.save();
    return before - this.data.sessions.length;
  }

  updateUser(id, updates) {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    const sanitizedUpdates = { ...updates };
    if (Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'password')) {
      sanitizedUpdates.passwordHash = hashPassword(sanitizedUpdates.password);
      delete sanitizedUpdates.password;
    }
    if (Object.prototype.hasOwnProperty.call(sanitizedUpdates, 'passwordHash') && !isPasswordHash(sanitizedUpdates.passwordHash)) {
      sanitizedUpdates.passwordHash = hashPassword(sanitizedUpdates.passwordHash);
    }
    this.data.users[index] = { ...this.data.users[index], ...sanitizedUpdates };
    delete this.data.users[index].password;
    this.save();
    return this.data.users[index];
  }

  deleteUser(id) {
    const index = this.data.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    this.data.users.splice(index, 1);
    this.deleteSessionsForUser(id);
    this.save();
    return true;
  }

  createUser(userData) {
    const newUser = {
      id: userData.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      createdAt: Date.now(),
      emailVerified: userData.emailVerified ?? false,
      ...userData
    };
    if (newUser.password) {
      newUser.passwordHash = hashPassword(newUser.password);
      delete newUser.password;
    } else if (newUser.passwordHash && !isPasswordHash(newUser.passwordHash)) {
      newUser.passwordHash = hashPassword(newUser.passwordHash);
    }
    delete newUser.password;
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
      scoringWeights: jobData.scoringWeights || { requiredSkills: 70, nonRequiredSkills: 20, experience: 10 },
      requiredSkills: Array.isArray(jobData.requiredSkills) ? jobData.requiredSkills : [],
      nonRequiredSkills: Array.isArray(jobData.nonRequiredSkills) ? jobData.nonRequiredSkills : [],
      scorecardCriteria: Array.isArray(jobData.scorecardCriteria) ? jobData.scorecardCriteria : DEFAULT_SCORECARD_CRITERIA,
      ratingScale: Number(jobData.ratingScale || 5),
      sourcingCost: Number(jobData.sourcingCost || 0),
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

  _enrichApplication(app) {
    if (!app) return null;
    return {
      ...app,
      source: app.source || 'Direct Application',
      scorecards: Array.isArray(app.scorecards) ? app.scorecards : [],
      timeline: ensureApplicationTimeline(app),
      offer: app.offer || null,
      mergedInto: app.mergedInto || null,
      mergedApplications: Array.isArray(app.mergedApplications) ? app.mergedApplications : []
    };
  }

  // --- Applications ---
  getApplications() {
    return [...this.data.applications]
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(a => this._enrichApplication(a));
  }

  getApplicationById(id) {
    const app = this.data.applications.find(a => a.id === id);
    return app ? this._enrichApplication(app) : null;
  }

  getApplicationsByUserId(userId) {
    return this.data.applications
      .filter(a => a.userId === userId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(a => this._enrichApplication(a));
  }

  getApplicationsByJobId(jobId) {
    return this.data.applications
      .filter(a => a.jobId === jobId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(a => this._enrichApplication(a));
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
      resumeFile: appData.resumeFile || null,
      stage: appData.stage || 'Application Submitted',
      source: appData.source || 'Direct Application',
      scorecards: Array.isArray(appData.scorecards) ? appData.scorecards : [],
      timeline: Array.isArray(appData.timeline) && appData.timeline.length ? appData.timeline : ensureApplicationTimeline(appData),
      offer: appData.offer || null,
      mergedInto: appData.mergedInto || null,
      mergedApplications: Array.isArray(appData.mergedApplications) ? appData.mergedApplications : [],
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
    return this._enrichApplication(newApp);
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
    return this._enrichApplication(this.data.applications[index]);
  }

  mergeApplications(primaryId, duplicateIds = [], mergedBy = 'HR Recruiter') {
    const primary = this.getApplicationById(primaryId);
    if (!primary) return null;

    const actorName = typeof mergedBy === 'object' && mergedBy?.name ? mergedBy.name : String(mergedBy || 'HR Recruiter');
    const dupList = Array.isArray(duplicateIds) ? duplicateIds : [duplicateIds];
    const duplicates = [];
    for (const dupId of dupList) {
      if (dupId && dupId !== primaryId) {
        const dup = this.getApplicationById(dupId);
        if (dup) duplicates.push(dup);
      }
    }

    if (duplicates.length === 0) return primary;

    const combinedNotes = [
      primary.recruiterNotes,
      ...duplicates.map(d => `[Merged from ${d.name} (${d.email})]: ${d.recruiterNotes || 'No notes'}`)
    ].filter(Boolean).join('\n\n');

    const allScorecards = [
      ...(primary.scorecards || []),
      ...duplicates.flatMap(d => d.scorecards || [])
    ];

    const allTimeline = [
      ...(primary.timeline || []),
      ...duplicates.flatMap(d => d.timeline || [])
    ];

    const mergedAppIds = Array.from(new Set([
      ...(primary.mergedApplications || []),
      ...duplicates.map(d => d.id)
    ]));

    allTimeline.push({
      id: `tle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'candidate_merged',
      title: 'Candidate Profile Merged',
      description: `Merged profiles for: ${duplicates.map(d => `${d.name} (${d.email})`).join(', ')}`,
      performedBy: mergedBy,
      performedByRole: 'hr',
      timestamp: Date.now(),
      metadata: { mergedApplicationIds: duplicates.map(d => d.id) }
    });

    const updatedPrimary = this.updateApplication(primaryId, {
      recruiterNotes: combinedNotes,
      scorecards: allScorecards,
      timeline: allTimeline.sort((a, b) => a.timestamp - b.timestamp),
      mergedApplications: mergedAppIds
    });

    for (const dup of duplicates) {
      this.updateApplication(dup.id, {
        stage: 'Archived (Duplicate Merged)',
        mergedInto: primaryId,
        recruiterNotes: `[MERGED INTO ${primary.name} (${primary.id})]\n${dup.recruiterNotes || ''}`,
        timeline: [
          ...(dup.timeline || []),
          {
            id: `tle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            type: 'candidate_merged',
            title: 'Merged into Primary Record',
            description: `Merged into primary candidate profile: ${primary.name} (${primary.email})`,
            performedBy: actorName,
            performedByRole: 'hr',
            timestamp: Date.now(),
            metadata: { primaryId }
          }
        ]
      });
    }

    return updatedPrimary;
  }

  scheduleInterviewIfAvailable(id, interviewData, conflictWindowMs = 30 * 60 * 1000) {
    const index = this.data.applications.findIndex(a => a.id === id);
    if (index === -1) return { ok: false, reason: 'not_found', application: null };

    const requestedMs = new Date(interviewData?.scheduledAt).getTime();
    if (Number.isNaN(requestedMs)) return { ok: false, reason: 'invalid_time', application: null };

    const conflict = this.data.applications.some(existing => {
      if (existing.id === id || !existing.interview?.scheduledAt) return false;
      const existingMs = new Date(existing.interview.scheduledAt).getTime();
      if (Number.isNaN(existingMs)) return false;
      return Math.abs(existingMs - requestedMs) < conflictWindowMs;
    });

    if (conflict) return { ok: false, reason: 'conflict', application: null };

    this.data.applications[index] = {
      ...this.data.applications[index],
      interview: interviewData,
      stage: 'Interview Scheduled',
      updatedAt: Date.now()
    };
    this.save();
    return { ok: true, reason: null, application: this.data.applications[index] };
  }

  deleteApplication(id) {
    const index = this.data.applications.findIndex(a => a.id === id);
    if (index === -1) return false;
    this.data.applications.splice(index, 1);
    this.save();
    return true;
  }

  // --- Email delivery logs ---
  getEmailLogs() {
    return [...(this.data.emailLogs || [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  createEmailLog(logData) {
    this.data.emailLogs = Array.isArray(this.data.emailLogs) ? this.data.emailLogs : [];
    const idempotencyKey = logData.idempotencyKey || null;
    if (idempotencyKey) {
      const existing = this.data.emailLogs.find(log => log.idempotencyKey === idempotencyKey);
      if (existing) return existing;
    }
    const log = {
      id: logData.id || `email-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`,
      idempotencyKey,
      to: Array.isArray(logData.to) ? logData.to : [logData.to].filter(Boolean),
      subject: String(logData.subject || '').slice(0, 200),
      type: logData.type || 'transactional',
      status: logData.status || 'pending',
      attempts: Number(logData.attempts || 0),
      providerMessageId: logData.providerMessageId || null,
      error: logData.error || null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.data.emailLogs = Array.isArray(this.data.emailLogs) ? this.data.emailLogs : [];
    this.data.emailLogs.unshift(log);
    if (this.data.emailLogs.length > 1000) this.data.emailLogs.length = 1000;
    this.save();
    return log;
  }

  updateEmailLog(id, updates) {
    const logs = this.data.emailLogs || [];
    const index = logs.findIndex(log => log.id === id);
    if (index === -1) return null;
    logs[index] = { ...logs[index], ...updates, updatedAt: Date.now() };
    this.save();
    return logs[index];
  }

  // --- Notifications ---
  getNotifications() {
    return [...this.data.notifications].sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
  }

  getNotificationsForUser(user) {
    const userId = typeof user === 'object' ? user?.id : user;
    if (!userId) return [];

    return this.data.notifications
      .filter(n => n.recipientUserId === userId)
      .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
  }

  getUsersByRole(role) {
    return this.data.users.filter(user => user.role === role);
  }

  async enqueueEmail(d) {
    this.data.emailQueue = Array.isArray(this.data.emailQueue) ? this.data.emailQueue : [];
    if (d.emailLogId) {
      const existing = this.data.emailQueue.find(item => item.emailLogId === d.emailLogId);
      if (existing) {
        if (existing.status === 'failed') {
          existing.payload = d.payload;
          existing.status = 'pending';
          existing.attempts = 0;
          existing.availableAt = Date.now();
          existing.lockedAt = null;
          existing.lastError = null;
          this.save();
        }
        return { id: existing.id, deduplicated: true };
      }
    }
    const item = {
      id: d.id || `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      emailLogId: d.emailLogId,
      payload: d.payload,
      status: 'pending',
      attempts: 0,
      availableAt: Date.now(),
      createdAt: Date.now()
    };
    this.data.emailQueue.push(item);
    this.save();
    return { id: item.id };
  }

  async claimEmailJobs(limit = 10) {
    this.data.emailQueue = Array.isArray(this.data.emailQueue) ? this.data.emailQueue : [];
    const now = Date.now();
    const leaseMs = Math.max(60_000, Number(process.env.EMAIL_WORKER_LEASE_MS || 5 * 60 * 1000));
    const maxRetries = Math.max(1, Number(process.env.EMAIL_MAX_RETRIES || 3));
    let changed = false;

    // Requeue work abandoned by a worker that crashed while a job was processing.
    for (const job of this.data.emailQueue) {
      if (job.status !== 'processing' || !job.lockedAt || Number(job.lockedAt) >= now - leaseMs) continue;
      job.attempts = Number(job.attempts || 0) + 1;
      job.lastError = job.lastError || 'Email worker lease expired; job was reclaimed.';
      job.status = job.attempts >= maxRetries ? 'failed' : 'pending';
      job.availableAt = now;
      job.lockedAt = null;
      if (job.emailLogId) {
        this.updateEmailLog(job.emailLogId, {
          status: job.status === 'failed' ? 'failed' : 'retrying',
          attempts: job.attempts,
          error: job.lastError
        });
      }
      changed = true;
    }

    const jobs = this.data.emailQueue
      .filter(job => job.status === 'pending' && job.availableAt <= now)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit);
    jobs.forEach(job => { job.status = 'processing'; job.lockedAt = now; });
    if (jobs.length) changed = true;
    if (changed) this.save();
    return jobs;
  }

  async completeEmailJob(id, { ok, error, nextAttemptAt } = {}) {
    this.data.emailQueue = Array.isArray(this.data.emailQueue) ? this.data.emailQueue : [];
    const index = this.data.emailQueue.findIndex(job => job.id === id);
    if (index === -1) return;
    if (ok) this.data.emailQueue.splice(index, 1);
    else {
      const job = this.data.emailQueue[index];
      job.attempts += 1;
      job.lastError = error || null;
      job.status = job.attempts >= Number(process.env.EMAIL_MAX_RETRIES || 3) ? 'failed' : 'pending';
      job.availableAt = nextAttemptAt || Date.now();
      job.lockedAt = null;
    }
    this.save();
  }


  createNotification(notifData) {
    const notif = {
      id: notifData.id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      applicationId: notifData.applicationId,
      recipientUserId: notifData.recipientUserId || null,
      jobId: notifData.jobId,
      recipientEmail: notifData.recipientEmail,
      recipientName: notifData.recipientName,
      stage: notifData.stage,
      subject: notifData.subject,
      body: notifData.body,
      deliveryStatus: notifData.deliveryStatus || 'sent',
      deliveryError: notifData.deliveryError || null,
      providerMessageId: notifData.providerMessageId || null,
      emailType: notifData.emailType || 'notification',
      sentAt: Date.now(),
      read: false
    };
    this.data.notifications.unshift(notif);
    this.save();
    return notif;
  }

  updateNotification(id, updates) {
    const index = this.data.notifications.findIndex(n => n.id === id);
    if (index === -1) return null;
    this.data.notifications[index] = { ...this.data.notifications[index], ...updates };
    this.save();
    return this.data.notifications[index];
  }

  markNotificationAsRead(id) {
    const notif = this.data.notifications.find(n => n.id === id);
    if (notif && !notif.read) {
      notif.read = true;
      this.save();
    }
    return notif;
  }

  deleteNotificationForUser(id, user) {
    const userId = typeof user === 'object' ? user?.id : user;
    if (!userId) return null;

    const index = this.data.notifications.findIndex(
      notification => notification.id === id && notification.recipientUserId === userId
    );

    if (index === -1) return null;

    const [deleted] = this.data.notifications.splice(index, 1);
    this.save();
    return deleted;
  }

  clearNotificationsForUser(user) {
    const userId = typeof user === 'object' ? user?.id : user;
    if (!userId) return 0;

    const before = this.data.notifications.length;
    this.data.notifications = this.data.notifications.filter(
      notification => notification.recipientUserId !== userId
    );

    const deletedCount = before - this.data.notifications.length;
    if (deletedCount > 0) this.save();
    return deletedCount;
  }
}

export { Store };

// PostgreSQL is selected when DATABASE_URL is configured. JSON remains available
// for local development and the existing reliability test suite.
let store;
if (process.env.DATABASE_URL) {
  const { PostgresStore } = await import('./postgresStore.js');
  store = new PostgresStore();
} else {
  store = new Store();
}
export { store };
