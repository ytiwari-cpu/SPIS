import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { PublicNotice } from '@/types'
import { NoticeCategory } from '@/types'

// Mock notices data
const mockNotices: PublicNotice[] = [
  {
    id: '1',
    title: 'New Social Security Programme Announced',
    summary: 'The government has launched a new social security initiative to support vulnerable families across the nation.',
    content: `
      <p>We are pleased to announce the launch of a comprehensive new social security programme designed to provide enhanced support to vulnerable families across the nation.</p>
      
      <h3>Key Features:</h3>
      <ul>
        <li>Monthly cash transfers for eligible families</li>
        <li>Healthcare coverage subsidies</li>
        <li>Education support for children</li>
        <li>Vocational training opportunities</li>
      </ul>
      
      <h3>Eligibility:</h3>
      <p>Families meeting the following criteria may apply:</p>
      <ul>
        <li>Household income below the national threshold</li>
        <li>Valid family registration in the SPIS system</li>
        <li>At least one dependent child or elderly member</li>
      </ul>
      
      <p>Applications can be submitted through the Citizen Portal starting March 1, 2026.</p>
    `,
    category: 'GOVERNMENT' as NoticeCategory,
    is_pinned: true,
    published_at: '2026-02-08T10:00:00Z',
    expires_at: null,
    attachments: [
      {
        id: 'att_1',
        notice_id: '1',
        file_name: 'Programme_Guidelines_2026.pdf',
        file_url: '#',
        file_size: 245000,
      },
    ],
  },
  {
    id: '2',
    title: 'Education Grant Applications Now Open',
    summary: 'Applications for the 2026 Education Grant programme are now being accepted. Deadline: March 15, 2026.',
    content: `
      <p>The Ministry of Education announces the opening of applications for the 2026 Education Grant Programme.</p>
      
      <h3>Grant Details:</h3>
      <ul>
        <li>Primary Education: Up to $500 per student</li>
        <li>Secondary Education: Up to $1,000 per student</li>
        <li>Higher Education: Up to $2,500 per student</li>
      </ul>
      
      <h3>Application Deadline: March 15, 2026</h3>
      
      <p>Registered families can apply through the Citizen Portal under the Programmes section.</p>
    `,
    category: 'PROGRAMME' as NoticeCategory,
    is_pinned: false,
    published_at: '2026-02-05T09:00:00Z',
    expires_at: null,
    attachments: [],
  },
  {
    id: '3',
    title: 'System Maintenance Notice',
    summary: 'Scheduled maintenance on February 15, 2026 from 2:00 AM to 6:00 AM. Services may be temporarily unavailable.',
    content: `
      <p>Please be advised that scheduled system maintenance will be performed on February 15, 2026.</p>
      
      <h3>Maintenance Window:</h3>
      <p>Date: February 15, 2026<br/>Time: 2:00 AM - 6:00 AM (Local Time)</p>
      
      <h3>Affected Services:</h3>
      <ul>
        <li>Citizen Portal login and registration</li>
        <li>Document uploads</li>
        <li>Application submissions</li>
      </ul>
      
      <p>We apologize for any inconvenience and appreciate your patience.</p>
    `,
    category: 'GENERAL' as NoticeCategory,
    is_pinned: false,
    published_at: '2026-02-01T14:00:00Z',
    expires_at: null,
    attachments: [],
  },
]

export default function NoticesPageContent() {
  const { id } = useParams()
  const [notices, setNotices] = useState<PublicNotice[]>([])
  const [selectedNotice, setSelectedNotice] = useState<PublicNotice | null>(null)
  const [activeCategory, setActiveCategory] = useState<NoticeCategory | 'ALL'>('ALL')

  useEffect(() => {
    setNotices(mockNotices)
    if (id) {
      const notice = mockNotices.find((n) => n.id === id)
      setSelectedNotice(notice || null)
    }
  }, [id])

  const categories: (NoticeCategory | 'ALL')[] = ['ALL', NoticeCategory.GOVERNMENT, NoticeCategory.PROGRAMME, NoticeCategory.EMERGENCY, NoticeCategory.GENERAL]

  const getCategoryBadge = (category: NoticeCategory) => {
    const styles = {
      GOVERNMENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      PROGRAMME: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      EMERGENCY: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      GENERAL: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    }
    return styles[category] || styles.GENERAL
  }

  const filteredNotices = activeCategory === 'ALL' 
    ? notices 
    : notices.filter((n) => n.category === activeCategory)

  if (selectedNotice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to="/notices"
          className="inline-flex items-center gap-2 text-primary font-medium mb-6 hover:underline"
          onClick={() => setSelectedNotice(null)}
        >
          <span className="material-symbols-outlined">arrow_back</span>
          Back to Notices
        </Link>

        <article className="bg-white dark:bg-gray-900 rounded-xl p-6 md:p-8 border border-gray-200 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getCategoryBadge(selectedNotice.category)}`}>
              {selectedNotice.category}
            </span>
            {selectedNotice.is_pinned && (
              <span className="text-amber-500 flex items-center gap-1 text-xs">
                <span className="material-symbols-outlined text-sm">push_pin</span>
                Pinned
              </span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {selectedNotice.title}
          </h1>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Published: {new Date(selectedNotice.published_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>

          <div 
            className="prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
          />

          {selectedNotice.attachments.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Attachments</h3>
              <div className="space-y-2">
                {selectedNotice.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.file_url}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-primary">description</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {attachment.file_name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(attachment.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-gray-400">download</span>
                  </a>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-6">
        Public Notices
      </h1>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeCategory === category
                ? 'bg-primary text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {category === 'ALL' ? 'All Notices' : category}
          </button>
        ))}
      </div>

      {/* Notices List */}
      <div className="space-y-4">
        {filteredNotices.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-700 mb-4">
              campaign_off
            </span>
            <p className="text-gray-500 dark:text-gray-400">No notices found for this category.</p>
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <Link
              key={notice.id}
              to={`/notices/${notice.id}`}
              className="block bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                <div className="hidden sm:flex w-12 h-12 shrink-0 rounded-full bg-primary/10 items-center justify-center">
                  <span className="material-symbols-outlined text-primary">
                    {notice.category === 'EMERGENCY' ? 'warning' : 'campaign'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${getCategoryBadge(notice.category)}`}>
                      {notice.category}
                    </span>
                    {notice.is_pinned && (
                      <span className="text-amber-500 flex items-center gap-1 text-xs">
                        <span className="material-symbols-outlined text-sm">push_pin</span>
                        Pinned
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                    {notice.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {notice.summary}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(notice.published_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <span className="material-symbols-outlined text-gray-400 shrink-0">
                  arrow_forward
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
