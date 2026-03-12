# AWS Setup - Quick Start Guide

## Prerequisites

✅ **Verified:**
- AWS CLI v2.32.18 is installed
- You have AWS credentials (access key + secret key)

## 3-Step Setup

### Step 1: Configure AWS Credentials

```bash
aws configure
```

You'll be prompted for:
```
AWS Access Key ID [None]: AKIAW34EEMIC3Q2OVUUA
AWS Secret Access Key [None]: your-secret-key-here
Default region name [None]: us-east-1
Default output format [None]: json
```

**Verify it worked:**
```bash
aws sts get-caller-identity
```

You should see your account details.

### Step 2: Run Setup Script

```bash
cd /home/sumanth/Projects/QA-Agents
chmod +x setup-aws.sh
./setup-aws.sh
```

The script will:
- ✅ Create S3 bucket (`qa-agents-reports-prod`)
- ✅ Block public access
- ✅ Enable encryption (AES-256)
- ✅ Enable versioning
- ✅ Set auto-delete after 90 days
- ✅ Create IAM user (`qa-agents-app`)
- ✅ Create access keys
- ✅ Attach S3 permissions
- ✅ Generate `.env.local.template`

### Step 3: Configure Application

```bash
# Copy environment template
cp .env.local.template .env.local

# Edit with credentials from script output
nano .env.local
```

**Fill in:**
```bash
S3_BUCKET=qa-agents-reports-prod
S3_REGION=us-east-1
S3_PREFIX=qa-agents/
S3_SIGNED_URL_EXPIRATION=3600
AWS_ACCESS_KEY_ID=<from-script-output>
AWS_SECRET_ACCESS_KEY=<from-script-output>
```

## Testing

### 1. Start Application

```bash
npm install
npm run dev
```

### 2. Submit Test Job

Visit: http://localhost:3000/qa-dashboard
- Click "Submit Job"
- Select "Shivani QA Agent"
- Type: "URL"
- Target: "https://example.com"
- Submit

### 3. Verify S3

```bash
# List bucket contents
aws s3 ls s3://qa-agents-reports-prod/

# Check specific job report
aws s3 ls s3://qa-agents-reports-prod/qa-agents/agent-shivani/
```

## Files Created

| File | Purpose |
|------|---------|
| `setup-aws.sh` | Automated setup (bucket + IAM) |
| `aws-commands.sh` | Quick reference for AWS CLI |
| `AWS_SETUP_GUIDE.md` | Complete step-by-step guide |
| `.env.local` | Application configuration |
| `.aws-keys-*.json` | Saved access keys (keep safe!) |

## Quick Commands

### Check Status
```bash
# Verify credentials
aws sts get-caller-identity

# List buckets
aws s3 ls

# List bucket contents
aws s3 ls s3://qa-agents-reports-prod/
```

### View Logs
```bash
# Recent S3 access (if CloudTrail enabled)
aws cloudtrail lookup-events --lookup-attributes AttributeKey=ResourceName,AttributeValue=qa-agents-reports-prod

# Bucket metrics (CloudWatch)
aws cloudwatch list-metrics --namespace AWS/S3
```

### Manage Credentials
```bash
# List user's access keys
aws iam list-access-keys --user-name qa-agents-app

# Delete old key (use key ID from above)
aws iam delete-access-key --user-name qa-agents-app --access-key-id AKIAXXXX

# Create new key
aws iam create-access-key --user-name qa-agents-app
```

## Troubleshooting

### "Access Denied" Error

```bash
# Check your credentials are correct
aws sts get-caller-identity

# Re-configure
aws configure
```

### "NoSuchBucket" Error

```bash
# Verify bucket exists
aws s3 ls | grep qa-agents-reports-prod

# Create if missing
aws s3 mb s3://qa-agents-reports-prod --region us-east-1
```

### "User: xxx is not authorized"

```bash
# Check policy is attached
aws iam list-attached-user-policies --user-name qa-agents-app

# If missing, attach manually
aws iam attach-user-policy \
  --user-name qa-agents-app \
  --policy-arn arn:aws:iam::123456789:policy/QAAgentsS3Access
```

### Files Not Appearing in Dashboard

1. Check S3 bucket: `aws s3 ls s3://qa-agents-reports-prod/qa-agents/`
2. Check .env.local has credentials
3. Check browser console for API errors
4. Check application logs: `npm run dev` output

## Environment Variables Explained

```bash
# Bucket name where files are stored
S3_BUCKET=qa-agents-reports-prod

# AWS region where bucket exists
S3_REGION=us-east-1

# Prefix for all objects (organizational)
S3_PREFIX=qa-agents/

# How long signed URLs stay valid (seconds)
# 3600 = 1 hour (good for dashboard)
S3_SIGNED_URL_EXPIRATION=3600

# AWS credentials (from IAM user)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
```

## Security Best Practices

✅ **Good:**
- Use IAM user instead of root credentials
- Store credentials in `.env.local` (gitignored)
- Rotate access keys every 90 days
- Enable bucket versioning
- Block all public access
- Use encryption (AES-256)

❌ **Bad:**
- Committing `.env.local` to git
- Using root AWS credentials
- Sharing access keys
- Storing credentials in code
- Making bucket public

## Cost Monitoring

```bash
# Estimate current bucket size
aws s3api list-objects-v2 \
  --bucket qa-agents-reports-prod \
  --query 'sum(Contents[].Size)' \
  --output text | numfmt --to=iec-i --suffix=B

# Check for old files (auto-delete in 90 days)
aws s3api list-objects-v2 \
  --bucket qa-agents-reports-prod \
  --query 'Contents[?LastModified<`2026-01-01`].{Key:Key,Size:Size}' \
  --output table
```

**Estimated Cost: ~$5/year for 100 jobs/day**

## Next Steps

1. ✅ Run setup script
2. ✅ Configure `.env.local`
3. ✅ Test with `npm run dev`
4. ✅ Submit sample job
5. ✅ Verify report in S3
6. ✅ Deploy to production!

## More Information

- **AWS_SETUP_GUIDE.md** - Detailed setup with all steps
- **aws-commands.sh** - Quick reference (view or run)
- **S3_MIGRATION_PLAN.md** - Complete migration strategy
- **GETTING_STARTED.md** - General platform guide

## Support

**Having issues?**

1. Check AWS credentials: `aws sts get-caller-identity`
2. Verify bucket exists: `aws s3 ls | grep qa-agents`
3. Check policy attached: `aws iam list-attached-user-policies --user-name qa-agents-app`
4. View application logs: `npm run dev` output
5. Check browser DevTools console for API errors

---

**Ready to deploy? You're all set! 🚀**

For advanced features (monitoring, logging, database), see the complete AWS_SETUP_GUIDE.md
