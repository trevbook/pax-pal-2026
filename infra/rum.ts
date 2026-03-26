import * as aws from "@pulumi/aws";

// Cognito Identity Pool for unauthenticated RUM access
export const rumIdentityPool = new aws.cognito.IdentityPool("RUMIdentityPool", {
  identityPoolName: $interpolate`pax-pal-${$app.stage}-rum-pool`,
  allowUnauthenticatedIdentities: true,
  allowClassicFlow: true,
});

// IAM role for unauthenticated RUM access
const rumUnauthRole = new aws.iam.Role("RUMUnauthRole", {
  assumeRolePolicy: {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Federated: "cognito-identity.amazonaws.com" },
        Action: "sts:AssumeRoleWithWebIdentity",
        Condition: {
          StringEquals: {
            "cognito-identity.amazonaws.com:aud": rumIdentityPool.id,
          },
          "ForAnyValue:StringLike": {
            "cognito-identity.amazonaws.com:amr": "unauthenticated",
          },
        },
      },
    ],
  },
});

// CloudWatch RUM App Monitor
export const rumAppMonitor = new aws.rum.AppMonitor("RUMAppMonitor", {
  name: $interpolate`pax-pal-${$app.stage}`,
  domain: "pax-pal-2026.trevbook.com",
  appMonitorConfiguration: {
    allowCookies: false,
    sessionSampleRate: 1.0,
    telemetries: ["errors", "performance", "http"],
    identityPoolId: rumIdentityPool.id,
    guestRoleArn: rumUnauthRole.arn,
  },
});

// Attach RUM policy to unauth role
new aws.iam.RolePolicy("RUMUnauthPolicy", {
  role: rumUnauthRole.id,
  policy: {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["rum:PutRumEvents"],
        Resource: "*",
      },
    ],
  },
});

// Attach the unauth role to the identity pool
new aws.cognito.IdentityPoolRoleAttachment("RUMIdentityPoolRoles", {
  identityPoolId: rumIdentityPool.id,
  roles: {
    unauthenticated: rumUnauthRole.arn,
  },
});
