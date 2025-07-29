#!/bin/bash

# LeaseGuard Production Deployment Script
# Implements secure deployment practices with health checks and rollback capabilities

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="leaseguard"
DEPLOYMENT_ENV=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/${APP_NAME}"
LOG_FILE="/var/log/${APP_NAME}/deploy_${TIMESTAMP}.log"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Pre-deployment checks
pre_deployment_checks() {
    log "Starting pre-deployment security checks..."
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root"
    fi
    
    # Check required environment variables
    required_vars=(
        "REDIS_PASSWORD"
        "GEMINI_API_KEY"
        "SUPABASE_URL"
        "SUPABASE_ANON_KEY"
        "SESSION_SECRET"
        "ALLOWED_ORIGINS"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable $var is not set"
        fi
    done
    
    # Check Docker and Docker Compose
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check SSL certificates
    if [[ ! -f "./ssl/cert.pem" ]] || [[ ! -f "./ssl/key.pem" ]]; then
        error "SSL certificates not found in ./ssl/ directory"
    fi
    
    # Check disk space
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 1048576 ]]; then  # Less than 1GB
        warning "Low disk space available: ${available_space}KB"
    fi
    
    success "Pre-deployment checks passed"
}

# Security scan
security_scan() {
    log "Running security scan..."
    
    # Check for known vulnerabilities in dependencies
    if command -v npm &> /dev/null; then
        log "Running npm audit..."
        if npm audit --audit-level=high; then
            success "No high-severity vulnerabilities found"
        else
            warning "High-severity vulnerabilities found - review before deployment"
        fi
    fi
    
    # Check Docker image for vulnerabilities (if trivy is available)
    if command -v trivy &> /dev/null; then
        log "Running Trivy security scan..."
        trivy image --severity HIGH,CRITICAL node:18-alpine || warning "Trivy scan found vulnerabilities"
    fi
    
    # Check for secrets in code
    log "Checking for potential secrets in code..."
    if grep -r "password\|secret\|key\|token" . --exclude-dir=node_modules --exclude-dir=.git | grep -v "process.env" | grep -v "REDIS_PASSWORD\|GEMINI_API_KEY\|SUPABASE_ANON_KEY\|SESSION_SECRET"; then
        warning "Potential secrets found in code - review before deployment"
    fi
}

# Backup current deployment
backup_current() {
    log "Creating backup of current deployment..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup Docker volumes
    if docker volume ls | grep -q "${APP_NAME}_redis_data"; then
        docker run --rm -v "${APP_NAME}_redis_data:/data" -v "$BACKUP_DIR:/backup" alpine tar czf "/backup/redis_backup_${TIMESTAMP}.tar.gz" -C /data .
        success "Redis data backed up"
    fi
    
    # Backup environment file
    if [[ -f ".env" ]]; then
        cp .env "$BACKUP_DIR/env_backup_${TIMESTAMP}"
        success "Environment file backed up"
    fi
    
    # Backup Docker Compose file
    cp docker-compose.prod.yml "$BACKUP_DIR/compose_backup_${TIMESTAMP}.yml"
    success "Docker Compose file backed up"
}

# Deploy application
deploy_application() {
    log "Deploying LeaseGuard application..."
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose -f docker-compose.prod.yml down --timeout 30 || warning "Failed to stop some containers"
    
    # Pull latest images
    log "Pulling latest images..."
    docker-compose -f docker-compose.prod.yml pull
    
    # Build and start services
    log "Building and starting services..."
    docker-compose -f docker-compose.prod.yml up -d --build
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    timeout=300  # 5 minutes
    elapsed=0
    
    while [[ $elapsed -lt $timeout ]]; do
        if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
            success "All services are healthy"
            break
        fi
        
        sleep 10
        elapsed=$((elapsed + 10))
        log "Waiting for healthy services... ($elapsed/$timeout seconds)"
    done
    
    if [[ $elapsed -ge $timeout ]]; then
        error "Services failed to become healthy within timeout"
    fi
}

# Health checks
health_checks() {
    log "Running post-deployment health checks..."
    
    # Check application health
    local max_retries=10
    local retry_count=0
    
    while [[ $retry_count -lt $max_retries ]]; do
        if curl -f -s http://localhost:3000/api/health > /dev/null; then
            success "Application health check passed"
            break
        fi
        
        retry_count=$((retry_count + 1))
        log "Health check attempt $retry_count/$max_retries failed, retrying in 10 seconds..."
        sleep 10
    done
    
    if [[ $retry_count -ge $max_retries ]]; then
        error "Application health check failed after $max_retries attempts"
    fi
    
    # Check Redis connection
    if docker exec leaseguard-redis redis-cli --raw incr ping > /dev/null 2>&1; then
        success "Redis health check passed"
    else
        error "Redis health check failed"
    fi
    
    # Check SSL certificate
    if openssl s_client -connect localhost:443 -servername localhost < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
        success "SSL certificate validation passed"
    else
        warning "SSL certificate validation failed"
    fi
    
    # Performance test
    log "Running performance test..."
    response_time=$(curl -w "%{time_total}" -o /dev/null -s http://localhost:3000/api/health)
    if (( $(echo "$response_time < 2.0" | bc -l) )); then
        success "Performance test passed: ${response_time}s response time"
    else
        warning "Performance test warning: ${response_time}s response time"
    fi
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Stop current deployment
    docker-compose -f docker-compose.prod.yml down
    
    # Restore from backup
    if [[ -f "$BACKUP_DIR/compose_backup_${TIMESTAMP}.yml" ]]; then
        cp "$BACKUP_DIR/compose_backup_${TIMESTAMP}.yml" docker-compose.prod.yml
        docker-compose -f docker-compose.prod.yml up -d
        success "Rollback completed"
    else
        error "No backup found for rollback"
    fi
}

# Cleanup old backups
cleanup_backups() {
    log "Cleaning up old backups..."
    
    # Keep only last 5 backups
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "env_backup_*" -mtime +7 -delete 2>/dev/null || true
    find "$BACKUP_DIR" -name "compose_backup_*" -mtime +7 -delete 2>/dev/null || true
    
    success "Cleanup completed"
}

# Main deployment function
main() {
    log "Starting LeaseGuard deployment to $DEPLOYMENT_ENV environment"
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Set up error handling
    trap 'error "Deployment failed at line $LINENO"' ERR
    trap 'rollback' EXIT
    
    # Run deployment steps
    pre_deployment_checks
    security_scan
    backup_current
    deploy_application
    health_checks
    
    # Remove rollback trap on success
    trap - EXIT
    
    cleanup_backups
    
    success "Deployment completed successfully!"
    log "Deployment log saved to: $LOG_FILE"
}

# Run main function
main "$@" 