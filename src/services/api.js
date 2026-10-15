// Keep API requests relative by default so the browser never needs to know
// the backend's local port. Vite proxies /api to Express during development;
// production can use the same-origin /api path or an explicit backend URL set
// at frontend build time with VITE_API_BASE_URL (including the /api suffix).
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const BASE_URL = (configuredApiBaseUrl || '/api').replace(/\/+$/, '');
const HEALTH_URL = `${BASE_URL}/health`;

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('ats_token');
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  } catch (cause) {
    const error = new Error(`API_CONNECTION_FAILED: Could not reach the configured API base (${BASE_URL}). Confirm that the backend is deployed and VITE_API_BASE_URL points to it if the frontend and backend use different hosts.`);
    error.code = 'API_CONNECTION_FAILED';
    error.cause = cause;
    error.data = { code: error.code, endpoint, baseUrl: BASE_URL };
    throw error;
  }
  const contentType = response.headers.get('Content-Type') || '';
  const rawBody = contentType.includes('application/json')
    ? null
    : await response.text().catch(() => '');
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : (rawBody ? { error: rawBody.slice(0, 500) } : null);

  if (!response.ok) {
    // Express's default HTML "Cannot POST ..." page means the request reached
    // a server that does not have the route, rather than this project's API
    // returning a structured diagnostic error.
    const isDefaultExpress404 = response.status === 404
      && /<!doctype html|<html/i.test(rawBody || '')
      && /Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS) \/api\//i.test(rawBody || '');
    const code = isDefaultExpress404
      ? 'WRONG_OR_OLD_BACKEND_INSTANCE'
      : (data?.code || `HTTP_${response.status}`);
    const requestId = data?.requestId;
    const message = isDefaultExpress404
      ? `The server at ${BASE_URL} returned Express's default HTML 404 for ${options.method || 'GET'} ${endpoint}. This project registers this route, so the configured API host may be pointing to a different or outdated backend. Verify the backend health endpoint at ${HEALTH_URL} and confirm VITE_API_BASE_URL is correct for this environment.`
      : (data?.error || `Request failed with HTTP ${response.status}.`);
    const error = new Error(`${code}: ${message}${requestId ? ` (Request ID: ${requestId})` : ''}`);
    error.name = 'ApiRequestError';
    error.code = code;
    error.status = response.status;
    error.requestId = requestId;
    error.diagnostic = data?.diagnostic;
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
    forgotPassword: email => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
    getCurrentUser: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' })
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

    // A. Interview Scorecards
    recordScorecard: (id, scorecardData) => request(`/applications/${id}/scorecards`, { method: 'POST', body: JSON.stringify(scorecardData) }),
    getScorecards: id => request(`/applications/${id}/scorecards`),

    // B. Activity Timeline
    getTimeline: id => request(`/applications/${id}/timeline`),

    // C. Duplicate Detection & Merge
    getDuplicates: id => request(`/applications/${id}/duplicates`),
    getAllDuplicates: () => request('/applications/duplicates/all'),
    mergeCandidates: (primaryApplicationId, duplicateApplicationIds) => request('/applications/merge', {
      method: 'POST',
      body: JSON.stringify({ primaryApplicationId, duplicateApplicationIds })
    }),

    // D. Offer Management
    createOrUpdateOffer: (id, offerData) => request(`/applications/${id}/offer`, { method: 'POST', body: JSON.stringify(offerData) }),
    approveOffer: (id, notes = '') => request(`/applications/${id}/offer/approve`, { method: 'POST', body: JSON.stringify({ notes }) }),
    sendOffer: id => request(`/applications/${id}/offer/send`, { method: 'POST' }),
    respondToOffer: (id, responseData) => request(`/applications/${id}/offer/respond`, { method: 'POST', body: JSON.stringify(responseData) }),
    withdrawOffer: (id, reason = '') => request(`/applications/${id}/offer/withdraw`, { method: 'POST', body: JSON.stringify({ reason }) }),

    getAvailability: (date, excludeApplicationId = '') => request(`/applications/availability?${new URLSearchParams({ date, ...(excludeApplicationId ? { excludeApplicationId } : {}) }).toString()}`),
    getResumeBlob: async id => {
      const token = localStorage.getItem('ats_token');
      const response = await fetch(`${BASE_URL}/applications/${id}/resume`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        const code = data?.code || `HTTP_${response.status}`;
        const requestId = data?.requestId;
        const message = data?.error || `Could not load resume (HTTP ${response.status}).`;
        const error = new Error(`${code}: ${message}${requestId ? ` (Request ID: ${requestId})` : ''}`);
        error.name = 'ApiRequestError';
        error.code = code;
        error.status = response.status;
        error.requestId = requestId;
        error.diagnostic = data?.diagnostic;
        throw error;
      }
      return {
        blob: await response.blob(),
        contentType: response.headers.get('Content-Type') || 'application/octet-stream'
      };
    },
    delete: id => request(`/applications/${id}`, { method: 'DELETE' })
  },
  analytics: {
    get: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return request(`/analytics${query ? `?${query}` : ''}`);
    },
    downloadCsv: async (params = {}) => {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null))
      ).toString();
      const token = localStorage.getItem('ats_token');
      const response = await fetch(`${BASE_URL}/analytics/csv${query ? `?${query}` : ''}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `CSV export failed (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'Tidal_ATS_Recruitment_Report.csv';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    }
  },
  ai: {
    screen: candidateId => request(`/ai/screen/${candidateId}`, { method: 'POST' }),
    parseResume: payload => request('/ai/parse-resume', { method: 'POST', body: JSON.stringify(payload) }),
    parseResumeFile: formData => request('/ai/parse-resume', { method: 'POST', body: formData })
  },
  notifications: {
    getAll: () => request('/notifications'),
    markAsRead: id => request(`/notifications/${id}/read`, { method: 'PATCH' }),
    remove: id => request(`/notifications/${id}`, { method: 'DELETE' }),
    clearAll: () => request('/notifications', { method: 'DELETE' }),
    retryEmail: id => request(`/notifications/${id}/retry-email`, { method: 'POST' })
  }
};
