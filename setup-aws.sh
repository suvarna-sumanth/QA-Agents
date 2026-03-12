#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BUCKET_NAME="${1:-qa-agents-reports-prod}"
REGION="${2:-us-east-1}"
IAM_USER="qa-agents-app"
POLICY_NAME="QAAgentsS3Access"
ROLE_NAME="QAAgentsRole"
ENV="${3:-dev}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   AWS Setup for QA Agents Platform                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo "  Environment: $ENV"
echo "  Bucket: $BUCKET_NAME"
echo "  Region: $REGION"
echo "  IAM User: $IAM_USER"
echo ""

# Check if AWS CLI is configured
if ! aws sts get-caller-identity &>/dev/null; then
  echo -e "${RED}❌ Error: AWS CLI not configured${NC}"
  echo "Run: aws configure"
  exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo -e "${GREEN}✓ AWS CLI configured (Account: $AWS_ACCOUNT)${NC}"
echo ""

# Step 1: Create S3 bucket
echo -e "${BLUE}Step 1: Creating S3 bucket...${NC}"
if aws s3 ls "s3://${BUCKET_NAME}" &>/dev/null; then
  echo -e "${YELLOW}⚠️  Bucket already exists${NC}"
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
  else
    aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}" \
      --create-bucket-configuration LocationConstraint="${REGION}"
  fi
  echo -e "${GREEN}✓ Bucket created${NC}"
fi
echo ""

# Step 2: Block public access
echo -e "${BLUE}Step 2: Blocking public access...${NC}"
aws s3api put-public-access-block \
  --bucket "${BUCKET_NAME}" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo -e "${GREEN}✓ Public access blocked${NC}"
echo ""

# Step 3: Enable encryption
echo -e "${BLUE}Step 3: Enabling server-side encryption...${NC}"
aws s3api put-bucket-encryption \
  --bucket "${BUCKET_NAME}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }'
echo -e "${GREEN}✓ Encryption enabled (AES-256)${NC}"
echo ""

# Step 4: Enable versioning
echo -e "${BLUE}Step 4: Enabling versioning...${NC}"
aws s3api put-bucket-versioning \
  --bucket "${BUCKET_NAME}" \
  --versioning-configuration Status=Enabled
echo -e "${GREEN}✓ Versioning enabled${NC}"
echo ""

# Step 5: Set lifecycle policy
echo -e "${BLUE}Step 5: Setting lifecycle policy...${NC}"
aws s3api put-bucket-lifecycle-configuration \
  --bucket "${BUCKET_NAME}" \
  --lifecycle-configuration '{
    "Rules": [{
      "Id": "DeleteOldReports",
      "Status": "Enabled",
      "Prefix": "qa-agents/",
      "Expiration": {"Days": 90},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 30}
    }]
  }'
echo -e "${GREEN}✓ Lifecycle policy set (auto-delete after 90 days)${NC}"
echo ""

# Step 6: Create IAM policy file
echo -e "${BLUE}Step 6: Creating IAM policy...${NC}"
POLICY_FILE=$(mktemp)
cat > "${POLICY_FILE}" << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListBucket",
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}"
    },
    {
      "Sid": "GetPutDeleteObjects",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:GetObjectVersion"
      ],
      "Resource": "arn:aws:s3:::${BUCKET_NAME}/*"
    }
  ]
}
EOF

# Create policy (or get existing)
POLICY_ARN=$(aws iam create-policy \
  --policy-name "${POLICY_NAME}" \
  --policy-document "file://${POLICY_FILE}" \
  --query 'Policy.Arn' \
  --output text 2>/dev/null || \
  aws iam list-policies \
    --query "Policies[?PolicyName=='${POLICY_NAME}'].Arn" \
    --output text)

echo -e "${GREEN}✓ Policy created/retrieved${NC}"
echo "  ARN: $POLICY_ARN"
echo ""

# Step 7: Create IAM user
echo -e "${BLUE}Step 7: Creating IAM user...${NC}"
if aws iam get-user --user-name "${IAM_USER}" &>/dev/null; then
  echo -e "${YELLOW}⚠️  User already exists${NC}"
else
  aws iam create-user --user-name "${IAM_USER}"
  echo -e "${GREEN}✓ User created${NC}"
fi
echo ""

# Step 8: Create access keys
echo -e "${BLUE}Step 8: Creating/retrieving access keys...${NC}"
KEYS_FILE=".aws-keys-${IAM_USER}-$(date +%Y%m%d-%H%M%S).json"

# Check if user already has access keys
EXISTING_KEYS=$(aws iam list-access-keys --user-name "${IAM_USER}" --query 'AccessKeyMetadata[0].AccessKeyId' --output text 2>/dev/null || echo "")

if [ "$EXISTING_KEYS" != "None" ] && [ ! -z "$EXISTING_KEYS" ]; then
  echo -e "${YELLOW}⚠️  User already has access keys${NC}"
  echo "  To get them again, delete and recreate:"
  echo "    aws iam delete-access-key --user-name ${IAM_USER} --access-key-id ${EXISTING_KEYS}"
  echo "    aws iam create-access-key --user-name ${IAM_USER}"
else
  aws iam create-access-key --user-name "${IAM_USER}" > "${KEYS_FILE}"
  echo -e "${GREEN}✓ Access keys created${NC}"
  echo "  Saved to: ${KEYS_FILE}"
fi
echo ""

# Step 9: Attach policy to user
echo -e "${BLUE}Step 9: Attaching policy to user...${NC}"
aws iam attach-user-policy \
  --user-name "${IAM_USER}" \
  --policy-arn "${POLICY_ARN}"
echo -e "${GREEN}✓ Policy attached${NC}"
echo ""

# Step 10: Create environment file template
echo -e "${BLUE}Step 10: Creating .env.local template...${NC}"
ENV_FILE=".env.local"

if [ ! -f "${ENV_FILE}" ]; then
  cat > "${ENV_FILE}.template" << EOF
# AWS S3 Configuration
S3_BUCKET=${BUCKET_NAME}
S3_REGION=${REGION}
S3_PREFIX=qa-agents/
S3_SIGNED_URL_EXPIRATION=3600

# AWS Credentials (from created IAM user)
AWS_ACCESS_KEY_ID=<paste-here-from-${KEYS_FILE}>
AWS_SECRET_ACCESS_KEY=<paste-here-from-${KEYS_FILE}>

# Optional: For local development with LocalStack
# LOCALSTACK_ENDPOINT=http://localhost:4566
EOF
  echo -e "${GREEN}✓ Template created: ${ENV_FILE}.template${NC}"
else
  echo -e "${YELLOW}⚠️  ${ENV_FILE} already exists${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    ✅ SETUP COMPLETE!                      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}AWS Infrastructure:${NC}"
echo "  ✓ S3 Bucket: ${BUCKET_NAME}"
echo "  ✓ Encryption: AES-256 (automatic)"
echo "  ✓ Versioning: Enabled"
echo "  ✓ Public Access: Blocked"
echo "  ✓ Lifecycle: 90-day retention"
echo ""
echo -e "${GREEN}IAM User:${NC}"
echo "  ✓ User: ${IAM_USER}"
echo "  ✓ Policy: ${POLICY_NAME}"
echo "  ✓ Permissions: S3 only (least privilege)"
echo ""
echo -e "${YELLOW}🔑 Next Steps:${NC}"
echo ""
echo "1️⃣  Retrieve access keys:"
if [ -f "${KEYS_FILE}" ]; then
  echo "   cat ${KEYS_FILE}"
  echo ""
  ACCESS_KEY=$(jq -r '.AccessKey.AccessKeyId' "${KEYS_FILE}" 2>/dev/null || echo "<not-found>")
  SECRET_KEY=$(jq -r '.AccessKey.SecretAccessKey' "${KEYS_FILE}" 2>/dev/null || echo "<not-found>")
  echo "   Access Key ID: ${ACCESS_KEY}"
  echo "   Secret Access Key: ${SECRET_KEY}"
else
  echo "   aws iam list-access-keys --user-name ${IAM_USER}"
fi
echo ""
echo "2️⃣  Update .env.local:"
echo "   cp .env.local.template .env.local"
echo "   # Edit with values from step 1"
echo ""
echo "3️⃣  Test the setup:"
echo "   npm install                    # Install dependencies"
echo "   npm run dev                    # Start dev server"
echo "   # Visit http://localhost:3000/qa-dashboard"
echo "   # Submit a job and verify S3 storage"
echo ""
echo "4️⃣  Verify bucket:"
echo "   aws s3 ls s3://${BUCKET_NAME}/"
echo "   aws s3api list-objects-v2 --bucket ${BUCKET_NAME}"
echo ""
echo -e "${YELLOW}🔐 Security Notes:${NC}"
echo "  ✓ Never commit .env.local with credentials"
echo "  ✓ Use IAM roles on AWS infrastructure (EC2, Lambda, ECS)"
echo "  ✓ Rotate access keys every 90 days"
echo "  ✓ Monitor S3 access via CloudTrail"
echo ""
echo -e "${YELLOW}💰 Cost Estimation:${NC}"
echo "  100 jobs/day = ~$5/year"
echo "  - Storage: $0.37/month (16GB)"
echo "  - API Calls: minimal"
echo "  - Data transfer: $0 (within AWS)"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "  • AWS_SETUP_GUIDE.md     - Complete setup guide"
echo "  • S3_MIGRATION_PLAN.md   - Migration strategy"
echo "  • GETTING_STARTED.md     - Quick start"
echo ""

# Cleanup temp file
rm -f "${POLICY_FILE}"

echo -e "${GREEN}Happy Testing! 🚀${NC}"
