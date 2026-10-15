// Development launcher: use a project-specific port so a stale Node process on
// the historical port 5000 cannot silently receive this app's API requests.
// Production should run `npm run server` and use the hosting platform's PORT.
import 'dotenv/config';

const backendPort = process.env.BACKEND_PORT || process.env.DEV_BACKEND_PORT || '5001';
process.env.BACKEND_PORT = backendPort;

await import('./server.js');
