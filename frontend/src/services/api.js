const rawBase = import.meta.env.VITE_API_URL?.trim();
const BASE = rawBase
  ? `${rawBase.replace(/\/+$/, '').replace(/\/api$/, '')}/api`
  : '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body;
}

// ─── Dashboard & Reports & Health ────────────────────────────────────────────

export const getDashboard = () => request('/dashboard');
export const getReports   = () => request('/reports');
export const getHealth    = () => request('/health');

// ─── Projects ────────────────────────────────────────────────────────────────

export const getProjects   = ()            => request('/projects');
export const getProject    = (id)          => request(`/projects/${id}`);
export const createProject = (payload)     => request('/projects', { method: 'POST', body: JSON.stringify(payload) });
export const updateProject = (id, payload) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteProject = (id)          => request(`/projects/${id}`, { method: 'DELETE' });

// ─── Sections (Registers inside a Project) ───────────────────────────────────

export const getSections   = (projectId)          => request(`/projects/${projectId}/sections`);
export const createSection = (projectId, payload) => request(`/projects/${projectId}/sections`, { method: 'POST', body: JSON.stringify(payload) });
export const updateSection = (sectionId, payload) => request(`/sections/${sectionId}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteSection = (sectionId)          => request(`/sections/${sectionId}`, { method: 'DELETE' });

// ─── Custom Fields (Columns inside a Section) ────────────────────────────────

export const createField   = (sectionId, payload)  => request(`/sections/${sectionId}/fields`, { method: 'POST', body: JSON.stringify(payload) });
export const reorderFields = (sectionId, fieldIds) => request(`/sections/${sectionId}/fields/reorder`, { method: 'PUT', body: JSON.stringify({ fieldIds }) });
export const updateField   = (fieldId, payload)    => request(`/fields/${fieldId}`, { method: 'PUT', body: JSON.stringify(payload) });
export const deleteField   = (fieldId)             => request(`/fields/${fieldId}`, { method: 'DELETE' });

// ─── Records (Rows inside a Section) ─────────────────────────────────────────

export const getRecords   = (sectionId)       => request(`/sections/${sectionId}/records`);
export const createRecord = (sectionId, data) => request(`/sections/${sectionId}/records`, { method: 'POST', body: JSON.stringify({ data }) });
export const updateRecord = (recordId, data)  => request(`/records/${recordId}`, { method: 'PUT', body: JSON.stringify({ data }) });
export const deleteRecord = (recordId)        => request(`/records/${recordId}`, { method: 'DELETE' });
