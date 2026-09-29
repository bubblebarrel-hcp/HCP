# Annex 08B --- User Management Functional Requirements

**Document ID:** HCP-PB-08B\
**Parent Document:** Chapter 8 --- Functional Requirements
Specification\
**Domain:** User Management (`FR-USER-*`)\
**Status:** Draft

## 1. Purpose

This annex defines all functional requirements related to user identity,
personal profiles, preferences, account lifecycle, and participation
across multiple kennels.

## 2. Scope

-   User profile
-   Hash identity
-   Avatars
-   Bio
-   Privacy
-   Preferences
-   Multi-kennel membership
-   Statistics
-   Activity history
-   Data export
-   Account deactivation
-   Account deletion
-   User discovery
-   Verification badges

------------------------------------------------------------------------

# 3. Functional Requirements

## FR-USER-001 --- Create User Profile

**Description**\
The system shall automatically create a user profile immediately after
successful account registration.

**Business Rules**

-   One profile per account.
-   Profile cannot exist without an account.
-   Profile receives a globally unique identifier.

**Acceptance Criteria**

-   Profile created automatically.
-   Creation timestamp recorded.

------------------------------------------------------------------------

## FR-USER-002 --- Edit Profile

Users shall be able to edit:

-   First Name
-   Last Name
-   Preferred Display Name
-   Hash Name
-   Biography
-   Home City
-   Country
-   Pronouns (optional)
-   Date of Birth (optional)
-   Profile Visibility
-   Social Links (optional)

**Acceptance Criteria**

-   Validation enforced.
-   Changes saved immediately.
-   Audit timestamp updated.

------------------------------------------------------------------------

## FR-USER-003 --- Hash Name Management

Users may maintain one or more Hash Names.

**Business Rules**

-   One primary Hash Name.
-   Historical names retained.
-   Hash Names need not be globally unique.

------------------------------------------------------------------------

## FR-USER-004 --- Avatar Management

Supported formats:

-   JPEG
-   PNG
-   WEBP

Future support:

-   Animated avatars
-   Event frames

------------------------------------------------------------------------

## FR-USER-005 --- Profile Visibility

Visibility levels:

-   Public
-   Registered Users
-   Kennel Members
-   Private

Each field may have independent visibility.

------------------------------------------------------------------------

## FR-USER-006 --- Home Kennel

Users may designate a single Home Kennel while remaining members of
multiple kennels.

------------------------------------------------------------------------

## FR-USER-007 --- Multi-Kennel Membership

Users may belong to multiple kennels simultaneously.

Officer roles apply only within their assigned kennel.

------------------------------------------------------------------------

## FR-USER-008 --- User Statistics

Automatically maintained statistics include:

-   Runs Attended
-   Trails Laid
-   Reports Authored
-   Beer Checks Visited
-   Countries Hashed
-   Kennels Joined
-   Distance Covered
-   Elevation Climbed
-   Photos Uploaded
-   Videos Uploaded
-   Years Active

------------------------------------------------------------------------

## FR-USER-009 --- Activity Timeline

Timeline events include:

-   Joined Kennel
-   Attended Run
-   Laid Trail
-   Uploaded Media
-   Published Report
-   Earned Badge

Supports filtering and search.

------------------------------------------------------------------------

## FR-USER-010 --- Profile Completeness

Completeness score considers:

-   Avatar
-   Biography
-   Hash Name
-   Home Kennel
-   Language
-   Preferences

Completeness never blocks participation.

------------------------------------------------------------------------

## FR-USER-011 --- Data Export

Supported export formats:

-   JSON
-   CSV

Future:

-   PDF Activity Summary

------------------------------------------------------------------------

## FR-USER-012 --- Account Deactivation

Users may deactivate accounts while preserving historical participation.

------------------------------------------------------------------------

## FR-USER-013 --- Permanent Account Deletion

Personally identifiable information shall be removed or anonymized where
appropriate while preserving historical run integrity.

------------------------------------------------------------------------

## FR-USER-014 --- Verification Badges

Supported badges:

-   Verified Officer
-   Verified Hare
-   Verified Scribe
-   Platform Administrator
-   Community Contributor

------------------------------------------------------------------------

## FR-USER-015 --- User Discovery

Users may be searched by:

-   Hash Name
-   Real Name (if public)
-   Home Kennel
-   City
-   Country
-   Badge

Search shall respect privacy settings.

------------------------------------------------------------------------

# 4. Domain Completion Criteria

This domain is complete when users can manage identity, privacy,
participation across multiple kennels, historical records and data
portability.

------------------------------------------------------------------------

# Progress

-   Annex 08A --- Authentication ✅
-   Annex 08B --- User Management ✅
-   Next: Annex 08C --- Kennels
