/*
 * Copyright (C) 2020 - present Instructure, Inc.
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

import React from 'react'
import {legacyRender} from '@canvas/react'
import {View} from '@instructure/ui-view'
import ready from '@instructure/ready'

import {AlignmentWidget} from '@instructure/outcomes-ui'

ready(() => {
  const container = document.getElementById('canvas_outcomes_alignment_widget')
  // @ts-expect-error TS2339 (typescriptify)
  if (ENV.canvas_outcomes && ENV.canvas_outcomes.host) {
    legacyRender(
      <View as="div" borderWidth="small none none none" padding="medium none">
        <AlignmentWidget
          // @ts-expect-error TS2339 (typescriptify)
          host={ENV.canvas_outcomes.host}
          // @ts-expect-error TS2339 (typescriptify)
          jwt={ENV.canvas_outcomes.jwt}
          // @ts-expect-error TS2339 (typescriptify)
          contextUuid={ENV.canvas_outcomes.context_uuid}
          // @ts-expect-error TS2339 (typescriptify)
          artifactType={ENV.canvas_outcomes.artifact_type}
          // @ts-expect-error TS2339 (typescriptify)
          artifactId={ENV.canvas_outcomes.artifact_id}
        />
      </View>,
      container,
    )
  }
})
