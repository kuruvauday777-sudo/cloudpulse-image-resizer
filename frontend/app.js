
const API_BASE_URL =
    "https://bq3aj1lvoa.execute-api.ap-south-1.amazonaws.com";


const fileInput =
    document.getElementById("fileInput");

const uploadButton =
    document.getElementById("uploadButton");

const uploadArea =
    document.getElementById("uploadArea");

const fileInfo =
    document.getElementById("fileInfo");

const fileNameElement =
    document.getElementById("fileName");

const fileSizeElement =
    document.getElementById("fileSize");

const statusElement =
    document.getElementById("status");

const resultElement =
    document.getElementById("result");

const resultMessage =
    document.getElementById("resultMessage");

const downloadButton =
    document.getElementById("downloadButton");


let selectedFile = null;


// ==================================================
// File selection
// ==================================================

fileInput.addEventListener(
    "change",
    handleFileSelection
);


uploadArea.addEventListener(
    "dragover",
    (event) => {

        event.preventDefault();

        uploadArea.classList.add(
            "drag-over"
        );

    }
);


uploadArea.addEventListener(
    "dragleave",
    () => {

        uploadArea.classList.remove(
            "drag-over"
        );

    }
);


uploadArea.addEventListener(
    "drop",
    (event) => {

        event.preventDefault();

        uploadArea.classList.remove(
            "drag-over"
        );

        const files =
            event.dataTransfer.files;

        if (files.length > 0) {

            selectedFile =
                files[0];

            showSelectedFile();

        }

    }
);


// ==================================================
// Handle selected file
// ==================================================

function handleFileSelection() {

    if (!fileInput.files.length) {

        return;

    }

    selectedFile =
        fileInput.files[0];

    showSelectedFile();

}


// ==================================================
// Display selected file
// ==================================================

function showSelectedFile() {

    if (!selectedFile) {

        return;

    }


    const allowedTypes = [

        "image/jpeg",
        "image/png",
        "image/webp"

    ];


    if (
        !allowedTypes.includes(
            selectedFile.type
        )
    ) {

        showStatus(
            "Unsupported image type. Use JPG, PNG or WebP.",
            "error"
        );

        uploadButton.disabled = true;

        return;

    }


    fileNameElement.textContent =
        selectedFile.name;


    fileSizeElement.textContent =
        formatFileSize(
            selectedFile.size
        );


    fileInfo.classList.remove(
        "hidden"
    );


    uploadButton.disabled =
        false;


    hideStatus();

    resultElement.classList.add(
        "hidden"
    );

}


// ==================================================
// Upload button
// ==================================================

uploadButton.addEventListener(
    "click",
    uploadAndResize
);


// ==================================================
// Main upload flow
// ==================================================

async function uploadAndResize() {

    if (!selectedFile) {

        return;

    }


    try {

        uploadButton.disabled =
            true;


        resultElement.classList.add(
            "hidden"
        );


        // ------------------------------------------
        // Step 1: Request presigned upload URL
        // ------------------------------------------

        showStatus(
            "Generating secure upload URL...",
            "info"
        );


        const uploadUrlResponse =
            await fetch(
                `${API_BASE_URL}/upload-url`,
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        fileName:
                            selectedFile.name,

                        contentType:
                            selectedFile.type

                    })

                }
            );


        if (!uploadUrlResponse.ok) {

            throw new Error(
                "Failed to generate upload URL"
            );

        }


        const uploadData =
            await uploadUrlResponse.json();


        const uploadUrl =
            uploadData.uploadUrl;


        const originalKey =
            uploadData.key;


        console.log(
            "Original key:",
            originalKey
        );


        // ------------------------------------------
        // Step 2: Upload directly to S3
        // ------------------------------------------

        showStatus(
            "Uploading image to Amazon S3...",
            "info"
        );


        const s3UploadResponse =
            await fetch(
                uploadUrl,
                {

                    method: "PUT",

                    headers: {

                        "Content-Type":
                            selectedFile.type

                    },

                    body:
                        selectedFile

                }
            );


        if (!s3UploadResponse.ok) {

            throw new Error(
                "Image upload to S3 failed"
            );

        }


        console.log(
            "S3 upload successful"
        );


        // ------------------------------------------
        // Step 3: Calculate resized key
        // ------------------------------------------

        const resizedKey =
            originalKey.replace(
                /^original\//,
                "resized/"
            );


        console.log(
            "Expected resized key:",
            resizedKey
        );


        // ------------------------------------------
        // Step 4: Wait for Lambda processing
        // ------------------------------------------

        showStatus(
            "Upload complete. AWS Lambda is resizing the image...",
            "info"
        );


        const downloadUrl =
            await waitForResizedImage(
                resizedKey
            );


        // ------------------------------------------
        // Step 5: Show result
        // ------------------------------------------

        downloadButton.href =
            downloadUrl;


        resultMessage.textContent =
            "Your image has been resized successfully.";


        resultElement.classList.remove(
            "hidden"
        );


        showStatus(
            "Image processing complete!",
            "success"
        );


    } catch (error) {

        console.error(
            "Upload error:",
            error
        );


        showStatus(
            `Error: ${error.message}`,
            "error"
        );

    } finally {

        uploadButton.disabled =
            false;

    }

}


// ==================================================
// Poll for resized image
// ==================================================

async function waitForResizedImage(
    resizedKey
) {

    const maxAttempts = 30;

    const delayMs = 2000;


    for (
        let attempt = 1;
        attempt <= maxAttempts;
        attempt++
    ) {

        console.log(
            `Checking resized image (${attempt}/${maxAttempts})`
        );


        try {

            const response =
                await fetch(

                    `${API_BASE_URL}/download-url?key=${encodeURIComponent(
                        resizedKey
                    )}`

                );


            // --------------------------------------
            // Image is ready
            // --------------------------------------

            if (response.ok) {

                const data =
                    await response.json();


                console.log(
                    "Resized image is ready"
                );


                return data.downloadUrl;

            }


            // --------------------------------------
            // Still processing
            // --------------------------------------

            if (response.status === 404) {

                showStatus(

                    `AWS Lambda is processing the image... (${attempt}/${maxAttempts})`,

                    "info"

                );


                await sleep(
                    delayMs
                );


                continue;

            }


            // --------------------------------------
            // Unexpected error
            // --------------------------------------

            throw new Error(
                `Download URL request failed: ${response.status}`
            );

        } catch (error) {

            console.error(
                "Polling error:",
                error
            );

            throw error;

        }

    }


    throw new Error(
        "Image processing timed out. Please try again."
    );

}


// ==================================================
// Sleep helper
// ==================================================

function sleep(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );

}


// ==================================================
// Status helpers
// ==================================================

function showStatus(
    message,
    type
) {

    statusElement.textContent =
        message;


    statusElement.className =
        `status ${type}`;


    statusElement.classList.remove(
        "hidden"
    );

}


function hideStatus() {

    statusElement.classList.add(
        "hidden"
    );

}


// ==================================================
// File size helper
// ==================================================

function formatFileSize(
    bytes
) {

    if (bytes === 0) {

        return "0 Bytes";

    }


    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        parseFloat(
            (
                bytes /
                Math.pow(
                    1024,
                    index
                )
            ).toFixed(2)
        ) +
        " " +
        units[index]
    );

}

