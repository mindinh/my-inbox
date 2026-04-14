import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { PurchaseRequisitionApprovalTreeStep, PurchaseRequisitionApprovalComment } from '../../types';

interface ODataV4Collection<T> {
    value?: T[];
}

interface SapApprovalTreeRaw {
    Banfn?: string;
    Lvl?: string | number;
    FrgCode?: string;
    Approver?: string;
    Usr?: string;
    Status?: string;
    NoteText?: string;
    PostedOn?: string;
    PostedTime?: string;
}

interface SapPrCommentRaw {
    DocNum?: string;
    PostedOn?: string;
    PostedTime?: string;
    NoteText?: string;
    UserComment?: string;
    Type?: string;
}

/** Raw shape from SAP ZI_PR_ATTACH_TAB entity */
export interface SapPrAttachmentRaw {
    doc_num?: string;
    attach_id?: string;
    file_name?: string;
    mime_type?: string;
    file_content?: string; // Base64 or hex-encoded binary (auto-detected on decode)
    file_size?: number;
    created_by?: string;
    created_on?: string;
    created_time?: string;
}
interface ApprovalTreeConfig {
    servicePath: string;
    entitySet: string;
}

export class SapPurchaseRequisitionApprovalTreeClient {
    private readonly destinationName: string;
    private readonly sapClient: string;
    private readonly enabled: boolean;
    private readonly defaultConfig: ApprovalTreeConfig;
    private readonly byOriginConfig: Record<string, Partial<ApprovalTreeConfig>>;

    constructor() {
        this.destinationName =
            process.env.SAP_PR_APPROVAL_DESTINATION ||
            process.env.SAP_TASK_DESTINATION ||
            'S4H_ODATA';
        this.sapClient = process.env.SAP_TASK_CLIENT || '400';
        this.enabled = process.env.SAP_PR_APPROVAL_TREE_ENABLED !== 'false';
        this.defaultConfig = {
            servicePath:
                process.env.SAP_PR_APPROVAL_TREE_ODATA_PATH ||
                '/sap/opu/odata4/sap/zsb_pr_approval_tree/srvd_a2x/sap/zsd_pr_approval_tree/0001',
            entitySet: process.env.SAP_PR_APPROVAL_TREE_ENTITY_SET || 'ZI_PR_APPROVAL_TREE',
        };
        this.byOriginConfig = this.loadByOriginConfig();
    }

    async fetchApprovalTree(
        purchaseRequisition: string,
        options?: { origin?: string; userJwt?: string }
    ): Promise<{ releaseStrategyName?: string; steps: PurchaseRequisitionApprovalTreeStep[]; comments?: PurchaseRequisitionApprovalComment[] }> {
        if (!this.enabled || !purchaseRequisition) return { steps: [] };
        let prNumber = purchaseRequisition.trim();
        if (!prNumber) return { steps: [] };

        prNumber = prNumber.padStart(10, '0');
        const config = this.resolveConfig(options?.origin);
        const escapedPr = this.escapeODataString(prNumber);

        try {
            const [treeResponse, commentsResponse] = await Promise.all([
                this.get<ODataV4Collection<SapApprovalTreeRaw>>(
                    config,
                    `/ZI_PR_APPROVAL_LINE`,
                    {
                        $filter: `Banfn eq '${escapedPr}'`,
                        'sap-client': this.sapClient,
                    },
                    options?.userJwt
                ).catch((e) => {
                    console.warn(`Failed to fetch lines: ${e instanceof Error ? e.message : String(e)}`);
                    return { value: [] };
                }),
                this.get<ODataV4Collection<SapPrCommentRaw>>(
                    config,
                    `/ZI_PR_COMMENT_TAB`,
                    {
                        $filter: `DocNum eq '${escapedPr}'`,
                        'sap-client': this.sapClient,
                    },
                    options?.userJwt
                ).catch((e) => {
                    console.warn(`Failed to fetch comments: ${e instanceof Error ? e.message : String(e)}`);
                    return { value: [] };
                })
            ]);

            const rows = treeResponse.value || [];
            const rawComments = commentsResponse.value || [];

            const comments = rawComments.map((c) => ({
                docNum: c.DocNum,
                postedOn: c.PostedOn,
                postedTime: c.PostedTime,
                noteText: c.NoteText,
                userComment: c.UserComment,
                type: c.Type,
            }));

            const steps = rows
                .map((row) => ({
                    prNumber: row.Banfn || prNumber,
                    level: this.toNumber(row.Lvl),
                    releaseCode: row.FrgCode,
                    approver: row.Approver || row.Usr,
                    approverUserId: row.Usr,
                    status: row.Status,
                    noteText: row.NoteText,
                    postedOn: row.PostedOn,
                    postedTime: row.PostedTime,
                }))
                .sort((a, b) => a.level - b.level);

            return {
                steps,
                comments,
            };
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to fetch Approval Tree for ${prNumber}: ${error instanceof Error ? error.message : String(error)}`);
            return { steps: [] };
        }
    }

    async fetchPrInfo(
        purchaseRequisition: string,
        options?: { origin?: string; userJwt?: string }
    ): Promise<{ description?: string; releaseStrategyName?: string } | undefined> {
        if (!this.enabled || !purchaseRequisition) return undefined;
        let prNumber = purchaseRequisition.trim();
        if (!prNumber) return undefined;

        // Pad with leading zeros up to 10 chars as shown in the user's screenshot
        prNumber = prNumber.padStart(10, '0');

        const config = this.resolveConfig(options?.origin);
        const escapedPr = this.escapeODataString(prNumber);

        try {
            const response = await this.get<ODataV4Collection<{ Banfn?: string; Frgxt?: string; Description?: { TextLine?: string }[] | null }>>(
                config,
                `/ZI_PR_INFO`,
                {
                    $filter: `Banfn eq '${escapedPr}'`,
                    $expand: 'Description',
                    'sap-client': this.sapClient,
                },
                options?.userJwt
            );

            const rows = response.value || [];
            if (rows.length === 0) return undefined;

            const prInfo = rows[0];
            const descriptionLines = prInfo.Description || [];
            const description = descriptionLines.map((row: any) => row.TextLine || '').join('\n').trim();

            return {
                description: description || undefined,
                releaseStrategyName: prInfo.Frgxt
            };
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to fetch PR Info for ${prNumber}: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    }

    async addPrComment(
        purchaseRequisition: string,
        commentText: string,
        options?: { origin?: string; userJwt?: string; type?: string }
    ): Promise<void> {
        if (!this.enabled || !purchaseRequisition || !commentText) return;
        let prNumber = purchaseRequisition.trim();
        if (!prNumber) return;

        prNumber = prNumber.padStart(10, '0');
        const config = this.resolveConfig(options?.origin);
        const escapedPr = this.escapeODataString(prNumber);

        const payload: Record<string, string> = { NoteText: commentText };
        if (options?.type) {
            payload.Type = options.type;
        }

        try {
            await this.post(
                config,
                `/ZI_PR_COMMENT(Banfn='${escapedPr}')/SAP__self.Comment`,
                payload,
                { 'sap-client': this.sapClient },
                options?.userJwt
            );
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to add PR Comment for ${prNumber}: ${error instanceof Error ? error.message : String(error)}`);
            // we don't throw because decision execution should proceed
        }
    }

    // ─── Attachment Operations ──────────────────────────────────

    /**
     * Fetch attachment metadata list for a PR document.
     * Excludes File_Content to save bandwidth — content is fetched on-demand.
     *
     * @returns An array of attachment metadata objects for the given document.
     */
    async fetchPrAttachments(
        documentNumber: string,
        options?: { origin?: string; userJwt?: string }
    ): Promise<SapPrAttachmentRaw[]> {
        if (!this.enabled || !documentNumber) return [];
        let docNum = documentNumber.trim();
        if (!docNum) return [];

        docNum = docNum.padStart(10, '0');
        const config = this.resolveConfig(options?.origin);
        const escapedDocNum = this.escapeODataString(docNum);

        try {
            const response = await this.get<ODataV4Collection<SapPrAttachmentRaw>>(
                config,
                `/ZI_PR_ATTACHMENTS`,
                {
                    '$filter': `doc_num eq '${escapedDocNum}'`,
                    '$select': 'file_name,mime_type,file_size,created_by,created_on,created_time',
                    'sap-client': this.sapClient,
                },
                options?.userJwt
            );

            return response.value || [];
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to fetch PR Attachments for ${docNum}: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    }

    /**
     * Fetch a single attachment's binary content by attach_id.
     * The SAP API returns file_content as either base64 or hex-encoded;
     * this method auto-detects the encoding and converts to a Buffer.
     */
    async fetchPrAttachmentContent(
        documentNumber: string,
        attachId: string,
        options?: { origin?: string; userJwt?: string }
    ): Promise<{ data: Buffer; contentType: string; fileName: string } | null> {
        if (!this.enabled || !documentNumber || !attachId) return null;
        let docNum = documentNumber.trim();
        if (!docNum) return null;

        docNum = docNum.padStart(10, '0');
        const config = this.resolveConfig(options?.origin);
        const escapedDocNum = this.escapeODataString(docNum);
        const escapedAttachId = this.escapeODataString(attachId);

        try {
            const response = await this.get<ODataV4Collection<SapPrAttachmentRaw>>(
                config,
                `/ZI_PR_ATTACHMENTS`,
                {
                    '$filter': `doc_num eq '${escapedDocNum}' and attach_id eq ${escapedAttachId}`,
                    '$select': 'file_content,file_name,mime_type',
                    'sap-client': this.sapClient,
                },
                options?.userJwt
            );

            const items = response.value || [];
            const attachment = items[0];
            if (!attachment || !attachment.file_content) {
                console.warn(`[SapPRApprovalTree] Attachment content not found for attach_id=${attachId} in PR ${docNum}`);
                return null;
            }

            // SAP may return file_content as base64 OR hex — auto-detect
            const data = decodeFileContent(attachment.file_content);
            const contentType = attachment.mime_type || 'application/octet-stream';

            return { data, contentType, fileName: attachment.file_name || attachId };
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to fetch PR Attachment content for attach_id=${attachId} in PR ${docNum}: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    /**
     * Upload a file attachment to a PR document.
     * Converts the incoming Buffer to a Base64 string for the SAP OData V4 action.
     */
    async uploadPrAttachment(
        documentNumber: string,
        fileName: string,
        mimeType: string,
        buffer: Buffer,
        options?: { origin?: string; userJwt?: string }
    ): Promise<void> {
        if (!this.enabled || !documentNumber) return;
        let docNum = documentNumber.trim();
        if (!docNum) return;

        docNum = docNum.padStart(10, '0');
        const config = this.resolveConfig(options?.origin);
        const escapedDocNum = this.escapeODataString(docNum);

        // Convert Buffer → Base64
        const fileContentBase64 = buffer.toString('base64');

        const payload: Record<string, string | number> = {
            file_name: fileName,
            mime_type: mimeType,
            file_content: fileContentBase64,
            file_size: buffer.byteLength,
        };

        try {
            await this.post(
                config,
                `/ZI_PR_ATTACH_TAB(doc_num='${escapedDocNum}')/SAP__self.upload`,
                payload,
                { 'sap-client': this.sapClient },
                options?.userJwt
            );
            console.log(`[SapPRApprovalTree] Uploaded attachment "${fileName}" to PR ${docNum}`);
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to upload attachment to PR ${docNum}: ${error instanceof Error ? error.message : String(error)}`);
            throw error; // Re-throw for upload so the caller can show an error
        }
    }

    private async get<T>(
        config: ApprovalTreeConfig,
        path: string,
        params: Record<string, string>,
        userJwt?: string
    ): Promise<T> {
        const url = this.appendQuery(this.toUrl(config, path), params);
        const destination =
            userJwt && userJwt.trim()
                ? { destinationName: this.destinationName, jwt: userJwt }
                : { destinationName: this.destinationName };

        const response = await executeHttpRequest(destination, {
            method: 'GET',
            url,
            headers: {
                Accept: 'application/json',
            },
        });

        return response.data as T;
    }

    private async post<T>(
        config: ApprovalTreeConfig,
        path: string,
        data: Record<string, unknown>,
        params: Record<string, string>,
        userJwt?: string
    ): Promise<T> {
        const url = this.appendQuery(this.toUrl(config, path), params);
        const destination =
            userJwt && userJwt.trim()
                ? { destinationName: this.destinationName, jwt: userJwt }
                : { destinationName: this.destinationName };

        // fetch CSRF token (requires an initial GET or HEAD)
        const csrfResponse = await executeHttpRequest(destination, {
            method: 'HEAD',
            url: this.toUrl(config, '/'),
            headers: {
                'X-CSRF-Token': 'Fetch',
                Accept: 'application/json',
            },
        });

        const csrfToken = csrfResponse.headers['x-csrf-token'];
        const cookies = csrfResponse.headers['set-cookie'] || [];

        const response = await executeHttpRequest(destination, {
            method: 'POST',
            url,
            data,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken,
                Cookie: Array.isArray(cookies) ? cookies.join('; ') : cookies,
            },
        });

        return response.data as T;
    }

    private toUrl(config: ApprovalTreeConfig, path: string): string {
        if (path.startsWith('/')) return `${config.servicePath}${path}`;
        return `${config.servicePath}/${path}`;
    }

    private appendQuery(url: string, params: Record<string, string>): string {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
            search.append(key, value);
        }
        return `${url}?${search.toString()}`;
    }

    private escapeODataString(value: string): string {
        return value.replace(/'/g, "''");
    }

    private toNumber(value: string | number | undefined): number {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const n = Number(value);
            if (!Number.isNaN(n)) return n;
        }
        return 0;
    }

    private resolveConfig(origin?: string): ApprovalTreeConfig {
        if (!origin) return this.defaultConfig;
        const override = this.byOriginConfig[origin.toUpperCase()];
        if (!override) return this.defaultConfig;
        return {
            ...this.defaultConfig,
            ...override,
        };
    }

    private loadByOriginConfig(): Record<string, Partial<ApprovalTreeConfig>> {
        const raw = process.env.SAP_PR_APPROVAL_TREE_CONFIG_JSON;
        if (!raw) return {};
        try {
            const parsed = JSON.parse(raw) as Record<string, Partial<ApprovalTreeConfig>>;
            const normalized: Record<string, Partial<ApprovalTreeConfig>> = {};
            for (const [origin, config] of Object.entries(parsed)) {
                normalized[origin.toUpperCase()] = config;
            }
            return normalized;
        } catch (error) {
            console.warn(
                `[SapPRApprovalTree] Invalid SAP_PR_APPROVAL_TREE_CONFIG_JSON. ${error instanceof Error ? error.message : String(error)
                }`
            );
            return {};
        }
    }
}

/**
 * Auto-detect whether SAP returned file_content as hex or base64.
 *
 * OData V4 Edm.Binary should be base64, but the ZI_PR_ATTACHMENTS entity
 * sometimes returns hex-encoded binary (e.g. PDF content starting with
 * "255044462D" = "%PDF-" in hex). Base64 strings will always contain
 * characters outside the hex range (G-Z, g-z, +, /, =).
 */
function decodeFileContent(content: string): Buffer {
    // Some SAP configurations might return data URI prefixes (e.g. data:application/pdf;base64,...)
    // If present, strip it out before decoding
    let cleanContent = content;
    const dataUriMatch = cleanContent.match(/^data:.*?;base64,(.*)$/i);
    if (dataUriMatch) {
        cleanContent = dataUriMatch[1];
    }

    // If only hex chars (0-9, a-f, A-F) and even length → hex-encoded
    if (cleanContent.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(cleanContent)) {
        return Buffer.from(cleanContent, 'hex');
    }
    // Otherwise treat as base64
    return Buffer.from(cleanContent, 'base64');
}
