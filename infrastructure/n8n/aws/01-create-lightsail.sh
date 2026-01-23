#!/bin/bash
set -e

INSTANCE_NAME="nba-cloud-hub"
REGION="ap-northeast-1"  # Tokyo region, change as needed
BUNDLE_ID="nano_3_0"     # $3.50/month plan
BLUEPRINT_ID="ubuntu_22_04"
AVAILABILITY_ZONE="${REGION}a"

echo "=== Creating Lightsail Instance: ${INSTANCE_NAME} ==="

# Create the instance
aws lightsail create-instances \
  --instance-names "${INSTANCE_NAME}" \
  --availability-zone "${AVAILABILITY_ZONE}" \
  --blueprint-id "${BLUEPRINT_ID}" \
  --bundle-id "${BUNDLE_ID}" \
  --region "${REGION}"

echo "Waiting for instance to be running..."
sleep 30

# Wait for instance to be ready
aws lightsail wait instance-running \
  --instance-name "${INSTANCE_NAME}" \
  --region "${REGION}" 2>/dev/null || sleep 60

# Open port 80 (HTTP)
echo "Opening port 80..."
aws lightsail open-instance-public-ports \
  --instance-name "${INSTANCE_NAME}" \
  --port-info fromPort=80,toPort=80,protocol=tcp \
  --region "${REGION}"

# Open port 443 (HTTPS)
echo "Opening port 443..."
aws lightsail open-instance-public-ports \
  --instance-name "${INSTANCE_NAME}" \
  --port-info fromPort=443,toPort=443,protocol=tcp \
  --region "${REGION}"

# Get instance info
echo ""
echo "=== Instance Created Successfully ==="
aws lightsail get-instance \
  --instance-name "${INSTANCE_NAME}" \
  --region "${REGION}" \
  --query 'instance.{Name:name,State:state.name,PublicIP:publicIpAddress,Username:username}' \
  --output table

# Get the public IP
PUBLIC_IP=$(aws lightsail get-instance \
  --instance-name "${INSTANCE_NAME}" \
  --region "${REGION}" \
  --query 'instance.publicIpAddress' \
  --output text)

echo ""
echo "Public IP: ${PUBLIC_IP}"
echo "nip.io domain: ${PUBLIC_IP}.nip.io"
echo ""
echo "Next step: Download SSH key from Lightsail console and run:"
echo "  ssh -i ~/.ssh/LightsailDefaultKey-${REGION}.pem ubuntu@${PUBLIC_IP}"
