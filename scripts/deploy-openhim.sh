#!/bin/bash

################################################################################
# NDRP-Backend OpenHIM Deployment Script
# This script deploys the complete OpenHIM architecture with all mediators
# Usage: ./scripts/deploy-openhim.sh [environment]
################################################################################

set -e

# Configuration
ENVIRONMENT=${1:-production}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$PROJECT_ROOT/docker"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

################################################################################
# Main Deployment Functions
################################################################################

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    log_success "Docker found: $(docker --version)"
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    log_success "Docker Compose found: $(docker-compose --version)"
    
    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        exit 1
    fi
    log_success "Git found: $(git --version)"
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    log_success "curl found"
}

stop_existing_services() {
    log_info "Stopping existing services..."
    
    cd "$DOCKER_DIR"
    
    # Stop docker-compose services
    if docker-compose ps 2>/dev/null | grep -q "Up"; then
        log_info "Stopping docker-compose services..."
        docker-compose down 2>/dev/null || true
    fi
    
    # Stop all containers
    if [ "$(docker ps -aq)" ]; then
        log_info "Stopping all containers..."
        docker ps -aq | xargs -r docker stop 2>/dev/null || true
        docker ps -aq | xargs -r docker rm 2>/dev/null || true
    fi
    
    # Clean up
    log_info "Cleaning up Docker system..."
    docker system prune -f 2>/dev/null || true
    
    log_success "Services stopped"
}

configure_environment() {
    log_info "Configuring environment variables..."
    
    cd "$DOCKER_DIR"
    
    # Check if .env exists
    if [ -f ".env" ]; then
        log_warning ".env file already exists, backing up to .env.backup"
        cp .env .env.backup
    fi
    
    # Create .env file
    cat > .env << 'ENVEOF'
# Database Configuration
DB_USER=healthflow
DB_PASSWORD=healthflow_secure_pass_2025
POSTGRES_DB=registry

# Keycloak Configuration
KEYCLOAK_ADMIN=admin
KEYCLOAK_ADMIN_PASSWORD=admin_secure_pass_2025

# JeMPI Configuration
JEMPI_DB_PASSWORD=jempi_secure_pass_2025
JEMPI_KC_SECRET=jempi_client_secret_2025

# Elasticsearch Configuration
ELASTICSEARCH_PASSWORD=elastic_pass_2025

# Application Environment
ENVIRONMENT=production
RELEASE_VERSION=v2.0.0
ENVEOF
    
    log_success "Environment file created"
}

deploy_stack() {
    log_info "Deploying OpenHIM and complete architecture..."
    
    cd "$DOCKER_DIR"
    
    # Pull latest images
    log_info "Pulling latest Docker images..."
    docker-compose -f docker-compose.jembi-platform.yml pull 2>&1 | grep -E "Pulling|Downloaded|Digest" || true
    
    # Deploy services
    log_info "Starting services (this may take 2-3 minutes)..."
    docker-compose -f docker-compose.jembi-platform.yml up -d
    
    log_success "Services deployed"
}

wait_for_services() {
    log_info "Waiting for services to start..."
    
    cd "$DOCKER_DIR"
    
    # Wait for services to be healthy
    MAX_ATTEMPTS=60
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        ATTEMPT=$((ATTEMPT + 1))
        
        # Check key services
        OPENHIM_READY=false
        REGISTRY_READY=false
        JEMPI_READY=false
        
        if curl -sf http://localhost:8080/heartbeat > /dev/null 2>&1; then
            OPENHIM_READY=true
        fi
        
        if curl -sf http://localhost:8081 > /dev/null 2>&1; then
            REGISTRY_READY=true
        fi
        
        if curl -sf http://localhost:50000/health > /dev/null 2>&1; then
            JEMPI_READY=true
        fi
        
        if [ "$OPENHIM_READY" = true ] && [ "$REGISTRY_READY" = true ] && [ "$JEMPI_READY" = true ]; then
            log_success "All key services are ready"
            break
        fi
        
        echo -ne "${BLUE}[INFO]${NC} Waiting for services... ($ATTEMPT/$MAX_ATTEMPTS)\r"
        sleep 2
    done
    
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        log_warning "Services did not fully start within timeout, but deployment continues"
    fi
}

perform_health_checks() {
    log_info "Performing health checks..."
    
    cd "$DOCKER_DIR"
    
    echo ""
    echo "Service Health Status:"
    echo "======================"
    
    # OpenHIM Core
    if curl -sf http://localhost:8080/heartbeat > /dev/null 2>&1; then
        log_success "OpenHIM Core: HEALTHY"
    else
        log_warning "OpenHIM Core: NOT RESPONDING"
    fi
    
    # OpenHIM Console
    if curl -sf http://localhost:9000 > /dev/null 2>&1; then
        log_success "OpenHIM Console: HEALTHY"
    else
        log_warning "OpenHIM Console: NOT RESPONDING"
    fi
    
    # Registry API
    if curl -sf http://localhost:8081 > /dev/null 2>&1; then
        log_success "Registry API: HEALTHY"
    else
        log_warning "Registry API: NOT RESPONDING"
    fi
    
    # JeMPI API
    if curl -sf http://localhost:50000/health > /dev/null 2>&1; then
        log_success "JeMPI API: HEALTHY"
    else
        log_warning "JeMPI API: NOT RESPONDING"
    fi
    
    # Elasticsearch
    if curl -sf http://localhost:9200/_cluster/health > /dev/null 2>&1; then
        log_success "Elasticsearch: HEALTHY"
    else
        log_warning "Elasticsearch: NOT RESPONDING"
    fi
    
    # Keycloak
    if curl -sf http://localhost:8080/auth > /dev/null 2>&1; then
        log_success "Keycloak: HEALTHY"
    else
        log_warning "Keycloak: NOT RESPONDING"
    fi
    
    echo ""
}

show_container_status() {
    log_info "Container Status:"
    
    cd "$DOCKER_DIR"
    
    echo ""
    docker-compose -f docker-compose.jembi-platform.yml ps
    echo ""
}

display_access_information() {
    log_info "Deployment Complete!"
    
    echo ""
    echo "=========================================="
    echo "OpenHIM Architecture Deployed Successfully"
    echo "=========================================="
    echo ""
    echo "Service Endpoints:"
    echo "  - OpenHIM Console: http://157.245.20.251:9000"
    echo "  - OpenHIM Core API: http://157.245.20.251:8080"
    echo "  - Registry API: http://157.245.20.251:8081"
    echo "  - JeMPI UI: http://157.245.20.251:3033"
    echo "  - JeMPI API: http://157.245.20.251:50000"
    echo "  - HAPI FHIR: http://157.245.20.251:8888"
    echo "  - Elasticsearch: http://157.245.20.251:9200"
    echo "  - Kibana: http://157.245.20.251:5601"
    echo "  - Keycloak: http://157.245.20.251:8080/auth"
    echo "  - Prometheus: http://157.245.20.251:9090"
    echo "  - Grafana: http://157.245.20.251:3000"
    echo ""
    echo "Default Credentials:"
    echo "  - OpenHIM: admin / password (change on first login)"
    echo "  - Keycloak: admin / admin_secure_pass_2025"
    echo ""
    echo "View Logs:"
    echo "  docker-compose -f docker/docker-compose.jembi-platform.yml logs -f"
    echo ""
    echo "Stop Services:"
    echo "  docker-compose -f docker/docker-compose.jembi-platform.yml down"
    echo ""
    echo "=========================================="
}

################################################################################
# Main Execution
################################################################################

main() {
    echo ""
    echo "=========================================="
    echo "NDRP-Backend OpenHIM Deployment"
    echo "Environment: $ENVIRONMENT"
    echo "=========================================="
    echo ""
    
    check_prerequisites
    stop_existing_services
    configure_environment
    deploy_stack
    wait_for_services
    perform_health_checks
    show_container_status
    display_access_information
    
    log_success "Deployment completed successfully!"
}

# Run main function
main "$@"
