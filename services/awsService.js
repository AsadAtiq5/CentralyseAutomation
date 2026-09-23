// services/awsService.js

const { GetObjectCommand } = require("@aws-sdk/client-s3");
const cache = require("./cacheService");       // updated cacheManager
const { s3Client } = require("./awsClient");
const { BASE_URLS } = require("../constant/enums");
require('dotenv').config();

class AWSService {

  /**
   * Fetch S3 file and cache in structured CacheManager
   * @param {string} key - S3 file name
   * @param {string} type - Namespace in cache
   * @returns {string} file content
   */
  async getS3File(filePath,type, key='') {
  // Build S3 key
  try {
    console.log(`Fetching from S3: ${filePath}`);
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: filePath
    });
    const response = await s3Client.send(command);
    // Transform body to string
    const body = await response.Body.transformToString();
    return body;
  } catch (err) {
    console.error(`Error fetching S3 file ${filePath}:`, err);
    throw new Error(`Failed to fetch S3 file ${key} from bucket ${process.env.AWS_S3_BUCKET}: ${err.message}`);
  }
}


}

module.exports = new AWSService();
