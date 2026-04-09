import { executeHttpRequest } from '@sap-cloud-sdk/http-client';
import { PurchaseRequisitionApprovalTreeStep, PurchaseRequisitionApprovalComment } from '../types';

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
        const prNumber = purchaseRequisition.trim();
        if (!prNumber) return { steps: [] };

        const config = this.resolveConfig(options?.origin);
        const escapedPr = this.escapeODataString(prNumber);
        
        try {
            const response = await this.get<ODataV4Collection<{ Banfn?: string; Frgxt?: string; Levels?: SapApprovalTreeRaw[]; Comments?: SapPrCommentRaw[] }>>(
                config,
                `/${config.entitySet}`,
                {
                    $filter: `Banfn eq '${escapedPr}'`,
                    $expand: 'Levels,Comments',
                    'sap-client': this.sapClient,
                },
                options?.userJwt
            );

            // Response now returns a root PR object holding an expanded "Levels" collection
            const prData = (response.value && response.value.length > 0) ? response.value[0] : null;
            const rows = prData?.Levels || [];
            const rawComments = prData?.Comments || [];

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
                releaseStrategyName: prData?.Frgxt,
                steps,
                comments,
            };
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to fetch Approval Tree for ${prNumber}: ${error instanceof Error ? error.message : String(error)}`);
            return { steps: [] };
        }
    }

    async fetchPrDescription(
        purchaseRequisition: string,
        options?: { origin?: string; userJwt?: string }
    ): Promise<string | undefined> {
        if (!this.enabled || !purchaseRequisition) return undefined;
        let prNumber = purchaseRequisition.trim();
        if (!prNumber) return undefined;

        // Pad with leading zeros up to 10 chars as shown in the user's screenshot
        prNumber = prNumber.padStart(10, '0');

        const config = this.resolveConfig(options?.origin);
        const escapedPr = this.escapeODataString(prNumber);

        try {
            const response = await this.get<ODataV4Collection<{ Banfn?: string; TextLine?: string }>>(
                config,
                `/ZI_PR_REQ`,
                {
                    $filter: `Banfn eq '${escapedPr}'`,
                    'sap-client': this.sapClient,
                },
                options?.userJwt
            );

            const rows = response.value || [];
            if (rows.length === 0) return undefined;

            return rows.map(row => row.TextLine || '').join('\n').trim();
        } catch (error) {
            console.warn(`[SapPRApprovalTree] Failed to fetch PR Description for ${prNumber}: ${error instanceof Error ? error.message : String(error)}`);
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
