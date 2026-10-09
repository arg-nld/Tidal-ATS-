import { store } from '../services/store.js';
import { calculateAnalytics, generateAnalyticsCsv } from '../services/analyticsService.js';

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
