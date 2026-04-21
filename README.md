# Document Viewer

A simple web application for uploading and viewing documents.

## Features

✅ **Upload Documents** - Upload files with drag-and-drop support
✅ **View Documents** - Preview documents in a modal viewer
✅ **Download Documents** - Download uploaded documents
✅ **File Management** - List all uploaded documents with metadata
✅ **File Validation** - Supports PDF, images, text, Office documents and more
✅ **Security** - 10MB file size limit, proper MIME type handling
✅ **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Framework**: Next.js 14 (React)
- **Styling**: Tailwind CSS
- **Language**: TypeScript
- **Storage**: Local filesystem

## Supported File Types

- Documents: PDF, TXT, DOC, DOCX, XLS, XLSX, PPT, PPTX
- Images: JPG, JPEG, PNG, GIF, WEBP

## Installation

1. Navigate to the project directory:
```bash
cd "d:\Brain Strom\document-viewer"
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open your browser and go to:
```
http://localhost:3000
```

## Usage

### Upload a Document
1. Click on the "Upload Document" section on the left
2. Select a file from your computer
3. Click "Upload" button
4. The document will appear in the list

### View a Document
1. Find the document in the list
2. Click the "View" button
3. A preview will open in a modal window
4. Close by clicking the ✕ button

### Download a Document
1. Find the document in the list
2. Click the "Download" button
3. The file will be downloaded to your computer

## Project Structure

```
document-viewer/
├── app/
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Main page with upload form
│   ├── globals.css             # Global styles
│   └── api/
│       ├── upload/
│       │   └── route.ts        # Upload endpoint
│       └── documents/
│           ├── route.ts        # Get documents list
│           └── [id]/
│               └── route.ts    # Download/view document
├── uploads/                    # Uploaded files (auto-created)
├── package.json
├── tsconfig.json
├── next.config.js
└── tailwind.config.js
```

## API Endpoints

### Upload Document
- **POST** `/api/upload`
- Request: FormData with file
- Response: `{ success: true, filename, fileId }`

### Get All Documents
- **GET** `/api/documents`
- Response: Array of documents with metadata

### Download/View Document
- **GET** `/api/documents/[id]`
- Response: File content with appropriate MIME type

### Delete Document
- **DELETE** `/api/documents/[id]`
- Response: `{ success: true, message: 'Document deleted' }`

## Features Details

### Security
- File size limit: 10MB
- MIME type validation
- Safe file handling with unique IDs
- No execution of uploaded content

### Storage
- Files stored in `/uploads` directory
- Unique IDs generated for each file
- Original filename preserved with metadata

## Development

Build for production:
```bash
npm run build
npm start
```

## Notes

- Documents are stored in the `/uploads` folder
- Each file gets a unique ID for safe handling
- The application creates the uploads directory automatically
- Uploaded files are accessible via their unique ID

---

**Ready to use!** 🎉 Simply run `npm install` and `npm run dev` to get started.
