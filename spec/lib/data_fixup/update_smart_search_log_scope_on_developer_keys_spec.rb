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

RSpec.describe DataFixup::UpdateSmartSearchLogScopeOnDeveloperKeys do
  let(:old_scope) { described_class::OLD_SCOPE }
  let(:new_scope) { described_class::NEW_SCOPE }
  let(:unrelated_scope) { "url:GET|/api/v1/courses/:course_id/quizzes" }

  def execute_fixup
    described_class.new.run
    run_jobs
  end

  # `validate_scopes!` rejects the old GET scope now that routes.rb has moved it
  # to POST, so bypass validation to seed the pre-fixup state.
  def seed_scopes(developer_key, scopes)
    developer_key.update_column(:scopes, scopes)
  end

  it "rewrites the stale GET scope to the new POST scope" do
    dk = developer_key_model
    seed_scopes(dk, [old_scope])

    execute_fixup

    expect(dk.reload.scopes).to eq [new_scope]
  end

  it "preserves other scopes on the same key" do
    dk = developer_key_model
    seed_scopes(dk, [old_scope, unrelated_scope])

    execute_fixup

    expect(dk.reload.scopes).to contain_exactly(new_scope, unrelated_scope)
  end

  it "does not touch keys without the stale scope" do
    dk = developer_key_model(scopes: [unrelated_scope])

    expect { execute_fixup }.not_to change { dk.reload.scopes }
  end

  it "does not touch keys that already have the new POST scope" do
    dk = developer_key_model
    seed_scopes(dk, [new_scope])

    expect { execute_fixup }.not_to change { dk.reload.scopes }
  end
end
