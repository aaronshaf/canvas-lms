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

// Replaces the inline <script> shipped from the SIS CSV report parameter
// partials (provisioning_csv, sis_export_csv, and any similar reports)
// which used to toggle the `created_by_sis` and `include_deleted`
// checkboxes' `disabled` state based on whether any of the other
// CSV-selection checkboxes were checked. After CFA-865 the
// dangerouslySetInnerHTML sink is wrapped in DOMPurify, which strips
// the inline <script>, so we wire the same behavior up natively here.

import {useEffect, type RefObject} from 'react'

interface Props {
  // Ref to the container div that holds the server-rendered form
  // (i.e. `RunReportForm`'s `formRef`). The toggle component looks for
  // any `<form>` inside it.
  containerRef: RefObject<HTMLDivElement | null>
}

const DEPENDENT_IDS = ['parameters_created_by_sis', 'parameters_include_deleted'] as const

const applyToggle = (form: HTMLFormElement) => {
  const dependents = DEPENDENT_IDS.map(id => form.querySelector<HTMLInputElement>(`#${id}`)).filter(
    (el): el is HTMLInputElement => el !== null,
  )

  // The "controlling" checkboxes are every checkbox in the form that
  // isn't one of the dependents. Matches the original ERB script's
  // `:not(#parameters_created_by_sis):not(#parameters_include_deleted)`
  // selector.
  const controllers = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
  ).filter(cb => !DEPENDENT_IDS.includes(cb.id as (typeof DEPENDENT_IDS)[number]))

  const anyChecked = controllers.some(cb => cb.checked)

  dependents.forEach(dep => {
    dep.disabled = !anyChecked
    if (!anyChecked) {
      dep.checked = false
    }
  })
}

export default function SisCsvToggle({containerRef}: Props) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const form = container.querySelector<HTMLFormElement>('form')
    if (!form) return undefined

    // Initial sync in case the server-rendered form already has any
    // controlling checkboxes pre-checked.
    applyToggle(form)

    const handler = () => applyToggle(form)
    form.addEventListener('click', handler)
    return () => {
      form.removeEventListener('click', handler)
    }
  }, [containerRef])

  return null
}
