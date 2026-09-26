const {
    S3Client,
    GetObjectCommand,
    PutObjectCommand
} = require("@aws-sdk/client-s3");

const {
    SNSClient,
    PublishCommand
} = require("@aws-sdk/client-sns");

const sharp = require("sharp");

const s3 = new S3Client({});
const sns = new SNSClient({});

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

exports.handler = async (event) => {
    console.log("CloudPulse Image Resizer started");

    console.log("S3 Event:");
    console.log(JSON.stringify(event, null, 2));

    for (const record of event.Records) {

        const bucket = record.s3.bucket.name;

        const key = decodeURIComponent(
            record.s3.object.key.replace(/\+/g, " ")
        );

        console.log(`Processing: s3://${bucket}/${key}`);

        // Only process images inside original/
        if (!key.startsWith("original/")) {
            console.log(`Skipping: ${key}`);
            continue;
        }

        // Download original image from S3
        const response = await s3.send(
            new GetObjectCommand({
                Bucket: bucket,
                Key: key
            })
        );

        const imageBuffer = Buffer.from(
            await response.Body.transformToByteArray()
        );

        console.log("Original image downloaded");

        // Get image metadata
        const metadata = await sharp(imageBuffer).metadata();

        console.log(`Image format: ${metadata.format}`);
        console.log(`Original dimensions: ${metadata.width}x${metadata.height}`);

        // Create Sharp pipeline
        let image = sharp(imageBuffer).resize({
            width: 800,
            withoutEnlargement: true
        });

        let extension;
        let contentType;

        // JPEG
        if (metadata.format === "jpeg") {

            image = image.jpeg({
                quality: 80
            });

            extension = ".jpg";
            contentType = "image/jpeg";

        // PNG
        } else if (metadata.format === "png") {

            image = image.png();

            extension = ".png";
            contentType = "image/png";

        // WebP
        } else if (metadata.format === "webp") {

            image = image.webp({
                quality: 80
            });

            extension = ".webp";
            contentType = "image/webp";

        } else {

            throw new Error(
                `Unsupported image format: ${metadata.format}`
            );
        }

        // Generate resized image
        const resizedBuffer = await image.toBuffer();

        console.log("Image resized successfully");

        // Remove original/ prefix
        const originalFileName = key.substring("original/".length);

        // Remove existing extension
        const baseName = originalFileName.replace(
            /\.[^/.]+$/,
            ""
        );

        // Create resized object key
        const outputKey = `resized/${baseName}${extension}`;

        console.log(
            `Uploading: s3://${bucket}/${outputKey}`
        );

        // Upload resized image
        await s3.send(
            new PutObjectCommand({
                Bucket: bucket,
                Key: outputKey,
                Body: resizedBuffer,
                ContentType: contentType
            })
        );

        console.log(
            `Successfully uploaded: ${outputKey}`
        );

        // Send SNS notification
        if (SNS_TOPIC_ARN) {

            await sns.send(
                new PublishCommand({
                    TopicArn: SNS_TOPIC_ARN,

                    Subject:
                        "CloudPulse Image Processing Completed",

                    Message: `CloudPulse Image Processing Completed

Original Image:
s3://${bucket}/${key}

Resized Image:
s3://${bucket}/${outputKey}

Original Dimensions:
${metadata.width}x${metadata.height}

Resize Width:
800px

Status:
SUCCESS
`
                })
            );

            console.log(
                "SNS notification sent successfully"
            );

        } else {

            console.log(
                "SNS_TOPIC_ARN environment variable is not configured"
            );
        }
    }

    return {
        statusCode: 200,

        body: JSON.stringify({
            message: "Image processed successfully"
        })
    };
};
