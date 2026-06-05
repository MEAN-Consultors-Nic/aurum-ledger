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

