// Keep API requests relative by default so the browser never needs to know
// the backend's local port. Vite proxies /api to Express during development;
// production can use the same-origin /api path or an explicit backend URL set
// at frontend build time with VITE_API_BASE_URL (including the /api suffix).
const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const BASE_URL = (configuredApiBaseUrl || '/api').replace(/\/+$/, '');

function defaultUserMessage(status) {
  if (status === 400 || status === 422) return 'Please check the information you entered and try again.';
  if (status === 401) return 'Please sign in again to continue.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'We could not find what you requested. Refresh the page and try again.';
  if (status === 409) return 'This action conflicts with the current record. Refresh and try again.';
  if (status === 413) return 'The file or request is too large. Choose a smaller file and try again.';
  if (status === 429) return 'Too many attempts. Please wait a little while and try again.';
  if (status === 503) return 'This service is temporarily unavailable. Please try again later.';
  if (status >= 500) return 'Something went wrong. Please try again later.';
  return 'We could not complete your request. Please try again.';
}

function isSafeUserMessage(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  // Defensive check: infrastructure diagnostics belong in server logs, never in UI.
  return !/(HTTP_\d|request failed with http|AccessDenied|ECONN[A-Z]+|SQLSTATE|DATABASE_URL|S3_SECRET|stack trace|node_modules| at .+:\d+:\d+)/i.test(value)
    && !/<[a-z][\s\S]*>/i.test(value)
    && !/No API route matches|No backend route matches|returned Express's default HTML/i.test(value);
}

function makeApiError({ status, data, endpoint, method, cause, fallback }) {
  const code = data?.code || `HTTP_${status || 'NETWORK'}`;
  const requestId = data?.requestId;
  let message = fallback || defaultUserMessage(Number(status) || 0);

  if (status === 503 && code === 'ACCOUNT_FILE_CLEANUP_FAILED' && isSafeUserMessage(data?.error)) {
    message = data.error;
  } else if (status && status < 500 && isSafeUserMessage(data?.error)) {
    message = data.error;
  }

  const error = new Error(message);
  error.name = 'ApiRequestError';
  error.code = code;
  error.status = status;
  error.requestId = requestId;
  error.diagnostic = data?.diagnostic;
  error.data = data;
  // Technical context remains available to browser devtools for diagnostics, but
  // never gets concatenated into the message displayed by UI components.
  if (import.meta.env.DEV) {
    console.error('[ATS API request failed]', { endpoint: String(endpoint || '').replace(/(\/verify-email\/)[^/]+/ig, '$1[redacted]'), method: method || 'GET', status, code, requestId, cause, diagnostic: data?.diagnostic });
  }
  return error;
}

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
    throw makeApiError({
      endpoint,
      method: options.method,
      cause,
      fallback: 'We could not connect to the service. Check your connection and try again.'
    });
  }

  const contentType = response.headers.get('Content-Type') || '';
  const rawBody = contentType.includes('application/json') ? null : await response.text().catch(() => '');
  const data = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : (rawBody ? { error: rawBody.slice(0, 500) } : null);

  if (!response.ok) {
    const isDefaultExpress404 = response.status === 404
      && /<!doctype html|<html/i.test(rawBody || '')
      && /Cannot (GET|POST|PUT|PATCH|DELETE|OPTIONS) \/api\//i.test(rawBody || '');
    const safeData = isDefaultExpress404
      ? { code: 'WRONG_OR_OLD_BACKEND_INSTANCE' }
      : data;
    throw makeApiError({
      status: response.status,
      data: safeData,
      endpoint,
      method: options.method
    });
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
    logout: () => request('/auth/logout', { method: 'POST' }),
    deleteAccount: (password, confirmation) => request('/auth/me', { method: 'DELETE', body: JSON.stringify({ password, confirmation }) })
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
        throw makeApiError({ status: response.status, data, endpoint: `/applications/${id}/resume`, method: 'GET' });
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
    downloadAnalystPack: async (params = {}) => {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, value]) => value !== '' && value != null))
      ).toString();
      const token = localStorage.getItem('ats_token');
      const response = await fetch(`${BASE_URL}/analytics/analyst-pack${query ? `?${query}` : ''}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw makeApiError({ status: response.status, data, endpoint: '/analytics/analyst-pack', method: 'GET' });
      }
      const blob = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'Tidal_ATS_Analyst_Export.zip';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
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
        throw makeApiError({ status: response.status, data, endpoint: '/analytics/csv', method: 'GET' });
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
