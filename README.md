# ☁️ CloudPulse Image Resizer

A serverless image processing application built on AWS that securely uploads, resizes, and downloads images using an event-driven architecture.

Users can upload JPEG, PNG, or WebP images through a web interface. The application generates temporary S3 presigned URLs, processes the image using AWS Lambda and Sharp, and provides a secure presigned download URL for the resized image.

---
## 🔄 End-to-End Workflow

### 1. User selects an image

The user selects or drags an image into the CloudPulse frontend.

Currently supported:

- JPEG
- PNG
- WebP

---

### 2. Frontend requests an upload URL

The browser sends:

```http
POST /upload-url
```

to Amazon API Gateway.

The request contains:

```json
{
  "fileName": "example.png",
  "contentType": "image/png"
}
```

---

### 3. Upload Lambda generates a presigned URL

API Gateway invokes the Upload Lambda.

The Lambda:

- Validates the file name
- Validates the content type
- Generates a unique S3 object key
- Generates a temporary presigned S3 `PUT` URL

Example:

```text
original/1750000000000-example.png
```

The browser receives the temporary URL.

No AWS access keys are exposed to the browser.

---

### 4. Browser uploads directly to Amazon S3

The browser uses the presigned URL to upload the image directly to the private S3 bucket.

```text
S3 Bucket
└── original/
    └── example.png
```

---

### 5. S3 triggers the Resizer Lambda

An S3 `ObjectCreated` event triggers the Resizer Lambda.

The Lambda:

1. Reads the S3 event
2. Downloads the original image
3. Processes the image using Sharp
4. Resizes the image
5. Uploads the processed image to `resized/`

Current resize configuration:

```text
Maximum width: 800px
withoutEnlargement: true
```

---

### 6. Resized image is stored

The processed image is stored separately:

```text
S3 Bucket
├── original/
│   └── example.png
│
└── resized/
    └── example.png
```

The S3 bucket containing images remains private.

---

### 7. Frontend checks processing status

The frontend requests:

```http
GET /download-url?key=resized/example.png
```

The Download Lambda checks whether the resized image exists.

If processing is still running:

```http
404
```

is returned.

The frontend waits and checks again.

---

### 8. Download Lambda generates a presigned URL

Once the resized image exists, the Download Lambda generates a temporary S3 `GET` presigned URL.

The browser uses this URL to download the resized image.

---

# 🔐 Security

Security was considered throughout the architecture.

## No AWS credentials in frontend

The frontend never contains:

```text
AWS Access Key
AWS Secret Access Key
```

Instead, the application uses:

```text
Browser
   ↓
API Gateway
   ↓
Lambda
   ↓
Presigned URL
   ↓
S3
```

---

## Private image storage

The image S3 bucket is private.

Users access images through temporary presigned URLs rather than public S3 object URLs.

---

## IAM Least Privilege

Lambda execution roles are restricted to the resources they need.

For example, the Resizer Lambda can:

```text
s3:GetObject
original/*
```

and:

```text
s3:PutObject
resized/*
```

It does not require unrestricted access to the entire S3 bucket.

---

## Preventing Recursive Lambda Invocation

The S3 event notification is configured only for:

```text
original/
```

The Lambda writes processed images to:

```text
resized/
```

Therefore:

```text
original/image.png
       │
       ▼
Resizer Lambda
       │
       ▼
resized/image.png
```

The processed image does not trigger the Resizer Lambda again.

---

# ☁️ AWS Services Used

| AWS Service | Purpose |
|---|---|
| Amazon S3 | Frontend hosting and private image storage |
| API Gateway | HTTP API endpoints |
| AWS Lambda | Upload URL, download URL and image processing |
| Sharp | Image resizing |
| Amazon SNS | Processing notifications and alerts |
| Amazon CloudWatch | Logs, metrics and alarms |
| AWS IAM | Access control and least privilege |
| S3 Event Notifications | Event-driven Lambda invocation |

---

# 📁 Project Structure

```text
cloudpulse-image-resizer/
│
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── lambda/
│   ├── index.js
│   ├── package.json
│   └── package-lock.json
│
├── upload-lambda/
│   ├── index.js
│   ├── package.json
│   └── package-lock.json
│
├── architecture.png
├── README.md
└── .gitignore
```

---

# 🧪 Supported Image Formats

Currently supported:

```text
JPEG
PNG
WebP
```

MIME types:

```text
image/jpeg
image/png
image/webp
```

Currently unsupported:

```text
GIF
SVG
HEIC
TIFF
```

---

# 📊 Monitoring and Alerts

Amazon CloudWatch monitors the Resizer Lambda.

The project includes a Lambda error alarm based on:

```text
Namespace: AWS/Lambda
Metric: Errors
Function: cloudpulse-image-resizer
Statistic: Sum
Period: 5 minutes
```

When the configured error threshold is reached, CloudWatch sends an alert through Amazon SNS.

---

# 📩 Notifications

Amazon SNS is used for:

### Successful processing

The Resizer Lambda publishes a notification after successfully processing an image.

### Lambda errors

CloudWatch sends Lambda error alarms to SNS.

This provides basic operational monitoring for the application.

---

# 🧰 Technologies

### Frontend

- HTML
- CSS
- JavaScript

### Backend

- Node.js
- AWS Lambda
- Sharp
- AWS SDK for JavaScript

### AWS

- Amazon S3
- API Gateway
- Lambda
- SNS
- CloudWatch
- IAM

### Deployment / Management

- AWS CLI
- AWS Console

---

# 💰 Cost

The application uses primarily serverless, pay-per-use AWS services.

For a small portfolio or development workload, the request and compute costs are very low.

Actual cost depends on:

- Number of uploads
- Image size
- Lambda execution duration
- Number of API requests
- S3 storage
- S3 requests
- CloudWatch logs
- Data transfer
- Image retention period

The application does not require an always-running EC2 instance.

---

# 🧪 Testing

The complete application was tested using the following flow:

```text
Browser
   ↓
POST /upload-url
   ↓
API Gateway
   ↓
Upload Lambda
   ↓
Presigned S3 PUT URL
   ↓
S3 original/
   ↓
S3 ObjectCreated Event
   ↓
Resizer Lambda
   ↓
Sharp
   ↓
S3 resized/
   ↓
GET /download-url
   ↓
Download Lambda
   ↓
Presigned S3 GET URL
   ↓
Browser
```

The following were also tested:

- Direct S3 upload using presigned URL
- Automatic S3 → Lambda trigger
- Image resizing
- Resized image upload
- Presigned download URL
- Processing status check
- SNS notification
- CloudWatch Lambda error alarm
- IAM permission restrictions
- API Gateway CORS

---

# 🧠 Key Concepts Learned

This project helped me understand practical AWS serverless architecture and event-driven application design.

### AWS concepts

- Amazon S3
- S3 Event Notifications
- AWS Lambda
- API Gateway
- IAM
- SNS
- CloudWatch
- Presigned URLs
- Serverless architecture

### DevOps / Cloud concepts

- Least-privilege IAM
- Event-driven architecture
- Asynchronous processing
- Application monitoring
- Error alerting
- Secure object access
- AWS CLI based deployment
- Troubleshooting AWS services

---

# 🔮 Future Improvements

Possible future improvements:

- CI/CD pipeline using GitHub Actions
- Authentication and authorization
- API authentication
- Image size validation
- Additional image formats
- S3 lifecycle policies
- Dead-letter queue
- Improved processing status tracking
- CloudWatch dashboard
- Custom domain
- Automated deployment

---

# 👨‍💻 Author

**K Uday**

Cloud / DevOps Enthusiast

---

⭐ If you found this project useful, feel free to explore the repository.
