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
 */
export async function evaluateAllSubjects(programmeId: string): Promise<EvaluationResult[]> {
    if (!familySupabase) throw new Error('Family database not configured')

    // Fetch all families
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
