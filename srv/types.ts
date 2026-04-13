/**
 * Domain types for Inbox Service
 * Normalized models independent of SAP OData structure
 */

// ─── Identity ──────────────────────────────────────────────
export interface InboxIdentity {
    btpUser: string;
    sapUser: string;
    isImpersonated: boolean;
    userJwt?: string;
}

// ─── Task Capabilities ────────────────────────────────────
export interface TaskSupports {
    forward: boolean;
    comments: boolean;
}

// ─── Decision Option ──────────────────────────────────────
export interface Decision {
    key: string;
    text: string;
    nature?: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    commentMandatory?: boolean;
    commentSupported?: boolean;
}

// ─── Business Context ─────────────────────────────────────
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
    workflowTaskInternalID?: string;
    isPurReqnOvrlRel?: boolean;
    isOnBehalfCart?: boolean;
    createdByUser?: string;
    department?: string;
    expenseType?: string;
    commitmentItem?: string;
    releaseStrategyName?: string;
    /** Raw key-value pairs from OData response */
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
    fixedSupplier?: string;
}

export interface PurchaseRequisitionFactsheetData {
    header: PurchaseRequisitionHeader;
    items: PurchaseRequisitionItem[];
    approvalTree?: PurchaseRequisitionApprovalTreeResponse;
}

export interface BusinessContext {
    type: BusinessContextType;
    documentId?: string;
    pr?: PurchaseRequisitionFactsheetData | Record<string, unknown>;
    po?: PurchaseOrderFactsheetData | Record<string, unknown>;
}

// ─── Task Description ─────────────────────────────────────
export interface TaskDescription {
    type: 'text' | 'html';
    value: string;
}

// ─── Custom Attribute ─────────────────────────────────────
export interface CustomAttribute {
    name: string;
    label: string;
    value: string;
    type?: string;
}

// ─── Task Object (Attachment / Link) ──────────────────────
export interface TaskObject {
    objectId: string;
    type: string;
    name?: string;
    url?: string;
    mimeType?: string;
}

// ─── Core Inbox Task ──────────────────────────────────────
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

// ─── Full Task Detail ─────────────────────────────────────
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

export interface PurchaseRequisitionApprovalTreeStep {
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

export interface PurchaseRequisitionApprovalComment {
    docNum?: string;
    postedOn?: string;
    postedTime?: string;
    noteText?: string;
    userComment?: string;
    type?: string;
}

export interface PurchaseRequisitionApprovalTreeResponse {
    prNumber?: string;
    releaseStrategyName?: string;
    steps: PurchaseRequisitionApprovalTreeStep[];
    comments?: PurchaseRequisitionApprovalComment[];
}

// ─── Dashboard ────────────────────────────────────────────
export interface DashboardTask {
    taskId: string;
    documentNumber: string;
    taskType: string;
    documentType: string;
    documentTypeDesc: string;
    status: string;
    currency: string;
    totalNetAmount: number | null;
    displayCurrency: string;
}

export interface DashboardResponse {
    items: DashboardTask[];
    total: number;
}

// ─── API Response Envelopes ───────────────────────────────
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

// ─── Decision Request ─────────────────────────────────────

/** Optional context supplied by the frontend to avoid a redundant SAP $batch fetch on the BFF. */
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
    /** Context forwarded from FE to avoid extra fetchTaskDetailBundle calls */
    _context?: DecisionRequestContext;
}

export interface ForwardRequest {
    forwardTo: string;
    comment?: string;
}

// ─── SAP Raw Types (what SAP returns before normalization) ─
export interface SapTaskRaw {
    InstanceID: string;
    SAP__Origin?: string;
    __metadata?: {
        uri?: string;
    };
    TaskTitle: string;
    Status: string;
    Priority: string;
    CreatedOn: string;
    CreatedByName?: string;
    ProcessorName?: string;
    ScenarioID?: string;
    TaskDefinitionID?: string;
    HasPotentialOwners?: boolean;
    SupportsRelease?: boolean;
    SupportsClaim?: boolean;
    SupportsForward?: boolean;
    SupportsComments?: boolean;
    HasComments?: boolean;
    SupportsAttachments?: boolean;
    HasAttachments?: boolean;
    TaskDefinitionName?: string;
    StartDeadLine?: string;
    CompletionDeadLine?: string;
    ExpiryDate?: string;
    IsEscalated?: boolean;
    CompletedOn?: string;
    ForwardedOn?: string;
    GUI_Link?: string;
    // Nav properties (when expanded)
    Description?: SapDescriptionRaw;
    DecisionOptions?: { results: SapDecisionOptionRaw[] };
    TaskDefinitionData?: SapTaskDefinitionRaw;
    CustomAttributeData?: { results: SapCustomAttributeRaw[] };
    TaskObjects?: { results: SapTaskObjectRaw[] };
    Comments?: { results: SapCommentRaw[] };
    ProcessingLogs?: { results: SapProcessingLogRaw[] };
    WorkflowLogs?: { results: SapWorkflowLogRaw[] };
    Attachments?: { results: SapAttachmentRaw[] };
}

export interface SapTaskDefinitionRaw {
    TaskDefinitionID: string;
    TaskName?: string;
    Category?: string;
    CustomAttributeDefinitionData?: { results: SapCustomAttributeDefinitionRaw[] };
}

export interface SapDescriptionRaw {
    Description: string;
    DescriptionAsHtml?: string;
}

export interface SapDecisionOptionRaw {
    DecisionKey: string;
    DecisionText: string;
    Nature?: string;
    CommentMandatory?: boolean;
    CommentSupported?: boolean;
}

export interface SapCustomAttributeRaw {
    Name: string;
    Label: string;
    Value: string;
    Type?: string;
}

export interface SapCustomAttributeDefinitionRaw {
    TaskDefinitionID: string;
    Name: string;
    Type?: string;
    Label?: string;
    Rank?: number;
}

export interface SapTaskObjectRaw {
    ObjectID: string;
    ObjectType: string;
    ObjectName?: string;
    ObjectUrl?: string;
    MimeType?: string;
}

export interface SapCommentRaw {
    ID: string;
    InstanceID?: string;
    CreatedAt?: string;
    CreatedBy?: string;
    CreatedByName?: string;
    Text?: string;
}

export interface SapProcessingLogRaw {
    InstanceID?: string;
    OrderID?: number;
    Timestamp?: string;
    ActionName?: string;
    PerformedBy?: string;
    PerformedByName?: string;
    Comments?: string;
    TaskStatus?: string;
}

export type SapWorkflowLogRaw = Record<string, unknown>;

export interface SapAttachmentRaw {
    __metadata?: {
        uri?: string;
    };
    ID: string;
    InstanceID?: string;
    FileName?: string;
    FileDisplayName?: string;
    mime_type?: string;
    FileSize?: number;
    Link?: string;
    LinkDisplayName?: string;
    CreatedAt?: string;
    CreatedBy?: string;
    CreatedByName?: string;
}

// ─── SAP OData Collection Response ────────────────────────
export interface SapODataResponse<T> {
    d: {
        results: T[];
        __count?: string;
    };
}

export interface SapODataSingleResponse<T> {
    d: T;
}
