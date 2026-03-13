# AWS Setup Guide - S3 Bucket & IAM Roles

This guide walks you through setting up AWS infrastructure for the QA Agent Platform using AWS CLI.

## Prerequisites

1. **AWS CLI installed** (verified: v2.32.18)
2. **AWS Account** with appropriate permissions
3. **AWS Credentials configured** (access key + secret)

## Step 1: Configure AWS Credentials

### Option A: Using AWS Credentials File (Recommended)

```bash
# Interactive configuration
aws configure

# You'll be prompted for:
# AWS Access Key ID: [paste your access key]
# AWS Secret Access Key: [paste your secret key]
# Default region name: us-east-1
# Default output format: json
```

This creates `~/.aws/credentials` and `~/.aws/config`

### Option B: Using Environment Variables

```bash
export AWS_ACCESS_KEY_ID="AKIAW34EEMIC3Q2OVUUA"
export AWS_SECRET_ACCESS_KEY="your-secret-key-here"
export AWS_DEFAULT_REGION="us-east-1"
```

### Option C: Using IAM Role (if running on EC2/Lambda)

No configuration needed - AWS SDK will auto-detect IAM role credentials.

## Step 2: Create S3 Bucket

```bash
# Set variables
BUCKET_NAME="qa-agents-reports-prod"
REGION="us-east-1"

# Create bucket (us-east-1 doesn't need LocationConstraint)
aws s3 mb s3://${BUCKET_NAME} \
  --region ${REGION}

# Verify bucket was created
aws s3 ls | grep ${BUCKET_NAME}
```

**Output:**
```
2026-03-12 12:00:00 qa-agents-reports-prod
```

## Step 3: Enable Versioning (Optional but Recommended)

```bash
BUCKET_NAME="qa-agents-reports-prod"

aws s3api put-bucket-versioning \
  --bucket ${BUCKET_NAME} \
  --versioning-configuration Status=Enabled

# Verify
aws s3api get-bucket-versioning --bucket ${BUCKET_NAME}
```

## Step 4: Block Public Access

```bash
BUCKET_NAME="qa-agents-reports-prod"

# Block all public access
aws s3api put-public-access-block \
  --bucket ${BUCKET_NAME} \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Verify
aws s3api get-public-access-block --bucket ${BUCKET_NAME}
```

## Step 5: Enable Server-Side Encryption

```bash
BUCKET_NAME="qa-agents-reports-prod"

aws s3api put-bucket-encryption \
  --bucket ${BUCKET_NAME} \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        }
      }
    ]
  }'

# Verify
aws s3api get-bucket-encryption --bucket ${BUCKET_NAME}
```

## Step 6: Set Lifecycle Policy (Optional)

Auto-delete old reports after 90 days:

```bash
BUCKET_NAME="qa-agents-reports-prod"

aws s3api put-bucket-lifecycle-configuration \
  --bucket ${BUCKET_NAME} \
  --lifecycle-configuration '{
    "Rules": [
      {
        "Id": "DeleteOldReports",
        "Status": "Enabled",
        "Prefix": "qa-agents/",
        "Expiration": {
          "Days": 90
        }
      }
    ]
  }'

# Verify
aws s3api get-bucket-lifecycle-configuration --bucket ${BUCKET_NAME}
```

## Step 7: Create IAM User for Application

```bash
# Create user
IAM_USER="qa-agents-app"

aws iam create-user --user-name ${IAM_USER}

# Create access keys
aws iam create-access-key --user-name ${IAM_USER}

# Save the AccessKeyId and SecretAccessKey - you'll need these!
```

**Output:**
```json
{
  "AccessKey": {
    "UserName": "qa-agents-app",
    "AccessKeyId": "AKIA...",
    "SecretAccessKey": "...",
    "Status": "Active"
  }
}
```

## Step 8: Create IAM Policy for S3 Access

Create a file `s3-policy.json`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::qa-agents-reports-prod",
        "arn:aws:s3:::qa-agents-reports-prod/*"
      ]
    }
  ]
}
```

Create the policy:

```bash
aws iam create-policy \
  --policy-name QAAgentsS3Access \
  --policy-document file://s3-policy.json

# Save the ARN from output:
# arn:aws:iam::123456789:policy/QAAgentsS3Access
```

## Step 9: Attach Policy to User

```bash
IAM_USER="qa-agents-app"
POLICY_ARN="arn:aws:iam::123456789:policy/QAAgentsS3Access"

aws iam attach-user-policy \
  --user-name ${IAM_USER} \
  --policy-arn ${POLICY_ARN}

# Verify
aws iam list-attached-user-policies --user-name ${IAM_USER}
```

## Step 10: Create IAM Role (for EC2/Lambda/ECS)

If running on AWS infrastructure, create a role instead of user:

```bash
# Create role
ROLE_NAME="QAAgentsRole"

cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name ${ROLE_NAME} \
  --assume-role-policy-document file://trust-policy.json

# Attach policy to role
POLICY_ARN="arn:aws:iam::123456789:policy/QAAgentsS3Access"

aws iam attach-role-policy \
  --role-name ${ROLE_NAME} \
  --policy-arn ${POLICY_ARN}

# Create instance profile
aws iam create-instance-profile \
  --instance-profile-name ${ROLE_NAME}-Profile

aws iam add-role-to-instance-profile \
  --instance-profile-name ${ROLE_NAME}-Profile \
  --role-name ${ROLE_NAME}
```

## Step 11: Verify Setup

```bash
# List buckets
aws s3 ls

# List bucket contents
aws s3 ls s3://qa-agents-reports-prod

# Test write access (if using user credentials)
echo "test" > test.txt
aws s3 cp test.txt s3://qa-agents-reports-prod/test.txt
aws s3 ls s3://qa-agents-reports-prod/

# Clean up
aws s3 rm s3://qa-agents-reports-prod/test.txt
rm test.txt
```

## Step 12: Configure Application

Update `.env.local` in your project:

```bash
# S3 Configuration
S3_BUCKET=qa-agents-reports-prod
S3_REGION=us-east-1
S3_PREFIX=qa-agents/
S3_SIGNED_URL_EXPIRATION=3600

# AWS Credentials (from Step 7 or Step 9)
AWS_ACCESS_KEY_ID="AKIA..."
AWS_SECRET_ACCESS_KEY="..."

# Optional: For testing with LocalStack
# LOCALSTACK_ENDPOINT=http://localhost:4566
```

## Complete Setup Script

Save this as `setup-aws.sh`:

```bash
#!/bin/bash
set -e

# Configuration
BUCKET_NAME="${1:-qa-agents-reports-prod}"
REGION="${2:-us-east-1}"
IAM_USER="qa-agents-app"
POLICY_NAME="QAAgentsS3Access"
ROLE_NAME="QAAgentsRole"

echo "🔧 AWS Setup for QA Agents Platform"
echo "===================================="
echo "Bucket: $BUCKET_NAME"
echo "Region: $REGION"
echo ""

# Step 1: Create bucket
echo "1️⃣  Creating S3 bucket..."
aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}" 2>/dev/null || echo "   ⚠️  Bucket may already exist"

# Step 2: Block public access
echo "2️⃣  Blocking public access..."
aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Step 3: Enable encryption
echo "3️⃣  Enabling encryption..."
aws s3api put-bucket-encryption \
  --bucket "${BUCKET_NAME}" \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'

# Step 4: Enable versioning
echo "4️⃣  Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "${BUCKET_NAME}" \
  --versioning-configuration Status=Enabled

# Step 5: Create policy file
echo "5️⃣  Creating IAM policy..."
cat > /tmp/s3-policy.json << 'POLICY'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::BUCKET_NAME", "arn:aws:s3:::BUCKET_NAME/*"]
    }
  ]
}
POLICY

sed -i "s/BUCKET_NAME/${BUCKET_NAME}/g" /tmp/s3-policy.json

# Step 6: Create IAM user (if not exists)
echo "6️⃣  Setting up IAM user..."
aws iam create-user --user-name "${IAM_USER}" 2>/dev/null || echo "   ⚠️  User may already exist"

# Create and save access keys
echo "7️⃣  Creating access keys..."
aws iam create-access-key --user-name "${IAM_USER}" > /tmp/access-keys.json 2>/dev/null || echo "   ⚠️  Keys may already exist"

# Step 8: Create and attach policy
echo "8️⃣  Attaching policy to user..."
POLICY_ARN=$(aws iam create-policy --policy-name "${POLICY_NAME}" --policy-document file:///tmp/s3-policy.json 2>/dev/null | jq -r '.Policy.Arn' || echo "")

if [ -z "$POLICY_ARN" ]; then
  echo "   Getting existing policy ARN..."
  POLICY_ARN=$(aws iam list-policies --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" --output text)
fi

if [ ! -z "$POLICY_ARN" ]; then
  aws iam attach-user-policy --user-name "${IAM_USER}" --policy-arn "${POLICY_ARN}"
fi

# Summary
echo ""
echo "✅ AWS Setup Complete!"
echo "====================="
echo ""
echo "📋 Summary:"
echo "  S3 Bucket: ${BUCKET_NAME}"
echo "  IAM User: ${IAM_USER}"
echo "  Region: ${REGION}"
echo ""
echo "📝 Next Steps:"
echo "  1. Get access keys:"
echo "     aws iam list-access-keys --user-name ${IAM_USER}"
echo ""
echo "  2. Update .env.local with:"
echo "     S3_BUCKET=${BUCKET_NAME}"
echo "     S3_REGION=${REGION}"
echo "     AWS_ACCESS_KEY_ID=<from step 1>"
echo "     AWS_SECRET_ACCESS_KEY=<from step 1>"
echo ""
echo "  3. Test:"
echo "     npm run dev"
echo "     # Submit a job via dashboard"
echo ""
echo "🔐 Security Notes:"
echo "  ✓ Bucket is private (no public access)"
echo "  ✓ Objects are encrypted (AES-256)"
echo "  ✓ Versioning enabled"
echo "  ✓ IAM user has minimal S3 permissions"
echo ""

# Cleanup
rm -f /tmp/s3-policy.json /tmp/access-keys.json
```

Run the script:

```bash
chmod +x setup-aws.sh
./setup-aws.sh qa-agents-reports-prod us-east-1
```

## Cleanup & Deletion

If you need to delete the resources:

```bash
# Delete access keys
AWS_KEY_ID=$(aws iam list-access-keys --user-name qa-agents-app --query 'AccessKeyMetadata[0].AccessKeyId' --output text)
aws iam delete-access-key --user-name qa-agents-app --access-key-id ${AWS_KEY_ID}

# Detach policies
aws iam detach-user-policy --user-name qa-agents-app --policy-arn arn:aws:iam::123456789:policy/QAAgentsS3Access

# Delete user
aws iam delete-user --user-name qa-agents-app

# Delete policy
aws iam delete-policy --policy-arn arn:aws:iam::123456789:policy/QAAgentsS3Access

# Empty bucket
aws s3 rm s3://qa-agents-reports-prod --recursive

# Delete bucket
aws s3 rb s3://qa-agents-reports-prod
```

## Troubleshooting

### "User: anonymous is not authorized"
- AWS credentials not configured
- Run: `aws configure` and enter your credentials

### "The S3 bucket does not exist"
- Bucket name is incorrect
- Bucket is in different region
- Verify: `aws s3 ls | grep bucket-name`

### "Access Denied" when uploading
- IAM user lacks S3 permissions
- Verify policy is attached: `aws iam list-attached-user-policies --user-name qa-agents-app`

### "ExpiredToken"
- Access keys have expired
- Generate new keys: `aws iam create-access-key --user-name qa-agents-app`

## Cost Estimation

**For 100 jobs/day over 2 years:**

| Service | Cost |
|---------|------|
| Storage (16GB/month) | $0.37/month |
| API Requests | $0.45/year |
| Data Transfer | $0 (within AWS) |
| **Total Annual** | **~$5** |

## Next Steps

1. ✅ Configure AWS credentials
2. ✅ Run setup script to create bucket and IAM user
3. ✅ Update `.env.local` with credentials
4. ✅ Test: `npm run dev` and submit a job
5. ✅ Verify reports/screenshots in S3
6. ✅ Deploy to production

---

**Need Help?**
- AWS CLI Documentation: https://docs.aws.amazon.com/cli/
- S3 Documentation: https://docs.aws.amazon.com/s3/
- IAM Documentation: https://docs.aws.amazon.com/iam/
