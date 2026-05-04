# frozen_string_literal: true

#
# Copyright (C) 2023 - present Instructure, Inc.
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

require "singleton"

module AdheresToPolicy
  class Result
    NO_JUSTIFICATION = [].freeze
    private_constant :NO_JUSTIFICATION

    # @return [<JustifiedFailure>]
    attr_reader :justifications

    # @return [true, false]
    def success? = false

    private

    def initialize
      @justifications = NO_JUSTIFICATION
    end
  end

  class Success < Result
    include Singleton

    def success? = true
  end

  class Failure < Result
    include Singleton
  end

  class JustifiedFailure < Result
    # @return [Symbol]
    attr_reader :justification
    # @return [Object, nil]
    attr_reader :context

    def initialize(justification, context = nil)
      super()
      @justification = justification
      @context = context
      @justifications = [self].freeze
    end
  end

  class JustifiedFailures < Result
    def initialize(justifications)
      super()
      @justifications = justifications.freeze
    end
  end
end
