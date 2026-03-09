// cron jobs / background workers go here
export class UserCleanupJob {
  start() {
    console.log('[Job] UserCleanupJob scheduled.');
    // setInterval(() => { ... }, 24 * 60 * 60 * 1000);
  }
}
