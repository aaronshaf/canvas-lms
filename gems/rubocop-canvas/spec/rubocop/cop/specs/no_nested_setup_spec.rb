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

describe RuboCop::Cop::Specs::NoNestedSetup do
  subject(:cop) { described_class.new }

  context "single-level setup (allowed)" do
    it "passes a top-level `before`" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          it "exists" do
            expect(@course).to be_present
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "passes a top-level `let`" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          let(:course) { course_factory }
          it "exists" do
            expect(course).to be_present
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "passes a top-level `subject`" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          subject { course_factory }
          it "exists" do
            expect(subject).to be_present
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "passes a hook-bearing group containing a pure-grouping nested context" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          context "when published" do
            it "is available" do
              @course.publish!
              expect(@course.reload).to be_available
            end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "passes sibling nested groups that each declare hooks (no shared hook ancestor)" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          context "as teacher" do
            before { @user = teacher_factory }
            it "..." do end
          end
          context "as student" do
            before { @user = student_factory }
            it "..." do end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "passes a hook at depth 2 when no ancestor group declares hooks" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          context "when published" do
            before { @course = course_factory(workflow_state: "available") }
            it "..." do end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end
  end

  context "nested setup composition (banned)" do
    it "flags a nested `before` when an ancestor group also declares `before`" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          context "when published" do
            before { @course.publish! }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(4)
    end

    it "flags a nested `let` when an ancestor group declares `let`" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          let(:course) { course_factory }
          context "as teacher" do
            let(:teacher) { teacher_in_course(course) }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(4)
    end

    it "flags a nested `subject` when an ancestor declares any setup hook" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @account = Account.default }
          context "when fetched" do
            subject { @account.courses }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(4)
    end

    it "flags `let!` and `subject!` the same as their lazy counterparts" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          let!(:course) { course_factory }
          context "as teacher" do
            subject!(:teacher) { teacher_in_course(course) }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(4)
    end

    it "flags regardless of `before` argument (`:each`, `:once`, etc.)" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before(:once) { @course = course_factory }
          context "when published" do
            before(:each) { @course.publish! }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(4)
    end

    it "flags under `RSpec.describe` form the same as bare `describe`" do
      offenses = inspect_source(<<~RUBY)
        RSpec.describe "Courses" do
          before { @course = course_factory }
          context "when published" do
            before { @course.publish! }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(4)
    end

    it "issues offenses at :warning severity (advisory, not blocking)" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          context "when published" do
            before { @course.publish! }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.severity.name).to eq(:warning)
    end

    it "flags a depth-3 hook when only depth-1 also has a hook (depth-2 is empty)" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          context "when published" do
            context "as teacher" do
              before { @user = teacher_factory }
              it "..." do end
            end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(5)
    end

    it "flags every nested hook in a triple-level chain" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          context "when published" do
            before { @course.publish! }
            context "as teacher" do
              before { @user = teacher_factory }
              it "..." do end
            end
          end
        end
      RUBY
      expect(offenses.size).to eq(2)
      expect(offenses.map(&:line).sort).to eq([4, 6])
    end
  end

  context "edge cases (pinned behavior)" do
    it "does NOT flag `around` hooks (not in scope for this rule)" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          around { |ex| Timecop.freeze { ex.run } }
          context "when published" do
            around { |ex| Timecop.travel(1.hour) { ex.run } }
            it "..." do end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "does NOT flag hooks declared inside `shared_examples` blocks" do
      # shared_examples are not example groups themselves; whether their hooks
      # compose with the including group depends on `include_examples` call
      # sites, which are out of scope for static analysis.
      offenses = inspect_source(<<~RUBY)
        shared_examples "a publishable resource" do
          before { @resource = resource_factory }
          let(:something) { 1 }
          it "..." do end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "does NOT flag a hook inside `shared_examples` even when included by a hook-bearing group" do
      # Same reason: we don't resolve `include_examples` to its definition.
      offenses = inspect_source(<<~RUBY)
        shared_examples "publishable" do
          before { @resource.publish! }
        end

        describe "Courses" do
          before { @resource = course_factory }
          include_examples "publishable"
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "does NOT flag a hook inside `shared_context` lexically nested below a hook-bearing ancestor group" do
      # `shared_context`'s hooks are inert until `include_context` composes them
      # at a call site we can't statically resolve, so we treat it as a
      # scope-breaker and don't compose with the outer describe.
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          context "when fancy" do
            shared_context "with publish" do
              before { @course.publish! }
            end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "does NOT flag a hook inside `shared_examples_for` lexically nested below a hook-bearing ancestor group" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          let(:course) { course_factory }
          context "as teacher" do
            shared_examples_for "a publishable" do
              before { course.publish! }
            end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "still flags real nested-setup when a sibling `shared_context` is present in the same file" do
      # A `shared_context` in the file shouldn't make the cop miss a real
      # nested `before`/`let` in a sibling group.
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          shared_context "with publish" do
            before { @course.publish! }
          end
          context "as teacher" do
            before { @user = teacher_factory }
            it "..." do end
          end
        end
      RUBY
      expect(offenses.size).to eq(1)
      expect(offenses.first.line).to eq(7)
    end

    it "does NOT detect send-form hooks (`let(:x, &proc)`) as ancestor hooks (known limitation)" do
      # `let(:foo, &some_proc)` is a SendNode without a literal block, so this
      # cop does not recognize it as an ancestor hook. Rare in Canvas; pinned
      # here so the limitation is intentional rather than an unnoticed gap.
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          let(:course, &Course.method(:default))
          context "as teacher" do
            let(:teacher) { teacher_in_course(course) }
            it "..." do end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end
  end

  context "non-hook calls" do
    it "ignores plain method calls inside example groups" do
      offenses = inspect_source(<<~RUBY)
        describe "Courses" do
          before { @course = course_factory }
          context "when published" do
            it "..." do
              some_helper_method
              another_one(:with, :args)
            end
          end
        end
      RUBY
      expect(offenses).to be_empty
    end

    it "ignores `before` / `let` / `subject` outside any example group" do
      offenses = inspect_source(<<~RUBY)
        module SomeHelpers
          def before(arg); end
          def let(name); end
        end
      RUBY
      expect(offenses).to be_empty
    end
  end
end
