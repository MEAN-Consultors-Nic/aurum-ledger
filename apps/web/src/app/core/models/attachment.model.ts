export type AttachmentParentType = 'estimate' | 'contract' | 'project' | 'task' | 'client';

export type AttachmentUploader = {
  _id: string;
  name?: string;
  email?: string;
};

export type AttachmentItem = {
  _id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  parentType: AttachmentParentType;
  parentId: string;
  status: 'pending' | 'uploaded';
  uploadedBy?: string | AttachmentUploader;
  uploadedAt?: string;
  createdAt?: string;
};

export type PresignResponse = {
  attachmentId: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  s3Key: string;
};
