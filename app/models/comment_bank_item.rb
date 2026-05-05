# frozen_string_literal: true

#
# Copyright (C) 2021 - present Instructure, Inc.
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

class CommentBankItem < ApplicationRecord
  include Canvas::SoftDeletable
  extend RootAccountResolver

  belongs_to :course, optional: false, inverse_of: :comment_bank_items
  belongs_to :user, optional: false
  belongs_to :assignment, class_name: "AbstractAssignment", optional: true
  resolves_root_account through: :course

  validates :comment, length: { maximum: maximum_text_length, allow_blank: false }

  sanitize_field :comment, CanvasSanitize::SANITIZE

  def comment
    Sanitize.clean(super, CanvasSanitize::SANITIZE)
  end

  set_policy do
    given { |principal| user == principal&.user }
    can :delete and can :read and can :update

    given { |principal, session| course.grants_right?(principal, session, :manage_grades) }
    can :create
  end
end
