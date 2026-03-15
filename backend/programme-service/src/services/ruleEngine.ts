/**
 * Rule Engine Service
 * Evaluates programme rules against citizen/family data from the family DB.
 * Supports:
 *   - Individual variable rules (compare field value to threshold)
 *   - Composite group rules (PMT, MT) that calculate a weighted score
 */
import { supabase, familySupabase } from '../lib/supabase.js'
import type { ProgrammeRule, RuleGroupRule, RuleGroup } from '../types/index.js'

interface EvaluationResult {
    subject_id: string
    subject_type: string
    eligible: boolean
    calculated_score: number
    group_scores: Record<string, number>
    rule_results: {
        rule_code: string | null
        variable_code: string | null
        rule_group_id: string | null
        passed: boolean
        actual_value: unknown
        threshold: string | null
        score: number
    }[]
}

/**
 * Evaluate all rules for a programme against a specific subject.
 */
export async function evaluateSubject(
    programmeId: string,
    subjectId: string,
    subjectType: 'Individual' | 'Family',
): Promise<EvaluationResult> {
    if (!familySupabase) {
        throw new Error('Family database not configured — cannot evaluate rules')
    }

    // 1. Fetch programme rules
    const { data: rules, error: rulesErr } = await supabase
        .from('programme_rules')
        .select('*')
        .eq('programme_id', programmeId)

    if (rulesErr) throw new Error(`Failed to fetch programme rules: ${rulesErr.message}`)
    if (!rules || rules.length === 0) {
        return { subject_id: subjectId, subject_type: subjectType, eligible: true, calculated_score: 0, group_scores: {}, rule_results: [] }
    }

    // 2. Fetch subject data from family DB
    const subjectData = await fetchSubjectData(subjectId, subjectType)

    // 3. Evaluate each rule
    const ruleResults: EvaluationResult['rule_results'] = []
    const groupScores: Record<string, number> = {}
    let totalScore = 0
    let allMandatoryPassed = true

    for (const rule of rules as ProgrammeRule[]) {
        if (rule.rule_type === 'group' && rule.rule_group_id) {
            // Evaluate composite group rule
            const groupResult = await evaluateGroupRule(rule, subjectData)
            groupScores[rule.rule_group_id] = groupResult.score
            totalScore += groupResult.score

            ruleResults.push({
                rule_code: rule.rule_code,
                variable_code: null,
                rule_group_id: rule.rule_group_id,
                passed: groupResult.passed,
                actual_value: groupResult.score,
                threshold: rule.threshold_value,
                score: groupResult.score,
            })

            if (rule.mandatory_flag && !groupResult.passed) {
                allMandatoryPassed = false
            }
        } else if (rule.variable_code) {
            // Evaluate individual variable rule
            const result = evaluateVariableRule(rule, subjectData)
            totalScore += result.score

            ruleResults.push({
                rule_code: rule.rule_code,
                variable_code: rule.variable_code,
                rule_group_id: null,
                passed: result.passed,
                actual_value: result.actualValue,
                threshold: rule.threshold_value,
                score: result.score,
            })

            if (rule.mandatory_flag && !result.passed) {
                allMandatoryPassed = false
            }
        }
    }

    return {
        subject_id: subjectId,
        subject_type: subjectType,
        eligible: allMandatoryPassed,
        calculated_score: totalScore,
        group_scores: groupScores,
        rule_results: ruleResults,
    }
}

/**
 * Evaluate a composite group rule (PMT, MT).
 */
async function evaluateGroupRule(
    programmeRule: ProgrammeRule,
    subjectData: Record<string, unknown>,
): Promise<{ passed: boolean; score: number }> {
    // Fetch the group
    const { data: group } = await supabase
        .from('rule_group')
        .select('*')
        .eq('rule_group_id', programmeRule.rule_group_id)
        .single()

    if (!group) return { passed: false, score: 0 }

    // Fetch group rules
    const { data: groupRules } = await supabase
        .from('rule_group_rules')
        .select('*')
        .eq('rule_group_id', programmeRule.rule_group_id)

    if (!groupRules || groupRules.length === 0) return { passed: true, score: 0 }

    // Evaluate each sub-rule in the group
    const subResults: { passed: boolean; weight: number; mandatory: boolean }[] = []

    for (const gr of groupRules as RuleGroupRule[]) {
        const actualValue = resolveVariable(gr.variable_code, subjectData)
        const passed = compareValue(actualValue, gr.operator, gr.threshold_value)
        subResults.push({ passed, weight: gr.weight, mandatory: gr.mandatory_flag })
    }

    // Calculate composite score based on scoring method
    const rg = group as RuleGroup
    let score = 0

    switch (rg.scoring_method) {
        case 'weighted_sum': {
            score = subResults.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)
            break
        }
        case 'average': {
            const total = subResults.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)
            score = subResults.length > 0 ? total / subResults.length : 0
            break
        }
        case 'min': {
            const scores = subResults.map(r => r.passed ? r.weight : 0)
            score = scores.length > 0 ? Math.min(...scores) : 0
            break
        }
        case 'max': {
            const scores = subResults.map(r => r.passed ? r.weight : 0)
            score = scores.length > 0 ? Math.max(...scores) : 0
            break
        }
    }

    // Check if all mandatory sub-rules passed
    const mandatoryPassed = subResults.filter(r => r.mandatory).every(r => r.passed)

    // Check if the group score meets the programme rule threshold
    let passed = mandatoryPassed
    if (programmeRule.operator && programmeRule.threshold_value) {
        passed = passed && compareValue(score, programmeRule.operator, programmeRule.threshold_value)
    }

    return { passed, score }
}

/**
 * Evaluate an individual variable rule.
 */
function evaluateVariableRule(
    rule: ProgrammeRule,
    subjectData: Record<string, unknown>,
): { passed: boolean; actualValue: unknown; score: number } {
    const actualValue = resolveVariable(rule.variable_code!, subjectData)
    const passed = rule.operator ? compareValue(actualValue, rule.operator, rule.threshold_value || '') : true
    return { passed, actualValue, score: passed ? rule.weight : 0 }
}

/**
 * Dynamically resolve a variable value from the subject data.
 * Variables are in format "table.column" (e.g., "family_member.is_disabled")
 */
function resolveVariable(variableCode: string, subjectData: Record<string, unknown>): unknown {
    const [table, column] = variableCode.split('.')
    const tableData = subjectData[table]
    if (tableData && typeof tableData === 'object') {
        return (tableData as Record<string, unknown>)[column]
    }
    return undefined
}

/**
 * Compare a value against a threshold using the specified operator.
 */
function compareValue(actual: unknown, operator: string, threshold: string): boolean {
    if (actual === undefined || actual === null) return false

    const actualStr = String(actual)
    const actualNum = Number(actual)
    const thresholdNum = Number(threshold)

    switch (operator) {
        case '==': return actualStr === threshold || actualStr === threshold.toLowerCase()
        case '!=': return actualStr !== threshold && actualStr !== threshold.toLowerCase()
        case '>': return !isNaN(actualNum) && !isNaN(thresholdNum) && actualNum > thresholdNum
        case '<': return !isNaN(actualNum) && !isNaN(thresholdNum) && actualNum < thresholdNum
        case '>=': return !isNaN(actualNum) && !isNaN(thresholdNum) && actualNum >= thresholdNum
        case '<=': return !isNaN(actualNum) && !isNaN(thresholdNum) && actualNum <= thresholdNum
        case 'IN': {
            try {
                const values = JSON.parse(threshold) as string[]
                return values.includes(actualStr)
            } catch {
                return threshold.split(',').map(v => v.trim()).includes(actualStr)
            }
        }
        case 'NOT IN': {
            try {
                const values = JSON.parse(threshold) as string[]
                return !values.includes(actualStr)
            } catch {
                return !threshold.split(',').map(v => v.trim()).includes(actualStr)
            }
        }
        case 'BETWEEN': {
            const parts = threshold.split(',').map(v => Number(v.trim()))
            return parts.length === 2 && !isNaN(actualNum) && actualNum >= parts[0] && actualNum <= parts[1]
        }
        default: return false
    }
}

/**
 * Fetch all relevant data for a subject from the family database.
 */
async function fetchSubjectData(
    subjectId: string,
    subjectType: string,
): Promise<Record<string, unknown>> {
    if (!familySupabase) throw new Error('Family database not configured')

    const result: Record<string, unknown> = {}

    if (subjectType === 'Family') {
        // Fetch family data
        const { data: family } = await familySupabase
            .from('family')
            .select('*')
            .eq('uuid', subjectId)
            .single()
        result.family = family || {}

        // Fetch first family member (head)
        const { data: members } = await familySupabase
            .from('family_member')
            .select('*')
            .eq('family_uuid', subjectId)
            .eq('relationship_to_head', 'head')
            .limit(1)
        result.family_member = members?.[0] || {}

        // Fetch address
        if (family?.permanent_address_id) {
            const { data: address } = await familySupabase
                .from('address')
                .select('*')
                .eq('uuid', family.permanent_address_id)
                .single()
            result.address = address || {}
        }

        // Fetch house services
        const { data: houseServices } = await familySupabase
            .from('house_services')
            .select('*')
            .eq('family_uuid', subjectId)
            .single()
        result.house_services = houseServices || {}

    } else {
        // Individual — fetch by member ID
        const { data: member } = await familySupabase
            .from('family_member')
            .select('*')
            .eq('uuid', subjectId)
            .single()
        result.family_member = member || {}

        if (member?.family_uuid) {
            const { data: family } = await familySupabase
                .from('family')
                .select('*')
                .eq('uuid', member.family_uuid)
                .single()
            result.family = family || {}

            const { data: houseServices } = await familySupabase
                .from('house_services')
                .select('*')
                .eq('family_uuid', member.family_uuid)
                .single()
            result.house_services = houseServices || {}

            if (family?.permanent_address_id) {
                const { data: address } = await familySupabase
                    .from('address')
                    .select('*')
                    .eq('uuid', family.permanent_address_id)
                    .single()
                result.address = address || {}
            }
        }
    }

    return result
}

/**
 * Batch evaluate all eligible subjects for a programme.
 * Pre-fetches ALL data in ~8 queries, then evaluates in memory — no N+1.
 *
 * @param programmeId — the programme to evaluate
 * @param connections — { programme: Connection, family: Connection } from engineService
 */
export async function evaluateAllSubjects(
    programmeId: string,
    connections?: { programme: any; family: any },
): Promise<EvaluationResult[]> {
    // If connections are provided, use the optimised batch path
    if (connections?.programme && connections?.family) {
        return evaluateAllSubjectsBatch(programmeId, connections)
    }

    // Legacy fallback: sequential per-subject (still uses Supabase clients)
    if (!familySupabase) throw new Error('Family database not configured')

    const { data: families } = await familySupabase
        .from('family')
        .select('uuid')
        .eq('status', 'active')
        .limit(1000)

    if (!families || families.length === 0) return []

    const results: EvaluationResult[] = []
    for (const family of families) {
        try {
            const result = await evaluateSubject(programmeId, family.uuid, 'Family')
            results.push(result)
        } catch (err) {
            console.error(`Error evaluating family ${family.uuid}:`, err)
        }
    }

    return results
}

// ─── BATCH EVALUATION (N14 optimisation) ─────────────────────────

/**
 * Optimised batch evaluation — 8 queries total instead of 5000+.
 * Pre-fetches all programme rules, group definitions, and family data,
 * then evaluates each family in memory.
 */
async function evaluateAllSubjectsBatch(
    programmeId: string,
    connections: { programme: any; family: any },
): Promise<EvaluationResult[]> {
    const { programme: progConn, family: famConn } = connections

    // 1. Pre-fetch programme rules ONCE
    const rulesResult = await progConn.query(
        'SELECT * FROM programme_rules WHERE programme_id = $1', [programmeId])
    const rules = rulesResult.rows as ProgrammeRule[]
    if (!rules || rules.length === 0) return []

    // 2. Pre-fetch ALL group definitions and group rules ONCE
    const groupRuleIds = rules
        .filter((r: ProgrammeRule) => r.rule_group_id)
        .map((r: ProgrammeRule) => r.rule_group_id!)
    let groupsMap: Record<string, RuleGroup> = {}
    let groupRulesMap: Record<string, RuleGroupRule[]> = {}

    if (groupRuleIds.length > 0) {
        // Build IN clause with parameterised placeholders
        const groupPlaceholders = groupRuleIds.map((_: string, i: number) => `$${i + 1}`).join(', ')

        const groupsResult = await progConn.query(
            `SELECT * FROM rule_group WHERE rule_group_id IN (${groupPlaceholders})`,
            groupRuleIds)
        groupsMap = Object.fromEntries(
            (groupsResult.rows || []).map((g: any) => [g.rule_group_id, g]))

        const groupRulesResult = await progConn.query(
            `SELECT * FROM rule_group_rules WHERE rule_group_id IN (${groupPlaceholders})`,
            groupRuleIds)
        for (const gr of groupRulesResult.rows || []) {
            if (!groupRulesMap[gr.rule_group_id]) groupRulesMap[gr.rule_group_id] = []
            groupRulesMap[gr.rule_group_id].push(gr)
        }
    }

    // 3. Pre-fetch ALL active families + related data in bulk (4 queries, not 4000)
    const familiesResult = await famConn.query(
        "SELECT * FROM family WHERE status = 'active' LIMIT 1000")
    const families = familiesResult.rows || []
    if (families.length === 0) return []

    const familyUuids = families.map((f: any) => f.uuid)
    const famPlaceholders = familyUuids.map((_: string, i: number) => `$${i + 1}`).join(', ')

    const addressIds = families.map((f: any) => f.permanent_address_id).filter(Boolean)
    const addrPlaceholders = addressIds.map((_: string, i: number) => `$${i + 1}`).join(', ')

    const [membersResult, addressResult, houseResult] = await Promise.all([
        famConn.query(
            `SELECT * FROM family_member WHERE family_uuid IN (${famPlaceholders}) AND relationship_to_head = 'head'`,
            familyUuids),
        addressIds.length > 0
            ? famConn.query(
                `SELECT * FROM address WHERE uuid IN (${addrPlaceholders})`,
                addressIds)
            : Promise.resolve({ rows: [] }),
        famConn.query(
            `SELECT * FROM house_services WHERE family_uuid IN (${famPlaceholders})`,
            familyUuids),
    ])

    // 4. Index data by family UUID for O(1) lookup
    const membersByFamily: Record<string, any> = Object.fromEntries(
        (membersResult.rows || []).map((m: any) => [m.family_uuid, m]))
    const addressById: Record<string, any> = Object.fromEntries(
        (addressResult.rows || []).map((a: any) => [a.uuid, a]))
    const houseByFamily: Record<string, any> = Object.fromEntries(
        (houseResult.rows || []).map((h: any) => [h.family_uuid, h]))

    // 5. Evaluate each family IN MEMORY — zero additional DB queries
    const results: EvaluationResult[] = []
    for (const family of families) {
        try {
            const subjectData: Record<string, unknown> = {
                family: family,
                family_member: membersByFamily[family.uuid] || {},
                address: family.permanent_address_id
                    ? (addressById[family.permanent_address_id] || {})
                    : {},
                house_services: houseByFamily[family.uuid] || {},
            }

            const result = evaluateSubjectInMemory(
                programmeId, family.uuid, 'Family',
                subjectData, rules, groupsMap, groupRulesMap)
            results.push(result)
        } catch (err) {
            console.error(`Error evaluating family ${family.uuid}:`, err)
        }
    }

    return results
}

/**
 * Evaluate all rules for a subject using pre-fetched in-memory data.
 * Same logic as evaluateSubject() but reads group data from maps
 * instead of querying the DB.
 */
function evaluateSubjectInMemory(
    programmeId: string,
    subjectId: string,
    subjectType: string,
    subjectData: Record<string, unknown>,
    rules: ProgrammeRule[],
    groupsMap: Record<string, RuleGroup>,
    groupRulesMap: Record<string, RuleGroupRule[]>,
): EvaluationResult {
    const ruleResults: EvaluationResult['rule_results'] = []
    const groupScores: Record<string, number> = {}
    let totalScore = 0
    let allMandatoryPassed = true

    for (const rule of rules) {
        if (rule.rule_type === 'group' && rule.rule_group_id) {
            // Use pre-fetched group data — NO DB QUERY
            const group = groupsMap[rule.rule_group_id]
            const subRules = groupRulesMap[rule.rule_group_id] || []
            const groupResult = evaluateGroupRuleInMemory(rule, group, subRules, subjectData)
            groupScores[rule.rule_group_id] = groupResult.score
            totalScore += groupResult.score

            ruleResults.push({
                rule_code: rule.rule_code,
                variable_code: null,
                rule_group_id: rule.rule_group_id,
                passed: groupResult.passed,
                actual_value: groupResult.score,
                threshold: rule.threshold_value,
                score: groupResult.score,
            })

            if (rule.mandatory_flag && !groupResult.passed) {
                allMandatoryPassed = false
            }
        } else if (rule.variable_code) {
            const result = evaluateVariableRule(rule, subjectData)
            totalScore += result.score

            ruleResults.push({
                rule_code: rule.rule_code,
                variable_code: rule.variable_code,
                rule_group_id: null,
                passed: result.passed,
                actual_value: result.actualValue,
                threshold: rule.threshold_value,
                score: result.score,
            })

            if (rule.mandatory_flag && !result.passed) {
                allMandatoryPassed = false
            }
        }
    }

    return {
        subject_id: subjectId,
        subject_type: subjectType,
        eligible: allMandatoryPassed,
        calculated_score: totalScore,
        group_scores: groupScores,
        rule_results: ruleResults,
    }
}

/**
 * Evaluate a composite group rule using pre-fetched group data.
 * Same logic as evaluateGroupRule() but reads from maps instead of DB.
 */
function evaluateGroupRuleInMemory(
    programmeRule: ProgrammeRule,
    group: RuleGroup | undefined,
    subRules: RuleGroupRule[],
    subjectData: Record<string, unknown>,
): { passed: boolean; score: number } {
    if (!group) return { passed: false, score: 0 }
    if (!subRules || subRules.length === 0) return { passed: true, score: 0 }

    const subResults: { passed: boolean; weight: number; mandatory: boolean }[] = []

    for (const gr of subRules) {
        const actualValue = resolveVariable(gr.variable_code, subjectData)
        const passed = compareValue(actualValue, gr.operator, gr.threshold_value)
        subResults.push({ passed, weight: gr.weight, mandatory: gr.mandatory_flag })
    }

    let score = 0
    switch (group.scoring_method) {
        case 'weighted_sum': {
            score = subResults.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)
            break
        }
        case 'average': {
            const total = subResults.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)
            score = subResults.length > 0 ? total / subResults.length : 0
            break
        }
        case 'min': {
            const scores = subResults.map(r => r.passed ? r.weight : 0)
            score = scores.length > 0 ? Math.min(...scores) : 0
            break
        }
        case 'max': {
            const scores = subResults.map(r => r.passed ? r.weight : 0)
            score = scores.length > 0 ? Math.max(...scores) : 0
            break
        }
    }

    const mandatoryPassed = subResults.filter(r => r.mandatory).every(r => r.passed)
    let passed = mandatoryPassed
    if (programmeRule.operator && programmeRule.threshold_value) {
        passed = passed && compareValue(score, programmeRule.operator, programmeRule.threshold_value)
    }

    return { passed, score }
}
