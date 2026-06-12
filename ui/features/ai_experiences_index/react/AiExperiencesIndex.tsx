/*
 * Copyright (C) 2025 - present Instructure, Inc.
 *
 * This file is part of Canvas.
 *
 * Canvas is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the Free
 * Software Foundation, version 3 of the License.
 *
 * Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
 * A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
 * details.
 *
 * You should have received a copy of the GNU Affero General Public License along
 * with this program. If not, see <http://www.gnu.org/licenses/>.
 */

import React, {useEffect, useState, useRef} from 'react'
import {useScope as useI18nScope} from '@canvas/i18n'
import {Heading} from '@instructure/ui-heading'
import {View} from '@instructure/ui-view'
import {Flex} from '@instructure/ui-flex'
import {Spinner} from '@instructure/ui-spinner'
import {Text} from '@instructure/ui-text'
import {Button} from '@instructure/ui-buttons'
import {Modal} from '@instructure/ui-modal'
import {Pagination} from '@instructure/ui-pagination'
import {IconAiColoredSolid} from '@instructure/ui-icons'
import AddExperienceButton from '@canvas/ai-experiences/react/components/AddExperienceButton'
import {showFlashError} from '@instructure/platform-alerts'
import doFetchApi from '@canvas/do-fetch-api-effect'
import AIExperienceList from './components/AIExperienceList'
import AIExperiencesEmptyState from './components/AIExperiencesEmptyState'
import type {AiExperience} from './types'
import sanitizeUrl from '@canvas/util/sanitizeUrl'

const AiExperiencesIndex: React.FC = () => {
  const I18n = useI18nScope('ai_experiences')
  const [experiences, setExperiences] = useState<AiExperience[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [canManage, setCanManage] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStudents, setTotalStudents] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState<{id: number; title: string} | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const createButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    const fetchExperiences = async () => {
      try {
        const courseId = ENV.COURSE_ID

        if (!courseId) {
          throw new Error('Could not find course ID in environment')
        }

        const {json: data} = await doFetchApi<{
          experiences: AiExperience[]
          can_manage: boolean
          total_students: number | null
          total_pages: number
          current_page: number
        }>({
          path: `/api/v1/courses/${courseId}/ai_experiences`,
          params: {page: currentPage},
        })

        setExperiences(data!.experiences)
        setCanManage(data!.can_manage)
        setTotalPages(data!.total_pages ?? 1)
        setTotalStudents(data!.total_students ?? 0)
      } catch (err) {
        // TODO: Show flash alert to user for fetch error
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchExperiences()
  }, [currentPage])

  const handleEdit = (id: number) => {
    const courseId = ENV.COURSE_ID
    window.location.href = sanitizeUrl(`/courses/${courseId}/ai_experiences/${id}/edit`)
  }

  const handleDelete = (id: number) => {
    const target = experiences.find(exp => exp.id === id)
    if (target) setDeleteTarget({id, title: target.title})
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    const {id} = deleteTarget
    setIsDeleting(true)
    try {
      const courseId = ENV.COURSE_ID
      await doFetchApi({
        path: `/api/v1/courses/${courseId}/ai_experiences/${id}`,
        method: 'DELETE',
      })
      setExperiences(prev => prev.filter(exp => exp.id !== id))
      setDeleteTarget(null)
      // Focus the next available menu button, or the Create button if the list is now empty
      setTimeout(() => {
        const nextMenu = document.querySelector<HTMLButtonElement>(
          '[data-testid="ai-experience-menu"]',
        )
        if (nextMenu) {
          nextMenu.focus()
        } else {
          createButtonRef.current?.focus()
        }
      }, 0)
    } catch {
      showFlashError(I18n.t('Failed to delete Knowledge check. Please try again.'))()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancelDelete = () => setDeleteTarget(null)

  const handleCreateNew = () => {
    const courseId = ENV.COURSE_ID
    window.location.href = sanitizeUrl(`/courses/${courseId}/ai_experiences/new`)
  }

  if (loading) {
    return (
      <View as="div" textAlign="center" margin="large" aria-live="polite" aria-busy={true}>
        <Spinner renderTitle={I18n.t('Loading Knowledge checks')} />
      </View>
    )
  }

  if (error) {
    return (
      <View as="div" margin="medium">
        <Text color="danger">{I18n.t('Error loading Knowledge checks: %{error}', {error})}</Text>
      </View>
    )
  }

  return (
    <View as="div" margin="medium">
      <View as="div" margin="0 0 medium 0">
        <Flex justifyItems="space-between" alignItems="center">
          <Flex.Item>
            <Flex alignItems="center" gap="small">
              <Flex.Item>
                <IconAiColoredSolid size="small" aria-hidden="true" />
              </Flex.Item>
              <Flex.Item>
                <Heading level="h1">{I18n.t('Knowledge checks')}</Heading>
              </Flex.Item>
            </Flex>
            <View as="div" margin="x-small 0 0 0">
              <Text>
                {canManage
                  ? I18n.t('Guided AI conversations that help gauge what students know')
                  : I18n.t('Conversations with IgniteAI that help you show what you know')}
              </Text>
            </View>
          </Flex.Item>
          {experiences.length > 0 && canManage && (
            <Flex.Item>
              <AddExperienceButton
                data-testid="ai-expriences-index-create-new-button"
                onClick={handleCreateNew}
                elementRef={el => {
                  createButtonRef.current = el
                }}
              />
            </Flex.Item>
          )}
        </Flex>
      </View>

      {experiences.length === 0 ? (
        <AIExperiencesEmptyState canManage={canManage} onCreateNew={handleCreateNew} />
      ) : (
        <>
          <AIExperienceList
            canManage={canManage}
            experiences={experiences}
            totalStudents={totalStudents}
            onEdit={handleEdit}
            onPublishChange={(id, newState) =>
              setExperiences(prev =>
                prev.map(exp => (exp.id === id ? {...exp, workflow_state: newState} : exp)),
              )
            }
            onDelete={handleDelete}
          />
          {totalPages > 1 && (
            <Pagination
              as="nav"
              variant="compact"
              margin="small 0 0 0"
              currentPage={currentPage}
              totalPageNumber={totalPages}
              onPageChange={(page: number) => setCurrentPage(page)}
              labelNext={I18n.t('Next page')}
              labelPrev={I18n.t('Previous page')}
              aria-label={I18n.t('Knowledge checks pagination')}
              data-testid="ai-experiences-pagination"
            />
          )}
        </>
      )}

      <Modal
        open={deleteTarget !== null}
        onDismiss={handleCancelDelete}
        size="small"
        label={I18n.t('Delete Knowledge check')}
        shouldCloseOnDocumentClick={true}
      >
        <Modal.Header>
          <Heading>{I18n.t('Delete Knowledge check')}</Heading>
        </Modal.Header>
        <Modal.Body>
          <Text>
            {I18n.t('Are you sure you want to delete "%{title}"? This action cannot be undone.', {
              title: deleteTarget?.title ?? '',
            })}
          </Text>
        </Modal.Body>
        <Modal.Footer>
          <Button
            data-testid="ai-experience-index-delete-cancel-button"
            onClick={handleCancelDelete}
            margin="0 small 0 0"
          >
            {I18n.t('Cancel')}
          </Button>
          <Button
            data-testid="ai-experience-index-delete-confirm-button"
            onClick={handleConfirmDelete}
            color="danger"
            interaction={isDeleting ? 'disabled' : 'enabled'}
          >
            {isDeleting ? I18n.t('Deleting...') : I18n.t('Delete')}
          </Button>
        </Modal.Footer>
      </Modal>
    </View>
  )
}

export default AiExperiencesIndex
