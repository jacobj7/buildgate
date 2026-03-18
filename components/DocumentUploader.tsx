"use client";

import { useState, useCallback, useRef } from "react";
import { z } from "zod";

const PresignResponseSchema = z.object({
  uploadUrl: z.string().url(),
  documentId: z.string(),
  key: z.string(),
  expiresAt: z.string(),
});

const DocumentMetadataSchema = z.object({
  documentId: z.string(),
  key: z.string(),
  fileName: z.string(),
  fileSize: z.number(),
  fileType: z.string(),
  uploadedAt: z.string(),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

interface DocumentUploaderProps {
  onUploadComplete?: (metadata: DocumentMetadata) => void;
  onUploadError?: (error: Error) => void;
  accept?: string;
  maxSizeMB?: number;
  multiple?: boolean;
  className?: string;
}

type UploadStatus = "idle" | "presigning" | "uploading" | "complete" | "error";

interface FileUploadState {
  file: File;
  status: UploadStatus;
  progress: number;
  error?: string;
  metadata?: DocumentMetadata;
}

export default function DocumentUploader({
  onUploadComplete,
  onUploadError,
  accept = "*/*",
  maxSizeMB = 50,
  multiple = false,
  className = "",
}: DocumentUploaderProps) {
  const [uploads, setUploads] = useState<Map<string, FileUploadState>>(
    new Map(),
  );
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const updateUploadState = useCallback(
    (fileId: string, updates: Partial<FileUploadState>) => {
      setUploads((prev) => {
        const next = new Map(prev);
        const existing = next.get(fileId);
        if (existing) {
          next.set(fileId, { ...existing, ...updates });
        }
        return next;
      });
    },
    [],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const fileId = `${file.name}-${Date.now()}-${Math.random()}`;

      setUploads((prev) => {
        const next = new Map(prev);
        next.set(fileId, {
          file,
          status: "presigning",
          progress: 0,
        });
        return next;
      });

      try {
        // Step 1: Get presigned URL
        updateUploadState(fileId, { status: "presigning", progress: 0 });

        const presignResponse = await fetch("/api/documents/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
          }),
        });

        if (!presignResponse.ok) {
          const errorData = await presignResponse.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `Failed to get upload URL: ${presignResponse.status}`,
          );
        }

        const presignData = PresignResponseSchema.parse(
          await presignResponse.json(),
        );

        // Step 2: Upload directly to R2
        updateUploadState(fileId, { status: "uploading", progress: 10 });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable) {
              const progress =
                10 + Math.round((event.loaded / event.total) * 85);
              updateUploadState(fileId, { progress });
            }
          });

          xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
          });

          xhr.addEventListener("error", () => {
            reject(new Error("Network error during upload"));
          });

          xhr.addEventListener("abort", () => {
            reject(new Error("Upload was aborted"));
          });

          xhr.open("PUT", presignData.uploadUrl);
          xhr.setRequestHeader(
            "Content-Type",
            file.type || "application/octet-stream",
          );
          xhr.send(file);
        });

        updateUploadState(fileId, { progress: 95 });

        // Step 3: Notify backend of completion
        const notifyResponse = await fetch("/api/documents/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId: presignData.documentId,
            key: presignData.key,
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
          }),
        });

        if (!notifyResponse.ok) {
          const errorData = await notifyResponse.json().catch(() => ({}));
          throw new Error(
            errorData.message ||
              `Failed to confirm upload: ${notifyResponse.status}`,
          );
        }

        const confirmedData = await notifyResponse.json();
        const metadata: DocumentMetadata = {
          documentId: presignData.documentId,
          key: presignData.key,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          uploadedAt: confirmedData.uploadedAt || new Date().toISOString(),
        };

        updateUploadState(fileId, {
          status: "complete",
          progress: 100,
          metadata,
        });

        onUploadComplete?.(metadata);
      } catch (error) {
        const err = error instanceof Error ? error : new Error("Upload failed");
        updateUploadState(fileId, {
          status: "error",
          error: err.message,
        });
        onUploadError?.(err);
      }
    },
    [updateUploadState, onUploadComplete, onUploadError],
  );

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        if (file.size > maxSizeBytes) {
          const err = new Error(
            `File "${file.name}" exceeds maximum size of ${maxSizeMB}MB`,
          );
          onUploadError?.(err);
          continue;
        }
        uploadFile(file);
      }
    },
    [maxSizeBytes, maxSizeMB, uploadFile, onUploadError],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const { files } = e.dataTransfer;
      if (files && files.length > 0) {
        handleFiles(multiple ? files : [files[0]]);
      }
    },
    [handleFiles, multiple],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { files } = e.target;
      if (files && files.length > 0) {
        handleFiles(files);
      }
      // Reset input so same file can be re-uploaded
      e.target.value = "";
    },
    [handleFiles],
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeUpload = useCallback((fileId: string) => {
    setUploads((prev) => {
      const next = new Map(prev);
      next.delete(fileId);
      return next;
    });
  }, []);

  const uploadEntries = Array.from(uploads.entries());

  return (
    <div className={`w-full ${className}`}>
      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload document"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center w-full min-h-40 p-8
          border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${
            isDragging
              ? "border-blue-500 bg-blue-50 scale-[1.01]"
              : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="sr-only"
          aria-hidden="true"
        />

        <div className="flex flex-col items-center gap-3 text-center pointer-events-none">
          <div
            className={`p-3 rounded-full transition-colors ${
              isDragging ? "bg-blue-100" : "bg-gray-100"
            }`}
          >
            <svg
              className={`w-8 h-8 transition-colors ${
                isDragging ? "text-blue-500" : "text-gray-400"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-700">
              {isDragging
                ? "Drop files here"
                : "Click to upload or drag and drop"}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {accept === "*/*" ? "Any file type" : accept} up to {maxSizeMB}MB
              {multiple ? " · Multiple files allowed" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Upload List */}
      {uploadEntries.length > 0 && (
        <ul className="mt-4 space-y-3" aria-label="Upload progress">
          {uploadEntries.map(([fileId, uploadState]) => (
            <li
              key={fileId}
              className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm"
            >
              {/* File Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
              </div>

              {/* File Info & Progress */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {uploadState.file.name}
                  </p>
                  <span className="flex-shrink-0 text-xs text-gray-500">
                    {(uploadState.file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>

                {/* Status */}
                <div className="mt-1">
                  {uploadState.status === "presigning" && (
                    <p className="text-xs text-blue-600 animate-pulse">
                      Preparing upload…
                    </p>
                  )}
                  {uploadState.status === "uploading" && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-blue-600">Uploading…</p>
                        <span className="text-xs text-gray-500">
                          {uploadState.progress}%
                        </span>
                      </div>
                      <div
                        className="w-full bg-gray-200 rounded-full h-1.5"
                        role="progressbar"
                        aria-valuenow={uploadState.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Uploading ${uploadState.file.name}`}
                      >
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadState.progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {uploadState.status === "complete" && (
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5 text-green-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      <p className="text-xs text-green-600 font-medium">
                        Upload complete
                      </p>
                    </div>
                  )}
                  {uploadState.status === "error" && (
                    <div className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5 text-red-500 flex-shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                        />
                      </svg>
                      <p className="text-xs text-red-600 truncate">
                        {uploadState.error || "Upload failed"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Remove Button */}
              {(uploadState.status === "complete" ||
                uploadState.status === "error") && (
                <button
                  type="button"
                  onClick={() => removeUpload(fileId)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                  aria-label={`Remove ${uploadState.file.name}`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
