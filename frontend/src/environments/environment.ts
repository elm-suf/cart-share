export const environment = {
  production: false,
  apiUrl: '/api',
  wsUrl: `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
};
