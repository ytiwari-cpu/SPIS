/**
 * RuleBuilder — Wireframe-aligned visual rule builder
 *
 * Matches the provided wireframe:
 *   • Header: "Visual Rule Builder" + DRAFT MODE / ACTIVE badge
 *   • AND/OR pill toggles + "GLOBAL REQUIREMENT GROUP" label
 *   • Column headers: FIELD, OPERATOR, VALUE, WEIGHT, MANDATORY
 *   • Condition rows: drag handle + field select + operator select + value input + weight input + mandatory toggle + remove
 *   • "+ ADD CONDITION" button
 *   • Active Rule Inventory section below
 *
 * Keeps the existing RulesTreeNode AND/OR nested logic exactly the same.
 */
import { useState } from 'react'
import type { RulesTreeNode, RuleCondition, RuleVariable, ProgrammeRule } from '@/types/programme'
import { OPERATORS, isRulesTreeGroup } from '@/types/programme'

// ── Helpers ──────────────────────────────────────────────────────────────────

function newCondition(): RuleCondition {
    return { field: '', operator: '==', value: '', weight: 0 }
}

function newGroup(): RulesTreeNode {
    return { combinator: 'AND', rules: [newCondition()] }
}

// ── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
            <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
        </button>
    )
}

// ── AND/OR Pill Toggle ───────────────────────────────────────────────────────

function CombinatorPills({ value, onChange, readOnly }: { value: 'AND' | 'OR'; onChange: (v: 'AND' | 'OR') => void; readOnly: boolean }) {
    return (
        <div className="inline-flex rounded-md border border-gray-200 overflow-hidden">
            <button
                type="button"
                disabled={readOnly}
                onClick={() => onChange('AND')}
                className={`px-3 py-1 text-xs font-bold transition-colors ${value === 'AND'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    } ${readOnly ? 'cursor-default' : ''}`}
            >
                AND
            </button>
            <button
                type="button"
                disabled={readOnly}
                onClick={() => onChange('OR')}
                className={`px-3 py-1 text-xs font-bold transition-colors ${value === 'OR'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-500 hover:bg-gray-50'
                    } ${readOnly ? 'cursor-default' : ''}`}
            >
                OR
            </button>
        </div>
    )
}

// ── Condition Row ────────────────────────────────────────────────────────────

function ConditionRow({
    condition,
    variables,
    readOnly,
    mandatory,
    onChange,
    onMandatoryChange,
    onRemove,
}: {
    condition: RuleCondition
    variables: RuleVariable[]
    readOnly: boolean
    mandatory: boolean
    onChange: (c: RuleCondition) => void
    onMandatoryChange: (v: boolean) => void
    onRemove: () => void
}) {
    const inp = 'px-2.5 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500'

    if (readOnly) {
        const varLabel = variables.find(v => v.variable_code === condition.field)?.display_name ?? condition.field
        const opLabel = OPERATORS.find(o => o.value === condition.operator)?.label ?? condition.operator
        return (
            <div className="grid grid-cols-12 gap-3 items-center py-2 px-2">
                <div className="col-span-1 flex justify-center">
                    <span className="text-gray-300 text-sm cursor-default">⠿</span>
                </div>
                <div className="col-span-3 text-sm font-medium text-gray-700">{varLabel || '—'}</div>
                <div className="col-span-2 text-sm text-gray-600">{opLabel}</div>
                <div className="col-span-2 text-sm text-gray-600">{condition.value || '—'}</div>
                <div className="col-span-2 text-sm text-gray-600">{condition.weight ?? 0}</div>
                <div className="col-span-2 flex items-center justify-between">
                    <Toggle checked={mandatory} onChange={() => { }} disabled={true} />
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-12 gap-3 items-center py-2 px-2 hover:bg-gray-50/60 rounded-lg transition-colors">
            {/* Drag handle */}
            <div className="col-span-1 flex justify-center">
                <span className="text-gray-400 cursor-grab text-sm select-none">⠿</span>
            </div>

            {/* Field */}
            <div className="col-span-3">
                <select
                    value={condition.field}
                    onChange={e => onChange({ ...condition, field: e.target.value })}
                    className={`w-full ${inp}`}
                >
                    <option value="">Select variable…</option>
                    {variables.map(v => (
                        <option key={v.variable_code} value={v.variable_code}>
                            {v.display_name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Operator */}
            <div className="col-span-2">
                <select
                    value={condition.operator}
                    onChange={e => onChange({ ...condition, operator: e.target.value })}
                    className={`w-full ${inp}`}
                >
                    {OPERATORS.map(op => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                </select>
            </div>

            {/* Value */}
            <div className="col-span-2">
                <input
                    value={condition.value}
                    onChange={e => onChange({ ...condition, value: e.target.value })}
                    placeholder="Value"
                    className={`w-full ${inp}`}
                />
            </div>

            {/* Weight */}
            <div className="col-span-2">
                <input
                    type="number"
                    value={condition.weight ?? 0}
                    onChange={e => onChange({ ...condition, weight: e.target.value ? Number(e.target.value) : 0 })}
                    placeholder="0"
                    className={`w-full ${inp}`}
                />
            </div>

            {/* Mandatory + Remove */}
            <div className="col-span-2 flex items-center justify-between">
                <Toggle checked={mandatory} onChange={onMandatoryChange} />
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-gray-400 hover:text-red-500 transition-colors ml-2"
                    title="Remove condition"
                >
                    <span className="material-symbols-outlined text-lg">close</span>
                </button>
            </div>
        </div>
    )
}

// ── Group Node ───────────────────────────────────────────────────────────────

function GroupNode({
    node,
    variables,
    readOnly,
    mandatoryFlags,
    onChange,
    onRemove,
    onMandatoryFlagsChange,
    depth,
}: {
    node: RulesTreeNode
    variables: RuleVariable[]
    readOnly: boolean
    mandatoryFlags: boolean[]
    onChange: (n: RulesTreeNode) => void
    onRemove?: () => void
    onMandatoryFlagsChange: (flags: boolean[]) => void
    depth: number
}) {
    const updateRule = (index: number, updated: RuleCondition | RulesTreeNode) => {
        const rules = [...node.rules]
        rules[index] = updated
        onChange({ ...node, rules })
    }

    const removeRule = (index: number) => {
        const rules = node.rules.filter((_, i) => i !== index)
        const flags = mandatoryFlags.filter((_, i) => i !== index)
        onChange({ ...node, rules })
        onMandatoryFlagsChange(flags)
    }

    const addCondition = () => {
        onChange({ ...node, rules: [...node.rules, newCondition()] })
        onMandatoryFlagsChange([...mandatoryFlags, false])
    }

    const addGroup = () => {
        onChange({ ...node, rules: [...node.rules, newGroup()] })
        onMandatoryFlagsChange([...mandatoryFlags, false])
    }

    const groupLabel = depth === 0 ? 'Global Requirement Group' : `Nested Group (Level ${depth + 1})`

    return (
        <div className={`border border-gray-200 rounded-xl bg-white ${depth > 0 ? 'ml-4 mt-2' : ''}`}>
            {/* Group header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                <div className="flex items-center gap-3">
                    <CombinatorPills
                        value={node.combinator}
                        onChange={c => onChange({ ...node, combinator: c })}
                        readOnly={readOnly}
                    />
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{groupLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                    {!readOnly && onRemove && (
                        <button
                            type="button"
                            onClick={onRemove}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete group"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-3 items-center px-6 py-2 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                <div className="col-span-1" />
                <div className="col-span-3">Field</div>
                <div className="col-span-2">Operator</div>
                <div className="col-span-2">Value</div>
                <div className="col-span-2">Weight</div>
                <div className="col-span-2">Mandatory</div>
            </div>

            {/* Rules */}
            <div className="px-3 py-1">
                {node.rules.map((rule, i) =>
                    isRulesTreeGroup(rule) ? (
                        <GroupNode
                            key={i}
                            node={rule}
                            variables={variables}
                            readOnly={readOnly}
                            mandatoryFlags={[]}
                            onChange={updated => updateRule(i, updated)}
                            onRemove={() => removeRule(i)}
                            onMandatoryFlagsChange={() => { }}
                            depth={depth + 1}
                        />
                    ) : (
                        <ConditionRow
                            key={i}
                            condition={rule}
                            variables={variables}
                            readOnly={readOnly}
                            mandatory={mandatoryFlags[i] ?? false}
                            onChange={updated => updateRule(i, updated)}
                            onMandatoryChange={v => {
                                const flags = [...mandatoryFlags]
                                flags[i] = v
                                onMandatoryFlagsChange(flags)
                            }}
                            onRemove={() => removeRule(i)}
                        />
                    )
                )}
            </div>

            {/* Add buttons */}
            {!readOnly && (
                <div className="flex gap-3 px-5 py-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={addCondition}
                        className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-blue-600 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">add</span>
                        Add Condition
                    </button>
                    <button
                        type="button"
                        onClick={addGroup}
                        className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-500 hover:text-purple-600 transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        Add Group
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Active Rule Inventory ───────────────────────────────────────────────────

function ActiveRuleInventory({ rules }: { rules: ProgrammeRule[] }) {
    if (!rules.length) return null

    const activeRules = rules.filter(r => r.rule_type === 'variable')

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-500 text-lg">history</span>
                    <h3 className="font-bold text-gray-800">Active Rule Inventory</h3>
                </div>
                <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {activeRules.length} Total Rules
                </span>
            </div>

            <div className="space-y-3">
                {activeRules.map(rule => (
                    <div key={rule.programme_rule_id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">
                                    Code: {rule.rule_code ?? rule.variable_code ?? '—'}
                                </p>
                                <p className="font-bold text-gray-900">
                                    {(rule.variable_code ?? rule.rule_code ?? 'Unnamed').replace(/_/g, ' ')} Requirement
                                </p>
                            </div>
                            <span className="text-xs font-bold uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded">
                                {rule.rule_type === 'group' ? 'Group' : 'Demographic'}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Operator</p>
                                <p className="text-sm font-semibold text-gray-700">{rule.operator ?? '—'} {rule.threshold_value ?? ''}</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Weight</p>
                                <p className="text-sm font-semibold text-gray-700">{rule.weight}% Points</p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-0.5">Status</p>
                                <p className="text-sm font-bold text-green-600">ACTIVE</p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100">
                            <button className="text-gray-400 hover:text-gray-600 transition-colors" title="Duplicate rule">
                                <span className="material-symbols-outlined text-lg">content_copy</span>
                            </button>
                            <button className="text-gray-400 hover:text-red-500 transition-colors" title="Delete rule">
                                <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Main RuleBuilder Component ───────────────────────────────────────────────

interface RuleBuilderProps {
    value: RulesTreeNode
    onChange: (tree: RulesTreeNode | null) => void
    variables: RuleVariable[]
    readOnly: boolean
    status?: 'DRAFT' | 'ACTIVE' | 'INACTIVE'
    programmeRules?: ProgrammeRule[]
}

export default function RuleBuilder({ value, onChange, variables, readOnly, status = 'DRAFT', programmeRules = [] }: RuleBuilderProps) {
    const [mandatoryFlags, setMandatoryFlags] = useState<boolean[]>(
        () => value.rules.map(() => false)
    )

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-500 text-lg">account_tree</span>
                    <h3 className="font-bold text-gray-800">Visual Rule Builder</h3>
                </div>
                <span className={`text-xs font-bold uppercase px-3 py-1 rounded border ${status === 'ACTIVE'
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : status === 'DRAFT'
                            ? 'text-red-600 bg-red-50 border-red-200'
                            : 'text-gray-500 bg-gray-50 border-gray-200'
                    }`}>
                    {status === 'DRAFT' ? 'Draft Mode' : status}
                </span>
            </div>

            {/* Rule tree */}
            <GroupNode
                node={value}
                variables={variables}
                readOnly={readOnly}
                mandatoryFlags={mandatoryFlags}
                onChange={onChange}
                onMandatoryFlagsChange={setMandatoryFlags}
                depth={0}
            />

            {/* Active Rule Inventory */}
            <ActiveRuleInventory rules={programmeRules} />
        </div>
    )
}
