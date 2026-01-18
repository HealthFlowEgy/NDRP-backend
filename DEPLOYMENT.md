# NDRP-Backend OpenHIM Deployment Guide

## Overview

This guide provides instructions for deploying the complete NDRP-Backend architecture with OpenHIM and all mediators to DigitalOcean using Terraform and CI/CD.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Deployment](#local-deployment)
3. [Terraform Deployment](#terraform-deployment)
4. [CI/CD Deployment](#cicd-deployment)
5. [Service Endpoints](#service-endpoints)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- Docker & Docker Compose
- Git
- Terraform (for infrastructure deployment)
- Make (for convenient commands)
- curl (for health checks)

### DigitalOcean Setup

1. Create a DigitalOcean account
2. Generate an API token: https://cloud.digitalocean.com/account/api/tokens
3. Create an SSH key pair for droplet access
4. Configure the SSH key in DigitalOcean console

### GitHub Setup (for CI/CD)

1. Fork or clone the repository
2. Add secrets to GitHub repository:
   - `DIGITALOCEAN_TOKEN` - Your DigitalOcean API token
   - `SSH_PRIVATE_KEY` - Your SSH private key
   - `DROPLET_IP` - Your droplet's reserved IP (157.245.20.251)
   - `SLACK_WEBHOOK` - (Optional) Slack webhook for notifications

---

## Local Deployment

### 1. Clone Repository

```bash
git clone https://github.com/HealthFlowEgy/NDRP-backend.git
cd NDRP-backend
```

### 2. Deploy Using Make

```bash
# Deploy to production
make deploy-prod

# Deploy to staging
make deploy-staging

# Deploy to development
make deploy-dev
```

### 3. Manual Deployment

```bash
# Make script executable
chmod +x scripts/deploy-openhim.sh

# Run deployment script
bash scripts/deploy-openhim.sh production
```

### 4. Monitor Deployment

```bash
# View logs
make logs

# Check status
make status

# Perform health checks
make health-check
```

---

## Terraform Deployment

### 1. Initialize Terraform

```bash
cd terraform
terraform init
```

### 2. Configure Variables

Create `terraform.tfvars`:

```hcl
do_token = "your_digitalocean_api_token"
ssh_key_name = "your_ssh_key_name"
region = "fra1"
droplet_size = "s-8vcpu-16gb"
domain_name = "your-domain.com"
environment = "production"
```

### 3. Plan Deployment

```bash
terraform plan -out=tfplan
```

### 4. Apply Configuration

```bash
terraform apply tfplan
```

This will:
- Create DigitalOcean droplet (8vCPU, 16GB)
- Allocate reserved IP
- Create firewall rules
- Attach persistent storage
- Execute deployment script automatically

### 5. Get Outputs

```bash
terraform output

# Output:
# deployment_endpoints = {
#   "openhim_console" = "http://157.245.20.251:9000"
#   "registry_api" = "http://157.245.20.251:8081"
#   ...
# }
```

---

## CI/CD Deployment

### 1. Configure GitHub Secrets

Add to your GitHub repository settings:

```
DIGITALOCEAN_TOKEN=dop_v1_...
SSH_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
...
-----END RSA PRIVATE KEY-----
DROPLET_IP=157.245.20.251
SLACK_WEBHOOK=https://hooks.slack.com/services/...
```

### 2. Trigger Deployment

#### Option A: Automatic (on push)

Push changes to trigger automatic deployment:

```bash
git add .
git commit -m "Deploy OpenHIM"
git push origin main
```

#### Option B: Manual (workflow dispatch)

1. Go to GitHub Actions
2. Select "Deploy OpenHIM to DigitalOcean"
3. Click "Run workflow"
4. Select environment (development, staging, production)
5. Click "Run workflow"

### 3. Monitor CI/CD Pipeline

1. Go to GitHub Actions tab
2. Click on the workflow run
3. View logs in real-time
4. Check deployment status

### 4. Deployment Notifications

Slack notifications are sent on:
- Deployment start
- Deployment success
- Deployment failure

---

## Service Endpoints

After deployment, access services at:

| Service | URL | Port |
|---------|-----|------|
| OpenHIM Console | http://157.245.20.251:9000 | 9000 |
| OpenHIM Core API | http://157.245.20.251:8080 | 8080 |
| Registry API | http://157.245.20.251:8081 | 8081 |
| JeMPI UI | http://157.245.20.251:3033 | 3033 |
| JeMPI API | http://157.245.20.251:50000 | 50000 |
| HAPI FHIR | http://157.245.20.251:8888 | 8888 |
| Elasticsearch | http://157.245.20.251:9200 | 9200 |
| Kibana | http://157.245.20.251:5601 | 5601 |
| Keycloak | http://157.245.20.251:8080/auth | 8080 |
| Prometheus | http://157.245.20.251:9090 | 9090 |
| Grafana | http://157.245.20.251:3000 | 3000 |

---

## Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| OpenHIM | admin | password |
| Keycloak | admin | admin_secure_pass_2025 |
| Registry | admin | admin |
| Elasticsearch | elastic | elastic_pass_2025 |

**Important:** Change default passwords after first login!

---

## Common Commands

### Deployment

```bash
# Deploy to production
make deploy-prod

# Deploy to staging
make deploy-staging

# Deploy to development
make deploy-dev
```

### Service Management

```bash
# Stop services
make stop

# View logs
make logs

# Check status
make status

# Health checks
make health-check
```

### Terraform

```bash
# Initialize
make terraform-init

# Plan
make terraform-plan

# Apply
make terraform-apply

# Destroy
make terraform-destroy
```

### Database Access

```bash
# PostgreSQL shell
make db-shell

# Run SQL query
docker exec -it healthflow-db psql -U healthflow -d registry -c "SELECT * FROM table_name;"
```

---

## Troubleshooting

### Services Not Starting

```bash
# Check logs
make logs

# Check status
make status

# Restart services
docker-compose -f docker/docker-compose.jembi-platform.yml restart
```

### High Memory Usage

```bash
# Check memory
free -h

# Check Docker stats
docker stats

# Reduce service memory limits in docker/docker-compose.jembi-platform.yml
```

### Port Conflicts

```bash
# Find what's using a port
lsof -i :8080

# Kill the process
kill -9 <PID>
```

### Database Connection Issues

```bash
# Check PostgreSQL
docker ps | grep postgres

# Test connection
docker exec -it healthflow-db psql -U healthflow -c "SELECT 1"
```

### SSH Connection Issues

```bash
# Test SSH connection
ssh -v root@157.245.20.251

# Check SSH key permissions
chmod 600 ~/.ssh/id_rsa

# Add SSH key to agent
ssh-add ~/.ssh/id_rsa
```

---

## Monitoring

### View Logs

```bash
# All services
make logs

# Specific service
docker logs <container_name> -f

# Follow logs
docker-compose -f docker/docker-compose.jembi-platform.yml logs -f <service>
```

### Health Checks

```bash
# Run health checks
make health-check

# Manual health checks
curl http://localhost:8080/heartbeat
curl http://localhost:8081/
curl http://localhost:50000/health
curl http://localhost:9200/_cluster/health
```

### Metrics

Access Prometheus and Grafana:

```
Prometheus: http://157.245.20.251:9090
Grafana: http://157.245.20.251:3000
```

---

## Backup & Recovery

### Backup Database

```bash
# PostgreSQL backup
docker exec healthflow-db pg_dumpall -U healthflow > backup.sql

# MongoDB backup
docker exec mongo-openhim mongodump --out /backup
```

### Restore Database

```bash
# PostgreSQL restore
docker exec -i healthflow-db psql -U healthflow < backup.sql

# MongoDB restore
docker exec mongo-openhim mongorestore /backup
```

---

## Security

### Change Default Passwords

```bash
# OpenHIM Console
# 1. Access http://157.245.20.251:9000
# 2. Login with admin / password
# 3. Change password in settings

# Keycloak
# 1. Access http://157.245.20.251:8080/auth/admin
# 2. Login with admin / admin_secure_pass_2025
# 3. Change password in account settings
```

### Enable HTTPS

```bash
# Install Certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d your-domain.com

# Configure reverse proxy with SSL
# Update docker-compose.jembi-platform.yml to use SSL certificates
```

### Regular Updates

```bash
# Pull latest images
docker-compose -f docker/docker-compose.jembi-platform.yml pull

# Restart services
docker-compose -f docker/docker-compose.jembi-platform.yml restart
```

---

## Cost Optimization

### Current Setup

- Droplet (8vCPU, 16GB): $96/month
- Reserved IP: $3/month
- Volume (100GB): $10/month
- **Total: ~$109/month**

### Ways to Reduce Costs

1. Use smaller droplet for development ($12-24/month)
2. Remove reserved IP ($0/month, but less stable)
3. Reduce volume size ($5-10/month)
4. Use spot instances if available

---

## Support

For issues or questions:

1. Check logs: `make logs`
2. Review documentation in `docs/` folder
3. Check GitHub Issues: https://github.com/HealthFlowEgy/NDRP-backend/issues
4. Contact support: support@healthflow.tech

---

## Additional Resources

- [OpenHIM Documentation](https://openhim.org/docs/)
- [JeMPI Documentation](https://jembi.org/jempi/)
- [HealthFlow Repository](https://github.com/HealthFlowEgy/NDRP-backend)
- [DigitalOcean Documentation](https://docs.digitalocean.com/)
- [Terraform Documentation](https://www.terraform.io/docs/)

---

**Last Updated:** 2026-01-18  
**Version:** 2.0.0  
**Status:** Production Ready
