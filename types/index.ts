export type UserRole = "owner" | "admin" | "estimator" | "viewer";

export type ProjectStatus =
  | "draft"
  | "active"
  | "bidding"
  | "awarded"
  | "completed"
  | "cancelled";

export type BidStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "accepted"
  | "rejected"
  | "withdrawn";

export type InvitationStatus = "pending" | "accepted" | "declined" | "expired";

export type ComplianceDocumentType =
  | "insurance_certificate"
  | "license"
  | "bond"
  | "safety_record"
  | "financial_statement"
  | "tax_document"
  | "other";

export type ComplianceDocumentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export type ComplianceFlagSeverity = "low" | "medium" | "high" | "critical";

export type ComplianceFlagStatus = "open" | "resolved" | "dismissed";

export type AuditLogAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "submit"
  | "approve"
  | "reject"
  | "invite"
  | "login"
  | "logout";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserWithOrganization extends User {
  organization: Organization;
}

export interface Project {
  id: string;
  organizationId: string;
  createdByUserId: string;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  location?: string | null;
  estimatedValue?: number | null;
  bidDeadline?: Date | null;
  startDate?: Date | null;
  endDate?: Date | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithDetails extends Project {
  organization: Organization;
  createdBy: User;
  documents: ProjectDocument[];
  bids: Bid[];
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  uploadedByUserId: string;
  name: string;
  description?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDocumentWithDetails extends ProjectDocument {
  project: Project;
  uploadedBy: User;
}

export interface Invitation {
  id: string;
  organizationId: string;
  invitedByUserId: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvitationWithDetails extends Invitation {
  organization: Organization;
  invitedBy: User;
}

export interface Bid {
  id: string;
  projectId: string;
  organizationId: string;
  submittedByUserId?: string | null;
  status: BidStatus;
  totalAmount: number;
  currency: string;
  notes?: string | null;
  submittedAt?: Date | null;
  validUntil?: Date | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidWithDetails extends Bid {
  project: Project;
  organization: Organization;
  submittedBy?: User | null;
  lineItems: BidLineItem[];
}

export interface BidLineItem {
  id: string;
  bidId: string;
  description: string;
  quantity: number;
  unit?: string | null;
  unitPrice: number;
  totalPrice: number;
  category?: string | null;
  notes?: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BidLineItemWithBid extends BidLineItem {
  bid: Bid;
}

export interface PrequalificationProfile {
  id: string;
  organizationId: string;
  yearsInBusiness?: number | null;
  annualRevenue?: number | null;
  employeeCount?: number | null;
  bondingCapacity?: number | null;
  primaryTrades?: string[] | null;
  certifications?: string[] | null;
  safetyRating?: number | null;
  experienceDescription?: string | null;
  references?: PrequalificationReference[] | null;
  isComplete: boolean;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PrequalificationReference {
  name: string;
  company: string;
  email?: string | null;
  phone?: string | null;
  projectDescription?: string | null;
}

export interface PrequalificationProfileWithOrganization extends PrequalificationProfile {
  organization: Organization;
}

export interface ComplianceDocument {
  id: string;
  organizationId: string;
  uploadedByUserId: string;
  type: ComplianceDocumentType;
  name: string;
  description?: string | null;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  status: ComplianceDocumentStatus;
  issuer?: string | null;
  issueDate?: Date | null;
  expirationDate?: Date | null;
  reviewedByUserId?: string | null;
  reviewedAt?: Date | null;
  reviewNotes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceDocumentWithDetails extends ComplianceDocument {
  organization: Organization;
  uploadedBy: User;
  reviewedBy?: User | null;
  flags: ComplianceFlag[];
}

export interface ComplianceFlag {
  id: string;
  complianceDocumentId: string;
  raisedByUserId?: string | null;
  severity: ComplianceFlagSeverity;
  status: ComplianceFlagStatus;
  title: string;
  description: string;
  resolvedByUserId?: string | null;
  resolvedAt?: Date | null;
  resolutionNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplianceFlagWithDetails extends ComplianceFlag {
  complianceDocument: ComplianceDocument;
  raisedBy?: User | null;
  resolvedBy?: User | null;
}

export interface AuditLog {
  id: string;
  organizationId: string;
  userId?: string | null;
  action: AuditLogAction;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
}

export interface AuditLogWithDetails extends AuditLog {
  organization: Organization;
  user?: User | null;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  avatarUrl?: string | null;
}
