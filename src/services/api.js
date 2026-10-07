const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('ats_token');
  const role = localStorage.getItem('ats_role');

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(role ? { 'X-User-Role': role } : {}),
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  auth: {
    login: credentials => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    register: userData => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    verifyEmail: token => request(`/auth/verify-email/${encodeURIComponent(token)}`),
    getCurrentUser: () => request('/auth/me'),
    getUsers: () => request('/auth/users')
  },
  jobs: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/jobs${query ? `?${query}` : ''}`);
    },
    getById: id => request(`/jobs/${id}`),
    create: jobData => request('/jobs', { method: 'POST', body: JSON.stringify(jobData) }),
    update: (id, updates) => request(`/jobs/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    delete: id => request(`/jobs/${id}`, { method: 'DELETE' })
  },
  applications: {
    getAll: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/applications${query ? `?${query}` : ''}`);
    },
    getById: id => request(`/applications/${id}`),
    submit: appData => request('/applications', { method: 'POST', body: appData instanceof FormData ? appData : JSON.stringify(appData) }),
    updateStage: (id, payload) => request(`/applications/${id}/stage`, { method: 'PATCH', body: JSON.stringify(payload) }),
    updateNotes: (id, notes) => request(`/applications/${id}/notes`, { method: 'PATCH', body: JSON.stringify({ notes }) }),
    scheduleInterview: (id, interviewData) => request(`/applications/${id}/interview`, { method: 'POST', body: interviewData instanceof FormData ? interviewData : JSON.stringify(interviewData) }),
    recordEvaluation: (id, evaluationData) => request(`/applications/${id}/evaluation`, { method: 'POST', body: JSON.stringify(evaluationData) }),
    getAvailability: (date, excludeApplicationId = '') => request(`/applications/availability?${new URLSearchParams({ date, ...(excludeApplicationId ? { excludeApplicationId } : {}) }).toString()}`),
    getResumeBlob: async id => {
      const token = localStorage.getItem('ats_token');
      const role = localStorage.getItem('ats_role');
      const response = await fetch(`${BASE_URL}/applications/${id}/resume`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(role ? { 'X-User-Role': role } : {})
        }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Could not load resume (${response.status})`);
      }
      return {
        blob: await response.blob(),
        contentType: response.headers.get('Content-Type') || 'application/octet-stream'
      };
    },
    delete: id => request(`/applications/${id}`, { method: 'DELETE' })
  },
  ai: {
    screen: candidateId => request(`/ai/screen/${candidateId}`, { method: 'POST' }),
    parseResume: payload => request('/ai/parse-resume', { method: 'POST', body: JSON.stringify(payload) }),
    parseResumeFile: formData => request('/ai/parse-resume', { method: 'POST', body: formData })
  },
  notifications: {
    getAll: () => request('/notifications'),
    markAsRead: id => request(`/notifications/${id}/read`, { method: 'PATCH' })
  }
};
