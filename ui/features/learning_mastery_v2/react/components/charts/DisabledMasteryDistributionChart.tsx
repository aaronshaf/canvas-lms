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

import React from 'react'
import {IconNoLine} from '@instructure/ui-icons'
import {Text} from '@instructure/ui-text'
import {colors} from '@instructure/canvas-theme'
import {Outcome} from '@canvas/outcomes/react/types/rollup'
import {RatingDistribution} from '@canvas/outcomes/react/types/mastery_distribution'
import {MasteryDistributionChart} from './MasteryDistributionChart'

const DISABLED_BAR_COLOR = colors.contrasts.grey1214

// Static placeholder data — always 5 bars regardless of the actual scale.
const STATIC_DISABLED_DATA: RatingDistribution[] = [2, 4, 3, 2, 1].map((count, i) => ({
  description: `level-${i + 1}`,
  points: 5 - i,
  color: DISABLED_BAR_COLOR,
  count,
  student_ids: [],
}))

interface DisabledMasteryDistributionChartProps {
  outcome: Outcome
  height: number | string
  width?: number | string
  isPreview?: boolean
}

/**
 * Renders a non-interactive, greyed-out bar chart with static placeholder
 * data and a ban icon overlaid in the center. Used when an outcome's mastery
 * scale exceeds the maximum supported levels.
 */
export const DisabledMasteryDistributionChart: React.FC<DisabledMasteryDistributionChartProps> = ({
  outcome,
  height,
  width,
  isPreview = false,
}) => {
  return (
    <div
      style={{position: 'relative', display: 'inline-block', width: '100%', pointerEvents: 'none'}}
      data-testid="disabled-mastery-distribution-chart"
    >
      <div style={{opacity: 0.4}}>
        <MasteryDistributionChart
          outcome={outcome}
          distributionData={STATIC_DISABLED_DATA}
          height={height}
          width={width}
          isPreview={isPreview}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
        data-testid="disabled-mastery-distribution-chart-icon"
      >
        <Text color="secondary">
          <IconNoLine size={isPreview ? 'x-small' : 'small'} />
        </Text>
      </div>
    </div>
  )
}
