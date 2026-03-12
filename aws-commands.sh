#!/bin/bash
# AWS CLI Quick Reference for QA Agents Platform
# Common commands for S3 and IAM management

BUCKET="qa-agents-reports-prod"
REGION="us-east-1"
IAM_USER="qa-agents-app"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║      AWS CLI Quick Reference - QA Agents Platform         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "📝 Configuration:"
echo "   BUCKET: $BUCKET"
echo "   REGION: $REGION"
echo "   IAM_USER: $IAM_USER"
echo ""

# Function to show command and explanation
show_command() {
  local title="$1"
  local command="$2"
  local description="$3"
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📌 $title"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "$description"
  echo ""
  echo "$ $command"
  echo ""
}

# ====================
# S3 BUCKET COMMANDS
# ====================

echo "🪣  S3 BUCKET OPERATIONS"
echo "╔════════════════════════════════════════════════════════════╗"
echo ""

show_command "List all buckets" \
  "aws s3 ls" \
  "Shows all S3 buckets in your account"

show_command "List bucket contents" \
  "aws s3 ls s3://${BUCKET}/" \
  "Shows all objects in the bucket (recursive)"

show_command "List bucket contents with size" \
  "aws s3api list-objects-v2 --bucket ${BUCKET} --query 'Contents[].{Key:Key,Size:Size}' --output table" \
  "Detailed listing with object sizes"

show_command "Count objects in bucket" \
  "aws s3api list-objects-v2 --bucket ${BUCKET} --query 'length(Contents)' --output text" \
  "Shows total number of objects"

show_command "Calculate bucket size" \
  "aws s3api list-objects-v2 --bucket ${BUCKET} --query 'sum(Contents[].Size)' --output text | numfmt --to=iec-i --suffix=B" \
  "Shows total storage used (Linux only)"

show_command "Upload file to bucket" \
  "aws s3 cp myfile.txt s3://${BUCKET}/qa-agents/" \
  "Uploads a file to S3"

show_command "Download file from bucket" \
  "aws s3 cp s3://${BUCKET}/qa-agents/report.json ./report.json" \
  "Downloads a file from S3"

show_command "Sync local directory to S3" \
  "aws s3 sync ./reports s3://${BUCKET}/qa-agents/backup/" \
  "Syncs all files in directory to S3"

show_command "Delete object from bucket" \
  "aws s3 rm s3://${BUCKET}/qa-agents/old-report.json" \
  "Deletes a single object"

show_command "Delete all objects with prefix" \
  "aws s3 rm s3://${BUCKET}/qa-agents/ --recursive --exclude '*.keep'" \
  "Deletes all objects matching prefix (keep .keep files)"

show_command "View bucket location" \
  "aws s3api get-bucket-location --bucket ${BUCKET}" \
  "Shows which region the bucket is in"

# ====================
# S3 CONFIGURATION
# ====================

echo ""
echo "⚙️  S3 CONFIGURATION"
echo "╣════════════════════════════════════════════════════════════╣"
echo ""

show_command "View bucket versioning status" \
  "aws s3api get-bucket-versioning --bucket ${BUCKET}" \
  "Shows if versioning is enabled"

show_command "View encryption settings" \
  "aws s3api get-bucket-encryption --bucket ${BUCKET}" \
  "Shows encryption configuration"

show_command "View public access block" \
  "aws s3api get-public-access-block --bucket ${BUCKET}" \
  "Shows public access restrictions"

show_command "View lifecycle configuration" \
  "aws s3api get-bucket-lifecycle-configuration --bucket ${BUCKET}" \
  "Shows auto-delete rules"

show_command "View bucket policy" \
  "aws s3api get-bucket-policy --bucket ${BUCKET} --output text | jq ." \
  "Shows bucket access policy"

show_command "Generate signed URL (1 hour)" \
  "aws s3 presign s3://${BUCKET}/qa-agents/report.json --expires-in 3600" \
  "Creates temporary public URL for object"

# ====================
# IAM USER COMMANDS
# ====================

echo ""
echo "👤 IAM USER OPERATIONS"
echo "╣════════════════════════════════════════════════════════════╣"
echo ""

show_command "Get user info" \
  "aws iam get-user --user-name ${IAM_USER}" \
  "Shows IAM user details"

show_command "List all access keys for user" \
  "aws iam list-access-keys --user-name ${IAM_USER}" \
  "Shows all access keys (hide secrets!)"

show_command "Create new access key" \
  "aws iam create-access-key --user-name ${IAM_USER}" \
  "Generates new AccessKeyId and SecretAccessKey"

show_command "Delete access key" \
  "aws iam delete-access-key --user-name ${IAM_USER} --access-key-id AKIXXXXXXXXXXXX" \
  "Deletes old access key (use key ID from list command)"

show_command "List attached policies" \
  "aws iam list-attached-user-policies --user-name ${IAM_USER}" \
  "Shows what permissions user has"

show_command "View policy details" \
  "aws iam get-policy --policy-arn arn:aws:iam::123456789:policy/QAAgentsS3Access | jq '.Policy.Arn'" \
  "Shows policy information"

show_command "Delete access key and user" \
  "aws iam delete-access-key --user-name ${IAM_USER} --access-key-id AKIXXXX && aws iam delete-user --user-name ${IAM_USER}" \
  "CAREFUL: Deletes user and access (requires policy detached first)"

# ====================
# MONITORING & LOGS
# ====================

echo ""
echo "📊 MONITORING & LOGS"
echo "╣════════════════════════════════════════════════════════════╣"
echo ""

show_command "List CloudTrail events (requires access)" \
  "aws cloudtrail lookup-events --lookup-attributes AttributeKey=ResourceName,AttributeValue=${BUCKET} --max-results 10" \
  "Shows S3 access logs (if CloudTrail enabled)"

show_command "Check bucket size history (CloudWatch)" \
  "aws cloudwatch get-metric-statistics --namespace AWS/S3 --metric-name BucketSizeBytes --dimensions Name=BucketName,Value=${BUCKET} --start-time $(date -d '7 days ago' -Iseconds) --end-time $(date -Iseconds) --period 86400 --statistics Average" \
  "Shows bucket size over time"

show_command "Get billing info" \
  "aws ce get-cost-and-usage --time-period Start=$(date -d '30 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) --granularity MONTHLY --metrics BlendedCost --filter file://filter.json --group-by Type=DIMENSION,Key=SERVICE" \
  "Shows AWS costs (requires Cost Explorer access)"

# ====================
# TROUBLESHOOTING
# ====================

echo ""
echo "🔧 TROUBLESHOOTING"
echo "╣════════════════════════════════════════════════════════════╣"
echo ""

show_command "Verify AWS credentials" \
  "aws sts get-caller-identity" \
  "Shows current AWS account and user"

show_command "Test S3 access" \
  "aws s3 ls s3://${BUCKET} --region ${REGION}" \
  "Verify user can access bucket"

show_command "Test object upload" \
  "echo 'test' | aws s3 cp - s3://${BUCKET}/test.txt && aws s3 rm s3://${BUCKET}/test.txt" \
  "Quick test of read/write permissions"

show_command "Check IAM user permissions" \
  "aws iam list-user-policies --user-name ${IAM_USER}" \
  "Shows inline policies attached to user"

show_command "View detailed policy" \
  "aws iam get-user-policy --user-name ${IAM_USER} --policy-name PolicyName" \
  "Shows actual policy permissions"

# ====================
# EXAMPLES
# ====================

echo ""
echo "💡 PRACTICAL EXAMPLES"
echo "╣════════════════════════════════════════════════════════════╣"
echo ""

show_command "Find all reports older than 30 days" \
  "aws s3api list-objects-v2 --bucket ${BUCKET} --query \"Contents[?LastModified<'$(date -d '30 days ago' -Iseconds)'].Key\" --output text" \
  "Lists old objects for cleanup"

show_command "Backup bucket to local" \
  "aws s3 sync s3://${BUCKET}/ ./bucket-backup/" \
  "Downloads entire bucket to local directory"

show_command "Count jobs by date" \
  "aws s3api list-objects-v2 --bucket ${BUCKET} --prefix 'qa-agents/' --query 'Contents[].Key' --output text | grep -o '20[0-9][0-9]-[0-9][0-9]-[0-9][0-9]' | sort | uniq -c" \
  "Shows how many jobs per day"

show_command "List largest files in bucket" \
  "aws s3api list-objects-v2 --bucket ${BUCKET} --query 'sort_by(Contents, &Size)[-10:].{Key:Key, Size:Size}' --output table" \
  "Top 10 largest objects"

# ====================
# CLEANUP
# ====================

echo ""
echo "🗑️  CLEANUP (DESTRUCTIVE)"
echo "╣════════════════════════════════════════════════════════════╣"
echo ""

show_command "Empty entire bucket" \
  "aws s3 rm s3://${BUCKET}/ --recursive" \
  "⚠️  CAREFUL: Deletes all objects in bucket"

show_command "Delete bucket (must be empty first)" \
  "aws s3 rb s3://${BUCKET}" \
  "⚠️  CAREFUL: Deletes the bucket itself"

show_command "Delete user and all access keys" \
  "aws iam list-access-keys --user-name ${IAM_USER} --query 'AccessKeyMetadata[].AccessKeyId' --output text | xargs -I {} aws iam delete-access-key --user-name ${IAM_USER} --access-key-id {} && aws iam delete-user --user-name ${IAM_USER}" \
  "⚠️  CAREFUL: Completely removes user"

# ====================
# HELP & INFO
# ====================

echo ""
echo "ℹ️  HELP & INFORMATION"
echo "╣════════════════════════════════════════════════════════════╣"
echo ""

show_command "S3 command help" \
  "aws s3 help" \
  "Shows S3 CLI documentation"

show_command "S3 API help" \
  "aws s3api help" \
  "Shows S3 API documentation"

show_command "IAM help" \
  "aws iam help" \
  "Shows IAM CLI documentation"

show_command "Specific command help" \
  "aws s3 cp help" \
  "Shows help for specific command"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 For more info, see AWS_SETUP_GUIDE.md"
echo "💡 To execute a command, copy it and paste into terminal"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
