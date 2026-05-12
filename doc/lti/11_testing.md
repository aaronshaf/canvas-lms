# Testing

There are a few common scenarios for testing LTI tools that will be detailed here, so that test plans on commits can just reference the pertinent section of this document instead of typing out the installation/setup/reproduction instructions.

## 1.1 Basic Outcomes (Grade Passback)

LTI 1.1 tools can pass grades back to Canvas, only after the student has launched the tool from the associated assignment. Using the [Outcome Service Example](./10_example_tools.md#Outcome-Service-Example) tool, it's possible to locally perform this action.

1. Install the above tool locally, following the instructions in the README.
2. Install the tool in Canvas, following the instructions in the README.
3. In a course with at least one student, create an assignment that launches this tool.
4. Masquerade as the student and launch the tool - the `?become_student` and `?become_user_id=:id` helpers may be useful here. While on the assignment page with url `http://canvas.docker/courses/1/assignments/`, add either of those parameters on to the end of the url to automatically masquerade as the student.
5. The tool should launch and allow you to post a score back to Canvas.
6. To manipulate the grade passback request (to add submission text, a url, a timestamp, etc), open the tool repository and change the XML in `lti_example.rb:100`. Documentation for this XML is located in the [Canvas API docs](https://canvas.instructure.com/doc/api/file.assignment_tools.html#outcomes_service).

## 1.3 AGS (Grade Passback)

The Assignments and Grades Service, which is part of LTI Advantage, allows 1.3 tools to pass grades back to Canvas with much more flexibility than the 1.1 Basic Outcomes methods. There are a couple of ways to make these kinds of requests locally.

### Getting an LTI Access Token

LTI access tokens are different than normal API access tokens, in that they aren't directly tied to a User or a DeveloperKey, and that they are a JWT instead of a traditional encoded string. This JWT contains useful information about the tool that requested the token, the scopes that the key
is allowed to access, and the expiration of the token.

Historically, generating an LTI access token requires an installed tool to create another JWT and send it to Canvas, and the best tool to do that with is the 1.3 test tool. Unfortunately, that tool is difficult to install in a production environment without using ngrok.

It's now possible to, as a Site Admin user, directly ask Canvas for an LTI access token for any 1.3 tool. This will make local development and troubleshooting much easier.

1. Sign in to Canvas as a Site Admin user via browser session (API access tokens are rejected). Your Site Admin user must have an OTP secret configured (e.g. Google Authenticator, 1Password).
2. Make the request from the same domain as the tool's root account (e.g. `office365.instructure.com` for a tool installed on the Office 365 account). Tools installed on the site_admin account cannot have tokens generated this way.
3. Find the `ContextExternalTool` id for the tool you need a token for. The associated developer key must be an LTI 1.3 key. Note: only `tool_id` is accepted - if you only have a `client_id`, find a tool using that key first.
4. Navigate to `<host>/accounts/site_admin/lti_token`, enter the tool ID, enter the current 6-digit OTP from your authenticator app, and submit. The access token is displayed on the same page.

### With the 1.3 Test Tool

The test tool provides a nice UI for making all types of AGS requests, which can be nice for testing established features.

1. Install and configure the [1.3 test tool](./10_example_tools.md#LTI-1.3-Test-Tool) following the instructions in the README.
2. In a course with at least one student, create an assignment that launches this tool.
3. Go to `http://lti13testtool.docker/ags/new` and populate the information needed for the call you want to make. Submit the form to make the request.
4. To further manipulate the request body, edit the [`ags_service.rb`](https://gerrit.instructure.com/plugins/gitiles/lti-1.3-test-tool/+/refs/heads/master/app/services/ags_service.rb#98) file in the test tool repository.

### From an HTTP CLient

For testing new features that may not have been added to the test tool, or for maximum flexibility, you can make requests to the AGS endpoints using any HTTP client you like (curl, Postman, Insomnia, etc). You will need to acquire an LTI access token, which is different than an API access token. In addition to the site admin token endpoint described above, the test tool also allows for this.

1. Install and configure the [1.3 test tool](./10_example_tools.md#LTI-1.3-Test-Tool) following the instructions in the README.
2. In a course with at least one student, create an assignment that launches this tool.
3. In a shell in the test tool repository, run this command: (note that both ids are integers)
  ```
  docker compose run --rm web jwt:access_token CLIENT_ID=<global DeveloperKey id>
  ```
4. This command returns a blob of JSON that includes an access token, which is a JWT. Include that token on all requests you make in an `Authentication: Bearer <jwt>` header.
5. Include a request body, which could look like something like this:
  - [Line Item API docs](https://canvas.instructure.com/doc/api/line_items.html)
  - [Score API docs](https://canvas.instructure.com/doc/api/score.html)
  - [Result API docs](https://canvas.instructure.com/doc/api/result.html)

## Miscellaneous

### Stubbing Statsd Calls

This isn't exactly LTI-specific, but can come in handy. There isn't a great way to get
visibility into the calls made to `InstStatsd::Statsd`, which is the way to get metrics
sent to Datadog. It's possible to monkey-patch that class and stub the methods you care
about and just log them to stdout. If you're working entirely in the Rails console, you
can paste this patch directly into the console. If you're working with Canvas requests
at all, you can paste this patch into any Ruby file in Canvas and save it (I prefer the
one I'm currently working in, for consistency).

Replace `increment` with any Statsd method you need, or add more methods if needed.

```
class << InstStatsd::Statsd
  def increment(*args)
    puts "DEBUG STATSD increment: #{args.to_json}"
  end
end
```

Then, look in the logs for your method calls. If you are working entirely in the Rails
console, they will appear there. If you are working with Canvas requests, tail the web
container's logs with `docker compose logs -f --tail=100 web` and then search for
`DEBUG STATSD`.
