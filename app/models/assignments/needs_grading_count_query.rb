# frozen_string_literal: true

#
# Copyright (C) 2014 - present Instructure, Inc.
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

module Assignments
  module CourseProxyCache
    # holds values so we don't have to recompute them over and over again
    class CourseProxy
      attr_reader :course, :principal

      def initialize(course, principal)
        @course = course
        @principal = principal
      end

      def section_visibilities
        @section_visibilities ||= course.section_visibilities_for(principal&.user)
      end

      def visibility_level
        @visibility_level ||= course.enrollment_visibility_level_for(principal, section_visibilities)
      end

      def visible_section_ids
        @visible_section_ids ||= section_visibilities.pluck(:course_section_id)
      end
    end

    private

    def course_proxy_for(assignment)
      @course_proxies ||= {}
      global_course_id = assignment.context.global_id
      @course_proxies[global_course_id] ||= CourseProxy.new(assignment.context, principal)
    end
  end

  class NeedsGradingCountQuery
    include CourseProxyCache

    attr_reader :principal

    def initialize(assignments, user = nil)
      @assignments = Array(assignments)
      @user = user
      @principal = @user&.principal
    end

    # Returns { assignment.global_id => Integer }, defaults to 0 for unknown keys
    def count
      fetch_or_compute(:count, default: 0) { |assignments| compute_count(assignments) }
    end

    # Returns { assignment.global_id => Integer }, defaults to 0 for unknown keys
    def manual_count
      fetch_or_compute(:manual_count, default: 0) { |assignments| compute_manual_count(assignments) }
    end

    # Returns { assignment.global_id => Array<Hash> }, defaults to [] for unknown keys
    # Each hash is { section_id: <local Integer>, needs_grading_count: Integer }
    # (section_id is the local shard ID, not a global ID)
    def count_by_section
      fetch_or_compute(:count_by_section, default: []) { |assignments| compute_count_by_section(assignments) }
    end

    private

    # Checks the request cache for each assignment, computes only for missing ones,
    # writes the new values back, and returns the complete hash keyed by global_id.
    def fetch_or_compute(method_key, default: nil)
      missing = @assignments.reject { |a| RequestCache.exist?("ngcq_#{method_key}", a.global_id, principal&.user&.global_id) }

      new_values = {}
      if missing.any?
        new_values = yield(missing)
        # Populate the request cache so subsequent single-assignment lookups
        # within the same request are free in-memory hash reads.
        new_values.each do |gid, val|
          RequestCache.cache("ngcq_#{method_key}", gid, principal&.user&.global_id) { val }
        end
      end

      result = Hash.new(default)
      @assignments.each do |a|
        # Every assignment must be in either new_values (just computed) or the
        # request cache (warmed by a prior call). The 0 fallback is a safety
        # net that should never be reached in normal operation.
        result[a.global_id] = new_values.fetch(a.global_id) do
          RequestCache.cache("ngcq_#{method_key}", a.global_id, principal&.user&.global_id) do
            default
          end
        end
      end
      result
    end

    # Returns { assignment.global_id => Integer }
    def compute_count(assignments)
      results = assignments.to_h { |a| [a.global_id, 0] }

      Shard.partition_by_shard(assignments) do |shard_assignments|
        moderated, non_moderated = shard_assignments.partition do |a|
          a.moderated_grading? && !a.grades_published?
        end

        results.merge!(needs_moderated_grading_count(moderated)) if moderated.any?
        results.merge!(needs_grading_count(non_moderated)) if non_moderated.any?
      end

      results
    end

    # Returns { assignment.global_id => Integer }
    def compute_manual_count(assignments)
      results = assignments.to_h { |a| [a.global_id, 0] }

      partition_by_course(assignments) do |course_id, course_assignments|
        results.merge!(count_by_assignment(all_submissions_scope(course_assignments, course_id)))
      end

      results
    end

    # Returns { assignment.global_id => Array<Hash> }
    # Each hash is { section_id: <local Integer>, needs_grading_count: Integer }
    # (section_id is the local shard ID, not a global ID)
    def compute_count_by_section(assignments)
      results = assignments.to_h { |a| [a.global_id, []] }

      partition_by_course(assignments) do |course_id, course_assignments|
        proxy = course_proxy_for(course_assignments.first)

        scope = all_submissions_scope(course_assignments, course_id)
        scope = scope.where(e: { course_section_id: proxy.visible_section_ids }) if proxy.visibility_level == :sections

        scope
          .group("assignment_mapping.to_id", "e.course_section_id")
          .distinct
          .count("submissions.user_id")
          .each do |(assignment_id, section_id), cnt|
            results[assignment_id.to_i] << { section_id: section_id.to_i, needs_grading_count: cnt }
          end
      end

      results
    end

    def needs_moderated_grading_count(assignments)
      results = assignments.to_h { |a| [a.global_id, 0] }
      assignment_ids = assignments.map(&:id)

      # Step 1: submission IDs this user has already provisionally graded (bulk)
      # Default proc stores a new Set on first access, so missing assignment IDs
      # are handled automatically without a separate initialisation loop.
      graded_sub_ids_by_assignment = Hash.new { |h, k| h[k] = Set.new }
      Submission
        .joins(:provisional_grades)
        .where(
          assignment_id: assignment_ids,
          moderated_grading_provisional_grades: { final: false, scorer_id: principal&.user }
        )
        .where.not(moderated_grading_provisional_grades: { score: nil })
        .group(:assignment_id)
        .pluck(:assignment_id, Arel.sql("ARRAY_AGG(DISTINCT submissions.id)"))
        .each { |a_id, ids| graded_sub_ids_by_assignment[a_id] = ids.to_set }

      # Step 2: moderation sets per assignment (bulk)
      moderation_sets = ModeratedGrading::Selection
                        .where(assignment_id: assignment_ids)
                        .group(:assignment_id)
                        .pluck(:assignment_id, Arel.sql("ARRAY_AGG(student_id)"))
                        .to_h { |a_id, ids| [a_id, ids.to_set] }

      # Step 3: find submissions that already have enough provisional grades (bulk).
      # The threshold is 2 if the student is in the assignment's moderation set, 1 otherwise.
      Submission
        .joins(:provisional_grades)
        .where(assignment_id: assignment_ids)
        .where(moderated_grading_provisional_grades: { final: false })
        .where.not(moderated_grading_provisional_grades: { scorer_id: principal&.user })
        .group("submissions.assignment_id", "submissions.id", "submissions.user_id")
        .count
        .each do |(a_id, sub_id, user_id), pg_count|
          next if graded_sub_ids_by_assignment[a_id].include?(sub_id)

          threshold = moderation_sets.fetch(a_id, Set.new).include?(user_id) ? 2 : 1
          graded_sub_ids_by_assignment[a_id] << sub_id if pg_count >= threshold
        end

      # Step 4: count remaining submissions per assignment grouped by course for visibility.
      # Submission IDs are globally unique so flattening exclusions across assignments is safe.
      assignments.group_by(&:context_id).each do |course_id, course_assignments|
        proxy = course_proxy_for(course_assignments.first)
        level = proxy.visibility_level

        # leaves results at the 0 default
        next unless %i[full limited sections sections_limited].include?(level)

        all_graded_sub_ids = course_assignments.each_with_object(Set.new) { |a, s| s.merge(graded_sub_ids_by_assignment[a.id]) }

        scope = all_submissions_scope(course_assignments, course_id)
        scope = scope.where(e: { course_section_id: proxy.visible_section_ids }) if level == :sections
        scope = scope.where.not(submissions: { id: all_graded_sub_ids }) if all_graded_sub_ids.any?

        results.merge!(count_by_assignment(scope))
      end

      results
    end

    def partition_by_course(assignments, &)
      Shard.partition_by_shard(assignments) do |shard_assignments|
        shard_assignments.group_by(&:context_id).each(&)
      end
    end

    def count_by_assignment(scope)
      scope
        .group("assignment_mapping.to_id")
        .distinct
        .count("submissions.user_id")
        .transform_keys(&:to_i)
    end

    def needs_grading_count(assignments)
      results = assignments.to_h { |a| [a.global_id, 0] }

      assignments.group_by(&:context_id).each do |course_id, course_assignments|
        proxy = course_proxy_for(course_assignments.first)
        level = proxy.visibility_level
        next unless %i[full limited sections sections_limited].include?(level)

        scope = all_submissions_scope(course_assignments, course_id)
        scope = scope.where(e: { course_section_id: proxy.visible_section_ids }) if %i[sections sections_limited].include?(level)

        results.merge!(count_by_assignment(scope))
      end

      results
    end

    # Builds a scope with an INNER JOIN to a VALUES mapping table
    # (assignment_mapping.from_id, assignment_mapping.to_id) so that
    # count_by_assignment can group by assignment_mapping.to_id.
    #
    # Each assignment produces one or more mapping rows:
    #   - Standard / direct query (including SubAssignment queried directly):
    #       (assignment.id → assignment.id)
    #   - Parent with sub-assignments (roll-up):
    #       (sub_assignment.id → parent.id)
    #
    # A single sub-assignment that is both directly queried AND a child of a
    # queried parent gets both rows, so its submissions are counted under both
    # the sub-assignment's own ID and the parent's ID.
    def all_submissions_scope(course_assignments, course_id)
      sub_assignment_parents, standard = course_assignments.partition(&:has_sub_assignments)

      mapping_rows = standard.map { |a| [a.id, a.global_id] }

      if sub_assignment_parents.any?
        parent_global_id = sub_assignment_parents.to_h { |a| [a.id, a.global_id] }
        SubAssignment
          .where(parent_assignment_id: sub_assignment_parents.map(&:id))
          .pluck(:parent_assignment_id, :id)
          .each { |parent_id, sub_id| mapping_rows << [sub_id, parent_global_id[parent_id]] }
      end

      return Submission.none if mapping_rows.empty?

      all_ids = mapping_rows.map(&:first).uniq
      values_sql = mapping_rows.map { |from_id, to_id| "(#{from_id.to_i}, #{to_id.to_i})" }.join(", ")

      submissions_scope(all_ids, course_id)
        .joins("INNER JOIN (VALUES #{values_sql}) AS assignment_mapping(from_id, to_id) " \
               "ON assignment_mapping.from_id = submissions.assignment_id")
    end

    # Base submission scope filtered to the given assignment_ids and course.
    def submissions_scope(assignment_ids, course_id)
      Submission
        .joins("INNER JOIN #{Enrollment.quoted_table_name} e ON e.user_id = submissions.user_id")
        .where(
          "submissions.assignment_id IN (?) " \
          "AND e.course_id = ? " \
          "AND e.type IN ('StudentEnrollment', 'StudentViewEnrollment') " \
          "AND e.workflow_state = 'active' " \
          "AND #{Submission.needs_grading_conditions}",
          assignment_ids,
          course_id
        )
    end
  end
end
