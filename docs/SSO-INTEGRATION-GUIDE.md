# HealthFlow Sunbird RC - SSO Integration Guide

**Version:** 1.0  
**Last Updated:** December 21, 2025

---

## Introduction

This guide provides instructions for third-party healthcare systems to integrate with HealthFlow Sunbird RC for Single Sign-On (SSO). We support both **SAML 2.0** and **OpenID Connect (OIDC)** for secure and seamless user authentication.

By integrating with our SSO service, you can:
- Provide a unified login experience for your users
- Securely access HealthFlow services
- Exchange user attributes and healthcare-specific claims

---

## Option 1: SAML 2.0 Integration

Ideal for enterprise healthcare systems (EHRs, EMRs) and other SAML-compliant applications.

### Your Action Required

1. **Configure Your System as a SAML Service Provider (SP):**
   - Use the metadata URL below to automatically configure your SP.

2. **Provide Your SP Metadata:**
   - Send us your SAML SP metadata file or URL.
   - We will use this to register your application in our system.

### HealthFlow IdP Metadata

| Parameter | Value |
|---|---|
| **Metadata URL** | `https://keycloak.healthflow.tech/realms/healthflow/protocol/saml/descriptor` |
| **Entity ID** | `https://keycloak.healthflow.tech/realms/healthflow` |
| **SSO Service URL** | `https://keycloak.healthflow.tech/realms/healthflow/protocol/saml` |
| **Binding** | `HTTP-POST` |
| **NameID Format** | `urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified` |
| **Signature Algorithm** | `RSA_SHA256` |

### Required Attributes

Your SAML assertion **must** include the following attributes:

| Attribute Name | Description |
|---|---|
| `email` | User's email address (primary identifier) |
| `firstName` | User's first name |
| `lastName` | User's last name |
| `licenseNumber` | (Optional) Medical license number |
| `facilityId` | (Optional) Healthcare facility ID |

---

## Option 2: OpenID Connect (OIDC) Integration

Recommended for modern web and mobile applications.

### Your Action Required

1. **Configure Your Application as an OIDC Client:**
   - Use the discovery URL below to automatically configure your client.

2. **Provide Your Redirect URIs:**
   - Send us a list of all valid `redirect_uri` values for your application.
   - Example: `https://yourapp.com/callback`, `https://yourapp.com/oauth2/redirect`

### HealthFlow OIDC Provider Configuration

| Parameter | Value |
|---|---|
| **Discovery URL** | `https://keycloak.healthflow.tech/realms/healthflow/.well-known/openid-configuration` |
| **Issuer** | `https://keycloak.healthflow.tech/realms/healthflow` |
| **Authorization Endpoint** | `.../protocol/openid-connect/auth` |
| **Token Endpoint** | `.../protocol/openid-connect/token` |
| **User Info Endpoint** | `.../protocol/openid-connect/userinfo` |
| **JWKS URI** | `.../protocol/openid-connect/certs` |

### Client Credentials

| Parameter | Value |
|---|---|
| **Client ID** | `healthcare-oidc-client` |
| **Client Secret** | `EsvHFigXyHBVzNdQcEVlctUheZtgsXWg` |
| **Response Types** | `code` (Authorization Code Flow) |
| **Grant Types** | `authorization_code`, `refresh_token`, `client_credentials` |
| **Scopes** | `openid`, `profile`, `email` |

### Custom Claims

We provide the following custom claims in the ID token and UserInfo response:

| Claim Name | Description |
|---|---|
| `healthcare_roles` | Array of the user's roles (e.g., `Doctor`, `Nurse`) |
| `license_number` | User's medical license number |
| `facility_id` | User's associated healthcare facility ID |

---

## Integration Workflow

1. **Initiate Login:** Your application redirects the user to our Authorization Endpoint.
2. **User Authentication:** The user logs in with their HealthFlow credentials.
3. **Consent:** The user grants your application access to their information.
4. **Token Exchange:** Your application receives an authorization code, which is exchanged for an ID token and access token.
5. **Access Resources:** Your application can now access HealthFlow APIs on behalf of the user.

---

## Support

For integration support, please contact the HealthFlow technical team and provide:
- Your application name
- The integration protocol you are using (SAML or OIDC)
- Your SP metadata or redirect URIs

We will work with you to complete the integration and test the SSO connection.
