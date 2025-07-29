# LeaseGuard Production Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying LeaseGuard to production with security hardening and monitoring.

## Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ / CentOS 8+ / macOS 12+
- **RAM**: Minimum 4GB, Recommended 8GB+
- **Storage**: Minimum 20GB available space
- **CPU**: 2+ cores recommended

### Software Requirements
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Node.js**: 18+ (for local development)
- **OpenSSL**: For SSL certificate management
- **Git**: For version control

### Security Requirements
- **SSL Certificate**: Valid SSL certificate for your domain
- **Firewall**: Configured to allow only necessary ports (80, 443, 22)
- **Domain**: Registered domain name pointing to your server

## Security Hardening

### 1. Server Security

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install security tools
sudo apt install -y fail2ban ufw unattended-upgrades

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Configure automatic security updates
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 2. SSL Certificate Setup

```bash
# Create SSL directory
mkdir -p ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=yourdomain.com"

# For production, use Let's Encrypt or commercial certificate
# Let's Encrypt example:
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
```

### 3. Environment Configuration

```bash
# Copy environment template
cp env.production.template .env.production

# Edit environment file with secure values
nano .env.production
```

**Critical Security Settings:**
- Use strong, unique passwords for Redis
- Generate a 32+ character random session secret
- Restrict CORS origins to your domains only
- Use environment-specific API keys

## Deployment Steps

### 1. Clone and Setup

```bash
# Clone repository
git clone https://github.com/yourusername/leaseguard.git
cd leaseguard

# Checkout production branch
git checkout main

# Make deployment script executable
chmod +x scripts/deploy.sh
```

### 2. Pre-deployment Security Scan

```bash
# Run security audit
npm audit --audit-level=high

# Check for secrets in code
grep -r "password\|secret\|key\|token" . --exclude-dir=node_modules --exclude-dir=.git

# Run security tests
npm test -- --testPathPattern="security"
```

### 3. Deploy Application

```bash
# Run deployment script
./scripts/deploy.sh production
```

The deployment script will:
- ✅ Perform pre-deployment security checks
- ✅ Run security scans
- ✅ Create backups of existing deployment
- ✅ Deploy with Docker Compose
- ✅ Run health checks
- ✅ Verify SSL certificates
- ✅ Test performance

### 4. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Test health endpoint
curl -f https://yourdomain.com/api/health

# Check SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Test performance
curl -w "@curl-format.txt" -o /dev/null -s https://yourdomain.com/api/health
```

## Monitoring and Maintenance

### 1. Health Monitoring

```bash
# Check application logs
docker-compose -f docker-compose.prod.yml logs -f app

# Check Redis logs
docker-compose -f docker-compose.prod.yml logs -f redis

# Check Nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx
```

### 2. Security Monitoring

```bash
# Monitor failed login attempts
grep "failed_login" /var/log/leaseguard/*.log

# Check for suspicious activity
grep "suspicious" /var/log/leaseguard/*.log

# Monitor rate limit violations
grep "rate_limit" /var/log/leaseguard/*.log
```

### 3. Backup and Recovery

```bash
# Manual backup
docker run --rm -v leaseguard_redis_data:/data -v /backups:/backup \
  alpine tar czf /backup/redis_backup_$(date +%Y%m%d_%H%M%S).tar.gz -C /data .

# Restore from backup
docker run --rm -v leaseguard_redis_data:/data -v /backups:/backup \
  alpine tar xzf /backup/redis_backup_20240101_120000.tar.gz -C /data
```

## Security Best Practices

### 1. Regular Security Updates

```bash
# Update system packages weekly
sudo apt update && sudo apt upgrade -y

# Update Docker images monthly
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Update npm dependencies
npm audit fix
npm update
```

### 2. Access Control

```bash
# Restrict SSH access
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
# Set: PasswordAuthentication no
# Set: AllowUsers yourusername

# Restart SSH
sudo systemctl restart ssh
```

### 3. Log Management

```bash
# Configure log rotation
sudo nano /etc/logrotate.d/leaseguard

# Add configuration:
/var/log/leaseguard/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
```

## Troubleshooting

### Common Issues

1. **SSL Certificate Errors**
   ```bash
   # Check certificate validity
   openssl x509 -in ssl/cert.pem -text -noout
   
   # Renew Let's Encrypt certificate
   sudo certbot renew
   ```

2. **Redis Connection Issues**
   ```bash
   # Check Redis status
   docker exec leaseguard-redis redis-cli ping
   
   # Check Redis logs
   docker-compose -f docker-compose.prod.yml logs redis
   ```

3. **Application Health Check Failures**
   ```bash
   # Check application logs
   docker-compose -f docker-compose.prod.yml logs app
   
   # Test health endpoint directly
   curl -v http://localhost:3000/api/health
   ```

### Performance Issues

1. **High Response Times**
   ```bash
   # Check system resources
   docker stats
   
   # Monitor Redis performance
   docker exec leaseguard-redis redis-cli info memory
   ```

2. **Memory Issues**
   ```bash
   # Check memory usage
   free -h
   
   # Restart services if needed
   docker-compose -f docker-compose.prod.yml restart
   ```

## Rollback Procedures

### Emergency Rollback

```bash
# Stop current deployment
docker-compose -f docker-compose.prod.yml down

# Restore from latest backup
cp /backups/leaseguard/compose_backup_$(ls -t /backups/leaseguard/compose_backup_* | head -1) docker-compose.prod.yml

# Restart with previous version
docker-compose -f docker-compose.prod.yml up -d
```

### Data Recovery

```bash
# Restore Redis data
docker run --rm -v leaseguard_redis_data:/data -v /backups:/backup \
  alpine tar xzf /backup/redis_backup_$(ls -t /backups/redis_backup_* | head -1) -C /data

# Restart Redis
docker-compose -f docker-compose.prod.yml restart redis
```

## Compliance and Auditing

### Security Checklist

- [ ] SSL certificates are valid and up to date
- [ ] All environment variables are properly set
- [ ] Firewall rules are configured correctly
- [ ] Regular backups are being performed
- [ ] Security updates are applied regularly
- [ ] Access logs are being monitored
- [ ] Rate limiting is working correctly
- [ ] CORS origins are restricted
- [ ] File upload restrictions are in place
- [ ] Error messages don't expose sensitive information

### Audit Logs

```bash
# Generate security audit report
echo "=== Security Audit Report $(date) ===" > audit_report.txt
echo "SSL Certificate:" >> audit_report.txt
openssl x509 -in ssl/cert.pem -text -noout | grep -E "(Subject:|Not After)" >> audit_report.txt
echo "Docker Images:" >> audit_report.txt
docker images >> audit_report.txt
echo "Running Containers:" >> audit_report.txt
docker ps >> audit_report.txt
echo "Recent Security Events:" >> audit_report.txt
grep -r "security\|error\|failed" /var/log/leaseguard/*.log | tail -20 >> audit_report.txt
```

## Support and Resources

### Documentation
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/benchmarks/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

### Monitoring Tools
- **Logs**: `/var/log/leaseguard/`
- **Health**: `https://yourdomain.com/api/health`
- **Metrics**: Docker stats and application metrics

### Emergency Contacts
- **Security Issues**: security@yourdomain.com
- **Technical Support**: support@yourdomain.com
- **System Administrator**: admin@yourdomain.com

---

**⚠️ Security Notice**: This deployment guide implements security best practices, but security is an ongoing process. Regularly review and update security measures based on new threats and vulnerabilities. 