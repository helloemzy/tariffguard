# Vercel Deployment Setup Guide

This guide will help you set up automated deployment to Vercel for the Manifest TariffGuard application.

## Prerequisites

1. **GitHub Repository**: `helloemzy/manifest`
2. **Vercel Account**: Connected to `emily-sparks` team/org
3. **Project Type**: Next.js 14 with TypeScript

## Required GitHub Secrets

Navigate to your GitHub repository → Settings → Secrets and variables → Actions, then add the following secrets:

### Vercel Configuration

```
VERCEL_TOKEN=your_vercel_token_here
VERCEL_ORG_ID=your_vercel_org_id_here
VERCEL_PROJECT_ID=your_vercel_project_id_here
```

### Application Environment Variables

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Optional Performance Monitoring

```
LHCI_GITHUB_APP_TOKEN=your_lighthouse_github_app_token
```

## How to Get Vercel Credentials

### 1. Vercel Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to Settings → Tokens
3. Create a new token with name "GitHub Actions - Manifest"
4. Copy the token value

### 2. Vercel Organization ID

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your team settings (`emily-sparks`)
3. Copy the Team ID from the General tab

### 3. Vercel Project ID

1. Go to your project in Vercel Dashboard
2. Navigate to Settings → General
3. Copy the Project ID

## Vercel Project Setup

### 1. Create New Project in Vercel

```bash
# Using Vercel CLI (optional)
vercel login
vercel --cwd /path/to/project
```

### 2. Configure Project Settings

In Vercel Dashboard → Project → Settings:

**General:**

- Framework Preset: Next.js
- Node.js Version: 18.x
- Install Command: `npm ci --prefer-offline --no-audit`
- Build Command: `npm run build`
- Output Directory: `.next` (default)

**Environment Variables:**
Add the same environment variables as GitHub secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Domains:**

- Production: `manifest.emily-sparks.com`
- Preview: Auto-generated URLs for PRs

### 3. Git Integration

- Connect to GitHub repository: `helloemzy/manifest`
- Production Branch: `main`
- Enable automatic deployments for main branch
- Enable preview deployments for all branches

## Deployment Workflow

### Production Deployments

- **Trigger**: Push to `main` branch
- **URL**: `https://manifest.emily-sparks.com`
- **Process**:
  1. Code quality checks (linting, type checking, formatting)
  2. Security audit
  3. Multi-node build and test
  4. Vercel deployment
  5. Health check verification
  6. Performance analysis with Lighthouse

### Preview Deployments

- **Trigger**: Pull requests to `main` or `develop`
- **URL**: Auto-generated preview URLs
- **Process**:
  1. Same quality checks as production
  2. Preview deployment
  3. Automatic PR comment with preview URL

### Manual Deployments

- **Trigger**: GitHub Actions workflow dispatch
- **Options**: Choose between preview or production deployment
- **Use Case**: Emergency deployments or testing

## Performance Monitoring

### Lighthouse CI

- Automatic performance analysis on production deployments
- Metrics tracked: Performance, Accessibility, Best Practices, SEO
- Results available in GitHub Actions logs and PR comments

### Health Checks

- Automatic health check after production deployment
- Verifies application accessibility and basic functionality
- Fails deployment if health check doesn't pass

## Optimization Features

### Build Optimization

- Multi-stage Docker-like build process
- Dependency caching across builds
- Parallel matrix builds for Node.js 18.x and 20.x

### Caching Strategy

- NPM package cache in GitHub Actions
- Static asset caching (1 year for immutable assets)
- API response caching (1 minute with stale-while-revalidate)

### Security Headers

- Comprehensive security headers in `vercel.json`
- CSP, XSS protection, frame options
- Content type sniffing protection

## Troubleshooting

### Common Issues

**Build Failures:**

- Check environment variables are properly set in both GitHub and Vercel
- Verify Node.js version compatibility (18.x or 20.x)
- Check for TypeScript errors in the codebase

**Deployment Failures:**

- Verify Vercel token has proper permissions
- Check project ID and org ID are correct
- Ensure build artifacts are properly generated

**Performance Issues:**

- Review Lighthouse CI reports in GitHub Actions
- Check for large bundle sizes or unoptimized images
- Monitor API response times

### Debug Commands

```bash
# Local build test
npm run build

# Environment validation
npm run env:validate

# Type checking
npm run type-check

# Linting check
npm run lint:strict
```

## Monitoring and Alerts

### GitHub Actions Notifications

- Success/failure notifications in GitHub
- PR comments with deployment URLs
- Performance metrics in action logs

### Vercel Dashboard

- Real-time deployment status
- Build logs and error messages
- Performance metrics and analytics

## Security Considerations

1. **Environment Variables**: Never commit sensitive data to the repository
2. **Secrets Management**: Use GitHub Secrets for all sensitive configuration
3. **Token Permissions**: Use minimal required permissions for Vercel tokens
4. **Branch Protection**: Enable branch protection rules for main branch
5. **Dependency Security**: Automatic security audits in CI pipeline

## Next Steps

After setup:

1. Test the pipeline with a pull request
2. Verify preview deployments work correctly
3. Test production deployment from main branch
4. Monitor performance metrics
5. Set up additional monitoring tools if needed

For questions or issues, check the GitHub Actions logs or Vercel deployment logs for detailed error information.
