module.exports = {
  apps: [
    {
      name: 'mern-backend',
      script: './backend/server.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};