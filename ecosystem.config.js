module.exports = {
  apps: [
    {
      name: 'shopeezkavipushp-backend',
      script: 'server.js',
      cwd: 'C:/Users/hks26/shopeezkavipushp/backend',
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'shopeezkavipushp-frontend',
      script: 'node_modules/vite/bin/vite.js',
      args: '--host',
      cwd: 'C:/Users/hks26/shopeezkavipushp/frontend',
      watch: false,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
