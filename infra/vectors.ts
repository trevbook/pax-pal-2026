// S3 Vectors resources are provisioned outside SST via the data pipeline's
// `load` stage (or `setup-vectors` script) using @aws-sdk/client-s3vectors.
//
// Why not SST/Pulumi? @pulumi/aws-native triggers a gRPC serialization bug
// in SST 3.19.3's bundled Pulumi 3.210.0 engine ("b.Va is not a function"
// in registerResourceOutputs). See: https://github.com/sst/sst/issues/5266
//
// The vector index ARN, name, and bucket name are passed to the frontend
// and load script via environment variables instead of SST resource linking.
//
// Expected env vars (set after running `just setup-vectors` or `just load`):
//   VECTOR_INDEX_ARN
//   VECTOR_INDEX_NAME
//   VECTOR_BUCKET_NAME
