// SST Secrets — encrypted and stored in S3.
// Set values via: sst secret set <Name> <value>

/** Gemini API key for embedding search queries. */
export const geminiApiKey = new sst.Secret("GeminiApiKey");
