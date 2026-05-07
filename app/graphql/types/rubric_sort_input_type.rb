# frozen_string_literal: true

#
# Copyright (C) 2026 - present Instructure, Inc.
#
# This file is part of Canvas.
#
# Canvas is free software: you can redistribute it and/or modify it under
# the terms of the GNU Affero General Public License as published by the Free
# Software Foundation, version 3 of the License.
#
# Canvas is distributed in the hope that it will be useful, but WITHOUT ANY
# WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
# A PARTICULAR PURPOSE. See the GNU Affero General Public License for more
# details.
#
# You should have received a copy of the GNU Affero General Public License along
# with this program. If not, see <http://www.gnu.org/licenses/>.
#

module Types
  class RubricSortFieldType < Types::BaseEnum
    value "title", "Sort by rubric title (case-insensitive collation)."
    value "criteria_count", "Sort by the number of criteria on the rubric."
    value "has_rubric_associations", <<~MD
      Sort by whether the rubric is associated with an active Assignment in a
      non-deleted Course. Mirrors the semantics of the `hasRubricAssociations`
      field — Account-level rubric associations are intentionally not counted,
      so a rubric whose only associations live on Accounts will sort as
      "not used" by this field.
    MD
    value "points_possible", "Sort by the rubric's total points possible."
  end

  class RubricSortInputType < Types::BaseInputObject
    argument :direction, Types::OrderDirectionType, required: false, default_value: "ascending"
    argument :field, Types::RubricSortFieldType, required: true
  end
end
