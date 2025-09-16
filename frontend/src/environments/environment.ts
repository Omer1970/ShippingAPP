export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000',
  apiPrefix: '/api',
  websocketUrl: 'ws://localhost:6001/app/shipment-app-key',
  pusher: {
    key: 'shipment-app-key',
    cluster: 'mt1',
    encrypted: false,
    wsHost: 'localhost',
    wsPort: 6001,
    wssPort: 6001,
    enabledTransports: ['ws', 'wss'],
    disabledTransports: ['sockjs', 'xhr_streaming', 'xhr_polling', 'jsonp_polling']
  }
};