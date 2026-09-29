# Annex 08C --- Kennels Functional Requirements

**Document ID:** HCP-PB-08C\
**Parent:** Chapter 8 --- Functional Requirements Specification\
**Domain:** Kennels (`FR-KENNEL-*`)\
**Status:** Draft

## Purpose

Defines the lifecycle, governance, identity, discovery and
administration of Hash House Harrier kennels.

> **Core Product Principle:** Every kennel is a **Living Clubhouse**,
> not just a profile page.

## Scope

-   Creation & verification
-   Branding
-   Officer management
-   Discovery
-   Announcements
-   Calendar
-   Gallery
-   Statistics
-   Historical archive
-   Sister kennels
-   Clubhouse experience

## Functional Requirements

### FR-KENNEL-001 --- Create Kennel

The system shall allow eligible users to submit a kennel creation
request.

**Required:** Name, Short Name, Country, State/Province, City, Time
Zone, Description, Logo, Banner.

**Business Rules** - Creator becomes provisional administrator. -
Duplicate local kennel names are not permitted. - New kennels start as
Pending Verification.

------------------------------------------------------------------------

### FR-KENNEL-002 --- Verify Kennel

Support Pending, Community Verified, Officer Verified and Platform
Verified states. Verification confirms authenticity within HCP only.

------------------------------------------------------------------------

### FR-KENNEL-003 --- Kennel Profile

Each kennel shall expose a public profile containing branding, officers,
schedule, statistics, gallery, reports and upcoming runs.

------------------------------------------------------------------------

### FR-KENNEL-004 --- Living Clubhouse

Each kennel shall have a dynamic clubhouse containing: - Welcome
message - Countdown to next run - Live notice board - New member
welcomes - Active visitors - Recent trail reports - Featured photos -
Upcoming events - Club milestones - Configurable widgets

------------------------------------------------------------------------

### FR-KENNEL-005 --- Branding

Custom logo, banner, colors, motto and landing message.

------------------------------------------------------------------------

### FR-KENNEL-006 --- Officer Directory

Support Grand Master, Joint Master, RA, Hash Cash, Hash Scribe, Hare
Raiser, Trail Master, On Sec, Web Master, Committee Members and future
custom roles.

------------------------------------------------------------------------

### FR-KENNEL-007 --- Officer Assignment

Officer appointments shall include start/end dates and preserve
historical records.

------------------------------------------------------------------------

### FR-KENNEL-008 --- Announcements

Pinned, scheduled and categorized announcements.

------------------------------------------------------------------------

### FR-KENNEL-009 --- Calendar

Support weekly runs, campouts, AGMs, Interhash, Nash Hash, Red Dress
Runs, charity events and workshops.

------------------------------------------------------------------------

### FR-KENNEL-010 --- Gallery

Photo albums, videos and featured collections sourced from runs or
direct uploads.

------------------------------------------------------------------------

### FR-KENNEL-011 --- Statistics

Automatically maintain member counts, runs, trails, reports, countries
represented and media totals.

------------------------------------------------------------------------

### FR-KENNEL-012 --- Sister Kennels

Allow formal relationships with regional and international partner
kennels.

------------------------------------------------------------------------

### FR-KENNEL-013 --- Historical Archive

Preserve officers, reports, runs, awards, media and milestones
permanently.

------------------------------------------------------------------------

### FR-KENNEL-014 --- Discovery

Search by location, name, activity, meeting day and verification.

------------------------------------------------------------------------

### FR-KENNEL-015 --- Lifecycle

Draft → Pending Verification → Active → Inactive → Archived.

## Completion Criteria

A kennel can be created, verified, branded, managed, discovered and
preserved historically while functioning as a living digital clubhouse.
