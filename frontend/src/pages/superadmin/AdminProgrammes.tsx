/**
 * ADMIN PROGRAMMES PAGE
 * 
 * Two-level view:
 * 1. Master table of programmes (sortable by type)
 * 2. Programme details view with family segments (Enrolled, Eligible, Benefits Received)
 */

import { useState, useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import {
  PageHeader,
  DataTable,
  SearchInput,
  FilterSelect,
  Pagination,
  Tabs,
  ActionButton,
  Badge,
  StatCard,
  usePagination,
  useSort,
  type Column,
} from '@/components/admin/shared'
import {
  programmes,
  getProgrammeFamilies,
  getProgrammeFamiliesBySegment,
  formatCurrency,
  formatDate,
  exportToCSV,
  type Programme,
  type ProgrammeFamilyMapping,
  type ProgrammeType,
} from '@/mock/superAdminMockData'

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'

function getStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'ACTIVE': return 'success'
    case 'SUSPENDED': return 'warning'
    case 'INACTIVE': return 'error'
    case 'COMPLETED': return 'default'
    default: return 'default'
  }
}

function getProgrammeTypeLabel(type: ProgrammeType): string {
  const labels: Record<ProgrammeType, string> = {
    CASH_TRANSFER: 'Cash Transfer',
    FOOD_SECURITY: 'Food Security',
    HEALTH: 'Health',
    EDUCATION: 'Education',
    HOUSING: 'Housing',
    EMPLOYMENT: 'Employment',
  }
  return labels[type]
}

export default function AdminProgrammes() {
  // Pure permission-based checks from JWT - no role names!
  const { hasPermission } = useAuthStore()
  
  const canExport = hasPermission('ADMIN.PROGRAMMES.EXPORT')

  // View state
  const [selectedProgramme, setSelectedProgramme] = useState<Programme | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Programme details state
  const [familySegment, setFamilySegment] = useState<'enrolled' | 'eligible' | 'benefits_received'>('enrolled')
  const [familySearch, setFamilySearch] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  // Filter programmes
  const filteredProgrammes = useMemo(() => {
    return programmes.filter(prog => {
      const matchesSearch = !searchQuery ||
        prog.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prog.id.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = !typeFilter || prog.programmeType === typeFilter
      const matchesStatus = !statusFilter || prog.status === statusFilter
      
      return matchesSearch && matchesType && matchesStatus
    })
  }, [searchQuery, typeFilter, statusFilter])

  // Sort programmes
  const { data: sortedProgrammes, sortColumn, sortDirection, handleSort } = useSort(filteredProgrammes, 'name')

  // Pagination for programmes
  const programmePagination = usePagination(sortedProgrammes, 10)

  // Get families for selected programme
  const programmeFamilies = useMemo(() => {
    if (!selectedProgramme) return []
    const families = getProgrammeFamiliesBySegment(selectedProgramme.id, familySegment)
    
    return families.filter(family => {
      const matchesSearch = !familySearch ||
        family.familyName.toLowerCase().includes(familySearch.toLowerCase()) ||
        family.familyId.toLowerCase().includes(familySearch.toLowerCase())
      
      const matchesRegion = !regionFilter || family.region === regionFilter
      
      return matchesSearch && matchesRegion
    })
  }, [selectedProgramme, familySegment, familySearch, regionFilter])

  // Pagination for families
  const familyPagination = usePagination(programmeFamilies, 10)

  // Programme columns
  const programmeColumns: Column<Programme>[] = [
    {
      key: 'id',
      label: 'ID',
      sortable: true,
      render: (prog) => <span className="font-mono text-sm">{prog.id}</span>,
    },
    {
      key: 'name',
      label: 'Programme Name',
      sortable: true,
      render: (prog) => (
        <div>
          <p className="font-medium">{prog.name}</p>
          <p className="text-xs text-gray-500 truncate max-w-xs">{prog.description}</p>
        </div>
      ),
    },
    {
      key: 'programmeType',
      label: 'Type',
      sortable: true,
      render: (prog) => (
        <Badge variant="info">{getProgrammeTypeLabel(prog.programmeType)}</Badge>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (prog) => <Badge variant={getStatusVariant(prog.status)}>{prog.status}</Badge>,
    },
    {
      key: 'enrolledCount',
      label: 'Enrolled',
      sortable: true,
      render: (prog) => prog.enrolledCount.toLocaleString(),
    },
    {
      key: 'eligibleCount',
      label: 'Eligible',
      sortable: true,
      render: (prog) => prog.eligibleCount.toLocaleString(),
    },
    {
      key: 'benefitsDisbursed',
      label: 'Disbursed',
      sortable: true,
      render: (prog) => formatCurrency(prog.benefitsDisbursed),
    },
    {
      key: 'lastUpdated',
      label: 'Last Updated',
      sortable: true,
      render: (prog) => formatDate(prog.lastUpdated, 'relative'),
    },
  ]

  // Family columns
  const familyColumns: Column<ProgrammeFamilyMapping>[] = [
    {
      key: 'familyId',
      label: 'Family ID',
      render: (f) => <span className="font-mono font-medium text-primary">{f.familyId}</span>,
    },
    {
      key: 'familyName',
      label: 'Family Name',
      render: (f) => f.familyName,
    },
    {
      key: 'region',
      label: 'Region',
      render: (f) => f.region,
    },
    {
      key: 'enrollmentStatus',
      label: 'Status',
      render: (f) => (
        <Badge variant={f.enrollmentStatus === 'ENROLLED' ? 'success' : f.enrollmentStatus === 'ELIGIBLE' ? 'info' : 'warning'}>
          {f.enrollmentStatus}
        </Badge>
      ),
    },
    {
      key: 'benefitsReceivedCount',
      label: 'Benefits Received',
      render: (f) => f.benefitsReceivedCount || '—',
    },
    {
      key: 'benefitsReceivedAmount',
      label: 'Total Amount',
      render: (f) => f.benefitsReceivedAmount ? formatCurrency(f.benefitsReceivedAmount) : '—',
    },
    {
      key: 'lastBenefitDate',
      label: 'Last Benefit',
      render: (f) => formatDate(f.lastBenefitDate, 'short'),
    },
    {
      key: 'enrolledAt',
      label: 'Enrolled',
      render: (f) => formatDate(f.enrolledAt, 'short'),
    },
  ]

  const programmeTypeOptions = [
    { value: 'CASH_TRANSFER', label: 'Cash Transfer' },
    { value: 'FOOD_SECURITY', label: 'Food Security' },
    { value: 'HEALTH', label: 'Health' },
    { value: 'EDUCATION', label: 'Education' },
    { value: 'HOUSING', label: 'Housing' },
    { value: 'EMPLOYMENT', label: 'Employment' },
  ]

  const statusOptions = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
    { value: 'SUSPENDED', label: 'Suspended' },
    { value: 'COMPLETED', label: 'Completed' },
  ]

  const regionOptions = [
    { value: 'Kingston', label: 'Kingston' },
    { value: 'St. Andrew', label: 'St. Andrew' },
    { value: 'St. Catherine', label: 'St. Catherine' },
    { value: 'Clarendon', label: 'Clarendon' },
    { value: 'Manchester', label: 'Manchester' },
    { value: 'St. Elizabeth', label: 'St. Elizabeth' },
    { value: 'Westmoreland', label: 'Westmoreland' },
    { value: 'Hanover', label: 'Hanover' },
    { value: 'St. James', label: 'St. James' },
    { value: 'Trelawny', label: 'Trelawny' },
    { value: 'St. Ann', label: 'St. Ann' },
    { value: 'Portland', label: 'Portland' },
    { value: 'St. Mary', label: 'St. Mary' },
    { value: 'St. Thomas', label: 'St. Thomas' },
  ]

  const handleExportProgrammes = () => {
    exportToCSV(
      filteredProgrammes,
      'programmes_export',
      [
        { key: 'id', label: 'ID' },
        { key: 'name', label: 'Name' },
        { key: 'programmeType', label: 'Type' },
        { key: 'status', label: 'Status' },
        { key: 'enrolledCount', label: 'Enrolled' },
        { key: 'eligibleCount', label: 'Eligible' },
        { key: 'benefitsDisbursed', label: 'Disbursed' },
        { key: 'lastUpdated', label: 'Last Updated' },
      ]
    )
  }

  const handleExportFamilies = () => {
    if (!selectedProgramme) return
    exportToCSV(
      programmeFamilies,
      `${selectedProgramme.id}_families_${familySegment}`,
      [
        { key: 'familyId', label: 'Family ID' },
        { key: 'familyName', label: 'Family Name' },
        { key: 'region', label: 'Region' },
        { key: 'enrollmentStatus', label: 'Status' },
        { key: 'benefitsReceivedCount', label: 'Benefits Count' },
        { key: 'benefitsReceivedAmount', label: 'Total Amount' },
        { key: 'lastBenefitDate', label: 'Last Benefit' },
        { key: 'enrolledAt', label: 'Enrolled Date' },
      ]
    )
  }

  // Programme Details View
  if (selectedProgramme) {
    const allFamilies = getProgrammeFamilies(selectedProgramme.id)
    const enrolledFamilies = allFamilies.filter(f => f.enrollmentStatus === 'ENROLLED')
    const eligibleFamilies = allFamilies.filter(f => f.enrollmentStatus === 'ELIGIBLE' || f.enrollmentStatus === 'PENDING')
    const benefitsReceived = allFamilies.filter(f => f.benefitsReceivedCount > 0)

    return (
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <PageHeader
            title={selectedProgramme.name}
            subtitle={selectedProgramme.description}
            breadcrumb={[
              { label: 'Programmes', href: '#' },
              { label: selectedProgramme.name },
            ]}
            actions={
              <div className="flex gap-2">
                {canExport && (
                  <ActionButton
                    onClick={handleExportFamilies}
                    icon="download"
                    label="Export"
                    variant="secondary"
                  />
                )}
                <ActionButton
                  onClick={() => setSelectedProgramme(null)}
                  icon="arrow_back"
                  label="Back to Programmes"
                  variant="ghost"
                />
              </div>
            }
          />

          {/* Programme Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Status"
              value={selectedProgramme.status}
              icon="info"
            />
            <StatCard
              label="Enrolled Families"
              value={selectedProgramme.enrolledCount.toLocaleString()}
              icon="group"
            />
            <StatCard
              label="Eligible Families"
              value={selectedProgramme.eligibleCount.toLocaleString()}
              icon="check_circle"
            />
            <StatCard
              label="Total Disbursed"
              value={formatCurrency(selectedProgramme.benefitsDisbursed)}
              icon="payments"
            />
          </div>

          {/* Segment Tabs */}
          <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <Tabs
              tabs={[
                { id: 'enrolled', label: 'Enrolled', count: enrolledFamilies.length },
                { id: 'benefits_received', label: 'Benefits Received', count: benefitsReceived.length },
                { id: 'eligible', label: 'Eligible', count: eligibleFamilies.length },
              ]}
              activeTab={familySegment}
              onChange={(tab) => setFamilySegment(tab as typeof familySegment)}
            />

            {/* Family Filters */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <SearchInput
                    value={familySearch}
                    onChange={setFamilySearch}
                    placeholder="Search families..."
                  />
                </div>
                <FilterSelect
                  value={regionFilter}
                  onChange={setRegionFilter}
                  options={regionOptions}
                  placeholder="All Regions"
                />
              </div>
            </div>

            {/* Families Table */}
            <div className="p-4">
              <DataTable
                data={familyPagination.data}
                columns={familyColumns}
                keyExtractor={(f) => f.id}
                emptyMessage={`No ${familySegment.replace('_', ' ')} families found`}
              />

              {familyPagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={familyPagination.currentPage}
                    totalPages={familyPagination.totalPages}
                    totalItems={familyPagination.totalItems}
                    itemsPerPage={familyPagination.itemsPerPage}
                    onPageChange={familyPagination.goToPage}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Programmes Master View
  return (
    <div className="p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          title="Programmes"
          subtitle={`${filteredProgrammes.length} programmes in the system`}
          actions={
            canExport && (
              <ActionButton
                onClick={handleExportProgrammes}
                icon="download"
                label="Export CSV"
                variant="secondary"
              />
            )
          }
        />

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-t-lg border border-b-0 border-gray-200 dark:border-gray-800 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search programmes..."
              />
            </div>
            <FilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={programmeTypeOptions}
              placeholder="All Types"
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Statuses"
            />
          </div>
        </div>

        {/* Table */}
        <DataTable
          data={programmePagination.data}
          columns={programmeColumns}
          keyExtractor={(prog) => prog.id}
          onRowClick={setSelectedProgramme}
          emptyMessage="No programmes found"
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        {/* Pagination */}
        {programmePagination.totalPages > 1 && (
          <Pagination
            currentPage={programmePagination.currentPage}
            totalPages={programmePagination.totalPages}
            totalItems={programmePagination.totalItems}
            itemsPerPage={programmePagination.itemsPerPage}
            onPageChange={programmePagination.goToPage}
          />
        )}
      </div>
    </div>
  )
}
