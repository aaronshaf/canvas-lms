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

describe Loaders::DiscussionLockedForLoader do
  def load_for(user, topics)
    GraphQL::Batch.batch do
      Promise.all(topics.map { |t| described_class.for(current_user: user).load(t) })
    end
  end

  let_once(:course) { course_factory(active_all: true) }
  let_once(:student) { student_in_course(course:, active_all: true).user }
  let(:override_query_re) { /FROM (?:"\w+"\.)?"assignment_overrides"/ }
  let(:enrollment_query_re) { /SELECT enrollments\.\*, enrollment_states\.state AS date_based_state_in_db/ }

  describe "#perform" do
    context "with a single locked topic" do
      let(:topic) { discussion_topic_model(context: course, locked: true) }

      it "matches locked_for? output" do
        results = nil
        RequestCache.enable do
          results = load_for(student, [topic])
        end
        expected = RequestCache.enable do
          DiscussionTopic.find(topic.id).locked_for?(student, check_policies: true)
        end
        expect(results.first).to eql(expected)
      end
    end

    context "with an unlocked topic" do
      let(:topic) { discussion_topic_model(context: course) }

      it "fulfills with false" do
        result = RequestCache.enable { load_for(student, [topic]).first }
        expect(result).to be(false)
      end
    end

    context "with a nil current_user" do
      it "fulfills with locked_for? for the anonymous user" do
        topic = discussion_topic_model(context: course)
        result = RequestCache.enable { load_for(nil, [topic]).first }
        expect(result).to eql(DiscussionTopic.find(topic.id).locked_for?(nil, check_policies: true))
      end
    end

    context "with a list of graded topics in one course" do
      let!(:topics_2) { Array.new(2) { graded_discussion_topic(context: course) } }
      let!(:topics_5) { Array.new(5) { graded_discussion_topic(context: course) } }

      it "issues constant override queries" do
        Rails.cache.clear
        count_2 = RequestCache.enable do
          count_sql_queries(matcher: override_query_re) { load_for(student, topics_2) }
        end
        Rails.cache.clear
        count_5 = RequestCache.enable do
          count_sql_queries(matcher: override_query_re) { load_for(student, topics_5) }
        end
        expect(count_2).to eql(count_5)
        expect(count_2).to be <= 2
      end

      it "warms enrollment cache in one query" do
        student # realize fixture before measuring
        Rails.cache.clear
        count = RequestCache.enable do
          count_sql_queries(matcher: enrollment_query_re) { load_for(student, topics_2) }
        end
        expect(count).to be(1)
      end
    end

    context "with topics in a group context" do
      let(:group) { group_model(context: course) }
      let(:group_topic) { group.discussion_topics.create!(title: "g", message: "m") }

      it "fulfills group-context topics" do
        result = RequestCache.enable { load_for(student, [group_topic]).first }
        expect(result).to be(false)
      end

      it "preloads group parent contexts in one query" do
        topics = Array.new(3) { group.discussion_topics.create!(title: "g", message: "m") }
        course_query_re = /FROM (?:"\w+"\.)?"courses"/
        count = RequestCache.enable do
          count_sql_queries(matcher: course_query_re) { load_for(student, topics) }
        end
        expect(count).to be <= 1
      end
    end

    context "with sharding" do
      specs_require_sharding

      it "fulfills topics on each shard and warms enrollment cache once per shard" do
        user = user_factory(active_all: true)
        shard1_topic = @shard1.activate do
          c = course_factory(active_all: true, account: Account.create!)
          c.enroll_student(user, enrollment_state: "active")
          discussion_topic_model(context: c)
        end
        shard2_topic = @shard2.activate do
          c = course_factory(active_all: true, account: Account.create!)
          c.enroll_student(user, enrollment_state: "active")
          discussion_topic_model(context: c)
        end
        Rails.cache.clear

        results = nil
        count = RequestCache.enable do
          count_sql_queries(matcher: enrollment_query_re) do
            results = load_for(user, [shard1_topic, shard2_topic])
          end
        end

        expect(results).to all(be(false))
        expect(count).to be(2)
      end
    end
  end
end
