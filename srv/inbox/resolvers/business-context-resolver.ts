import { BusinessContext, BusinessContextType, CustomAttribute, InboxTask, TaskObject } from '../../types';
import { BUSINESS_OBJECT_DEFINITIONS } from './business-object-registry';

/**
 * Business Context Resolver
 *
 * SAP tasks are generic workflow items. This module inspects task metadata
 * to determine the business document type (PR, PO, etc.) and extract the document ID.
 *
 * Resolution priority (as defined in plan §8):
 *   1. CustomAttributeData — most reliable (explicit fields like PRNumber)
 *   2. TaskObjects — linked objects can indicate document type
 *   3. ScenarioID — workflow scenario patterns
 *   4. TaskDefinitionID — task definition patterns
 *   5. TaskTitle — last resort: parse title text
 *
 * All detection patterns are defined in `business-object-registry.ts`.
 * No hardcoded constants — the resolver loops over BUSINESS_OBJECT_DEFINITIONS.
 */

// ─── Main Resolver ────────────────────────────────────────

export function resolveBusinessContext(
    task: InboxTask,
    customAttributes: CustomAttribute[],
    taskObjects: TaskObject[]
): BusinessContext {
    let result: BusinessContext | null = null;

    // 1. Try CustomAttributeData
    result = resolveFromAttributes(customAttributes);

    // 2. Try TaskObjects
    if (!result) result = resolveFromTaskObjects(taskObjects);

    // 3. Try ScenarioID
    if (!result) result = resolveFromScenario(task.scenarioId);

    // 4. Try TaskDefinitionID
    if (!result) result = resolveFromDefinition(task.taskDefinitionId);

    // 5. Try title
    if (!result) result = resolveFromTitle(task.title);

    if (!result) {
        result = { type: 'UNKNOWN' };
    }

    // If we have a type but no documentId, try a fallback extraction from title
    // Matches 6-10 digit numbers, handling prefixes like PR1000123 or PO 4500012345
    if (!result.documentId && task.title) {
        const fallbackMatch = task.title.match(/(?:PR|PO|#|\b)\s*(\d{6,10})\b/i);
        if (fallbackMatch) {
            result.documentId = fallbackMatch[1];
        }
    }

    return result;
}

// ─── Resolution Strategies ────────────────────────────────

function resolveFromAttributes(attrs: CustomAttribute[]): BusinessContext | null {
    for (const def of BUSINESS_OBJECT_DEFINITIONS) {
        for (const attr of attrs) {
            const nameLower = attr.name.toLowerCase();
            const labelLower = attr.label.toLowerCase();

            if (
                def.attributeNames.includes(nameLower) ||
                def.attributeLabels.some((l) => labelLower.includes(l))
            ) {
                return {
                    type: def.type as BusinessContextType,
                    documentId: attr.value || undefined,
                };
            }
        }
    }
    return null;
}

function resolveFromTaskObjects(objects: TaskObject[]): BusinessContext | null {
    for (const def of BUSINESS_OBJECT_DEFINITIONS) {
        for (const obj of objects) {
            const typeLower = obj.type.toLowerCase();
            const nameLower = (obj.name || '').toLowerCase();

            if (
                def.objectTypePatterns.some((p) => typeLower.includes(p)) ||
                def.attributeLabels.some((l) => nameLower.includes(l))
            ) {
                return { type: def.type as BusinessContextType, documentId: obj.objectId };
            }
        }
    }
    return null;
}

function resolveFromScenario(scenarioId?: string): BusinessContext | null {
    if (!scenarioId) return null;
    const upper = scenarioId.toUpperCase();

    for (const def of BUSINESS_OBJECT_DEFINITIONS) {
        if (def.scenarioPatterns.some((p) => upper.includes(p))) {
            return { type: def.type as BusinessContextType };
        }
    }
    return null;
}

function resolveFromDefinition(taskDefId?: string): BusinessContext | null {
    if (!taskDefId) return null;
    const upper = taskDefId.toUpperCase();

    for (const def of BUSINESS_OBJECT_DEFINITIONS) {
        if (def.definitionPatterns.some((p) => upper.includes(p))) {
            return { type: def.type as BusinessContextType };
        }
    }
    return null;
}

function resolveFromTitle(title: string): BusinessContext | null {
    if (!title) return null;

    // Extract document number from title
    const docNumberMatch = title.match(/\b(\d{8,10})\b/);
    const docId = docNumberMatch ? docNumberMatch[1] : undefined;

    for (const def of BUSINESS_OBJECT_DEFINITIONS) {
        for (const pattern of def.titlePatterns) {
            if (pattern.test(title)) {
                return { type: def.type as BusinessContextType, documentId: docId };
            }
        }
    }

    return null;
}

/**
 * Get a display label for the business context type.
 * Now data-driven from the registry.
 */
export function getContextLabel(type: BusinessContextType): string {
    return BUSINESS_OBJECT_DEFINITIONS.find((d) => d.type === type)?.label ?? 'Unknown';
}
