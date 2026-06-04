import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProjectCredentialDocument = HydratedDocument<ProjectCredential>;

// Free-form `type` so the catalog can grow (ftp, sftp, mysql, postgres,
// wordpress, ssh, smtp, api_key, oauth_token, registrar, hosting, etc.)
@Schema({ timestamps: true })
export class ProjectCredential {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  name: string;

  // AES-256-GCM blob (base64). Contains JSON of arbitrary { key: value } pairs.
  @Prop({ required: true })
  encryptedFields: string;

  @Prop()
  notes?: string;

  @Prop()
  lastAccessedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const ProjectCredentialSchema = SchemaFactory.createForClass(ProjectCredential);
ProjectCredentialSchema.index({ projectId: 1, type: 1 });
