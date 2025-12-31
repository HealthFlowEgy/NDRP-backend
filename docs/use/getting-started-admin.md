# Getting Started for Administrators

**Version:** 2.0  
**Last Updated:** December 2025

---

## Overview

This guide provides a step-by-step walkthrough for new administrators on how to set up and manage HealthFlow RC.

---

## 1. Access the Admin Portal

HealthFlow RC does not ship with a default admin portal. You can use the Keycloak admin console to manage users and roles, and the API to manage schemas and entities.

- **Keycloak Admin Console:** `https://keycloak.yourdomain.com/admin`

## 2. Create a New Realm

It is recommended to create a new realm for your HealthFlow RC deployment to isolate users and clients.

1. Log in to the Keycloak admin console.
2. Click on the `master` realm in the top-left corner and select `Add realm`.
3. Enter a name for your realm (e.g., `healthflow`) and click `Create`.

## 3. Create User Roles

Create roles for different types of users in your system (e.g., `admin`, `doctor`, `nurse`).

1. In your new realm, navigate to `Roles` and click `Add Role`.
2. Enter a role name and description.
3. Repeat for all required roles.

## 4. Create Clients

Create clients for your applications that will interact with HealthFlow RC.

1. Navigate to `Clients` and click `Create`.
2. Enter a client ID and select the protocol (SAML or OIDC).
3. Configure the client settings, including redirect URIs and access type.

## 5. Create Schemas

Use the Schema API to define the data models for your registries.

Refer to the [Managing Schemas](./managing-schemas.md) guide for detailed instructions.

## 6. Create Users

Create user accounts for your administrators and end-users.

1. Navigate to `Users` and click `Add user`.
2. Enter the user details and set a password.
3. Assign roles to the user in the `Role Mappings` tab.

---

**Copyright © 2025 HealthFlow Medical. All rights reserved.**
