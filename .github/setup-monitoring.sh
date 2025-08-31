#!/bin/bash

# TariffGuard Monitoring Setup Script
# This script helps set up the comprehensive monitoring and alerting system

set -e

echo "🛡️  TariffGuard Monitoring Setup"
echo "================================"
echo

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ️${NC} $1"
}

# Check if running in GitHub repository
if [ ! -d ".github" ]; then
    print_error "This script must be run from the root of a GitHub repository"
    exit 1
fi

echo "This script will help you configure the monitoring and alerting system for TariffGuard."
echo

# Check required tools
print_info "Checking required tools..."

command -v gh >/dev/null 2>&1 || {
    print_error "GitHub CLI (gh) is required but not installed. Please install it first."
    echo "Visit: https://cli.github.com/"
    exit 1
}

command -v curl >/dev/null 2>&1 || {
    print_error "curl is required but not installed."
    exit 1
}

print_status "All required tools are available"
echo

# Get repository information
REPO_OWNER=$(gh repo view --json owner -q .owner.login)
REPO_NAME=$(gh repo view --json name -q .name)

print_info "Repository: $REPO_OWNER/$REPO_NAME"
echo

# Function to set GitHub secret
set_github_secret() {
    local secret_name=$1
    local secret_description=$2
    local secret_value

    echo
    print_info "Setting up: $secret_name"
    echo "$secret_description"
    echo -n "Enter value (input will be hidden): "
    read -s secret_value
    echo

    if [ -z "$secret_value" ]; then
        print_warning "Skipping $secret_name (empty value)"
        return
    fi

    if gh secret set "$secret_name" --body "$secret_value"; then
        print_status "$secret_name configured successfully"
    else
        print_error "Failed to set $secret_name"
    fi
}

# Function to confirm optional secret
confirm_optional_secret() {
    local secret_name=$1
    local secret_description=$2
    
    echo
    echo -n "Do you want to configure $secret_name? [y/N]: "
    read -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        set_github_secret "$secret_name" "$secret_description"
    else
        print_warning "Skipping $secret_name"
    fi
}

echo "🔐 GitHub Secrets Configuration"
echo "==============================="
echo
echo "The monitoring system requires several secrets to be configured."
echo "Some are required for core functionality, others are optional."
echo

# Required Vercel secrets
echo "📦 VERCEL DEPLOYMENT SECRETS (Required for deployment monitoring)"
echo "Get these from: https://vercel.com/account/tokens"
set_github_secret "VERCEL_TOKEN" "Your Vercel API token"
set_github_secret "VERCEL_ORG_ID" "Your Vercel organization/team ID"
set_github_secret "VERCEL_PROJECT_ID" "Your Vercel project ID"

# Slack integration
echo
echo "💬 SLACK INTEGRATION (Recommended)"
confirm_optional_secret "SLACK_WEBHOOK_URL" "Slack webhook URL for notifications. Get from: Slack > Apps > Incoming Webhooks"

# Email notifications
echo
echo "📧 EMAIL NOTIFICATIONS (Optional)"
confirm_optional_secret "SMTP_HOST" "SMTP server host (e.g., smtp.gmail.com)"
confirm_optional_secret "SMTP_PORT" "SMTP server port (e.g., 587)"
confirm_optional_secret "SMTP_USERNAME" "SMTP username (usually your email)"
confirm_optional_secret "SMTP_PASSWORD" "SMTP password (use app password for Gmail)"
confirm_optional_secret "NOTIFICATION_EMAIL" "Email address to receive notifications"

# Security scanning
echo
echo "🔒 SECURITY SCANNING (Optional)"
confirm_optional_secret "SNYK_TOKEN" "Snyk authentication token for advanced vulnerability scanning. Get from: https://snyk.io/account"

echo
print_status "Secrets configuration completed!"
echo

# Environment variables
echo "⚙️  ENVIRONMENT VARIABLES"
echo "========================"
echo
echo "The following environment variables should be set in your application:"
echo
echo "NEXT_PUBLIC_BASE_URL=https://your-domain.vercel.app"
echo "NODE_ENV=production"
echo "NEXT_TELEMETRY_DISABLED=1"
echo
echo "Add these to your Vercel project environment variables."
echo

# Workflow verification
echo "🔍 WORKFLOW VERIFICATION"
echo "======================="
echo

WORKFLOWS=(
    "deploy-monitoring.yml"
    "monitoring-alerts.yml"
    "performance-tracking.yml"
    "security-monitoring.yml"
    "reporting-system.yml"
)

print_info "Checking workflow files..."

all_workflows_present=true
for workflow in "${WORKFLOWS[@]}"; do
    if [ -f ".github/workflows/$workflow" ]; then
        print_status "$workflow"
    else
        print_error "$workflow missing"
        all_workflows_present=false
    fi
done

if [ "$all_workflows_present" = true ]; then
    echo
    print_status "All monitoring workflows are present!"
else
    echo
    print_error "Some workflow files are missing. Please ensure all workflows are committed."
fi

echo

# Monitoring endpoints
echo "📊 MONITORING ENDPOINTS"
echo "======================"
echo
echo "The following monitoring endpoints will be available:"
echo
echo "• Status Page: https://your-domain.vercel.app/status"
echo "• Status API: https://your-domain.vercel.app/api/monitoring/status"
echo "• Health Check: https://your-domain.vercel.app/api/health"
echo "• Prometheus Metrics: https://your-domain.vercel.app/api/monitoring/status?format=prometheus"
echo

# Next steps
echo "🚀 NEXT STEPS"
echo "============"
echo
echo "1. Commit all monitoring files to your repository:"
echo "   git add .github/ src/"
echo "   git commit -m 'feat: add comprehensive monitoring and alerting system'"
echo "   git push"
echo
echo "2. The workflows will automatically start running on:"
echo "   • Every push to main branch"
echo "   • Scheduled intervals (health checks every 5 minutes)"
echo "   • Manual triggers via GitHub Actions"
echo
echo "3. Monitor the GitHub Actions tab for workflow status"
echo
echo "4. Set up your Slack channels:"
echo "   • #deployments - Deployment notifications"
echo "   • #monitoring - Health and performance alerts"  
echo "   • #security - Security incident notifications"
echo
echo "5. Configure repository branch protection rules:"
echo "   • Require status checks to pass before merging"
echo "   • Require branches to be up to date before merging"
echo "   • Include administrators in restrictions"
echo

# Testing
echo "🧪 TESTING THE SETUP"
echo "==================="
echo
echo "To test your monitoring setup:"
echo
echo "1. Manual workflow trigger:"
echo "   gh workflow run monitoring-alerts.yml"
echo
echo "2. Check status endpoint:"
echo "   curl https://your-domain.vercel.app/api/monitoring/status"
echo
echo "3. View status page:"
echo "   Open https://your-domain.vercel.app/status in your browser"
echo

# Troubleshooting
echo "🔧 TROUBLESHOOTING"
echo "=================="
echo
echo "Common issues and solutions:"
echo
echo "• Vercel deployments failing:"
echo "  - Verify VERCEL_TOKEN, VERCEL_ORG_ID, and VERCEL_PROJECT_ID"
echo "  - Check Vercel project settings and permissions"
echo
echo "• Slack notifications not working:"
echo "  - Verify SLACK_WEBHOOK_URL is correct"
echo "  - Test webhook manually: curl -X POST -H 'Content-type: application/json' --data '{\"text\":\"Test\"}' YOUR_WEBHOOK_URL"
echo
echo "• Monitoring workflows failing:"
echo "  - Check GitHub Actions logs for detailed error messages"
echo "  - Ensure all required secrets are set"
echo "  - Verify repository permissions"
echo

echo "📚 DOCUMENTATION"
echo "==============="
echo
echo "For detailed configuration and customization:"
echo "• Configuration Guide: .github/MONITORING_CONFIG.md"
echo "• Workflow Files: .github/workflows/"
echo "• Components: src/components/MonitoringDashboard.tsx"
echo "• API Endpoints: src/app/api/monitoring/"
echo

echo
print_status "Monitoring setup completed!"
print_info "Your comprehensive monitoring and alerting system is now configured."
print_info "Check the GitHub Actions tab to see the workflows in action."
echo
echo "Questions? Check the documentation or open an issue in the repository."
echo