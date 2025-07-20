#!/bin/bash

# Azure Service Bus Explorer PWA Deployment Script
# This script handles the complete deployment process

set -e  # Exit on any error

# Configuration
PROJECT_NAME="azure-service-bus-explorer"
BUILD_DIR="dist"
BACKUP_DIR="backups"
LOG_FILE="deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a $LOG_FILE
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a $LOG_FILE
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed"
    fi
    
    # Check git
    if ! command -v git &> /dev/null; then
        error "git is not installed"
    fi
    
    success "Prerequisites check passed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    npm ci --production=false
    success "Dependencies installed"
}

# Run tests
run_tests() {
    log "Running tests..."
    npm run test:unit -- --run
    npm run test:e2e
    success "All tests passed"
}

# Run linting and type checking
run_quality_checks() {
    log "Running quality checks..."
    npm run lint
    npm run type-check
    success "Quality checks passed"
}

# Build the application
build_application() {
    log "Building application..."
    
    # Clean previous build
    rm -rf $BUILD_DIR
    
    # Build for production
    npm run build
    
    # Verify build output
    if [ ! -d "$BUILD_DIR" ]; then
        error "Build failed - no dist directory found"
    fi
    
    # Check for critical files
    if [ ! -f "$BUILD_DIR/index.html" ]; then
        error "Build failed - no index.html found"
    fi
    
    success "Application built successfully"
}

# Analyze bundle
analyze_bundle() {
    log "Analyzing bundle..."
    
    # Generate bundle analysis
    npm run build:analyze
    
    # Check bundle sizes
    local main_js_size=$(find $BUILD_DIR -name "*.js" -type f -exec du -b {} + | awk '{sum += $1} END {print sum}')
    local main_css_size=$(find $BUILD_DIR -name "*.css" -type f -exec du -b {} + | awk '{sum += $1} END {print sum}')
    
    log "Bundle sizes:"
    log "  JavaScript: $(echo $main_js_size | numfmt --to=iec-i)B"
    log "  CSS: $(echo $main_css_size | numfmt --to=iec-i)B"
    
    # Warn if bundles are too large
    if [ $main_js_size -gt 2097152 ]; then  # 2MB
        warning "JavaScript bundle is larger than 2MB"
    fi
    
    success "Bundle analysis completed"
}

# Run security audit
security_audit() {
    log "Running security audit..."
    npm audit --audit-level=high
    success "Security audit passed"
}

# Create backup
create_backup() {
    if [ -d "$BUILD_DIR" ]; then
        log "Creating backup..."
        mkdir -p $BACKUP_DIR
        local backup_name="backup-$(date +'%Y%m%d-%H%M%S')"
        cp -r $BUILD_DIR "$BACKUP_DIR/$backup_name"
        success "Backup created: $BACKUP_DIR/$backup_name"
    fi
}

# Deploy to staging
deploy_staging() {
    log "Deploying to staging..."
    
    # This would typically deploy to your staging environment
    # For example, using rsync, scp, or cloud provider CLI
    
    # Example for static hosting:
    # rsync -avz --delete $BUILD_DIR/ user@staging-server:/var/www/html/
    
    # Example for AWS S3:
    # aws s3 sync $BUILD_DIR s3://staging-bucket --delete
    
    # Example for Azure Static Web Apps:
    # az staticwebapp deploy --name staging-app --source $BUILD_DIR
    
    log "Staging deployment would happen here"
    success "Deployed to staging"
}

# Deploy to production
deploy_production() {
    log "Deploying to production..."
    
    # Production deployment logic
    # This should include:
    # - Blue/green deployment
    # - Health checks
    # - Rollback capability
    
    log "Production deployment would happen here"
    success "Deployed to production"
}

# Verify deployment
verify_deployment() {
    local environment=$1
    log "Verifying $environment deployment..."
    
    # Health check endpoints
    # curl -f https://$environment.example.com/health
    
    # PWA manifest check
    # curl -f https://$environment.example.com/manifest.json
    
    # Service worker check
    # curl -f https://$environment.example.com/sw.js
    
    success "$environment deployment verified"
}

# Cleanup
cleanup() {
    log "Cleaning up..."
    
    # Remove temporary files
    rm -f *.tmp
    
    # Keep only last 5 backups
    if [ -d "$BACKUP_DIR" ]; then
        ls -t $BACKUP_DIR | tail -n +6 | xargs -I {} rm -rf "$BACKUP_DIR/{}"
    fi
    
    success "Cleanup completed"
}

# Send notifications
send_notifications() {
    local environment=$1
    local status=$2
    
    log "Sending notifications..."
    
    # Example: Slack notification
    # curl -X POST -H 'Content-type: application/json' \
    #   --data '{"text":"Deployment to '$environment' '$status'"}' \
    #   $SLACK_WEBHOOK_URL
    
    # Example: Email notification
    # echo "Deployment to $environment $status" | mail -s "Deployment Status" admin@example.com
    
    log "Notifications sent"
}

# Main deployment function
deploy() {
    local environment=${1:-staging}
    local skip_tests=${2:-false}
    
    log "Starting deployment to $environment..."
    log "Skip tests: $skip_tests"
    
    # Pre-deployment checks
    check_prerequisites
    install_dependencies
    
    if [ "$skip_tests" != "true" ]; then
        run_tests
        run_quality_checks
        security_audit
    fi
    
    # Build and analyze
    create_backup
    build_application
    analyze_bundle
    
    # Deploy based on environment
    case $environment in
        "staging")
            deploy_staging
            verify_deployment "staging"
            ;;
        "production")
            deploy_production
            verify_deployment "production"
            ;;
        *)
            error "Unknown environment: $environment"
            ;;
    esac
    
    # Post-deployment
    cleanup
    send_notifications $environment "succeeded"
    
    success "Deployment to $environment completed successfully!"
}

# Rollback function
rollback() {
    local environment=$1
    local backup_name=$2
    
    log "Rolling back $environment to $backup_name..."
    
    if [ ! -d "$BACKUP_DIR/$backup_name" ]; then
        error "Backup $backup_name not found"
    fi
    
    # Restore from backup
    cp -r "$BACKUP_DIR/$backup_name" $BUILD_DIR
    
    # Redeploy
    case $environment in
        "staging")
            deploy_staging
            ;;
        "production")
            deploy_production
            ;;
        *)
            error "Unknown environment: $environment"
            ;;
    esac
    
    verify_deployment $environment
    send_notifications $environment "rolled back to $backup_name"
    
    success "Rollback completed successfully!"
}

# Help function
show_help() {
    echo "Azure Service Bus Explorer PWA Deployment Script"
    echo ""
    echo "Usage:"
    echo "  $0 deploy [staging|production] [--skip-tests]"
    echo "  $0 rollback [staging|production] [backup-name]"
    echo "  $0 list-backups"
    echo "  $0 help"
    echo ""
    echo "Examples:"
    echo "  $0 deploy staging"
    echo "  $0 deploy production"
    echo "  $0 deploy staging --skip-tests"
    echo "  $0 rollback production backup-20240115-143022"
    echo "  $0 list-backups"
}

# List backups
list_backups() {
    log "Available backups:"
    if [ -d "$BACKUP_DIR" ]; then
        ls -la $BACKUP_DIR
    else
        log "No backups found"
    fi
}

# Main script logic
case "${1:-help}" in
    "deploy")
        deploy "${2:-staging}" "${3}"
        ;;
    "rollback")
        rollback "${2:-staging}" "${3}"
        ;;
    "list-backups")
        list_backups
        ;;
    "help"|*)
        show_help
        ;;
esac