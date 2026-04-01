# LTI Registration Updates

## Overview

LTI 1.3 Dynamic Registrations in Canvas support a controlled update workflow that allows third-party tools to request changes to their registration configuration without immediately applying those changes. This provides administrators with visibility and control over configuration changes before they take effect.

When a tool sends an update request to Canvas, a **Registration Update Request** is created. The update remains in a pending state until an administrator reviews and either accepts or rejects it. This workflow ensures that administrators maintain oversight of all changes to LTI tool configurations in their institution.

## The Update Workflow

### Step 1: Tool Requests an Update

Tools can request an update to their configuration using the registration update endpoint with an access token for the current registration.

**Endpoint**: `PUT /api/lti/registrations/:registration_id/configuration`

**Authentication**: Developer Key Access Token with the `https://purl.imsglobal.org/spec/lti-reg/scope/registration` scope

**Request Headers**:
```
Content-Type: application/json
Authorization: Bearer <developer_key_access_token>
```

**Request Body**: Same format as the [LTI Registration schema](file.registration.html#lti-registration-schema) used during initial registration.

**Example Request**:
```bash
curl -X PUT \
  'https://canvas.instructure.com/api/lti/registrations/10000000000123/configuration' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...' \
  -d '{
    "application_type": "web",
    "client_name": "Updated Tool Name",
    "client_uri": "https://tool.example.com",
    "grant_types": ["client_credentials", "implicit"],
    "jwks_uri": "https://tool.example.com/.well-known/jwks.json",
    "initiate_login_uri": "https://tool.example.com/lti/login",
    "redirect_uris": ["https://tool.example.com/lti/launch"],
    "response_types": ["id_token"],
    "scope": "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly https://purl.imsglobal.org/spec/lti-ags/scope/lineitem",
    "token_endpoint_auth_method": "private_key_jwt",
    "logo_uri": "https://tool.example.com/logo.png",
    "https://purl.imsglobal.org/spec/lti-tool-configuration": {
      "claims": ["sub", "iss", "name", "email"],
      "domain": "tool.example.com",
      "target_link_uri": "https://tool.example.com/lti/launch",
      "messages": [
        {
          "type": "LtiResourceLinkRequest",
          "label": "Updated Tool",
          "placements": ["course_navigation", "assignment_selection"]
        }
      ]
    }
  }'
```

**Success Response** (200 OK):
```json
{
  "client_id": "10000000000001",
  "application_type": "web",
  "client_name": "Updated Tool Name",
  "grant_types": ["client_credentials", "implicit"],
  "initiate_login_uri": "https://tool.example.com/lti/login",
  "redirect_uris": ["https://tool.example.com/lti/launch"],
  "response_types": ["id_token"],
  "jwks_uri": "https://tool.example.com/.well-known/jwks.json",
  "logo_uri": "https://tool.example.com/logo.png",
  "token_endpoint_auth_method": "private_key_jwt",
  "scope": "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly https://purl.imsglobal.org/spec/lti-ags/scope/lineitem openid",
  "https://purl.imsglobal.org/spec/lti-tool-configuration": {
    "domain": "tool.example.com",
    "target_link_uri": "https://tool.example.com/lti/launch",
    "claims": ["sub", "iss", "name", "email"],
    "messages": [
      {
        "type": "LtiResourceLinkRequest",
        "label": "Updated Tool",
        "placements": ["course_navigation", "assignment_selection"]
      }
    ]
  },
  "registration_client_uri": "https://canvas.instructure.com/api/lti/registrations/10000000000123"
}
```

**Error Response** (401 Unauthorized):
```json
{
  "errorMessage": "Invalid or expired access token"
}
```

**Error Response** (422 Unprocessable Entity):
```json
{
  "errors": [
    "client_name is required",
    "redirect_uris must contain at least one URI"
  ]
}
```

### Step 2: Administrator Reviews and Applies the Update

Once a Registration Update Request is created, administrators review it through the Canvas user interface. Canvas provides a view that compares the existing configuration to the new values, showing exactly what will change, including:

- New or removed placements
- Added or removed scopes (permissions)
- Updates to tool metadata (name, logo, etc.)

Administrators can then choose to accept the update, or ignore it.

When accepting an update, administrators can optionally overlay customizations such as:
- Custom display names
- Disabled placements
- Restricted scopes

Note: The update does not take effect until an administrator explicitly accepts it, ensuring that tools cannot make unauthorized changes to their configuration.

## Feature Flag

The LTI Registration Update feature is controlled by the `lti_dr_registrations_update` feature flag at the root account level. When this flag is disabled:

- The update endpoint returns a 404 error
- Existing update requests cannot be applied

## Important Considerations

### Configuration Replacement
When an update is applied, the **entire registration configuration is replaced**, not merged. The tool must send the complete desired configuration, including any settings that haven't changed.

### Administrator Overlays
Administrators may have made adjustments (like custom names or disabled placements) to the original registration. When accepting an update, administrators will review and potentially update these overlays to ensure they're still appropriate for the new configuration.

### Access Tokens
Tools must use a developer key access token with the appropriate registration scope (`https://purl.imsglobal.org/spec/lti-reg/scope/registration`) to submit updates. This token is separate from the registration token used during initial dynamic registration.

### Audit Trail
Canvas maintains a complete history of registration updates. This includes:
- When updates were requested
- Who applied them
- What changed in each update

## Use Cases

### Scenario 1: Adding a New Placement
A tool wants to add support for a new Canvas placement:

1. Tool submits update with new placement in the `messages` array
2. Administrator reviews and sees the new `assignment_menu` placement
3. Administrator accepts the update
4. Tool is now available in the assignment menu placement

### Scenario 2: Requesting Additional Scopes
A tool adds new features requiring additional LTI Advantage scopes:

1. Tool submits update with expanded `scope` field
2. Administrator reviews new scope requests
3. Administrator decides to accept but restrict one scope using overlay
4. Tool receives reduced scope set and can handle gracefully

## API Reference Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/lti/registrations/:registration_id/configuration` | GET | Retrieve current registration configuration |
| `/api/lti/registrations/:registration_id/configuration` | PUT | Submit a registration update request |
