module.exports = {
  apps: [{
    name: 'qa-agents',
    script: 'node_modules/.bin/next',
    args: 'start -p 9002',
    cwd: '/home/ec2-user/QA-Agents',
    env: {
      NODE_ENV: 'production',
      PORT: 9002,
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/home/ec2-user/logs/qa-agents-error.log',
    out_file: '/home/ec2-user/logs/qa-agents-out.log',
    merge_logs: true,
    restart_delay: 5000,
    env_production: {
      NODE_ENV: 'production',
      PORT: 9002,
    }
  }],
};
