
const {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    HeadObjectCommand
} = require("@aws-sdk/client-s3");

const {
    getSignedUrl
} = require("@aws-sdk/s3-request-presigner");


const s3 = new S3Client({});

const BUCKET_NAME =
    process.env.BUCKET_NAME;


exports.handler = async (event) => {

    console.log("CloudPulse Upload/Download Lambda started");

    try {

        // ----------------------------------------
        // Determine HTTP method
        // ----------------------------------------

        const method =
            event.requestContext?.http?.method ||
            event.httpMethod;

        console.log("HTTP Method:", method);


        // ----------------------------------------
        // Parse request body
        // ----------------------------------------

        let body = {};

        if (event.body) {

            try {

                body =
                    typeof event.body === "string"
                        ? JSON.parse(event.body)
                        : event.body;

            } catch (error) {

                console.error(
                    "Invalid JSON body:",
                    error
                );

                return {
                    statusCode: 400,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message:
                            "Invalid JSON request body"
                    })
                };
            }
        }


        // ==================================================
        // POST /upload-url
        // ==================================================

        if (method === "POST") {

            console.log(
                "Generating presigned upload URL"
            );


            const fileName =
                body.fileName;

            const contentType =
                body.contentType;


            // ----------------------------------------
            // Validate input
            // ----------------------------------------

            if (!fileName || !contentType) {

                return {
                    statusCode: 400,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message:
                            "fileName and contentType are required"
                    })
                };
            }


            // ----------------------------------------
            // Allowed image formats
            // ----------------------------------------

            const allowedTypes = [

                "image/jpeg",

                "image/png",

                "image/webp"

            ];


            if (!allowedTypes.includes(contentType)) {

                return {
                    statusCode: 400,

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        message:
                            "Unsupported image type. Allowed types: JPEG, PNG, WebP"
                    })
                };
            }


            // ----------------------------------------
            // Sanitize filename
            // ----------------------------------------

            const safeFileName =
                fileName.replace(
                    /[^a-zA-Z0-9._-]/g,
                    "_"
                );


            // ----------------------------------------
            // Create S3 object key
            // ----------------------------------------

            const key =
                `original/${Date.now()}-${safeFileName}`;


            console.log(
                "Upload key:",
                key
            );


            // ----------------------------------------
            // Create S3 PUT command
            // ----------------------------------------

            const command =
                new PutObjectCommand({

                    Bucket:
                        BUCKET_NAME,

                    Key:
                        key,

                    ContentType:
                        contentType

                });


            // ----------------------------------------
            // Generate presigned PUT URL
            // ----------------------------------------

            const uploadUrl =
                await getSignedUrl(

                    s3,

                    command,

                    {
                        expiresIn: 300
                    }

                );


            console.log(
                "Presigned upload URL generated"
            );


            return {

                statusCode: 200,

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

                    uploadUrl,

                    key,

                    expiresIn: 300

                })

            };

        }


        // ==================================================
        // GET /download-url
        // ==================================================

        if (method === "GET") {

            console.log(
                "Generating presigned download URL"
            );


            // ----------------------------------------
            // Read query parameter
            // ----------------------------------------

            const key =
                event.queryStringParameters?.key;


            if (!key) {

                return {

                    statusCode: 400,

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        message:
                            "key query parameter is required"

                    })

                };

            }


            console.log(
                "Requested key:",
                key
            );


            // ----------------------------------------
            // Security check
            //
            // Only resized images can be downloaded
            // ----------------------------------------

            if (!key.startsWith("resized/")) {

                return {

                    statusCode: 400,

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        message:
                            "Only resized images are allowed"

                    })

                };

            }


            // ----------------------------------------
            // Check whether resized object exists
            // ----------------------------------------

            try {

                console.log(
                    "Checking if object exists..."
                );


                await s3.send(

                    new HeadObjectCommand({

                        Bucket:
                            BUCKET_NAME,

                        Key:
                            key

                    })

                );


                console.log(
                    "Resized image exists"
                );


            } catch (error) {

                console.error(
                    "HeadObject error:",
                    error
                );


                // Object does not exist yet
                if (
                    error.name === "NotFound" ||
                    error.$metadata?.httpStatusCode === 404
                ) {

                    return {

                        statusCode: 404,

                        headers: {

                            "Content-Type":
                                "application/json"

                        },

                        body: JSON.stringify({

                            message:
                                "Image is still being processed"

                        })

                    };

                }


                // Other S3/IAM errors
                return {

                    statusCode: 500,

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        message:
                            "Unable to check image status"

                    })

                };

            }


            // ----------------------------------------
            // Create GET command
            // ----------------------------------------

            const command =
                new GetObjectCommand({

                    Bucket:
                        BUCKET_NAME,

                    Key:
                        key

                });


            // ----------------------------------------
            // Generate presigned GET URL
            // ----------------------------------------

            const downloadUrl =
                await getSignedUrl(

                    s3,

                    command,

                    {
                        expiresIn: 300
                    }

                );


            console.log(
                "Presigned download URL generated"
            );


            return {

                statusCode: 200,

                headers: {

                    "Content-Type":
                        "application/json"

                },

                body: JSON.stringify({

                    downloadUrl,

                    expiresIn: 300

                })

            };

        }


        // ==================================================
        // Unsupported HTTP method
        // ==================================================

        return {

            statusCode: 405,

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify({

                message:
                    "Method not allowed"

            })

        };


    } catch (error) {

        // ==================================================
        // Global error handler
        // ==================================================

        console.error(
            "Lambda error:",
            error
        );


        return {

            statusCode: 500,

            headers: {

                "Content-Type":
                    "application/json"

            },

            body: JSON.stringify({

                message:
                    "Internal server error"

            })

        };

    }

};

