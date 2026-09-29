-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "TrustLevel" AS ENUM ('UNVERIFIED', 'VERIFIED_EMAIL', 'VERIFIED_MEMBER', 'TRUSTED_VOLUNTEER', 'OFFICER_VERIFIED', 'ORGANIZATION_VERIFIED', 'PLATFORM_VERIFIED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('FEMALE', 'MALE', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "ProfileVisibility" AS ENUM ('PUBLIC', 'MEMBERS_ONLY', 'PRIVATE');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('LOCAL_KENNEL', 'REGIONAL_ASSOCIATION', 'NATIONAL_ASSOCIATION', 'CONTINENTAL_ASSOCIATION', 'INTERNATIONAL_COMMITTEE', 'WORKING_GROUP', 'HERITAGE_FOUNDATION', 'TEMPORARY_EVENT_COMMITTEE');

-- CreateEnum
CREATE TYPE "KennelStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "VerificationLevel" AS ENUM ('PENDING', 'COMMUNITY_VERIFIED', 'OFFICER_VERIFIED', 'PLATFORM_VERIFIED');

-- CreateEnum
CREATE TYPE "KennelVisibility" AS ENUM ('PUBLIC', 'UNLISTED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "RunVisibility" AS ENUM ('PUBLIC', 'MEMBERS_ONLY', 'INVITE_ONLY');

-- CreateEnum
CREATE TYPE "MediaModerationMode" AS ENUM ('IMMEDIATE', 'OFFICER_APPROVAL', 'AI_ASSISTED', 'COMMUNITY_REPORTING');

-- CreateEnum
CREATE TYPE "SisterKennelStatus" AS ENUM ('PROPOSED', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "MembershipType" AS ENUM ('FULL', 'ASSOCIATE', 'VISITING', 'HONORARY', 'LIFE', 'GUEST', 'VIRGIN', 'COMMITTEE');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('APPLICANT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'RESIGNED', 'REMOVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipTimelineType" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'OFFICER_APPOINTMENT', 'SUSPENSION', 'REINSTATEMENT', 'PROMOTION', 'TYPE_CHANGED', 'RESIGNATION', 'REMOVAL', 'HOME_KENNEL_TRANSFER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InvitationMethod" AS ENUM ('EMAIL', 'QR_CODE', 'LINK');

-- CreateEnum
CREATE TYPE "AffiliationType" AS ENUM ('VOLUNTEER', 'ADVISOR', 'EVENT_ORGANIZER', 'FORMER_OFFICER', 'HONORARY_GUEST', 'PARTNER_ORGANIZATION');

-- CreateEnum
CREATE TYPE "AppointmentMethod" AS ENUM ('APPOINTED', 'ELECTED', 'ACCLAIMED', 'INTERIM', 'FOUNDING');

-- CreateEnum
CREATE TYPE "RoleAssignmentStatus" AS ENUM ('NOMINATED', 'APPOINTED', 'ACTIVE', 'TERM_ENDED', 'RESIGNED', 'REVOKED', 'HISTORICAL');

-- CreateEnum
CREATE TYPE "ScopedRole" AS ENUM ('KENNEL_ADMIN', 'HARE', 'CO_HARE', 'SCRIBE', 'ASSISTANT_SCRIBE', 'REVIEWER', 'PHOTOGRAPHER', 'VOLUNTEER', 'MODERATOR', 'EVENT_ORGANIZER');

-- CreateEnum
CREATE TYPE "MotionStatus" AS ENUM ('DRAFT', 'OPEN', 'PASSED', 'FAILED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "VoteChoice" AS ENUM ('YES', 'NO', 'ABSTAIN');

-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('DRAFT', 'NOMINATIONS_OPEN', 'VOTING_OPEN', 'VOTING_CLOSED', 'CERTIFIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('NOMINATED', 'ACCEPTED', 'DECLINED', 'ELECTED', 'NOT_ELECTED');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('CONSTITUTION', 'BYLAW', 'POLICY', 'CODE_OF_CONDUCT');

-- CreateEnum
CREATE TYPE "PolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WEEKLY_RUN', 'FULL_MOON_RUN', 'RED_DRESS_RUN', 'CAMPOUT', 'AGM', 'INTERHASH', 'NASH_HASH', 'CHARITY', 'WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PLANNING', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'PREPARATION', 'LIVE', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'CHECKED_IN');

-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('INVITED', 'CONFIRMED', 'DECLINED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RunType" AS ENUM ('REGULAR', 'FULL_MOON', 'RED_DRESS', 'CAMPOUT', 'CHARITY', 'INTERHASH', 'NASH_HASH', 'THEMED', 'SPECIAL');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PLANNING', 'TRAIL_HIDDEN', 'TRAIL_RELEASED', 'CHECK_IN_OPEN', 'LIVE', 'CIRCLE', 'REPORTING', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('GOING', 'MAYBE', 'NOT_GOING', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CheckInMethod" AS ENUM ('GPS', 'QR', 'OFFICER', 'MANUAL');

-- CreateEnum
CREATE TYPE "TrailStatus" AS ENUM ('IDEA', 'DRAFT', 'PLANNING', 'REVIEW', 'LOCKED', 'HIDDEN', 'RELEASED', 'LIVE', 'COMPLETED', 'ARCHIVED', 'HISTORIC');

-- CreateEnum
CREATE TYPE "TrailStyle" AS ENUM ('LIVE_HARE', 'DEAD_HARE', 'A_TO_A', 'A_TO_B', 'OTHER');

-- CreateEnum
CREATE TYPE "ReleaseMode" AS ENUM ('AT_RUN_START', 'SCHEDULED', 'MANUAL', 'CHECK_IN', 'GEOFENCE');

-- CreateEnum
CREATE TYPE "WaypointKind" AS ENUM ('START', 'FINISH', 'CHECKPOINT', 'REGROUP', 'HAZARD', 'SCENIC', 'ON_IN', 'OTHER');

-- CreateEnum
CREATE TYPE "ChalkSymbol" AS ENUM ('ON_ON', 'CHECK', 'FALSE_TRAIL', 'BACK_CHECK', 'REGROUP', 'BEER_NEAR', 'TRUE_TRAIL', 'ON_IN', 'HAZARD', 'CUSTOM');

-- CreateEnum
CREATE TYPE "StoryCategory" AS ENUM ('TRAIL', 'BEER_CHECK', 'CIRCLE', 'VISITOR', 'AWARD', 'SONG', 'INCIDENT', 'HUMOR', 'SAFETY', 'HISTORICAL', 'GENERAL');

-- CreateEnum
CREATE TYPE "StorySource" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "TrailReportStatus" AS ENUM ('DRAFT', 'SCRIBE_EDITING', 'REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportContributorRole" AS ENUM ('ASSISTANT_SCRIBE', 'REVIEWER');

-- CreateEnum
CREATE TYPE "CapsuleStatus" AS ENUM ('PLANNED', 'PREPARING', 'LIVE', 'DRAFT', 'PENDING_PUBLICATION', 'PUBLISHED', 'ARCHIVED', 'LEGACY');

-- CreateEnum
CREATE TYPE "SupplementalType" AS ENUM ('PHOTO', 'SCANNED_NEWSLETTER', 'INTERVIEW', 'REFLECTION', 'DOCUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('PHOTO', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "UploadState" AS ENUM ('QUEUED', 'UPLOADING', 'PROCESSING', 'AVAILABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "ModerationState" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REPORTED');

-- CreateEnum
CREATE TYPE "MediaTargetType" AS ENUM ('RUN', 'TRAIL', 'WAYPOINT', 'BEER_CHECK', 'CIRCLE', 'STORY_ASSET', 'GALLERY', 'CAPSULE');

-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('KENNEL', 'EVENT', 'COMMITTEE', 'GOVERNANCE', 'RUN');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('MEMBERSHIP', 'RUN', 'TRAIL_RELEASE', 'REMINDER', 'REPORT', 'ANNOUNCEMENT', 'GOVERNANCE', 'EVENT', 'MEDIA', 'SAFETY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('CREATED', 'EVALUATED', 'QUEUED', 'BATCHED', 'DIGESTED', 'SCHEDULED', 'DELIVERED', 'READ', 'EXPIRED', 'SUPPRESSED');

-- CreateEnum
CREATE TYPE "DeliveryChannel" AS ENUM ('IN_APP', 'PUSH', 'EMAIL');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- CreateEnum
CREATE TYPE "EvidenceCategory" AS ENUM ('ATTENDANCE', 'IDENTITY', 'MEMBERSHIP', 'GOVERNANCE', 'FINANCIAL', 'HISTORICAL', 'GEOGRAPHICAL', 'MEDIA', 'AWARDS', 'VOLUNTEER_SERVICE', 'TRAIL_VERIFICATION', 'ADMINISTRATIVE', 'IMPORTED_RECORDS');

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'DISPUTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "AuditDecision" AS ENUM ('ALLOWED', 'DENIED');

-- CreateEnum
CREATE TYPE "AiSuggestionKind" AS ENUM ('TRAIL_REPORT_DRAFT', 'RUN_SUMMARY', 'TERM_EXPLANATION', 'SEARCH_ASSIST', 'GOVERNANCE_SUGGESTION', 'MODERATION_FLAG', 'PREPARATION_TIPS');

-- CreateEnum
CREATE TYPE "AiSuggestionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RECEIVED', 'APPLIED', 'CONFLICT', 'REJECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "trustLevel" "TrustLevel" NOT NULL DEFAULT 'UNVERIFIED',
    "emailVerifiedAt" TIMESTAMP(3),
    "hashHandle" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "profileVisibility" "ProfileVisibility" NOT NULL DEFAULT 'MEMBERS_ONLY',
    "homeKennelId" UUID,
    "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
    "timeZone" TEXT,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "gender" "Gender" NOT NULL,
    "phone" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "stateProvince" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "addressLine" TEXT,
    "occupation" TEXT,
    "languages" TEXT[],
    "emergencyContactName" TEXT NOT NULL,
    "emergencyContactPhone" TEXT NOT NULL,
    "emergencyContactRelationship" TEXT NOT NULL,
    "medicalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HashName" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAlias" BOOLEAN NOT NULL DEFAULT false,
    "kennelId" UUID,
    "bestowedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HashName_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestProfile" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "claimedByUserId" UUID,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HashPassport" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "shareToken" TEXT NOT NULL,
    "runsAttended" INTEGER NOT NULL DEFAULT 0,
    "trailsLaid" INTEGER NOT NULL DEFAULT 0,
    "beerChecks" INTEGER NOT NULL DEFAULT 0,
    "reportsWritten" INTEGER NOT NULL DEFAULT 0,
    "photosUploaded" INTEGER NOT NULL DEFAULT 0,
    "videosUploaded" INTEGER NOT NULL DEFAULT 0,
    "countriesHashed" INTEGER NOT NULL DEFAULT 0,
    "kennelsJoined" INTEGER NOT NULL DEFAULT 0,
    "distanceMeters" INTEGER NOT NULL DEFAULT 0,
    "statsUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HashPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportStamp" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "runId" UUID,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportStamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportMilestone" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "threshold" INTEGER NOT NULL,
    "runId" UUID,
    "reachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportMemory" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "refType" TEXT,
    "refId" UUID,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlaceVisited" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "country" TEXT NOT NULL,
    "stateProvince" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "kennelId" UUID,
    "firstVisitedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceVisited_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentityTimelineEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "refType" TEXT,
    "refId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Kennel" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "orgType" "OrganizationType" NOT NULL DEFAULT 'LOCAL_KENNEL',
    "parentId" UUID,
    "country" TEXT NOT NULL,
    "stateProvince" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "logoUrl" TEXT,
    "bannerUrl" TEXT,
    "primaryColor" TEXT,
    "secondaryColor" TEXT,
    "motto" TEXT,
    "landingMessage" TEXT,
    "meetingDay" TEXT,
    "foundedOn" DATE,
    "status" "KennelStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verificationLevel" "VerificationLevel" NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "visibility" "KennelVisibility" NOT NULL DEFAULT 'PUBLIC',
    "defaultRunVisibility" "RunVisibility" NOT NULL DEFAULT 'MEMBERS_ONLY',
    "mediaModerationMode" "MediaModerationMode" NOT NULL DEFAULT 'IMMEDIATE',
    "allowOfflineProvisionalRelease" BOOLEAN NOT NULL DEFAULT false,
    "hashDna" JSONB,
    "createdById" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kennel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SisterKennelRelationship" (
    "id" UUID NOT NULL,
    "kennelAId" UUID NOT NULL,
    "kennelBId" UUID NOT NULL,
    "status" "SisterKennelStatus" NOT NULL DEFAULT 'PROPOSED',
    "establishedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SisterKennelRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "type" "MembershipType" NOT NULL DEFAULT 'FULL',
    "status" "MembershipStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isHomeKennel" BOOLEAN NOT NULL DEFAULT false,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sponsorUserId" UUID,
    "approvedById" UUID,
    "approvedAt" TIMESTAMP(3),
    "approvalNotes" TEXT,
    "suspensionReason" TEXT,
    "suspendedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipTimelineEntry" (
    "id" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "type" "MembershipTimelineType" NOT NULL,
    "fromStatus" "MembershipStatus",
    "toStatus" "MembershipStatus",
    "actorId" UUID,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipInvitation" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "method" "InvitationMethod" NOT NULL,
    "email" TEXT,
    "tokenHash" TEXT NOT NULL,
    "membershipType" "MembershipType" NOT NULL DEFAULT 'FULL',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedByUserId" UUID,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAffiliation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AffiliationType" NOT NULL,
    "kennelId" UUID,
    "committeeId" UUID,
    "eventId" UUID,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAffiliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerPosition" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "responsibilities" TEXT,
    "permissions" TEXT[],
    "termMonths" INTEGER,
    "appointmentMethod" "AppointmentMethod" NOT NULL DEFAULT 'ELECTED',
    "isMismanagement" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerAppointment" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "membershipId" UUID,
    "status" "RoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "method" "AppointmentMethod" NOT NULL,
    "electionId" UUID,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "endedReason" TEXT,
    "appointedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ScopedRole" NOT NULL,
    "status" "RoleAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "membershipId" UUID,
    "kennelId" UUID,
    "runId" UUID,
    "eventId" UUID,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "grantedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delegation" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "delegatorId" UUID NOT NULL,
    "delegateId" UUID NOT NULL,
    "sourceAppointmentId" UUID,
    "sourceRoleAssignmentId" UUID,
    "permissions" TEXT[],
    "reason" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Delegation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Committee" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mandate" TEXT,
    "chairUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dissolvedAt" TIMESTAMP(3),

    CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" UUID NOT NULL,
    "committeeId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Motion" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "committeeId" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "MotionStatus" NOT NULL DEFAULT 'DRAFT',
    "proposedById" UUID NOT NULL,
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "outcomeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" UUID NOT NULL,
    "motionId" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Election" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ElectionStatus" NOT NULL DEFAULT 'DRAFT',
    "nominationsOpenAt" TIMESTAMP(3),
    "nominationsCloseAt" TIMESTAMP(3),
    "votingOpensAt" TIMESTAMP(3),
    "votingClosesAt" TIMESTAMP(3),
    "certifiedAt" TIMESTAMP(3),
    "certifiedById" UUID,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionCandidate" (
    "id" UUID NOT NULL,
    "electionId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "nominatedById" UUID,
    "status" "CandidateStatus" NOT NULL DEFAULT 'NOMINATED',
    "statement" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionVoterRecord" (
    "id" UUID NOT NULL,
    "electionId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "voterId" UUID NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionVoterRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionBallot" (
    "id" UUID NOT NULL,
    "electionId" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "candidateId" UUID,
    "castAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionBallot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingRecord" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "committeeId" UUID,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "minutes" TEXT,
    "recordedById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Policy" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "PolicyType" NOT NULL,
    "status" "PolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyRevision" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "summary" TEXT,
    "authorId" UUID NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "GlossaryTerm" (
    "id" UUID NOT NULL,
    "kennelId" UUID,
    "term" TEXT NOT NULL,
    "definition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlossaryTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "visibility" "RunVisibility" NOT NULL DEFAULT 'PUBLIC',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "venueName" TEXT,
    "venueAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "capacity" INTEGER,
    "registrationOpensAt" TIMESTAMP(3),
    "registrationClosesAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventHostKennel" (
    "eventId" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EventHostKennel_pkey" PRIMARY KEY ("eventId","kennelId")
);

-- CreateTable
CREATE TABLE "EventSession" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "userId" UUID,
    "guestId" UUID,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "ticketCode" TEXT NOT NULL,
    "ticketType" TEXT,
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sponsor" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sponsor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSponsor" (
    "eventId" UUID NOT NULL,
    "sponsorId" UUID NOT NULL,
    "tier" TEXT,

    CONSTRAINT "EventSponsor_pkey" PRIMARY KEY ("eventId","sponsorId")
);

-- CreateTable
CREATE TABLE "VolunteerAssignment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventId" UUID,
    "runId" UUID,
    "role" TEXT NOT NULL,
    "status" "VolunteerStatus" NOT NULL DEFAULT 'INVITED',
    "shiftStartsAt" TIMESTAMP(3),
    "shiftEndsAt" TIMESTAMP(3),
    "assignedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolunteerAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Run" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "eventId" UUID,
    "runNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "theme" TEXT,
    "runType" "RunType" NOT NULL DEFAULT 'REGULAR',
    "status" "RunStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "RunVisibility" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "meetingPointName" TEXT,
    "meetingAddress" TEXT,
    "meetingLatitude" DOUBLE PRECISION,
    "meetingLongitude" DOUBLE PRECISION,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "capacity" INTEGER,
    "allowGuests" BOOLEAN NOT NULL DEFAULT true,
    "allowVisitors" BOOLEAN NOT NULL DEFAULT true,
    "hashCash" TEXT,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "circleSkipReason" TEXT,
    "circleSkippedById" UUID,
    "weather" JSONB,
    "createdById" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "checkInOpenedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunHare" (
    "runId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunHare_pkey" PRIMARY KEY ("runId","userId")
);

-- CreateTable
CREATE TABLE "RunPause" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "pausedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resumedAt" TIMESTAMP(3),
    "reason" TEXT,
    "actorId" UUID NOT NULL,

    CONSTRAINT "RunPause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "userId" UUID,
    "guestId" UUID,
    "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'GOING',
    "isVisitor" BOOLEAN NOT NULL DEFAULT false,
    "homeKennelId" UUID,
    "isVirginRun" BOOLEAN NOT NULL DEFAULT false,
    "checkInMethod" "CheckInMethod",
    "checkedInAt" TIMESTAMP(3),
    "checkedInById" UUID,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circle" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "songs" TEXT[],
    "announcements" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Circle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "id" UUID NOT NULL,
    "circleId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT,
    "isDownDown" BOOLEAN NOT NULL DEFAULT false,
    "recipientUserId" UUID,
    "recipientGuestId" UUID,
    "recipientName" TEXT,
    "awardedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trail" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "style" "TrailStyle" NOT NULL DEFAULT 'DEAD_HARE',
    "status" "TrailStatus" NOT NULL DEFAULT 'IDEA',
    "estimatedDistanceM" INTEGER,
    "estimatedDurationMin" INTEGER,
    "terrain" TEXT,
    "routeGeoJson" JSONB,
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "finishLatitude" DOUBLE PRECISION,
    "finishLongitude" DOUBLE PRECISION,
    "notes" TEXT,
    "releaseMode" "ReleaseMode" NOT NULL DEFAULT 'AT_RUN_START',
    "releaseAt" TIMESTAMP(3),
    "geofenceLatitude" DOUBLE PRECISION,
    "geofenceLongitude" DOUBLE PRECISION,
    "geofenceRadiusM" INTEGER,
    "payloadKeyEncrypted" TEXT,
    "releasedAt" TIMESTAMP(3),
    "releasedById" UUID,
    "lockedAt" TIMESTAMP(3),
    "lockedById" UUID,
    "safetyReviewedAt" TIMESTAMP(3),
    "safetyReviewedById" UUID,
    "trailDna" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailHare" (
    "trailId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrailHare_pkey" PRIMARY KEY ("trailId","userId")
);

-- CreateTable
CREATE TABLE "Waypoint" (
    "id" UUID NOT NULL,
    "trailId" UUID NOT NULL,
    "kind" "WaypointKind" NOT NULL,
    "label" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "sequence" INTEGER NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Waypoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BeerCheck" (
    "id" UUID NOT NULL,
    "trailId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "sequence" INTEGER NOT NULL,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BeerCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalChalkSymbol" (
    "id" UUID NOT NULL,
    "trailId" UUID NOT NULL,
    "symbol" "ChalkSymbol" NOT NULL,
    "customLabel" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "bearingDeg" DOUBLE PRECISION,
    "sequence" INTEGER,
    "placedById" UUID NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,

    CONSTRAINT "DigitalChalkSymbol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailRevision" (
    "id" UUID NOT NULL,
    "trailId" UUID NOT NULL,
    "editorId" UUID NOT NULL,
    "changes" JSONB NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrailRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryAsset" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "category" "StoryCategory" NOT NULL,
    "source" "StorySource" NOT NULL,
    "body" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "contributorId" UUID,
    "trailReportId" UUID,
    "refType" TEXT,
    "refId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailReport" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "status" "TrailReportStatus" NOT NULL DEFAULT 'DRAFT',
    "officialScribeId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrailReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrailReportContributor" (
    "reportId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ReportContributorRole" NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrailReportContributor_pkey" PRIMARY KEY ("reportId","userId","role")
);

-- CreateTable
CREATE TABLE "ReportRevision" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "authorId" UUID NOT NULL,
    "aiAssisted" BOOLEAN NOT NULL DEFAULT false,
    "isPublication" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportReviewComment" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "anchor" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportReviewComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunCapsule" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "status" "CapsuleStatus" NOT NULL DEFAULT 'PLANNED',
    "isLegacyImport" BOOLEAN NOT NULL DEFAULT false,
    "trailReportId" UUID,
    "summary" TEXT,
    "timeline" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedById" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunCapsule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplementalArtifact" (
    "id" UUID NOT NULL,
    "capsuleId" UUID NOT NULL,
    "type" "SupplementalType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaAssetId" UUID,
    "contributorId" UUID NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplementalArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiSuggestion" (
    "id" UUID NOT NULL,
    "kind" "AiSuggestionKind" NOT NULL,
    "status" "AiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" UUID NOT NULL,
    "kennelId" UUID,
    "runId" UUID,
    "reportId" UUID,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "input" JSONB,
    "output" TEXT NOT NULL,
    "sourceRefs" JSONB,
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" UUID NOT NULL,
    "uploaderId" UUID,
    "clientId" TEXT,
    "kind" "MediaKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "thumbnailUrl" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "durationSec" DOUBLE PRECISION,
    "caption" TEXT,
    "license" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3),
    "uploadState" "UploadState" NOT NULL DEFAULT 'QUEUED',
    "moderationState" "ModerationState" NOT NULL DEFAULT 'PENDING',
    "moderatedById" UUID,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaLink" (
    "id" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "targetType" "MediaTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Gallery" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Channel" (
    "id" UUID NOT NULL,
    "type" "ChannelType" NOT NULL,
    "name" TEXT NOT NULL,
    "kennelId" UUID,
    "eventId" UUID,
    "committeeId" UUID,
    "runId" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Channel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMember" (
    "channelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mutedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelMember_pkey" PRIMARY KEY ("channelId","userId")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "channelId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "parentId" UUID,
    "body" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "recipientUserId" UUID,
    "recipientGuestId" UUID,
    "category" "NotificationCategory" NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'CREATED',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contextType" TEXT,
    "contextId" UUID,
    "domainEventId" UUID,
    "deliveryPolicy" TEXT,
    "evaluationReason" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id" UUID NOT NULL,
    "notificationId" UUID NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "DeliveryChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "kennelId" UUID,
    "eventId" UUID,
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KennelNotificationRule" (
    "id" UUID NOT NULL,
    "kennelId" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "KennelNotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDevice" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "pushToken" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRecord" (
    "id" UUID NOT NULL,
    "category" "EvidenceCategory" NOT NULL,
    "kennelId" UUID,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT,
    "description" TEXT,
    "confidence" DOUBLE PRECISION,
    "verificationStatus" "EvidenceStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" UUID,
    "verifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "chainOfCustody" JSONB,
    "mediaAssetId" UUID,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceLink" (
    "id" UUID NOT NULL,
    "evidenceId" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "actorType" "ActorType" NOT NULL DEFAULT 'USER',
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" UUID,
    "kennelId" UUID,
    "decision" "AuditDecision" NOT NULL DEFAULT 'ALLOWED',
    "previousState" JSONB,
    "newState" JSONB,
    "reason" TEXT,
    "policyRef" TEXT,
    "evidenceId" UUID,
    "domainEventId" UUID,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientOccurredAt" TIMESTAMP(3),
    "actorId" UUID,
    "actorType" "ActorType" NOT NULL DEFAULT 'USER',
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncOperation" (
    "id" UUID NOT NULL,
    "clientOperationId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "deviceId" TEXT,
    "operation" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'RECEIVED',
    "result" JSONB,
    "clientOccurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_hashHandle_idx" ON "User"("hashHandle");

-- CreateIndex
CREATE INDEX "User_homeKennelId_idx" ON "User"("homeKennelId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonProfile_userId_key" ON "PersonProfile"("userId");

-- CreateIndex
CREATE INDEX "HashName_userId_idx" ON "HashName"("userId");

-- CreateIndex
CREATE INDEX "HashName_name_idx" ON "HashName"("name");

-- CreateIndex
CREATE INDEX "GuestProfile_email_idx" ON "GuestProfile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "HashPassport_userId_key" ON "HashPassport"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "HashPassport_shareToken_key" ON "HashPassport"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "PassportStamp_passportId_code_key" ON "PassportStamp"("passportId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "PassportMilestone_passportId_threshold_key" ON "PassportMilestone"("passportId", "threshold");

-- CreateIndex
CREATE INDEX "PassportMemory_passportId_idx" ON "PassportMemory"("passportId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceVisited_passportId_country_stateProvince_city_key" ON "PlaceVisited"("passportId", "country", "stateProvince", "city");

-- CreateIndex
CREATE INDEX "IdentityTimelineEntry_userId_occurredAt_idx" ON "IdentityTimelineEntry"("userId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Kennel_slug_key" ON "Kennel"("slug");

-- CreateIndex
CREATE INDEX "Kennel_status_visibility_idx" ON "Kennel"("status", "visibility");

-- CreateIndex
CREATE INDEX "Kennel_country_city_idx" ON "Kennel"("country", "city");

-- CreateIndex
CREATE UNIQUE INDEX "Kennel_name_city_country_key" ON "Kennel"("name", "city", "country");

-- CreateIndex
CREATE UNIQUE INDEX "SisterKennelRelationship_kennelAId_kennelBId_key" ON "SisterKennelRelationship"("kennelAId", "kennelBId");

-- CreateIndex
CREATE INDEX "Membership_userId_kennelId_idx" ON "Membership"("userId", "kennelId");

-- CreateIndex
CREATE INDEX "Membership_kennelId_status_idx" ON "Membership"("kennelId", "status");

-- CreateIndex
CREATE INDEX "MembershipTimelineEntry_membershipId_occurredAt_idx" ON "MembershipTimelineEntry"("membershipId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipInvitation_tokenHash_key" ON "MembershipInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "MembershipInvitation_kennelId_idx" ON "MembershipInvitation"("kennelId");

-- CreateIndex
CREATE INDEX "OrganizationAffiliation_userId_idx" ON "OrganizationAffiliation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerPosition_kennelId_title_key" ON "OfficerPosition"("kennelId", "title");

-- CreateIndex
CREATE INDEX "OfficerAppointment_kennelId_status_idx" ON "OfficerAppointment"("kennelId", "status");

-- CreateIndex
CREATE INDEX "OfficerAppointment_userId_idx" ON "OfficerAppointment"("userId");

-- CreateIndex
CREATE INDEX "RoleAssignment_userId_status_idx" ON "RoleAssignment"("userId", "status");

-- CreateIndex
CREATE INDEX "RoleAssignment_kennelId_role_status_idx" ON "RoleAssignment"("kennelId", "role", "status");

-- CreateIndex
CREATE INDEX "RoleAssignment_runId_idx" ON "RoleAssignment"("runId");

-- CreateIndex
CREATE INDEX "Delegation_delegateId_expiresAt_idx" ON "Delegation"("delegateId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Committee_kennelId_name_key" ON "Committee"("kennelId", "name");

-- CreateIndex
CREATE INDEX "CommitteeMember_committeeId_idx" ON "CommitteeMember"("committeeId");

-- CreateIndex
CREATE INDEX "Motion_kennelId_status_idx" ON "Motion"("kennelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_motionId_voterId_key" ON "Vote"("motionId", "voterId");

-- CreateIndex
CREATE INDEX "Election_kennelId_status_idx" ON "Election"("kennelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionCandidate_electionId_positionId_userId_key" ON "ElectionCandidate"("electionId", "positionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionVoterRecord_electionId_positionId_voterId_key" ON "ElectionVoterRecord"("electionId", "positionId", "voterId");

-- CreateIndex
CREATE INDEX "ElectionBallot_electionId_positionId_idx" ON "ElectionBallot"("electionId", "positionId");

-- CreateIndex
CREATE INDEX "MeetingRecord_kennelId_heldAt_idx" ON "MeetingRecord"("kennelId", "heldAt");

-- CreateIndex
CREATE INDEX "Policy_kennelId_type_idx" ON "Policy"("kennelId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRevision_policyId_version_key" ON "PolicyRevision"("policyId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "GlossaryTerm_kennelId_term_key" ON "GlossaryTerm"("kennelId", "term");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_idx" ON "Event"("status", "startsAt");

-- CreateIndex
CREATE INDEX "EventSession_eventId_startsAt_idx" ON "EventSession"("eventId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_ticketCode_key" ON "Registration"("ticketCode");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_userId_key" ON "Registration"("eventId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_eventId_guestId_key" ON "Registration"("eventId", "guestId");

-- CreateIndex
CREATE INDEX "VolunteerAssignment_userId_idx" ON "VolunteerAssignment"("userId");

-- CreateIndex
CREATE INDEX "VolunteerAssignment_runId_idx" ON "VolunteerAssignment"("runId");

-- CreateIndex
CREATE INDEX "VolunteerAssignment_eventId_idx" ON "VolunteerAssignment"("eventId");

-- CreateIndex
CREATE INDEX "Run_status_startsAt_idx" ON "Run"("status", "startsAt");

-- CreateIndex
CREATE INDEX "Run_kennelId_startsAt_idx" ON "Run"("kennelId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Run_kennelId_runNumber_key" ON "Run"("kennelId", "runNumber");

-- CreateIndex
CREATE INDEX "RunPause_runId_idx" ON "RunPause"("runId");

-- CreateIndex
CREATE INDEX "Participation_userId_idx" ON "Participation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_runId_userId_key" ON "Participation"("runId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_runId_guestId_key" ON "Participation"("runId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "Circle_runId_key" ON "Circle"("runId");

-- CreateIndex
CREATE INDEX "Award_circleId_idx" ON "Award"("circleId");

-- CreateIndex
CREATE INDEX "Trail_status_idx" ON "Trail"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Trail_runId_name_key" ON "Trail"("runId", "name");

-- CreateIndex
CREATE INDEX "Waypoint_trailId_sequence_idx" ON "Waypoint"("trailId", "sequence");

-- CreateIndex
CREATE INDEX "BeerCheck_trailId_sequence_idx" ON "BeerCheck"("trailId", "sequence");

-- CreateIndex
CREATE INDEX "DigitalChalkSymbol_trailId_idx" ON "DigitalChalkSymbol"("trailId");

-- CreateIndex
CREATE INDEX "TrailRevision_trailId_createdAt_idx" ON "TrailRevision"("trailId", "createdAt");

-- CreateIndex
CREATE INDEX "StoryAsset_runId_occurredAt_idx" ON "StoryAsset"("runId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrailReport_runId_key" ON "TrailReport"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportRevision_reportId_version_key" ON "ReportRevision"("reportId", "version");

-- CreateIndex
CREATE INDEX "ReportReviewComment_reportId_idx" ON "ReportReviewComment"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "RunCapsule_runId_key" ON "RunCapsule"("runId");

-- CreateIndex
CREATE UNIQUE INDEX "RunCapsule_trailReportId_key" ON "RunCapsule"("trailReportId");

-- CreateIndex
CREATE INDEX "SupplementalArtifact_capsuleId_idx" ON "SupplementalArtifact"("capsuleId");

-- CreateIndex
CREATE INDEX "AiSuggestion_kind_status_idx" ON "AiSuggestion"("kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MediaAsset_clientId_key" ON "MediaAsset"("clientId");

-- CreateIndex
CREATE INDEX "MediaAsset_uploaderId_idx" ON "MediaAsset"("uploaderId");

-- CreateIndex
CREATE INDEX "MediaAsset_uploadState_moderationState_idx" ON "MediaAsset"("uploadState", "moderationState");

-- CreateIndex
CREATE INDEX "MediaLink_targetType_targetId_idx" ON "MediaLink"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaLink_mediaId_targetType_targetId_key" ON "MediaLink"("mediaId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "Gallery_kennelId_idx" ON "Gallery"("kennelId");

-- CreateIndex
CREATE INDEX "Announcement_kennelId_publishedAt_idx" ON "Announcement"("kennelId", "publishedAt");

-- CreateIndex
CREATE INDEX "Message_channelId_createdAt_idx" ON "Message"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_status_createdAt_idx" ON "Notification"("recipientUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_domainEventId_idx" ON "Notification"("domainEventId");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_idx" ON "NotificationDelivery"("status");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_category_channel_kennelId_eve_key" ON "NotificationPreference"("userId", "category", "channel", "kennelId", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "KennelNotificationRule_kennelId_category_key" ON "KennelNotificationRule"("kennelId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "PushDevice_pushToken_key" ON "PushDevice"("pushToken");

-- CreateIndex
CREATE INDEX "PushDevice_userId_idx" ON "PushDevice"("userId");

-- CreateIndex
CREATE INDEX "EvidenceRecord_category_verificationStatus_idx" ON "EvidenceRecord"("category", "verificationStatus");

-- CreateIndex
CREATE INDEX "EvidenceLink_subjectType_subjectId_idx" ON "EvidenceLink"("subjectType", "subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceLink_evidenceId_subjectType_subjectId_key" ON "EvidenceLink"("evidenceId", "subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "AuditLog_resourceType_resourceId_createdAt_idx" ON "AuditLog"("resourceType", "resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_kennelId_createdAt_idx" ON "AuditLog"("kennelId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "DomainEvent_aggregateType_aggregateId_occurredAt_idx" ON "DomainEvent"("aggregateType", "aggregateId", "occurredAt");

-- CreateIndex
CREATE INDEX "DomainEvent_publishedAt_occurredAt_idx" ON "DomainEvent"("publishedAt", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_clientOperationId_key" ON "SyncOperation"("clientOperationId");

-- CreateIndex
CREATE INDEX "SyncOperation_userId_receivedAt_idx" ON "SyncOperation"("userId", "receivedAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_homeKennelId_fkey" FOREIGN KEY ("homeKennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonProfile" ADD CONSTRAINT "PersonProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashName" ADD CONSTRAINT "HashName_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestProfile" ADD CONSTRAINT "GuestProfile_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashPassport" ADD CONSTRAINT "HashPassport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportStamp" ADD CONSTRAINT "PassportStamp_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "HashPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportMilestone" ADD CONSTRAINT "PassportMilestone_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "HashPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportMemory" ADD CONSTRAINT "PassportMemory_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "HashPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaceVisited" ADD CONSTRAINT "PlaceVisited_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "HashPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentityTimelineEntry" ADD CONSTRAINT "IdentityTimelineEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Kennel" ADD CONSTRAINT "Kennel_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisterKennelRelationship" ADD CONSTRAINT "SisterKennelRelationship_kennelAId_fkey" FOREIGN KEY ("kennelAId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SisterKennelRelationship" ADD CONSTRAINT "SisterKennelRelationship_kennelBId_fkey" FOREIGN KEY ("kennelBId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipTimelineEntry" ADD CONSTRAINT "MembershipTimelineEntry_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipInvitation" ADD CONSTRAINT "MembershipInvitation_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAffiliation" ADD CONSTRAINT "OrganizationAffiliation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAffiliation" ADD CONSTRAINT "OrganizationAffiliation_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAffiliation" ADD CONSTRAINT "OrganizationAffiliation_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAffiliation" ADD CONSTRAINT "OrganizationAffiliation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerPosition" ADD CONSTRAINT "OfficerPosition_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerAppointment" ADD CONSTRAINT "OfficerAppointment_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerAppointment" ADD CONSTRAINT "OfficerAppointment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OfficerPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerAppointment" ADD CONSTRAINT "OfficerAppointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerAppointment" ADD CONSTRAINT "OfficerAppointment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerAppointment" ADD CONSTRAINT "OfficerAppointment_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleAssignment" ADD CONSTRAINT "RoleAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegatorId_fkey" FOREIGN KEY ("delegatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_delegateId_fkey" FOREIGN KEY ("delegateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_sourceAppointmentId_fkey" FOREIGN KEY ("sourceAppointmentId") REFERENCES "OfficerAppointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delegation" ADD CONSTRAINT "Delegation_sourceRoleAssignmentId_fkey" FOREIGN KEY ("sourceRoleAssignmentId") REFERENCES "RoleAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Committee" ADD CONSTRAINT "Committee_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motion" ADD CONSTRAINT "Motion_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motion" ADD CONSTRAINT "Motion_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Motion" ADD CONSTRAINT "Motion_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_motionId_fkey" FOREIGN KEY ("motionId") REFERENCES "Motion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Election" ADD CONSTRAINT "Election_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OfficerPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVoterRecord" ADD CONSTRAINT "ElectionVoterRecord_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVoterRecord" ADD CONSTRAINT "ElectionVoterRecord_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OfficerPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionVoterRecord" ADD CONSTRAINT "ElectionVoterRecord_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionBallot" ADD CONSTRAINT "ElectionBallot_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionBallot" ADD CONSTRAINT "ElectionBallot_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OfficerPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionBallot" ADD CONSTRAINT "ElectionBallot_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ElectionCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecord" ADD CONSTRAINT "MeetingRecord_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingRecord" ADD CONSTRAINT "MeetingRecord_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Policy" ADD CONSTRAINT "Policy_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRevision" ADD CONSTRAINT "PolicyRevision_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "Policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyRevision" ADD CONSTRAINT "PolicyRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlossaryTerm" ADD CONSTRAINT "GlossaryTerm_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventHostKennel" ADD CONSTRAINT "EventHostKennel_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventHostKennel" ADD CONSTRAINT "EventHostKennel_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSponsor" ADD CONSTRAINT "EventSponsor_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSponsor" ADD CONSTRAINT "EventSponsor_sponsorId_fkey" FOREIGN KEY ("sponsorId") REFERENCES "Sponsor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VolunteerAssignment" ADD CONSTRAINT "VolunteerAssignment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunHare" ADD CONSTRAINT "RunHare_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunHare" ADD CONSTRAINT "RunHare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunPause" ADD CONSTRAINT "RunPause_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circle" ADD CONSTRAINT "Circle_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "Circle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_recipientGuestId_fkey" FOREIGN KEY ("recipientGuestId") REFERENCES "GuestProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trail" ADD CONSTRAINT "Trail_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailHare" ADD CONSTRAINT "TrailHare_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailHare" ADD CONSTRAINT "TrailHare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Waypoint" ADD CONSTRAINT "Waypoint_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BeerCheck" ADD CONSTRAINT "BeerCheck_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalChalkSymbol" ADD CONSTRAINT "DigitalChalkSymbol_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalChalkSymbol" ADD CONSTRAINT "DigitalChalkSymbol_placedById_fkey" FOREIGN KEY ("placedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailRevision" ADD CONSTRAINT "TrailRevision_trailId_fkey" FOREIGN KEY ("trailId") REFERENCES "Trail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailRevision" ADD CONSTRAINT "TrailRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAsset" ADD CONSTRAINT "StoryAsset_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAsset" ADD CONSTRAINT "StoryAsset_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryAsset" ADD CONSTRAINT "StoryAsset_trailReportId_fkey" FOREIGN KEY ("trailReportId") REFERENCES "TrailReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailReport" ADD CONSTRAINT "TrailReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailReport" ADD CONSTRAINT "TrailReport_officialScribeId_fkey" FOREIGN KEY ("officialScribeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailReportContributor" ADD CONSTRAINT "TrailReportContributor_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TrailReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrailReportContributor" ADD CONSTRAINT "TrailReportContributor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TrailReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRevision" ADD CONSTRAINT "ReportRevision_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportReviewComment" ADD CONSTRAINT "ReportReviewComment_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TrailReport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportReviewComment" ADD CONSTRAINT "ReportReviewComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunCapsule" ADD CONSTRAINT "RunCapsule_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunCapsule" ADD CONSTRAINT "RunCapsule_trailReportId_fkey" FOREIGN KEY ("trailReportId") REFERENCES "TrailReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementalArtifact" ADD CONSTRAINT "SupplementalArtifact_capsuleId_fkey" FOREIGN KEY ("capsuleId") REFERENCES "RunCapsule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementalArtifact" ADD CONSTRAINT "SupplementalArtifact_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplementalArtifact" ADD CONSTRAINT "SupplementalArtifact_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiSuggestion" ADD CONSTRAINT "AiSuggestion_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "TrailReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaLink" ADD CONSTRAINT "MediaLink_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "MediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gallery" ADD CONSTRAINT "Gallery_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Channel" ADD CONSTRAINT "Channel_runId_fkey" FOREIGN KEY ("runId") REFERENCES "Run"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMember" ADD CONSTRAINT "ChannelMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "Channel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientGuestId_fkey" FOREIGN KEY ("recipientGuestId") REFERENCES "GuestProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KennelNotificationRule" ADD CONSTRAINT "KennelNotificationRule_kennelId_fkey" FOREIGN KEY ("kennelId") REFERENCES "Kennel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDevice" ADD CONSTRAINT "PushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRecord" ADD CONSTRAINT "EvidenceRecord_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "MediaAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceLink" ADD CONSTRAINT "EvidenceLink_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
