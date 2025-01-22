#!/bin/bash

echo "Building application..."
npm run build

echo "Creating deployment package..."
tar -czf deploy.tar.gz dist/ package.json package-lock.json .env.production docker-compose.yml

echo "Uploading to server..."
scp deploy.tar.gz user@your-server:/path/to/app

echo "Deploying on server..."
ssh user@your-server << 'EOF'
  cd /path/to/app
  tar xzf deploy.tar.gz
  docker-compose down
  docker-compose up -d --build
EOF

echo "Deployment complete!" 