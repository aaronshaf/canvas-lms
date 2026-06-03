# frozen_string_literal: true

#
# Copyright (C) 2011 - present Instructure, Inc.
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

require_relative "../common"

describe "login logout test" do
  include_context "in-process server selenium tests"

  def should_show_message(message_text, selector)
    expect(fj(selector)).to include_text(message_text)
    expect(f("#flash_screenreader_holder")).to have_attribute("textContent", message_text)
  end

  def go_to_forgot_password
    get "/"
    f("#login_forgot_password").click
  end

  before do
    Account.default.enable_canvas_authentication
    @login_error_box_css = ".error_text:last"
  end

  it "shows invalid password message if password is nil", priority: "2" do
    expected_error = "Invalid password"
    get "/login"
    fill_in_login_form("fake@user.com", nil)
    should_show_message(expected_error, @login_error_box_css)
  end

  it "shows invalid login message if username is nil", priority: "2" do
    expected_error = "Invalid login"
    get "/login"
    fill_in_login_form(nil, "123")
    should_show_message(expected_error, @login_error_box_css)
  end

  it "shoulds invalid login message if both username and password are nil", priority: "2" do
    expected_error = "Invalid login"
    get "/login"
    fill_in_login_form(nil, nil)
    should_show_message(expected_error, @login_error_box_css)
  end

  it "prompts must be logged in message when accessing permission based pages while not logged in", priority: "2" do
    expected_url = app_url + "/login/canvas"
    get "/grades"
    assert_flash_warning_message "You must be logged in to access this page"
    expect(driver.current_url).to eq expected_url
  end

  it "validates forgot my password functionality for email account", priority: "1" do
    user_with_pseudonym({ active_user: true })
    go_to_forgot_password
    f("#pseudonym_session_unique_id_forgot").send_keys(@user.pseudonyms.first.unique_id)
    submit_form("#forgot_password_form")
    wait_for_ajaximations
    assert_flash_notice_message "Your password recovery instructions will be sent to #{@user.pseudonyms.first.unique_id}"
  end

  it "validates back button works in forgot password page", priority: "2" do
    go_to_forgot_password
    f(".login_link").click
    expect(f("#login_form")).to be_displayed
  end

  it "doesn't display external link icons", priority: "2" do
    get "/login"
    expect(f(".external_link_icon")).not_to be_displayed
  end
end
