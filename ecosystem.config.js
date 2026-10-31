module.exports = {
  apps: [
    {
      name: 'restroastra-app',
      script: 'server.js',
      instances: 1, // Single instance required for in-memory Socket.io rooms (or use Redis adapter for cluster)
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      out_file: './logs/restroastra-out.log',
      error_file: './logs/restroastra-error.log',
      merge_logs: true,
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
    },
  ],
};
