/**
 * Frontend domain types — mirrors backend normalized models.
 * These types define the API contract between React and CAP.
 */

export interface InboxIdentity {
    btpUser: string;
    sapUser: string;
    isImpersonated: boolean;
}

export interface TaskSupports {
    claim: boolean;
    release: boolean;
    forward: boolean;
    comments: boolean;
}

export type DecisionNature = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';

export interface Decision {
    key: string;
    text: string;
    nature?: DecisionNature;
    /** Whether a comment is mandatory for this decision (from SAP TASKPROCESSING.DecisionOption.CommentMandatory) */
    commentMandatory?: boolean;
    /** Whether comments are supported for this decision (from SAP TASKPROCESSING.DecisionOption.CommentSupported, default true) */
    commentSupported?: boolean;
}

export type BusinessContextType = 'PR' | 'PO' | 'UNKNOWN';

export interface PurchaseOrderHeader {
    purchaseOrder: string;
    purchaseOrderText?: string;
    purchaseOrderType?: string;
    purchaseOrderTypeText?: string;
    createdByUser?: string;
    createdOn?: string;
    purchaseOrderDate?: string;
    companyCode?: string;
    companyCodeName?: string;
    purchasingOrganization?: string;
    purchasingOrganizationName?: string;
    purchasingGroup?: string;
    purchasingGroupName?: string;
    supplier?: string;
    supplierName?: string;
    paymentTerms?: string;
    paymentTermsText?: string;
    incotermsClassification?: string;
    documentCurrency?: string;
    purchaseOrderNetAmount?: string;
    purchasingDocumentStatusName?: string;
    userFullName?: string;
    raw?: Record<string, string>;
}

export interface PurchaseOrderItem {
    purchaseOrder: string;
    purchaseOrderItem: string;
    purchaseOrderItemText?: string;
    purchaseOrderItemCategoryText?: string;
    materialGroup?: string;
    materialGroupText?: string;
    productTypeText?: string;
    firstDeliveryDate?: string;
    orderQuantity?: string;
    purchaseOrderQuantityUnit?: string;
    netPriceAmount?: string;
    purchaseOrderPriceUnit?: string;
    netAmount?: string;
    documentCurrency?: string;
    servicePerformer?: string;
}

export interface PurchaseOrderAccountAssignment {
    purchaseOrder: string;
    purchaseOrderItem: string;
    accountAssignmentNumber: string;
    distributionPercentage?: string;
    glAccount?: string;
    glAccountText?: string;
    costCenter?: string;
    costCenterText?: string;
    functionalArea?: string;
    profitCenter?: string;
    profitCenterText?: string;
    unloadingPoint?: string;
    controllingArea?: string;
    controllingAreaText?: string;
    fund?: string;
    fundsCenter?: string;
    earmarkedFunds?: string;
    documentItem?: string;
    commitmentItem?: string;
    grant?: string;
    budgetPeriod?: string;
    businessProcess?: string;
    goodsRecipient?: string;
    asset?: string;
    assetSubNumber?: string;
    network?: string;
    networkActivity?: string;
    sdDocument?: string;
    sdDocumentItem?: string;
    salesOrder?: string;
    wbsElement?: string;
    projectName?: string;
    workPackageName?: string;
    serviceDocumentType?: string;
    serviceDocument?: string;
    serviceDocumentItem?: string;
    raw?: Record<string, string>;
}

export interface PurchaseOrderScheduleLine {
    purchaseOrder: string;
    purchaseOrderItem: string;
    scheduleLine: string;
    scheduleLineDeliveryDate?: string;
    scheduleLineOrderQuantity?: string;
    purchaseOrderQuantityUnit?: string;
}

export interface PurchaseOrderFactsheetData {
    header: PurchaseOrderHeader;
    items: PurchaseOrderItem[];
    accountAssignments: PurchaseOrderAccountAssignment[];
    scheduleLines: PurchaseOrderScheduleLine[];
}

export interface PurchaseRequisitionHeader {
    purchaseRequisition: string;
    purchaseRequisitionText?: string;
    purReqnRequestor?: string;
    userFullName?: string;
    purReqCreationDate?: string;
    numberOfItems?: number;
    purchaseRequisitionType?: string;
    totalNetAmount?: string;
    displayCurrency?: string;
    purReqnHdrCurrencySourceDesc?: string;
    workflowScenarioDefinition?: string;
    isPurReqnOvrlRel?: boolean;
    isOnBehalfCart?: boolean;
    createdByUser?: string;
    department?: string;
    expenseType?: string;
    commitmentItem?: string;
    releaseStrategyName?: string;
    raw?: Record<string, string>;
}

export interface PurchaseRequisitionItem {
    purchaseRequisition: string;
    purchaseRequisitionItem: string;
    purchaseRequisitionItemText?: string;
    material?: string;
    materialText?: string;
    materialGroup?: string;
    materialGroupText?: string;
    purchaseRequisitionType?: string;
    purchaseRequisitionTypeText?: string;
    purchaseRequisitionPrice?: string;
    purReqnItemTotalAmount?: string;
    purReqnPriceQuantity?: string;
    purReqnItemCurrency?: string;
    purReqnReleaseStatus?: string;
    purReqnReleaseStatusText?: string;
    processingStatus?: string;
    processingStatusText?: string;
    requestedQuantity?: string;
    baseUnit?: string;
    purchasingGroup?: string;
    purchasingOrganization?: string;
    plant?: string;
    deliveryDate?: string;
    plainLongText?: string;
    createdByUser?: string;
    userFullName?: string;
    supplier?: string;
}

export interface PurchaseRequisitionFactsheetData {
    header: PurchaseRequisitionHeader;
    items: PurchaseRequisitionItem[];
    approvalTree?: WorkflowApprovalTreeResponse;
}

export interface BusinessContext {
    type: BusinessContextType;
    documentId?: string;
    pr?: PurchaseRequisitionFactsheetData | Record<string, unknown>;
    po?: PurchaseOrderFactsheetData | Record<string, unknown>;
}

export interface TaskDescription {
    type: 'text' | 'html';
    value: string;
}

export interface CustomAttribute {
    name: string;
    label: string;
    value: string;
    type?: string;
}

export interface TaskObject {
    objectId: string;
    type: string;
    name?: string;
    url?: string;
    mimeType?: string;
}

export interface InboxTask {
    instanceId: string;
    sapOrigin?: string;
    title: string;
    status: string;
    priority?: string;
    createdOn?: string;
    createdByName?: string;
    processorName?: string;
    scenarioId?: string;
    taskDefinitionId?: string;
    taskDefinitionName?: string;
    startDeadline?: string;
    completionDeadline?: string;
    expiryDate?: string;
    completedOn?: string;
    forwardedOn?: string;
    isEscalated?: boolean;
    hasComments?: boolean;
    hasAttachments?: boolean;
    guiLink?: string;
    requestorName?: string;
    supports: TaskSupports;
    businessContext?: BusinessContext;
}

export interface TaskComment {
    id: string;
    createdAt?: string;
    createdBy?: string;
    createdByName?: string;
    text: string;
}

export interface ProcessingLog {
    orderId?: number;
    timestamp?: string;
    actionName?: string;
    performedBy?: string;
    performedByName?: string;
    comments?: string;
    taskStatus?: string;
}

export interface WorkflowLog {
    id: string;
    timestamp?: string;
    action?: string;
    user?: string;
    userName?: string;
    details?: string;
    raw: Record<string, unknown>;
}

export interface TaskAttachment {
    id: string;
    fileName?: string;
    fileDisplayName?: string;
    mimeType?: string;
    fileSize?: number;
    link?: string;
    linkDisplayName?: string;
    createdAt?: string;
    createdBy?: string;
    createdByName?: string;
}

export interface WorkflowApprovalStep {
    prNumber: string;
    level: number;
    releaseCode?: string;
    approver?: string;
    approverUserId?: string;
    status?: string;
    noteText?: string;
    postedOn?: string;
    postedTime?: string;
}

export interface WorkflowApprovalComment {
    docNum?: string;
    postedOn?: string;
    postedTime?: string;
    noteText?: string;
    userComment?: string;
    type?: string;
}

export interface WorkflowApprovalTreeResponse {
    prNumber?: string;
    releaseStrategyName?: string;
    steps: WorkflowApprovalStep[];
    comments?: WorkflowApprovalComment[];
}

export interface TaskDetail {
    task: InboxTask;
    description?: TaskDescription;
    decisions: Decision[];
    customAttributes: CustomAttribute[];
    taskObjects: TaskObject[];
    comments: TaskComment[];
    processingLogs: ProcessingLog[];
    workflowLogs: WorkflowLog[];
    attachments: TaskAttachment[];
    businessContext?: BusinessContext;
}

// ─── API Responses ────────────────────────────────────────

export interface TaskListResponse {
    identity: InboxIdentity;
    items: InboxTask[];
    total: number;
}

export interface TaskDetailResponse {
    identity: InboxIdentity;
    detail: TaskDetail;
}

export interface TaskActionResponse {
    success: boolean;
    message: string;
    task?: InboxTask;
}

// ─── API Requests ─────────────────────────────────────────

/** Context forwarded to BFF to avoid redundant SAP $batch fetch. */
export interface DecisionRequestContext {
    sapOrigin?: string;
    documentId?: string;
    businessObjectType?: string;
}

export interface DecisionRequest {
    decisionKey: string;
    comment?: string;
    reasonCode?: string;
    /** Decision type: 'APPR' for approval, 'NORM' for regular comment */
    type?: string;
    _context?: DecisionRequestContext;
}

export interface ForwardRequest {
    forwardTo: string;
    comment?: string;
}
