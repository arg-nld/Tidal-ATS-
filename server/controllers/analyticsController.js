import { store } from '../services/store.js';
import { calculateAnalytics, generateAnalyticsCsv } from '../services/analyticsService.js';
import { generateAnalyticsAnalystPack } from '../services/analyticsExportService.js';

export async function getAnalytics(req, res) {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: 'Access denied. HR credentials required for recruitment analytics.' });
  }

  const applications = await store.getApplications();
  const jobs = await store.getJobs();

  const analytics = calculateAnalytics({
    applications,
    jobs,
    filters: req.query
  });

  return res.json(analytics);
}

export async function exportAnalyticsCsv(req, res) {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: 'Access denied. HR credentials required for report export.' });
  }

  const applications = await store.getApplications();
  const jobs = await store.getJobs();

  const analytics = calculateAnalytics({
    applications,
    jobs,
    filters: req.query
  });

  const csvContent = generateAnalyticsCsv(analytics);
  const filename = `Tidal_ATS_Recruitment_Report_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(csvContent);
}


export async function exportAnalyticsAnalystPack(req, res) {
  if (req.user?.role !== 'hr') {
    return res.status(403).json({ error: 'Access denied. HR credentials required for analytics export.' });
  }

  const applications = await store.getApplications();
  const jobs = await store.getJobs();
  const filters = req.query || {};
  const analytics = calculateAnalytics({ applications, jobs, filters });
  const archive = generateAnalyticsAnalystPack({ applications, jobs, filters, analytics });
  const filename = `Tidal_ATS_Analyst_Export_${new Date().toISOString().slice(0, 10)}.zip`;

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', archive.length);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.send(archive);
}
