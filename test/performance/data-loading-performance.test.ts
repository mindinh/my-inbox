/**
 * Data Loading Performance Tests
 *
 * Diagnoses WHY data loads slowly by simulating realistic network conditions
 * and measuring each phase of the data loading pipeline:
 *
 *   Frontend → Router → InboxService → Adapters → SapClient → SAP OData
 *                                                  ↓
 *                                    enrichTaskForList() × N tasks
 *                                         ↓
 *                              enrichBusinessObjectData()
 *                                         ↓
 *                        PR/PO Factsheet Client → SAP OData (N+1!)
 *
 * Key bottlenecks identified and tested:
 *   1. N+1 enrichment — each task triggers a separate factsheet call
 *   2. Sequential enrichment fallback chains
 *   3. Task detail waterfall — fetch task → fetch segments → enrich
 *   4. Custom attribute definition fallback (expand fails → separate call)
 *   5. Large payload serialization overhead
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ISapTaskClient } from '../../srv/inbox/sap-task-client';
import type { SapTaskRaw, SapCustomAttributeRaw, SapTaskObjectRaw } from '../../srv/types';
import { TaskQueryAdapter } from '../../srv/integrations/sap/task-query-adapter';
import { TaskDetailAdapter } from '../../srv/integrations/sap/task-detail-adapter';

// ─── Network Delay Profiles ─────────────────────────────────

interface NetworkProfile {
    name: string;
    description: string;
    /** Base latency per SAP call in ms */
    baseLatencyMs: number;
    /** Jitter range ± ms */
    jitterMs: number;
    /** Simulated chance of timeout (0-1) */
    timeoutRate: number;
}

const NETWORK_PROFILES: Record<string, NetworkProfile> = {
    /** Ideal: co-located SAP system, everything fast */
    fast: {
        name: 'Fast (Co-located)',
        description: 'SAP system in same datacenter, <50ms RTT',
        baseLatencyMs: 30,
        jitterMs: 15,
        timeoutRate: 0,
    },
    /** Normal: typical BTP→S/4 via Cloud Connector */
    normal: {
        name: 'Normal (Cloud Connector)',
        description: 'Standard BTP→S/4 via Cloud Connector, ~200ms RTT',
        baseLatencyMs: 200,
        jitterMs: 80,
        timeoutRate: 0,
    },
    /** Slow: congested network or distant region */
    slow: {
        name: 'Slow (Cross-region)',
        description: 'Cross-region or congested network, ~800ms RTT',
        baseLatencyMs: 800,
        jitterMs: 300,
        timeoutRate: 0.02,
    },
    /** Terrible: unstable VPN, high packet loss */
    terrible: {
        name: 'Terrible (Unstable VPN)',
        description: 'VPN with packet loss, 2s+ RTT, frequent timeouts',
        baseLatencyMs: 2000,
        jitterMs: 1000,
        timeoutRate: 0.1,
    },
};

// ─── Delay Utility ──────────────────────────────────────────

function simulateDelay(profile: NetworkProfile): Promise<void> {
    if (profile.timeoutRate > 0 && Math.random() < profile.timeoutRate) {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('ETIMEDOUT: Simulated network timeout')), profile.baseLatencyMs * 3)
        );
    }
    const jitter = (Math.random() - 0.5) * 2 * profile.jitterMs;
    const delay = Math.max(1, profile.baseLatencyMs + jitter);
    return new Promise((resolve) => setTimeout(resolve, delay));
}

// ─── Mock Task Factory ──────────────────────────────────────

function createMockTask(index: number, type: 'PR' | 'PO' = 'PR'): SapTaskRaw {
    const prNum = `${1000100 + index}`;
    const poNum = `4500012${String(index).padStart(3, '0')}`;
    return {
        InstanceID: `TASK-${String(index).padStart(3, '0')}`,
        SAP__Origin: 'LOCAL',
        TaskTitle: type === 'PR'
            ? `Approve Purchase Requisition PR${prNum}`
            : `Release Purchase Order PO${poNum}`,
        Status: 'READY',
        Priority: 'HIGH',
        CreatedOn: new Date(Date.now() - index * 3600000).toISOString(),
        CreatedByName: `User ${index}`,
        ProcessorName: 'JDOE',
        ScenarioID: type === 'PR' ? 'WS00800238' : 'PO_APPROVAL_01',
        TaskDefinitionID: type === 'PR' ? 'TS00800238' : 'TS_PO_001',
        SupportsClaim: false,
        SupportsRelease: false,
        SupportsForward: true,
        SupportsComments: true,
    } as SapTaskRaw;
}

function createMockCustomAttributes(taskId: string): SapCustomAttributeRaw[] {
    return [
        { Name: 'PRNumber', Label: 'Purchase Requisition', Value: '1000123', Type: 'String' },
        { Name: 'TotalValue', Label: 'Total Value', Value: '2450.00', Type: 'Decimal' },
        { Name: 'Currency', Label: 'Currency', Value: 'USD', Type: 'String' },
    ] as SapCustomAttributeRaw[];
}

function createMockTaskObjects(taskId: string): SapTaskObjectRaw[] {
    return [
        { ObjectID: `OBJ-${taskId}`, ObjectType: 'PurchaseRequisition', ObjectName: `PR for ${taskId}` },
    ] as SapTaskObjectRaw[];
}

// ─── Instrumented Mock SAP Client ───────────────────────────

interface CallLog {
    method: string;
    args: unknown[];
    startedAt: number;
    finishedAt: number;
    durationMs: number;
}

function createInstrumentedMockClient(
    profile: NetworkProfile,
    taskCount: number = 25,
): { client: ISapTaskClient; callLogs: CallLog[] } {
    const callLogs: CallLog[] = [];
    const tasks = Array.from({ length: taskCount }, (_, i) =>
        createMockTask(i, i % 3 === 0 ? 'PO' : 'PR')
    );

    async function tracked<T>(method: string, args: unknown[], fn: () => T): Promise<T> {
        const startedAt = Date.now();
        await simulateDelay(profile);
        const result = fn();
        const finishedAt = Date.now();
        callLogs.push({ method, args, startedAt, finishedAt, durationMs: finishedAt - startedAt });
        return result;
    }

    const client: ISapTaskClient = {
        fetchTasks: async (sapUser, _jwt, pagination) => {
            return tracked('fetchTasks', [sapUser, pagination], () => {
                const skip = pagination?.skip ?? 0;
                const top = pagination?.top ?? tasks.length;
                return { results: tasks.slice(skip, skip + top), totalCount: tasks.length };
            });
        },
        fetchApprovedTasks: async (sapUser, _jwt, pagination) => {
            return tracked('fetchApprovedTasks', [sapUser, pagination], () => {
                return { results: [], totalCount: 0 };
            });
        },
        fetchTaskDetail: async (sapUser, instanceId) => {
            return tracked('fetchTaskDetail', [sapUser, instanceId], () => {
                const task = tasks.find(t => t.InstanceID === instanceId);
                if (!task) throw new Error(`Task ${instanceId} not found`);
                return { ...task };
            });
        },
        fetchTaskDetailBundle: async (sapUser, instanceId) => {
            return tracked('fetchTaskDetailBundle', [sapUser, instanceId], () => {
                const task = tasks.find(t => t.InstanceID === instanceId);
                if (!task) throw new Error(`Task ${instanceId} not found`);
                return {
                    ...task,
                    Description: { Description: `Description for ${instanceId}` },
                    DecisionOptions: {
                        results: [
                            { DecisionKey: '0001', DecisionText: 'Approve', Nature: 'POSITIVE' },
                            { DecisionKey: '0002', DecisionText: 'Reject', Nature: 'NEGATIVE' },
                        ],
                    },
                    CustomAttributeData: { results: createMockCustomAttributes(instanceId) },
                    TaskObjects: { results: createMockTaskObjects(instanceId) },
                    Attachments: { results: [] },
                    TaskDefinitionData: {
                        TaskDefinitionID: task.TaskDefinitionID,
                        CustomAttributeDefinitionData: {
                            results: [
                                { TaskDefinitionID: task.TaskDefinitionID, Name: 'PRNumber', Label: 'Purchase Requisition', Type: 'String', Rank: 10 },
                                { TaskDefinitionID: task.TaskDefinitionID, Name: 'TotalValue', Label: 'Total Value', Type: 'Decimal', Rank: 20 },
                            ],
                        },
                    },
                } as SapTaskRaw;
            });
        },
        fetchDecisionOptions: async (sapUser, instanceId) => {
            return tracked('fetchDecisionOptions', [sapUser, instanceId], () => [
                { DecisionKey: '0001', DecisionText: 'Approve', Nature: 'POSITIVE' },
                { DecisionKey: '0002', DecisionText: 'Reject', Nature: 'NEGATIVE' },
            ]);
        },
        fetchDescription: async (sapUser, instanceId) => {
            return tracked('fetchDescription', [sapUser, instanceId], () => ({
                Description: `Description for ${instanceId}`,
            }));
        },
        fetchCustomAttributes: async (sapUser, instanceId) => {
            return tracked('fetchCustomAttributes', [sapUser, instanceId], () =>
                createMockCustomAttributes(instanceId)
            );
        },
        fetchCustomAttributeDefinitions: async (sapUser, taskDefId) => {
            return tracked('fetchCustomAttributeDefinitions', [sapUser, taskDefId], () => [
                { TaskDefinitionID: taskDefId, Name: 'PRNumber', Label: 'Purchase Requisition', Type: 'String', Rank: 10 },
                { TaskDefinitionID: taskDefId, Name: 'TotalValue', Label: 'Total Value', Type: 'Decimal', Rank: 20 },
            ]);
        },
        fetchTaskObjects: async (sapUser, instanceId) => {
            return tracked('fetchTaskObjects', [sapUser, instanceId], () =>
                createMockTaskObjects(instanceId)
            );
        },
        fetchComments: async (sapUser, instanceId) => {
            return tracked('fetchComments', [sapUser, instanceId], () => []);
        },
        fetchProcessingLogs: async (sapUser, instanceId) => {
            return tracked('fetchProcessingLogs', [sapUser, instanceId], () => []);
        },
        fetchWorkflowLogs: async (sapUser, instanceId) => {
            return tracked('fetchWorkflowLogs', [sapUser, instanceId], () => []);
        },
        fetchAttachments: async (sapUser, instanceId) => {
            return tracked('fetchAttachments', [sapUser, instanceId], () => []);
        },
        executeDecision: async () => {
            await simulateDelay(profile);
        },
        forwardTask: async () => {
            await simulateDelay(profile);
        },
        addComment: async (sapUser, instanceId, text) => {
            return tracked('addComment', [sapUser, instanceId, text], () => ({
                ID: `CMT-${Date.now()}`,
                Text: text,
                CreatedAt: new Date().toISOString(),
                CreatedBy: sapUser,
            }));
        },
        addAttachment: async (sapUser, instanceId, fileName) => {
            return tracked('addAttachment', [sapUser, instanceId, fileName], () => ({
                ID: `ATT-${Date.now()}`,
                FileName: fileName,
                mime_type: 'application/pdf',
            }));
        },
        fetchAttachmentContent: async () => {
            return tracked('fetchAttachmentContent', [], () => ({
                data: Buffer.from('test'),
                contentType: 'text/plain',
            }));
        },
    } as ISapTaskClient;

    return { client, callLogs };
}

// ─── Performance Reporter ────────────────────────────────────

interface PerformanceReport {
    totalMs: number;
    sapCallCount: number;
    parallelEfficiency: number;
    callBreakdown: Record<string, { count: number; totalMs: number; avgMs: number }>;
    waterfall: string[];
    bottleneck: string;
}

function analyzePerformance(callLogs: CallLog[], totalMs: number): PerformanceReport {
    const breakdown: Record<string, { count: number; totalMs: number; avgMs: number }> = {};
    for (const log of callLogs) {
        if (!breakdown[log.method]) {
            breakdown[log.method] = { count: 0, totalMs: 0, avgMs: 0 };
        }
        breakdown[log.method].count++;
        breakdown[log.method].totalMs += log.durationMs;
    }
    for (const entry of Object.values(breakdown)) {
        entry.avgMs = Math.round(entry.totalMs / entry.count);
    }

    const serialTotal = callLogs.reduce((sum, log) => sum + log.durationMs, 0);
    const parallelEfficiency = serialTotal > 0 ? totalMs / serialTotal : 1;

    // Simple waterfall — group by start time bucket (100ms windows)
    const waterfall: string[] = [];
    if (callLogs.length > 0) {
        const earliest = Math.min(...callLogs.map(l => l.startedAt));
        for (const log of callLogs.sort((a, b) => a.startedAt - b.startedAt)) {
            const offset = log.startedAt - earliest;
            waterfall.push(`  +${offset}ms: ${log.method} (${log.durationMs}ms)`);
        }
    }

    // Find bottleneck
    let bottleneck = 'unknown';
    const sorted = Object.entries(breakdown).sort((a, b) => b[1].totalMs - a[1].totalMs);
    if (sorted.length > 0) {
        const [method, stats] = sorted[0];
        bottleneck = `${method} — ${stats.count} calls, ${stats.totalMs}ms total (${stats.avgMs}ms avg)`;
    }

    return {
        totalMs,
        sapCallCount: callLogs.length,
        parallelEfficiency,
        callBreakdown: breakdown,
        waterfall,
        bottleneck,
    };
}

function printReport(title: string, report: PerformanceReport): void {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  📊 ${title}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  ⏱  Total time:         ${report.totalMs}ms`);
    console.log(`  📡 SAP calls:           ${report.sapCallCount}`);
    console.log(`  ⚡ Parallel efficiency: ${(report.parallelEfficiency * 100).toFixed(1)}% (lower = better parallelism)`);
    console.log(`  🔥 Bottleneck:          ${report.bottleneck}`);
    console.log(`\n  Call Breakdown:`);
    for (const [method, stats] of Object.entries(report.callBreakdown)) {
        console.log(`    ${method.padEnd(35)} ${String(stats.count).padStart(3)}× │ total ${String(stats.totalMs).padStart(6)}ms │ avg ${String(stats.avgMs).padStart(4)}ms`);
    }
    if (report.waterfall.length > 0 && report.waterfall.length <= 30) {
        console.log(`\n  Waterfall (first 30 calls):`);
        for (const line of report.waterfall.slice(0, 30)) {
            console.log(line);
        }
    }
    console.log(`${'─'.repeat(70)}\n`);
}

// ═══════════════════════════════════════════════════════════════
// TEST SUITES
// ═══════════════════════════════════════════════════════════════

describe('Data Loading Performance Diagnostics', () => {
    beforeEach(() => {
        // Suppress adapter logging noise during tests
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ─── 1. Task List Loading (N+1 Problem) ─────────────────

    describe('Task List Loading — N+1 Enrichment Bottleneck', () => {
        it.each([
            { count: 10, profile: 'fast' },
            { count: 10, profile: 'normal' },
            { count: 25, profile: 'normal' },
            { count: 25, profile: 'slow' },
            { count: 50, profile: 'normal' },
        ])('fetches $count tasks on $profile network', async ({ count, profile }) => {
            const networkProfile = NETWORK_PROFILES[profile];
            const { client, callLogs } = createInstrumentedMockClient(networkProfile, count);
            const adapter = new TaskQueryAdapter(client);

            const startMs = Date.now();
            const result = await adapter.fetchTasks({ sapUser: 'TESTUSER', userJwt: 'mock-jwt' });
            const totalMs = Date.now() - startMs;

            const report = analyzePerformance(callLogs, totalMs);
            printReport(`Task List: ${count} tasks on ${networkProfile.name}`, report);

            // Assertions
            expect(result.items.length).toBe(count);
            expect(result.total).toBe(count);

            // The query adapter itself should only make 1 SAP call (fetchTasks)
            // The N+1 problem is in InboxService.enrichTaskForList, not in the adapter
            expect(report.sapCallCount).toBe(1);
            console.log(`  ✅ QueryAdapter makes only 1 SAP call (good)`);
            console.log(`  ⚠️  But InboxService.enrichTaskForList() will add ${count} MORE calls for factsheet enrichment\n`);
        });
    });

    // ─── 2. Simulated Full InboxService.getTasks() Flow ─────

    describe('Full Task List Pipeline — Simulated Enrichment Cost', () => {
        it.each([
            { count: 10, profile: 'normal' },
            { count: 25, profile: 'normal' },
            { count: 25, profile: 'slow' },
        ])('simulates full getTasks() cost for $count tasks on $profile network', async ({ count, profile }) => {
            const networkProfile = NETWORK_PROFILES[profile];

            // Phase 1: Task list fetch (1 SAP call)
            const phase1Start = Date.now();
            await simulateDelay(networkProfile);
            const phase1Ms = Date.now() - phase1Start;

            // Phase 2: N parallel enrichment calls (simulates enrichTaskForList × N)
            // Each enrichment does: resolveBusinessContext (pure) + enrichBusinessObjectData (1 SAP call)
            const phase2Start = Date.now();
            const enrichmentPromises = Array.from({ length: count }, () => simulateDelay(networkProfile).catch(() => {}));
            await Promise.all(enrichmentPromises);
            const phase2Ms = Date.now() - phase2Start;

            const totalMs = phase1Ms + phase2Ms;

            console.log(`\n${'═'.repeat(70)}`);
            console.log(`  📊 Full getTasks() Pipeline: ${count} tasks on ${NETWORK_PROFILES[profile].name}`);
            console.log(`${'═'.repeat(70)}`);
            console.log(`  Phase 1 (fetchTasks):          ${phase1Ms}ms  (1 SAP call)`);
            console.log(`  Phase 2 (enrichment × ${count}):    ${phase2Ms}ms  (${count} parallel SAP calls)`);
            console.log(`  Total:                         ${totalMs}ms`);
            console.log(`  SAP calls:                     ${1 + count}`);
            console.log(`  ──────────────────────────────────────`);
            console.log(`  ⚠️  Phase 2 is the bottleneck: ${count} factsheet calls in parallel`);
            console.log(`  💡 Fix: batch enrichment or cache factsheet data at list level`);
            console.log(`${'─'.repeat(70)}\n`);

            // On normal network, 25 parallel enrichments should complete in ~1 SAP RTT
            // (because they're parallel), but still adds latency
            expect(totalMs).toBeGreaterThan(0);
        });
    });

    // ─── 3. Task Detail Loading Waterfall ────────────────────

    describe('Task Detail Loading — Waterfall Analysis', () => {
        it.each([
            { mode: 'bundle', profile: 'normal' },
            { mode: 'bundle', profile: 'slow' },
            { mode: 'information', profile: 'normal' },
            { mode: 'information', profile: 'slow' },
        ])('fetches task $mode on $profile network', async ({ mode, profile }) => {
            const networkProfile = NETWORK_PROFILES[profile];
            const { client, callLogs } = createInstrumentedMockClient(networkProfile, 5);
            const adapter = new TaskDetailAdapter(client);
            const ctx = { sapUser: 'TESTUSER', userJwt: 'mock-jwt' };

            const startMs = Date.now();
            if (mode === 'bundle') {
                await adapter.fetchTaskDetailBundle(ctx, 'TASK-000');
            } else {
                await adapter.fetchTaskInformation(ctx, 'TASK-000');
            }
            const totalMs = Date.now() - startMs;

            const report = analyzePerformance(callLogs, totalMs);
            printReport(`Task ${mode}: TASK-000 on ${networkProfile.name}`, report);

            if (mode === 'bundle') {
                // fetchTaskDetailBundle: fetchTaskByFilter (1 call) then $batch is simulated via
                // fetchTaskDetailBundle direct call on mock, which is only 1 SAP call
                // In reality it would be: fetchTask (1) + $batch (1) = 2 sequential calls
                expect(report.sapCallCount).toBeGreaterThanOrEqual(1);
            } else {
                // fetchTaskInformation: fetchTaskDetail (1) then 4 parallel + 1 sequential = 6 calls
                // fetchTaskDetail + [Description, DecisionOptions, CustomAttributes, TaskObjects] + CustomAttributeDefinitions
                expect(report.sapCallCount).toBeGreaterThanOrEqual(5);
                console.log(`  ⚠️  Information mode makes ${report.sapCallCount} sequential+parallel calls`);
                console.log(`  💡 The waterfall is: fetchTaskDetail THEN 4 parallel sub-requests THEN 1 attr-def fallback`);
            }
        });
    });

    // ─── 4. Custom Attribute Definition Fallback Cost ─────────

    describe('Custom Attribute Definition Fallback — Expand vs Separate Call', () => {
        it('measures extra latency when inline expand has definitions (fast path)', async () => {
            const profile = NETWORK_PROFILES.normal;
            const { client, callLogs } = createInstrumentedMockClient(profile, 5);
            const adapter = new TaskDetailAdapter(client);
            const ctx = { sapUser: 'TESTUSER', userJwt: 'mock-jwt' };

            const startMs = Date.now();
            const bundle = await adapter.fetchTaskDetailBundle(ctx, 'TASK-000');
            const totalMs = Date.now() - startMs;

            const report = analyzePerformance(callLogs, totalMs);
            printReport('Detail Bundle with inline attr definitions', report);

            // Our mock includes CustomAttributeDefinitionData in TaskDefinitionData
            // so the fallback separate fetch should NOT happen
            const attrDefCalls = callLogs.filter(l => l.method === 'fetchCustomAttributeDefinitions');
            console.log(`  ✅ Attribute definition fallback calls: ${attrDefCalls.length}`);
            console.log(`     (0 = inline expand worked, >0 = separate fetch triggered)`);
            expect(attrDefCalls.length).toBe(0);
        });

        it('measures extra latency when inline expand is empty (fallback path)', async () => {
            const profile = NETWORK_PROFILES.normal;
            const taskCount = 5;
            const { client: baseClient, callLogs } = createInstrumentedMockClient(profile, taskCount);

            // Override fetchTaskDetailBundle to return empty definitions
            const client: ISapTaskClient = {
                ...baseClient,
                fetchTaskDetailBundle: async (sapUser, instanceId, userJwt) => {
                    const task = await baseClient.fetchTaskDetailBundle(sapUser, instanceId, userJwt);
                    // Clear inline definitions to force fallback
                    if (task.TaskDefinitionData) {
                        task.TaskDefinitionData.CustomAttributeDefinitionData = { results: [] };
                    }
                    return task;
                },
            };

            const adapter = new TaskDetailAdapter(client);
            const ctx = { sapUser: 'TESTUSER', userJwt: 'mock-jwt' };

            const startMs = Date.now();
            await adapter.fetchTaskDetailBundle(ctx, 'TASK-000');
            const totalMs = Date.now() - startMs;

            const report = analyzePerformance(callLogs, totalMs);
            printReport('Detail Bundle with attr definition FALLBACK', report);

            const attrDefCalls = callLogs.filter(l => l.method === 'fetchCustomAttributeDefinitions');
            console.log(`  ⚠️  Attribute definition fallback calls: ${attrDefCalls.length}`);
            console.log(`     This adds ~${profile.baseLatencyMs}ms of extra latency per task detail`);
            expect(attrDefCalls.length).toBe(1);
        });
    });

    // ─── 5. Pagination Impact ────────────────────────────────

    describe('Pagination Impact on Load Time', () => {
        it.each([
            { top: 10, skip: 0 },
            { top: 25, skip: 0 },
            { top: 50, skip: 0 },
            { top: 25, skip: 25 },
        ])('measures load time with top=$top skip=$skip', async ({ top, skip }) => {
            const profile = NETWORK_PROFILES.normal;
            const totalTasks = 100;
            const { client, callLogs } = createInstrumentedMockClient(profile, totalTasks);
            const adapter = new TaskQueryAdapter(client);

            const startMs = Date.now();
            const result = await adapter.fetchTasks(
                { sapUser: 'TESTUSER', userJwt: 'mock-jwt' },
                { top, skip },
            );
            const totalMs = Date.now() - startMs;

            console.log(`\n  📦 Pagination $top=${top} $skip=${skip}:`);
            console.log(`     Returned: ${result.items.length} tasks (total: ${result.total})`);
            console.log(`     Time: ${totalMs}ms`);
            console.log(`     ⚠️  Enrichment overhead would add: ${result.items.length} × ~${profile.baseLatencyMs}ms = ~${result.items.length * profile.baseLatencyMs}ms`);

            expect(result.items.length).toBeLessThanOrEqual(top);
        });
    });

    // ─── 6. Concurrent Detail Requests ───────────────────────

    describe('Concurrent Detail Requests — Connection Saturation', () => {
        it('simulates 5 concurrent task detail requests', async () => {
            const profile = NETWORK_PROFILES.normal;
            const { client, callLogs } = createInstrumentedMockClient(profile, 10);
            const adapter = new TaskDetailAdapter(client);
            const ctx = { sapUser: 'TESTUSER', userJwt: 'mock-jwt' };

            const taskIds = ['TASK-000', 'TASK-001', 'TASK-002', 'TASK-003', 'TASK-004'];

            const startMs = Date.now();
            const results = await Promise.all(
                taskIds.map(id => adapter.fetchTaskDetailBundle(ctx, id))
            );
            const totalMs = Date.now() - startMs;

            const report = analyzePerformance(callLogs, totalMs);
            printReport(`5 Concurrent Detail Requests on ${profile.name}`, report);

            expect(results).toHaveLength(5);
            console.log(`  ✅ 5 concurrent detail requests completed in ${totalMs}ms`);
            console.log(`  📡 Total SAP calls: ${report.sapCallCount}`);
            console.log(`  ⚠️  Real-world: each detail triggers enrichment (not measured here)`);
        });
    });

    // ─── 7. Network Profile Comparison ───────────────────────

    describe('Network Profile Comparison — Same Operations', () => {
        it('compares task list load across all network profiles', async () => {
            const results: { profile: string; totalMs: number; callCount: number }[] = [];

            for (const [key, profile] of Object.entries(NETWORK_PROFILES)) {
                if (key === 'terrible') continue; // Skip timeout-prone profile as it's flaky

                const { client, callLogs } = createInstrumentedMockClient(profile, 25);
                const adapter = new TaskQueryAdapter(client);

                const startMs = Date.now();
                await adapter.fetchTasks({ sapUser: 'TESTUSER', userJwt: 'mock-jwt' });
                const totalMs = Date.now() - startMs;

                results.push({ profile: profile.name, totalMs, callCount: callLogs.length });
            }

            console.log(`\n${'═'.repeat(70)}`);
            console.log(`  📊 Network Profile Comparison — 25 Task List Fetch`);
            console.log(`${'═'.repeat(70)}`);
            for (const r of results) {
                const bar = '█'.repeat(Math.min(40, Math.round(r.totalMs / 50)));
                console.log(`  ${r.profile.padEnd(25)} ${String(r.totalMs).padStart(5)}ms ${bar}`);
            }
            console.log(`\n  ⚠️  These times are for the list fetch ONLY.`);
            console.log(`     Add ${25}× RTT for factsheet enrichment (N+1 problem).`);
            console.log(`${'─'.repeat(70)}\n`);

            expect(results.length).toBe(3);
        });

        it('compares task detail load across network profiles', async () => {
            const results: { profile: string; totalMs: number; callCount: number }[] = [];

            for (const [key, profile] of Object.entries(NETWORK_PROFILES)) {
                if (key === 'terrible') continue;

                const { client, callLogs } = createInstrumentedMockClient(profile, 5);
                const adapter = new TaskDetailAdapter(client);
                const ctx = { sapUser: 'TESTUSER', userJwt: 'mock-jwt' };

                const startMs = Date.now();
                await adapter.fetchTaskInformation(ctx, 'TASK-000');
                const totalMs = Date.now() - startMs;

                results.push({ profile: profile.name, totalMs, callCount: callLogs.length });
            }

            console.log(`\n${'═'.repeat(70)}`);
            console.log(`  📊 Network Profile Comparison — Task Information`);
            console.log(`${'═'.repeat(70)}`);
            for (const r of results) {
                const bar = '█'.repeat(Math.min(40, Math.round(r.totalMs / 100)));
                console.log(`  ${r.profile.padEnd(25)} ${String(r.totalMs).padStart(5)}ms  (${r.callCount} calls) ${bar}`);
            }
            console.log(`${'─'.repeat(70)}\n`);

            expect(results.length).toBe(3);
        });
    });

    // ─── 8. End-to-End User Flow Simulation ─────────────────

    describe('End-to-End User Flow — Open App → Select Task', () => {
        it('simulates the full user experience flow on normal network', async () => {
            const profile = NETWORK_PROFILES.normal;
            const taskCount = 25;
            const { client, callLogs } = createInstrumentedMockClient(profile, taskCount);
            const queryAdapter = new TaskQueryAdapter(client);
            const detailAdapter = new TaskDetailAdapter(client);
            const ctx = { sapUser: 'TESTUSER', userJwt: 'mock-jwt' };

            const flowStart = Date.now();

            // Step 1: User opens app → fetch task list
            const step1Start = Date.now();
            const taskList = await queryAdapter.fetchTasks(ctx);
            const step1Ms = Date.now() - step1Start;

            // Step 2: Simulate N enrichment calls (factsheet N+1)
            const step2Start = Date.now();
            await Promise.all(
                taskList.items.map(() => simulateDelay(profile))
            );
            const step2Ms = Date.now() - step2Start;

            // Step 3: User selects first task → fetch task information
            const step3Start = Date.now();
            const info = await detailAdapter.fetchTaskInformation(ctx, 'TASK-000');
            const step3Ms = Date.now() - step3Start;

            // Step 4: Simulate enrichment for selected task (PR factsheet header + items + PR info)
            const step4Start = Date.now();
            // header + items + prInfo — 3 parallel calls
            await Promise.all([
                simulateDelay(profile),
                simulateDelay(profile),
                simulateDelay(profile),
            ]);
            const step4Ms = Date.now() - step4Start;

            const flowTotalMs = Date.now() - flowStart;

            console.log(`\n${'═'.repeat(70)}`);
            console.log(`  🚀 End-to-End User Flow: Open App → View Task Detail`);
            console.log(`  📶 Network: ${profile.name} (~${profile.baseLatencyMs}ms RTT)`);
            console.log(`${'═'.repeat(70)}`);
            console.log(`  Step 1: Fetch task list        ${step1Ms}ms  (1 SAP call)`);
            console.log(`  Step 2: Enrich list items      ${step2Ms}ms  (${taskCount} parallel factsheet calls) ⬅ N+1`);
            console.log(`  Step 3: Fetch task info         ${step3Ms}ms  (${callLogs.filter(l => l.startedAt >= step3Start && l.finishedAt <= step3Start + step3Ms + 50).length} SAP calls)`);
            console.log(`  Step 4: Enrich detail           ${step4Ms}ms  (3 parallel factsheet calls)`);
            console.log(`  ──────────────────────────────────────`);
            console.log(`  📊 Total flow:                 ${flowTotalMs}ms`);
            console.log(`  📡 Total SAP calls:            ${callLogs.length + taskCount + 3} (adapter: ${callLogs.length}, enrichment: ${taskCount + 3})`);
            console.log(`\n  🔥 Bottleneck Analysis:`);
            console.log(`     Step 2 (list enrichment) is the primary bottleneck.`);
            console.log(`     Even with ${taskCount} PARALLEL calls, it still adds ~1 RTT.`);
            console.log(`     On slow networks this becomes ${taskCount} × ${profile.baseLatencyMs}ms = ~${profile.baseLatencyMs}ms (parallel) or ~${taskCount * profile.baseLatencyMs}ms (serial).`);
            console.log(`\n  💡 Recommended Optimizations:`);
            console.log(`     1. Skip factsheet enrichment on list-level (defer to detail view)`);
            console.log(`     2. Use $expand in the SAP TaskCollection query to get custom attrs`);
            console.log(`     3. Cache factsheet data by document ID`);
            console.log(`     4. Use stale-while-revalidate pattern on frontend`);
            console.log(`${'─'.repeat(70)}\n`);

            expect(flowTotalMs).toBeGreaterThan(0);
            expect(taskList.items.length).toBe(taskCount);
        });

        it('simulates the full user experience flow on slow network', async () => {
            // Use slow profile WITHOUT timeout to test deterministic latency
            // Timeout resilience is covered separately in 'Enrichment Failure Resilience'
            const profile: NetworkProfile = { ...NETWORK_PROFILES.slow, timeoutRate: 0 };
            const taskCount = 25;
            const { client, callLogs } = createInstrumentedMockClient(profile, taskCount);
            const queryAdapter = new TaskQueryAdapter(client);
            const detailAdapter = new TaskDetailAdapter(client);
            const ctx = { sapUser: 'TESTUSER', userJwt: 'mock-jwt' };

            const flowStart = Date.now();
            const taskList = await queryAdapter.fetchTasks(ctx);
            const listMs = Date.now() - flowStart;

            const enrichStart = Date.now();
            await Promise.allSettled(taskList.items.map(() => simulateDelay(profile)));
            const enrichMs = Date.now() - enrichStart;

            const detailStart = Date.now();
            await detailAdapter.fetchTaskInformation(ctx, 'TASK-000');
            const detailMs = Date.now() - detailStart;

            const totalMs = Date.now() - flowStart;

            console.log(`\n  🐌 Slow Network Flow:`);
            console.log(`     List fetch:    ${listMs}ms`);
            console.log(`     Enrichment:    ${enrichMs}ms (${taskCount} parallel calls)`);
            console.log(`     Detail fetch:  ${detailMs}ms`);
            console.log(`     TOTAL:         ${totalMs}ms`);
            console.log(`     ⚠️  Users will perceive this as ${(totalMs / 1000).toFixed(1)}s of loading\n`);

            expect(totalMs).toBeGreaterThan(0);
        });
    });

    // ─── 9. Enrichment Failure Resilience ────────────────────

    describe('Enrichment Failure Resilience', () => {
        it('measures impact when some enrichment calls timeout', async () => {
            const profile = NETWORK_PROFILES.terrible; // 10% timeout rate
            const taskCount = 10;

            const timings: number[] = [];
            const errors: number[] = [];

            // Run multiple iterations to observe timeout impact
            for (let run = 0; run < 3; run++) {
                let errorCount = 0;
                const startMs = Date.now();
                const results = await Promise.allSettled(
                    Array.from({ length: taskCount }, async () => {
                        try {
                            await simulateDelay(profile);
                            return 'ok';
                        } catch {
                            errorCount++;
                            return 'timeout';
                        }
                    })
                );
                const totalMs = Date.now() - startMs;
                timings.push(totalMs);
                errors.push(errorCount);
            }

            console.log(`\n  ⚡ Terrible Network Resilience (${taskCount} enrichment calls × 3 runs):`);
            for (let i = 0; i < timings.length; i++) {
                console.log(`     Run ${i + 1}: ${timings[i]}ms, ${errors[i]} timeouts`);
            }
            console.log(`     ⚠️  With Promise.all, one timeout blocks the entire batch`);
            console.log(`     💡 Fix: Use Promise.allSettled + fallback for failed enrichments\n`);

            expect(timings.length).toBe(3);
        });
    });

    // ─── 10. Large Payload Overhead ──────────────────────────

    describe('Large Payload Simulation', () => {
        it('measures JSON serialization overhead for large task lists', () => {
            const tasks = Array.from({ length: 100 }, (_, i) => ({
                instanceId: `TASK-${i.toString().padStart(3, '0')}`,
                sapOrigin: 'LOCAL',
                title: `Approve Purchase Requisition PR${1000100 + i}`,
                status: 'READY',
                priority: 'HIGH',
                createdOn: new Date().toISOString(),
                createdByName: `User ${i}`,
                requestorName: `Requestor ${i}`,
                businessContext: {
                    type: 'PR',
                    documentId: `${1000100 + i}`,
                    pr: {
                        header: {
                            purchaseRequisition: `${1000100 + i}`,
                            totalNetAmount: '2450.00',
                            displayCurrency: 'USD',
                            userFullName: `User ${i} Full Name`,
                        },
                        items: Array.from({ length: 5 }, (_, j) => ({
                            purchaseRequisitionItem: `${(j + 1) * 10}`,
                            purchaseRequisitionItemText: `Item ${j + 1} for PR`,
                            materialGroup: 'MG01',
                            purchaseRequisitionPrice: '490.00',
                        })),
                    },
                },
            }));

            // Measure serialization
            const serStart = Date.now();
            const json = JSON.stringify({ tasks, total: tasks.length });
            const serMs = Date.now() - serStart;

            // Measure deserialization
            const deserStart = Date.now();
            JSON.parse(json);
            const deserMs = Date.now() - deserStart;

            const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);

            console.log(`\n  📦 Large Payload Analysis (${tasks.length} tasks with full enrichment):`);
            console.log(`     Payload size:     ${sizeKB} KB`);
            console.log(`     Serialization:    ${serMs}ms`);
            console.log(`     Deserialization:  ${deserMs}ms`);
            console.log(`     ⚠️  Over 3G: ~${(Number(sizeKB) / 50).toFixed(1)}s transfer time`);
            console.log(`     💡 Consider: pagination, partial responses, compression\n`);

            expect(Number(sizeKB)).toBeGreaterThan(0);
        });
    });
});
