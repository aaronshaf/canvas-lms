# frozen_string_literal: true

#
# Copyright (C) 2012 - present Instructure, Inc.
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

module Api::V1::AssignmentOverride
  include Api::V1::Json

  OVERRIDABLE_ID_FIELDS = %i[assignment_id quiz_id context_module_id discussion_topic_id wiki_page_id attachment_id].freeze

  def assignment_override_json(override, visible_users = nil, current_principal:, student_names: nil, module_names: nil, include_child_override_due_dates: nil, include_child_peer_review_override_dates: nil, peer_review_override: nil)
    fields = %i[id title unassign_item]
    fields << :parent_override_id if override.parent_override_id.present?
    OVERRIDABLE_ID_FIELDS.each { |f| fields << f if override.send(f).present? }
    fields.push(:due_at, :all_day, :all_day_date) if override.due_at_overridden
    fields << :unlock_at if override.unlock_at_overridden
    fields << :lock_at if override.lock_at_overridden
    api_json(override, current_principal, session, only: fields).tap do |json|
      json[:context_module_name] = module_names[override.context_module_id] if module_names && override.context_module_id
      case override.set_type
      when "ADHOC"
        student_ids = if override.preloaded_student_ids
                        override.preloaded_student_ids
                      elsif visible_users.present?
                        override.assignment_override_students.where(user_id: visible_users).pluck(:user_id)
                      else
                        override.assignment_override_students.pluck(:user_id)
                      end
        json[:student_ids] = student_ids
        json[:students] = student_ids.map { |id| { id:, name: student_names[id] } } if student_names
      when "Group"
        json[:group_id] = override.set_id
        json[:non_collaborative] = override.set.non_collaborative?
        json[:group_category_id] = override.set[:group_category_id]
        json[:title] = override.set.name

        # Remove the title from the override if the group is non_collaborative AND the user does not have read permission
        if override.set.non_collaborative? && !override.set.grants_right?(current_principal, session, :read)
          json.delete(:title)
        end
      when "CourseSection"
        json[:course_section_id] = override.set_id
        json[:title] = override.set.name
      when "Course"
        json[:course_id] = override.set_id
      when "Noop"
        json[:noop_id] = override.set_id
      end
      if include_child_override_due_dates
        json[:sub_assignment_due_dates] = override.sub_assignment_due_dates
      end
      if include_child_peer_review_override_dates
        json[:peer_review_dates] = if peer_review_override
                                     {
                                       id: peer_review_override.id,
                                       due_at: peer_review_override.due_at,
                                       unlock_at: peer_review_override.unlock_at,
                                       lock_at: peer_review_override.lock_at
                                     }
                                   else
                                     nil
                                   end
      end
    end
  end

  # temporary function to convert discussion_topic_section_visibilities to section overrides
  # will be able to remove once we deprecate the old section visibilities table
  def section_visibility_to_override_json(section_visibilities, discussion, current_principal:)
    section_visibilities.map do |section_visibility|
      fields = %i[]
      api_json(section_visibility, current_principal, session, only: fields).tap do |json|
        json[:discussion_topic_id] = section_visibility.discussion_topic_id
        json[:course_section_id] = section_visibility.course_section_id
        json[:unlock_at] = discussion.unlock_at if discussion.unlock_at
        json[:lock_at] = discussion.lock_at if discussion.lock_at
        json[:unassign_item] = false
      end
    end
  end

  def assignment_overrides_json(overrides, current_principal = nil, include_names: false, include_child_override_due_dates: false, include_child_peer_review_override_dates: false)
    visible_users_ids = ::AssignmentOverride.visible_enrollments_for(overrides.compact, current_principal).select(:user_id)
    # we most likely already have the student_ids preloaded here because of overridden_for, but just in case
    if overrides.any? { |ov| ov.present? && ov.set_type == "ADHOC" && !ov.preloaded_student_ids }
      AssignmentOverrideApplicator.preload_student_ids_for_adhoc_overrides(overrides.select { |ov| ov.set_type == "ADHOC" }, visible_users_ids)
    end
    if include_names
      student_ids = overrides.select { |ov| ov.present? && ov.set_type == "ADHOC" }.map(&:preloaded_student_ids).flatten.uniq
      student_names = User.where(id: student_ids).pluck(:id, :name).to_h
      module_ids = overrides.select { |ov| ov.present? && ov.context_module_id.present? }.map(&:context_module_id).uniq
      module_names = ContextModule.where(id: module_ids).pluck(:id, :name).to_h
    end

    # Eager load peer review overrides to avoid N+1 queries
    peer_review_overrides_by_parent_id = if include_child_peer_review_override_dates && overrides.any?(&:present?)
                                           override_ids = overrides.compact.map(&:id)
                                           AssignmentOverride
                                             .active
                                             .where(parent_override_id: override_ids)
                                             .index_by(&:parent_override_id)
                                         else
                                           {}
                                         end

    overrides.map do |override|
      next unless override

      peer_review_override = if include_child_peer_review_override_dates
                               peer_review_overrides_by_parent_id[override.id]
                             else
                               nil
                             end

      assignment_override_json(override, visible_users_ids, current_principal:, student_names:, module_names:, include_child_override_due_dates:, include_child_peer_review_override_dates:, peer_review_override:)
    end
  end

  def assignment_override_collection(learning_object, current_principal:, include_students: false)
    overrides = AssignmentOverrideApplicator.overrides_for_assignment_and_user(learning_object, current_principal&.user)
    if include_students
      ActiveRecord::Associations.preload(overrides, :assignment_override_students)
    end
    overrides
  end

  def find_assignment_override(learning_object, set_or_id, current_principal:)
    find_assignment_overrides(learning_object, [set_or_id], current_principal:)[0]
  end

  def find_assignment_overrides(learning_object, sets_or_ids, current_principal:)
    overrides = assignment_override_collection(learning_object, current_principal:)
    sets_or_ids.map do |set_or_id|
      filter_assignment_overrides(overrides, set_or_id)
    end
  end

  def filter_assignment_overrides(overrides, set_or_id)
    return nil if overrides.empty? || set_or_id.nil?

    case set_or_id
    when CourseSection, Group
      overrides.detect do |o|
        o.set_type == set_or_id.class.to_s &&
          o.set_id == set_or_id.id # maybe FIXME
      end
    else
      overrides.detect { |o| o.id == set_or_id.to_i }
    end
  end

  def find_group(assignment, group_id, group_category_id = nil, current_principal:)
    scope = Group.active.where(context_type: "Course").where.not(group_category_id: nil)
    if assignment
      scope = scope.where(
        context_id: assignment.context_id,
        group_category_id: group_category_id || assignment.group_category_id
      )
    end
    group = scope.find(group_id)
    raise ActiveRecord::RecordNotFound unless group.grants_right?(current_principal, session, :read)

    group
  end

  def find_section(context, section_id, current_principal:)
    scope = CourseSection.active
    scope = scope.where(course_id: context) if context
    section = api_find(scope, section_id)
    raise ActiveRecord::RecordNotFound unless section.grants_right?(current_principal, session, :read)

    section
  end

  def interpret_assignment_override_data(learning_object, data, set_type = nil, current_principal:)
    @domain_root_account ||= LoadAccount.default_domain_root_account

    data ||= {}
    return {}, ["invalid override data"] unless data.is_a?(Hash) || data.is_a?(ActionController::Parameters)

    # validate structure of parameters
    override_data = {}
    errors = []

    if !set_type && data[:student_ids]
      set_type = "ADHOC"
    end

    if set_type == "ADHOC" && data[:student_ids]
      # require the ids to be a list
      student_ids = data[:student_ids]
      if !student_ids.is_a?(Array) || student_ids.empty?
        errors << "invalid student_ids #{student_ids.inspect}"
        students = []
      else
        # look up all students since the assignment will affect all current and
        # previous students in the course on this override and not just what the
        # teacher can see that were sent in the request object
        students = api_find_all(learning_object.context.all_students, student_ids)
        students = students.distinct if students.is_a?(ActiveRecord::Relation)
        students = students.uniq if students.is_a?(Array)

        # make sure they were all valid
        found_ids = students.map do |s|
          [
            s.id.to_s,
            s.global_id.to_s,
            ("sis_login_id:#{s.pseudonym.unique_id}" if s.pseudonym),
            ("hex:sis_login_id:#{s.pseudonym.unique_id.to_s.unpack("H*")}" if s.pseudonym),
            ("sis_user_id:#{s.pseudonym.sis_user_id}" if s.pseudonym&.sis_user_id),
            ("hex:sis_user_id:#{s.pseudonym.sis_user_id.to_s.unpack("H*")}" if s.pseudonym&.sis_user_id)
          ]
        end.flatten.compact
        bad_ids = student_ids.map(&:to_s) - found_ids
        errors << "unknown student ids: #{bad_ids.inspect}" unless bad_ids.empty?
      end
      override_data[:students] = students
    end

    if !set_type && data.key?(:group_id) && data[:group_id].present?
      group_category_id = learning_object.effective_group_category_id

      begin
        group = Group.find_by!(id: data[:group_id], context: learning_object.context)

        # For now, differentiation tags are allowed to be assigned to Group Assignments. If the group is non_collaborative
        # and the feature flag is enabled, the learning object can be assigned to the group.
        # For collaborative groups, if the group category id is the same as the learning_object's group category id
        # the learning object can be assigned to the group.
        if (group.non_collaborative? && learning_object.context.account.allow_assign_to_differentiation_tags?) ||
           (!group.non_collaborative? && group_category_id == group.group_category_id)
          set_type = "Group"
          override_data[:group] = group
        else
          errors << "group_id is not valid"
        end
      rescue
        errors << "unknown group id #{data[:group_id].inspect}"
      end
    end

    if !set_type && data.key?(:course_section_id) && data[:course_section_id].present?
      set_type = "CourseSection"

      # look up the section
      begin
        section = find_section(learning_object.context, data[:course_section_id], current_principal:)
      rescue ActiveRecord::RecordNotFound
        errors << "unknown section id #{data[:course_section_id].inspect}"
      end
      override_data[:section] = section
    end

    if !set_type && data.key?(:course_id) && data[:course_id].present?
      set_type = "Course"
      override_data[:course] = learning_object.context
    end

    if !set_type && data.key?(:noop_id)
      set_type = "Noop"
      override_data[:noop_id] = data[:noop_id]
    end

    errors << "one of student_ids, group_id, or course_section_id is required" if !set_type && errors.empty?

    if %w[ADHOC Noop].include?(set_type) && data.key?(:title)
      override_data[:title] = data[:title]
    end

    if data.key?(:unassign_item) && data[:unassign_item]
      override_data[:unassign_item] = data[:unassign_item]
    end

    # collect override values
    %i[due_at unlock_at lock_at].each do |field|
      next unless data.key?(field)

      begin
        if data[field].blank?
          # override value of nil/'' is meaningful
          override_data[field] = nil
        elsif (value = Time.zone.parse(data[field].to_s))
          override_data[field] = value
        else
          errors << "invalid #{field} #{data[field].inspect}"
        end
      rescue
        errors << "invalid #{field} #{data[field].inspect}"
      end
    end

    errors = nil if errors.empty?
    [override_data, errors]
  end

  def check_property(object, prop, present, errors, message)
    object.each_with_index.reject do |element, i|
      if element[prop].present? != present
        errors[i] ||= []
        errors[i] << message
      end
    end
  end

  # receives data of shape [{ id: 2, assignment_id: 1, ...update_params }, ... ]
  # responds with data of shape [{ assignment: model, override: model, ...update_params }, ...]
  def interpret_batch_assignment_overrides_data(course, assignment_overrides_data, for_update, current_principal:)
    return nil, ["no assignment override data present"] unless assignment_overrides_data.present?
    return nil, ["must specify an array of overrides"] unless assignment_overrides_data.is_a? Array

    all_errors = Array.new(assignment_overrides_data.length)

    check_property(assignment_overrides_data, "assignment_id", true, all_errors, "must specify an assignment id")
    if for_update
      check_property(assignment_overrides_data, "id", true, all_errors, "must specify an override id")
    else
      check_property(assignment_overrides_data, "id", false, all_errors, "may not specify an override id")
    end
    return nil, all_errors unless all_errors.compact.blank?

    grouped = assignment_overrides_data.group_by { |o| o["assignment_id"] }
    assignments = course.active_assignments.where(id: grouped.keys).preload(:assignment_overrides)
    if for_update
      overrides = grouped.map do |assignment_id, overrides_data|
        assignment = assignments.find { |a| a.id.to_s == assignment_id.to_s }
        find_assignment_overrides(assignment, overrides_data.pluck("id"), current_principal:) if assignment
      end.flatten.compact
    end

    interpreted = assignment_overrides_data.each_with_index.map do |override_data, i|
      assignment = assignments.find { |a| a.id.to_s == override_data["assignment_id"].to_s }
      unless assignment.present?
        all_errors[i] = ["assignment not found"]
        next
      end
      if for_update
        override = overrides.find { |o| o.id.to_s == override_data["id"].to_s }
        unless override.present?
          all_errors[i] = ["override not found"]
          next
        end
        set_type = override.set_type
      end

      update_data, errors = interpret_assignment_override_data(assignment, override_data, set_type, current_principal:)
      if errors
        all_errors[i] = errors
        next
      end
      update_data["assignment"] = assignment
      update_data["override"] = override if for_update
      update_data
    end
    all_errors = nil if all_errors.compact.blank?
    [interpreted, all_errors]
  end

  def update_assignment_override_without_save(override, override_data)
    if override_data.key?(:noop_id)
      override.set = nil
      override.set_type = "Noop"
      override.set_id = override_data[:noop_id]
      override.title = override_data[:title]
    end

    if override_data.key?(:students)
      override.set = nil
      override.set_type = "ADHOC"

      defunct_student_ids = if override.new_record?
                              Set.new
                            else
                              override.assignment_override_students.to_set(&:user_id)
                            end

      override.changed_student_ids = Set.new

      override_data[:students].each do |student|
        if defunct_student_ids.include?(student.id)
          defunct_student_ids.delete(student.id)
        else
          # link will be saved with the override
          link = override.assignment_override_students.build
          link.workflow_state = "active"
          link.assignment_override = override
          link.user = student
          override.changed_student_ids << student.id
        end
      end

      unless defunct_student_ids.empty?
        override.changed_student_ids.merge(defunct_student_ids)
        override.assignment_override_students
                .where(user_id: defunct_student_ids.to_a)
                .in_batches
                .delete_all
      end
    end

    if override_data.key?(:group)
      override.set = override_data[:group]
    end

    if override_data.key?(:section)
      override.set = override_data[:section]
    end

    if override_data.key?(:course)
      override.set = override_data[:course]
    end

    if override_data.key?(:unassign_item)
      override.unassign_item = override_data[:unassign_item]
    end

    if override.set_type == "ADHOC"
      override.title = override_data[:title] ||
                       (override_data[:students] && override.title_from_students(override_data[:students])) ||
                       override.title
    end

    %i[due_at unlock_at lock_at].each do |field|
      if override_data.key?(field)
        override.send(:"override_#{field}", override_data[field])
      else
        override.send(:"clear_#{field}_override")
      end
    end
  end

  def update_assignment_override(override, override_data, updating_user: nil)
    SubmissionLifecycleManager.with_executing_user(updating_user) do
      override_changed = false
      override.transaction do
        update_assignment_override_without_save(override, override_data)
        override_changed = override.changed? || override.changed_student_ids.present?
        override.save! if override_changed
      end
      if override_changed
        if override.set_type == "ADHOC" && override.changed_student_ids.present?
          override.assignment.run_if_overrides_changed_later!(
            student_ids: override.changed_student_ids.to_a,
            updating_user:
          )
        else
          override.assignment.run_if_overrides_changed_later!(updating_user:)
        end
      end
    end

    true
  rescue ActiveRecord::RecordInvalid
    false
  end

  # updates only the selected overrides; compare with
  # batch_update_assignment_overrides below, which updates
  # all overrides for assignment
  def update_assignment_overrides(overrides, overrides_data, updating_user: nil)
    overrides.zip(overrides_data).each do |override, data|
      update_assignment_override_without_save(override, data)
    end
    return false if overrides.find(&:invalid?).present?

    AssignmentOverride.transaction do
      overrides.each(&:save!)
    end
    overrides.map(&:assignment).uniq.each do |assignment|
      assignment.run_if_overrides_changed_later!(updating_user:)
    end
  rescue ActiveRecord::RecordInvalid
    false
  end

  def invisible_users_and_overrides_for_user(context, current_principal, existing_overrides)
    # get the student overrides the user can't see and ensure those overrides are included
    visible_user_ids = context.enrollments_visible_to(current_principal).select(:user_id)
    invisible_user_ids = context.enrollments.where.not(user_id: visible_user_ids).distinct.pluck(:user_id)
    invisible_override_ids = existing_overrides.select do |ov|
      ov.set_type == "ADHOC" &&
        !ov.visible_student_overrides(visible_user_ids)
    end.map(&:id)
    [invisible_user_ids, invisible_override_ids]
  end

  def update_override_with_invisible_data(override_params, override, invisible_override_ids, invisible_user_ids)
    return override_params = override if invisible_override_ids.include?(override.id)

    # add back in the invisible students for this override if any found
    hidden_ids = override.assignment_override_students.where(user_id: invisible_user_ids).pluck(:user_id)
    unless hidden_ids.empty?
      override_params[:student_ids] = (override_params[:student_ids] + hidden_ids)
      overrides_size = override_params[:student_ids].size
      override_params[:title] = t({ one: "1 student", other: "%{count} students" }, count: overrides_size)
    end
  end

  def prepare_assignment_overrides_for_batch_update(learning_object, overrides_params, current_principal)
    existing_overrides = learning_object.all_assignment_overrides.active
    invisible_user_ids, invisible_override_ids = invisible_users_and_overrides_for_user(
      learning_object.context, current_principal, existing_overrides
    )

    override_param_ids = invisible_override_ids + overrides_params.map { |ov| ov[:id].to_i }
    split_overrides = existing_overrides.group_by do |override|
      override_param_ids.include?(override.id) ? :keep : :delete
    end

    overrides_to_keep = split_overrides[:keep] || []
    overrides_to_delete = split_overrides[:delete] || []

    ActiveRecord::Associations.preload(overrides_to_keep, :assignment_override_students)

    override_errors = []
    overrides_to_save = overrides_params.map do |override_params|
      # override_params.values.filter {|v| v.present?}.length > 0
      override = get_override_from_params(override_params, learning_object, overrides_to_keep)
      update_override_with_invisible_data(override_params, override, invisible_override_ids, invisible_user_ids)

      data, errors = interpret_assignment_override_data(learning_object, override_params, override.set_type, current_principal:)
      if errors
        override_errors << errors.join(",")
      else
        update_assignment_override_without_save(override, data)
      end
      override
    end

    overrides_to_create, overrides_to_update = overrides_to_save.partition(&:new_record?)

    {
      overrides_to_create:,
      overrides_to_update:,
      overrides_to_delete:,
      override_errors:
    }
  end

  def perform_batch_update_assignment_overrides(learning_object, prepared_overrides, updating_user: nil)
    prepared_overrides[:override_errors].each do |error|
      learning_object.errors.add(:base, error)
    end

    raise ActiveRecord::RecordInvalid, learning_object if learning_object.errors.any?

    if prepared_overrides[:overrides_to_delete].any?
      learning_object.assignment_overrides.where(id: prepared_overrides[:overrides_to_delete]).destroy_all
    end

    raise ActiveRecord::RecordInvalid, learning_object unless learning_object.valid?

    prepared_overrides[:overrides_to_update].each(&:save!)
    prepared_overrides[:overrides_to_create].each(&:save!)

    @overrides_affected = prepared_overrides[:overrides_to_delete].size +
                          prepared_overrides[:overrides_to_create].size + prepared_overrides[:overrides_to_update].size

    learning_object.touch # invalidate cached list of overrides for the assignment
    learning_object.assignment_overrides.reset # unload the obsolete association
    learning_object.run_if_overrides_changed_later!(updating_user:) if learning_object.respond_to?(:run_if_overrides_changed_later!)
  end

  def batch_update_assignment_overrides(learning_object, overrides_params, current_principal)
    prepared_overrides = prepare_assignment_overrides_for_batch_update(learning_object, overrides_params, current_principal)
    perform_batch_update_assignment_overrides(learning_object, prepared_overrides, updating_user: current_principal)
  end

  def get_override_from_params(override_params, learning_object, potential_overrides)
    override = potential_overrides.detect { |ov| ov.id == override_params[:id].to_i }
    return override if override

    case learning_object
    when Assignment
      AssignmentOverride.new(assignment_id: learning_object.id, dont_touch_assignment: true)
    when Quizzes::Quiz
      AssignmentOverride.new(quiz_id: learning_object.id, dont_touch_assignment: true)
    when DiscussionTopic
      AssignmentOverride.new(discussion_topic_id: learning_object.id, dont_touch_assignment: true)
    when WikiPage
      AssignmentOverride.new(wiki_page_id: learning_object.id)
    when Attachment
      AssignmentOverride.new(attachment_id: learning_object.id)
    end
  end
  private :get_override_from_params

  def deserialize_overrides(overrides)
    if overrides.is_a?(Hash) || overrides.is_a?(ActionController::Parameters)
      return unless overrides.keys.all? { |k| k.to_i.to_s == k.to_s }

      indices = overrides.keys.sort_by(&:to_i)
      return unless indices.map(&:to_i) == (0...indices.size).to_a

      overrides = indices.map { |index| overrides[index] }
    else
      overrides
    end
  end

  BLUEPRINT_DUE_DATE_PARAM_KEYS = %i[due_at reply_to_topic_due_at required_replies_due_at].freeze
  BLUEPRINT_DUE_DATE_OVERRIDE_KEYS = %i[due_at].freeze
  BLUEPRINT_AVAILABILITY_DATE_KEYS = %i[unlock_at lock_at].freeze

  def blueprint_date_changes(overridable, base_params, override_params)
    due_changing = BLUEPRINT_DUE_DATE_PARAM_KEYS.any? { |k| date_param_changing?(base_params, k, overridable.try(k)) }
    avail_changing = BLUEPRINT_AVAILABILITY_DATE_KEYS.any? { |k| date_param_changing?(base_params, k, overridable.try(k)) }

    if override_params.present?
      existing_by_id = overridable.respond_to?(:all_assignment_overrides) ? overridable.all_assignment_overrides.active.index_by(&:id) : {}
      override_params.each do |o|
        existing = existing_by_id[(o[:id] || o["id"])&.to_i]
        due_changing ||= BLUEPRINT_DUE_DATE_OVERRIDE_KEYS.any? { |k| date_param_changing?(o, k, existing&.try(k)) }
        avail_changing ||= BLUEPRINT_AVAILABILITY_DATE_KEYS.any? { |k| date_param_changing?(o, k, existing&.try(k)) }
      end
    end

    [due_changing, avail_changing]
  end
  private :blueprint_date_changes

  def date_param_changing?(source, key, current)
    return false unless source.key?(key) || source.key?(key.to_s)

    raw = source[key].nil? ? source[key.to_s] : source[key]
    parsed = begin
      raw.present? ? Time.zone.parse(raw.to_s) : nil
    rescue
      nil
    end
    # Unparseable input is not a determinable date change; let downstream validation surface it.
    return false if raw.present? && parsed.nil?

    iso = ->(v) { v.respond_to?(:iso8601) ? v.iso8601 : v }
    iso.call(parsed) != iso.call(current)
  end
  private :date_param_changing?
end
