// S3 Vectors resources are provisioned outside SST via the data pipeline's
// `load` stage (or `setup-vectors` script) using @aws-sdk/client-s3vectors.
//
// This Linkable references the externally-created index and grants IAM
// permissions to any linked consumer — without requiring @pulumi/aws-native
// (which triggers a gRPC bug in SST 3.19.3). See: https://github.com/sst/sst/issues/5266

const region = aws.getRegionOutput().name;
const accountId = aws.getCallerIdentityOutput().accountId;
const bucketName = "pax-pal-vectors-production";
const indexName = "game-embeddings";
const indexArn = $interpolate`arn:aws:s3vectors:${region}:${accountId}:bucket/${bucketName}/index/${indexName}`;

export const vectorIndex = new sst.Linkable("VectorIndex", {
  properties: { indexArn, indexName, vectorBucketName: bucketName },
  include: [
    sst.aws.permission({
      actions: ["s3vectors:QueryVectors", "s3vectors:GetVectors", "s3vectors:ListVectors"],
      resources: [indexArn],
    }),
  ],
});
