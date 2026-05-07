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

module GraphQLHelpers::RubricConnectionHelper
  def resolve_rubrics_connection(rubric_associations, id: nil, search_term: nil, sort: nil, workflow_states: nil)
    rubric_associations = rubric_associations
                          .bookmarked
                          .joins(:rubric)
                          .where.not(rubrics: { workflow_state: "deleted" })

    rubric_associations = rubric_associations.where(rubric_id: id) if id
    rubric_associations = rubric_associations.merge(Rubric.matching(search_term)) if search_term.present?
    rubric_associations = rubric_associations.where(rubrics: { workflow_state: workflow_states }) if workflow_states.present?

    rubrics = Rubric.where(id: rubric_associations.select(:rubric_id))

    sort_rubrics(rubrics, sort)
  end

  private

  def sort_rubrics(rubrics, sort)
    desc = sort&.dig(:direction) == "descending"

    case sort&.dig(:field)
    when "title"
      sorted = Canvas::ICU.collate_by(rubrics, &:title)
      desc ? sorted.reverse : sorted
    when "criteria_count"
      sorted = rubrics.sort_by { |r| r.criteria&.count || 0 }
      desc ? sorted.reverse : sorted
    when "has_rubric_associations"
      # Matches the filter used by Loaders::RubricAssociationsLoader so this
      # sort agrees with the `hasRubricAssociations` field on RubricType.
      # Intentionally Course-scoped because assignment associations are only
      # relevant within the context of a course.
      rubrics.order(Arel.sql(<<~SQL.squish + " #{desc ? "DESC" : "ASC"}"))
        CASE WHEN EXISTS (
          SELECT 1 FROM #{RubricAssociation.quoted_table_name}
          INNER JOIN #{Course.quoted_table_name}
            ON rubric_associations.context_id = courses.id
           AND rubric_associations.context_type = 'Course'
           AND courses.workflow_state <> 'deleted'
          WHERE rubric_associations.rubric_id = rubrics.id
            AND rubric_associations.association_type = 'Assignment'
            AND rubric_associations.workflow_state = 'active'
        ) THEN 0 ELSE 1 END
      SQL
    when "points_possible"
      # Unscored rubrics (hide_points = true) sort as -1 so they bucket at the
      # bottom of an ASC sort and at the top of a DESC sort, separate from
      # 0-point scored rubrics. NULL points_possible falls back to 0.
      rubrics.order(Arel.sql(<<~SQL.squish + " #{desc ? "DESC" : "ASC"}"))
        CASE
          WHEN rubrics.hide_points THEN -1
          ELSE COALESCE(rubrics.points_possible, 0)
        END
      SQL
    else
      Canvas::ICU.collate_by(rubrics, &:title)
    end
  end
end
