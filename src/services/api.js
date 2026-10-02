/**
 * Centralized API Service
 * Decouples frontend components from direct database queries and backend logic.
 */

const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('ats_token');
  const role = localStorage.getItem('ats_role');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(role ? { 'X-User-Role': role } : {}),
    ...(options.headers || {})
  };

  // If body is FormData, delete Content-Type so browser sets boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  // --- Auth ---
  auth: {
    login: (credentials) => request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    }),
    register: (userData) => request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
    getCurrentUser: () => request('/auth/me'),
    getUsers: () => request('/auth/users')
  },

  // --- Jobs ---
  jobs: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/jobs${query ? `?${query}` : ''}`);
    },
    getById: (id) => request(`/jobs/${id}`),
    create: (jobData) => request('/jobs', {
      method: 'POST',
      body: JSON.stringify(jobData)
    }),
    update: (id, updates) => request(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),
    delete: (id) => request(`/jobs/${id}`, {
      method: 'DELETE'
    })
  },

  // --- Applications ---
  applications: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/applications${query ? `?${query}` : ''}`);
    },
    getById: (id) => request(`/applications/${id}`),
    submit: (appData) => request('/applications', {
      method: 'POST',
      body: JSON.stringify(appData)
    }),
    updateStage: (id, { stage, customNote }) => request(`/applications/${id}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage, customNote })
    }),
    updateNotes: (id, notes) => request(`/applications/${id}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ notes })
    }),
    scheduleInterview: (id, interviewData) => request(`/applications/${id}/interview`, {
      method: 'POST',
      body: JSON.stringify(interviewData)
    }),
    recordEvaluation: (id, evaluationData) => request(`/applications/${id}/evaluation`, {
      method: 'POST',
      body: JSON.stringify(evaluationData)
    }),
    delete: (id) => request(`/applications/${id}`, {
      method: 'DELETE'
    })
  },

  // --- AI ---
  ai: {
    screen: (candidateId) => request(`/ai/screen/${candidateId}`, {
      method: 'POST'
    }),
    parseResume: (payload) => request('/ai/parse-resume', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
    parseResumeFile: (formData) => request('/ai/parse-resume', {
      method: 'POST',
      body: formData
    })
  },

  // --- Notifications ---
  notifications: {
    getAll: () => request('/notifications'),
    markAsRead: (id) => request(`/notifications/${id}/read`, {
      method: 'PATCH'
    })
  }
};
