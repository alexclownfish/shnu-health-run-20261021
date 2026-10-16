const { ROUTE_VERSION } = require('./route')

module.exports = {
  completionReporting: {
    enabled: true,
    functionName: 'submitCompletion',
    targets: {
      test: {
        enabled: true,
        envId: 'cloud1-d1g886bht0f7cbf69',
        activityId: 'health-run-2026-event02',
        routeVersion: ROUTE_VERSION
      },
      production: {
        enabled: true,
        envId: 'shnu-health-run-20261021-dc2d3ff',
        activityId: 'health-run-2026-event02',
        routeVersion: ROUTE_VERSION
      }
    }
  }
}
