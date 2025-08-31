# Security Policy

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability within the Manifest Tariff Guard application, please follow these steps:

### 🚨 For Security Issues

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please:

1. **Email us directly** at: [security@yourproject.com] (replace with your email)
2. **Use GitHub Security Advisories** by clicking "Security" tab → "Report a vulnerability"
3. **Include the following information:**
   - Type of vulnerability
   - Full details of the vulnerability
   - Steps to reproduce the vulnerability
   - Potential impact
   - Any suggested fixes or mitigations

### 🔄 Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution Timeline**: Varies based on complexity, but we aim for:
  - Critical vulnerabilities: 1-3 days
  - High-severity vulnerabilities: 3-7 days
  - Medium-severity vulnerabilities: 7-14 days
  - Low-severity vulnerabilities: 14-30 days

### 🛡️ Security Measures

Our application implements several security measures:

- **Environment Variables**: Sensitive data stored in environment variables
- **Input Validation**: All user inputs are validated and sanitized
- **Dependencies**: Regular dependency updates via Dependabot
- **Static Analysis**: CodeQL scanning in CI/CD pipeline
- **Vulnerability Scanning**: Snyk security scanning
- **Audit Checks**: Regular `npm audit` checks

### 🏆 Recognition

We appreciate security researchers and will:

- Acknowledge your contribution (if desired)
- Keep you updated on the resolution progress
- Credit you in our security acknowledgments (if desired)

### 📝 Disclosure Policy

- We follow responsible disclosure principles
- We will work with you to understand and resolve the issue
- We ask that you do not publicly disclose the vulnerability until we have had a chance to address it
- We will publicly acknowledge the fix once it's resolved

## Security Best Practices

When contributing to this project, please:

- Never commit sensitive information (API keys, passwords, etc.)
- Use environment variables for configuration
- Follow secure coding practices
- Keep dependencies up to date
- Report any security concerns promptly

## Contact

For security-related questions or concerns:

- Security Email: [security@yourproject.com] (replace with your email)
- GitHub Security: Use the "Security" tab in this repository
- Maintainer: @helloemzy
