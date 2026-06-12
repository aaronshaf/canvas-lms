/*
 * Copyright (C) 2026 - present Instructure, Inc.
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

import React, {useState, useEffect, useRef} from 'react'
import {useScope as createI18nScope} from '@canvas/i18n'
import {View} from '@instructure/ui-view'
import {Text} from '@instructure/ui-text'
import {TextInput} from '@instructure/ui-text-input'
import {Button, IconButton} from '@instructure/ui-buttons'
import {Flex} from '@instructure/ui-flex'
import {
  IconEditLine,
  IconTrashLine,
  IconCheckMarkLine,
  IconXLine,
  IconPlusLine,
} from '@instructure/ui-icons'
import type {GlobalEnv} from '@canvas/global/env/GlobalEnv'

declare const ENV: GlobalEnv & {AI_EXPERIENCES_FIELD_MAX_LENGTH?: number}

const I18n = createI18nScope('ai_experiences_edit')

const TEACHER_AUTHORED_FIELD_MAX = ENV?.AI_EXPERIENCES_FIELD_MAX_LENGTH ?? 10_000
export const LEARNING_OBJECTIVES_MAX_COUNT = 10

interface LearningObjectivesInputProps {
  objectives: string[]
  onChange: (objectives: string[]) => void
  error?: string
}

const LearningObjectivesInput: React.FC<LearningObjectivesInputProps> = ({
  objectives,
  onChange,
  error,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [draftValue, setDraftValue] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const addBtnRef = useRef<HTMLButtonElement | null>(null)
  const editBtnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const deleteBtnRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (isAdding || editingIndex !== null) {
      inputRef.current?.focus()
    }
  }, [isAdding, editingIndex])

  const validateDraft = (): boolean => {
    const trimmed = draftValue.trim()
    if (!trimmed) {
      setDraftError(I18n.t('Talking point cannot be blank'))
      return false
    }
    if (trimmed.length > TEACHER_AUTHORED_FIELD_MAX) {
      setDraftError(
        I18n.t('Talking point must be %{max} characters or fewer', {
          max: TEACHER_AUTHORED_FIELD_MAX,
        }),
      )
      return false
    }
    return true
  }

  const handleStartAdd = () => {
    setIsAdding(true)
    setEditingIndex(null)
    setDraftValue('')
    setDraftError(null)
  }

  const handleConfirmAdd = () => {
    if (!validateDraft()) return
    const newObjectives = [...objectives, draftValue.trim()]
    onChange(newObjectives)
    setDraftValue('')
    setDraftError(null)
    setIsAdding(false)
    const atMax = newObjectives.length >= LEARNING_OBJECTIVES_MAX_COUNT
    setTimeout(() => {
      if (atMax) {
        editBtnRefs.current[newObjectives.length - 1]?.focus()
      } else {
        addBtnRef.current?.focus()
      }
    }, 0)
  }

  const handleCancelAdd = () => {
    setDraftValue('')
    setDraftError(null)
    setIsAdding(false)
    setTimeout(() => addBtnRef.current?.focus(), 0)
  }

  const handleStartEdit = (index: number) => {
    setEditingIndex(index)
    setIsAdding(false)
    setDraftValue(objectives[index])
    setDraftError(null)
  }

  const handleConfirmEdit = () => {
    if (editingIndex === null || !validateDraft()) return
    const idx = editingIndex
    const updated = [...objectives]
    updated[idx] = draftValue.trim()
    onChange(updated)
    setEditingIndex(null)
    setDraftValue('')
    setDraftError(null)
    setTimeout(() => editBtnRefs.current[idx]?.focus(), 0)
  }

  const handleCancelEdit = () => {
    const idx = editingIndex
    setEditingIndex(null)
    setDraftValue('')
    setDraftError(null)
    setTimeout(() => editBtnRefs.current[idx!]?.focus(), 0)
  }

  const handleDelete = (index: number) => {
    const remaining = objectives.filter((_, i) => i !== index)
    onChange(remaining)
    setTimeout(() => {
      if (remaining.length === 0) {
        addBtnRef.current?.focus()
      } else {
        const focusIndex = Math.min(index, remaining.length - 1)
        deleteBtnRefs.current[focusIndex]?.focus()
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent, onConfirm: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onConfirm()
    }
  }

  const canAdd = !isAdding && objectives.length < LEARNING_OBJECTIVES_MAX_COUNT

  const inlineRow = (onConfirm: () => void, onCancel: () => void, testIdSuffix: string) => (
    <View
      as="div"
      display="block"
      borderWidth="small"
      borderRadius="medium"
      padding="small"
      margin="0 0 x-small 0"
    >
      <Flex gap="x-small" alignItems="end">
        <Flex.Item shouldGrow>
          <TextInput
            data-testid="learning-objectives-input"
            renderLabel={I18n.t('Talking point:')}
            value={draftValue}
            onChange={(_e, val) => {
              setDraftValue(val)
              setDraftError(null)
            }}
            onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, onConfirm)}
            inputRef={el => {
              inputRef.current = el
            }}
            messages={draftError ? [{type: 'newError' as const, text: draftError}] : []}
          />
        </Flex.Item>
        <Flex.Item>
          <IconButton
            data-testid={`learning-objectives-confirm-btn${testIdSuffix}`}
            screenReaderLabel={I18n.t('Save talking point')}
            onClick={onConfirm}
            color="primary"
          >
            <IconCheckMarkLine />
          </IconButton>
        </Flex.Item>
        <Flex.Item>
          <IconButton
            data-testid={`learning-objectives-cancel-btn${testIdSuffix}`}
            screenReaderLabel={I18n.t('Cancel')}
            onClick={onCancel}
          >
            <IconXLine />
          </IconButton>
        </Flex.Item>
      </Flex>
    </View>
  )

  return (
    <View as="div">
      {objectives.map((obj, index) =>
        editingIndex === index ? (
          <View
            key={index}
            as="div"
            display="block"
            data-testid={`learning-objectives-row-${index}`}
          >
            {inlineRow(handleConfirmEdit, handleCancelEdit, `-${index}`)}
          </View>
        ) : (
          <View
            key={index}
            as="div"
            display="block"
            background="secondary"
            borderWidth="small"
            borderRadius="medium"
            padding="small"
            margin="0 0 x-small 0"
            data-testid={`learning-objectives-row-${index}`}
          >
            <Flex justifyItems="space-between" alignItems="center">
              <Flex.Item shouldGrow>
                <Text>{obj}</Text>
              </Flex.Item>
              <Flex.Item>
                <IconButton
                  data-testid={`learning-objectives-edit-btn-${index}`}
                  screenReaderLabel={I18n.t('Edit talking point: %{objective}', {objective: obj})}
                  onClick={() => handleStartEdit(index)}
                  withBackground={false}
                  withBorder={false}
                  elementRef={el => {
                    editBtnRefs.current[index] = el as HTMLButtonElement | null
                  }}
                >
                  <IconEditLine />
                </IconButton>
              </Flex.Item>
              <Flex.Item>
                <IconButton
                  data-testid={`learning-objectives-delete-btn-${index}`}
                  screenReaderLabel={I18n.t('Delete talking point: %{objective}', {objective: obj})}
                  onClick={() => handleDelete(index)}
                  withBackground={false}
                  withBorder={false}
                  color="danger"
                  elementRef={el => {
                    deleteBtnRefs.current[index] = el as HTMLButtonElement | null
                  }}
                >
                  <IconTrashLine />
                </IconButton>
              </Flex.Item>
            </Flex>
          </View>
        ),
      )}

      {isAdding && inlineRow(handleConfirmAdd, handleCancelAdd, '')}

      {canAdd && (
        <Button
          data-testid="learning-objectives-add-btn"
          renderIcon={<IconPlusLine />}
          onClick={handleStartAdd}
          elementRef={el => {
            addBtnRef.current = el as HTMLButtonElement | null
          }}
        >
          {I18n.t('Add talking point')}
        </Button>
      )}

      {error && (
        <View as="div" margin="x-small 0 0 0">
          <Text color="danger" size="small">
            {error}
          </Text>
        </View>
      )}
    </View>
  )
}

export default LearningObjectivesInput
