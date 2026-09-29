'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/Avatar';
import { ActionDialog } from '@/components/membership/ActionDialog';
import { AssignJobDialog } from '@/components/membership/AssignJobDialog';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { allTypes, isPending, roleLabel, statusLabel, statusTone, timelineLabel, typeLabel } from '@/lib/membership';
import type { GrantableRole, KennelMember, MembershipTimelineItem, OfficerPosition, Page } from '@/lib/types';
import { bleedCard, cn, formatDate } from '@/lib/utils';
import api, { errorMessage } from '@/services/api';

function describe(m: KennelMember) {
  if (isPending(m.status)) return `Asked to join ${formatDate(m.createdAt)}`;
  if (m.status === 'ACTIVE') return `Member since ${formatDate(m.startDate ?? m.approvedAt ?? m.createdAt)}`;
  if (m.status === 'SUSPENDED') {
    return m.suspendedUntil ? `Suspended until ${formatDate(m.suspendedUntil)}` : 'Suspended until reinstated';
  }
  return `${statusLabel[m.status]} ${formatDate(m.endDate ?? m.updatedAt)}`;
}

// One membership in the officer's members list, with the decisions the viewer
// is allowed to make. The server re-checks every permission.
export function MemberCard({
  membership: m,
  viewerId,
  permissions,
  positions,
  roleTitles,
  slug,
  onChanged,
}: {
  membership: KennelMember;
  viewerId: string;
  permissions: Set<string>;
  // Offices this kennel has defined. Empty unless the viewer may appoint.
  positions: OfficerPosition[];
  // What this kennel calls each standing role (D40).
  roleTitles: Partial<Record<GrantableRole, string>>;
  slug: string;
  onChanged: () => Promise<void>;
}) {
  const [timeline, setTimeline] = useState<MembershipTimelineItem[] | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const name = m.member.displayName;
  const self = m.member.id === viewerId;
  const pending = isPending(m.status);
  const current = m.status === 'ACTIVE' || m.status === 'INACTIVE';

  async function decide(action: string, body: Record<string, unknown>, success: string) {
    try {
      await api.post(`/memberships/${m.id}/${action}`, body);
      toast.success(success);
      await onChanged();
    } catch (err) {
      toast.error(errorMessage(err, 'That did not work'));
      throw err;
    }
  }

  // Offices and roles are both "what this member does here", so they are
  // handed out from one control; the API keeps them apart (office = a seat with
  // a term, role = a standing job) and re-checks the permission for each.
  const canAppoint = permissions.has('officer.appoint') && current;
  const canGrantRoles = permissions.has('kennel.manage') && current;

  async function toggleTimeline() {
    const next = !showTimeline;
    setShowTimeline(next);
    if (next && !timeline) {
      try {
        const res = await api.get<{ data: Page<MembershipTimelineItem> }>(`/memberships/${m.id}/timeline`);
        setTimeline(res.data.data.items);
      } catch (err) {
        toast.error(errorMessage(err, 'Could not load the timeline'));
        setShowTimeline(false);
      }
    }
  }

  const actions: React.ReactNode[] = [];
  if (!self) {
    if (pending && permissions.has('membership.review')) {
      actions.push(
        <ActionDialog
          key="approve"
          trigger={<Button data-testid="member-approve">Approve</Button>}
          title={`Approve ${name}?`}
          description="They become an active member straight away."
          confirmLabel="Approve"
          types={allTypes}
          defaultType={m.type}
          text={{ label: 'Note', placeholder: 'Visible in their membership timeline' }}
          onConfirm={({ type, text }) => decide('approve', { type, notes: text }, `${name} is now a member.`)}
        />,
        <ActionDialog
          key="reject"
          trigger={
            <Button variant="outline" data-testid="member-reject">
              Decline
            </Button>
          }
          title={`Decline ${name}'s request?`}
          description="They can ask again after the cooldown period."
          confirmLabel="Decline request"
          destructive
          text={{ label: 'Note to the hasher', placeholder: 'Why the request was declined' }}
          onConfirm={({ text }) => decide('reject', { notes: text }, 'Request declined.')}
        />,
      );
    }
    if (current && permissions.has('membership.suspend')) {
      actions.push(
        <ActionDialog
          key="suspend"
          trigger={
            <Button variant="outline" data-testid="member-suspend">
              Suspend
            </Button>
          }
          title={`Suspend ${name}?`}
          description="Their history stays. While suspended they hold no kennel roles or permissions."
          confirmLabel="Suspend"
          destructive
          text={{ label: 'Reason', required: true, placeholder: 'Recorded in the audit log and their timeline' }}
          until={{ label: 'Suspended until', hint: 'Leave empty to suspend until someone reinstates them.' }}
          onConfirm={({ text, until }) =>
            decide(
              'suspend',
              { reason: text, until: until ? new Date(`${until}T23:59:59`).toISOString() : null },
              `${name} is suspended.`,
            )
          }
        />,
      );
    }
    if ((m.status === 'SUSPENDED' || m.status === 'INACTIVE') && permissions.has('membership.suspend')) {
      actions.push(
        <ActionDialog
          key="reinstate"
          trigger={<Button data-testid="member-reinstate">Reinstate</Button>}
          title={`Reinstate ${name}?`}
          description="They return as an active member with their original join date."
          confirmLabel="Reinstate"
          text={{ label: 'Note' }}
          onConfirm={({ text }) => decide('reinstate', { notes: text }, `${name} is reinstated.`)}
        />,
      );
    }
    if ((current || m.status === 'SUSPENDED') && permissions.has('membership.remove')) {
      actions.push(
        <ActionDialog
          key="remove"
          trigger={
            <Button variant="ghost" className="text-destructive" data-testid="member-remove">
              Remove
            </Button>
          }
          title={`Remove ${name} from the kennel?`}
          description="Their past runs and reports stay attributed to them. They can ask to join again after the cooldown period."
          confirmLabel="Remove member"
          destructive
          text={{ label: 'Reason', required: true, placeholder: 'Recorded in the audit log and their timeline' }}
          onConfirm={({ text }) => decide('remove', { reason: text }, `${name} was removed.`)}
        />,
      );
    }
  }

  return (
    <Card className={cn(bleedCard, 'p-4')} data-testid="member-card">
      <div className="flex items-start gap-3">
        <Avatar name={name} src={m.member.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{name}</p>
            <Badge className={statusTone(m.status)}>{statusLabel[m.status]}</Badge>
            <Badge>{typeLabel[m.type]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{describe(m)}</p>

          {/* What they do here. An office carries a title and a term; a role is
              a standing job. Both are shown to anyone who can see the roll. */}
          {(m.offices.length > 0 || m.roles.length > 0) && (
            <ul className="mt-2 flex flex-wrap items-center gap-2" data-testid="member-offices">
              {m.offices.map((office) => (
                <li key={office.appointmentId}>
                  <Badge className="bg-accent text-accent-foreground">
                    {office.title}
                    {canAppoint && (
                      <ActionDialog
                        trigger={
                          <button
                            type="button"
                            className="-mr-1 ml-1.5 rounded-full px-1 hover:bg-accent-foreground/15"
                            aria-label={`End ${name}'s term as ${office.title}`}
                            data-testid="member-office-end"
                          >
                            ×
                          </button>
                        }
                        title={`End ${name}'s term as ${office.title}?`}
                        description="The appointment is recorded as ended and stays on the kennel's leadership timeline."
                        confirmLabel="End the term"
                        destructive
                        text={{ label: 'Reason', required: true, placeholder: 'Recorded in the audit log' }}
                        onConfirm={async ({ text }) => {
                          try {
                            await api.post(`/appointments/${office.appointmentId}/term-ended`, { reason: text });
                            toast.success(`${name} no longer holds ${office.title}.`);
                            await onChanged();
                          } catch (err) {
                            toast.error(errorMessage(err, 'Could not end that appointment'));
                            throw err;
                          }
                        }}
                      />
                    )}
                  </Badge>
                </li>
              ))}
              {m.roles.map((role) => (
                <li key={role.assignmentId}>
                  <Badge title={role.title ? roleLabel[role.role] : undefined}>
                    {role.title ?? roleLabel[role.role]}
                    {canGrantRoles && (
                      <ActionDialog
                        trigger={
                          <button
                            type="button"
                            className="-mr-1 ml-1.5 rounded-full px-1 hover:bg-foreground/10"
                            aria-label={`Take ${roleLabel[role.role]} from ${name}`}
                            data-testid="member-role-revoke"
                          >
                            ×
                          </button>
                        }
                        title={`Take ${roleLabel[role.role]} from ${name}?`}
                        description="The grant is recorded as revoked rather than deleted, so the history stays readable."
                        confirmLabel="Revoke the role"
                        destructive
                        text={{ label: 'Reason', required: true, placeholder: 'Recorded in the audit log' }}
                        onConfirm={async ({ text }) => {
                          try {
                            await api.post(`/roles/${role.assignmentId}/revoke`, { reason: text });
                            toast.success(`${name} no longer holds ${roleLabel[role.role]}.`);
                            await onChanged();
                          } catch (err) {
                            toast.error(errorMessage(err, 'Could not revoke that role'));
                            throw err;
                          }
                        }}
                      />
                    )}
                    {/* Kennels rename things. The authority is untouched; only
                        the word for it changes (D40). */}
                    {canGrantRoles && (
                      <ActionDialog
                        trigger={
                          <button
                            type="button"
                            className="-mr-1 ml-1 rounded-full px-1 hover:bg-foreground/10"
                            aria-label={`Rename ${role.title ?? roleLabel[role.role]}`}
                            data-testid="member-role-rename"
                          >
                            ✎
                          </button>
                        }
                        title={`Rename “${role.title ?? roleLabel[role.role]}”`}
                        description={`${name} keeps exactly the same authority — this is only the name your kennel uses for it. Leave it empty to go back to “${roleLabel[role.role]}”.`}
                        confirmLabel="Save the name"
                        text={{ label: 'Name', placeholder: roleLabel[role.role] }}
                        onConfirm={async ({ text }) => {
                          try {
                            await api.patch(`/roles/${role.assignmentId}`, { title: text.trim() || null });
                            toast.success('Saved.');
                            await onChanged();
                          } catch (err) {
                            toast.error(errorMessage(err, 'Could not rename that role'));
                            throw err;
                          }
                        }}
                      />
                    )}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          {pending && m.requestNote && <p className="mt-2 rounded-lg bg-muted p-3 text-sm">“{m.requestNote}”</p>}
          {m.status === 'SUSPENDED' && m.suspensionReason && (
            <p className="mt-2 text-sm">
              <span className="text-muted-foreground">Reason:</span> {m.suspensionReason}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {self ? <p className="text-sm text-muted-foreground">This is your membership.</p> : actions}
        {!self && (canAppoint || canGrantRoles) && (
          <AssignJobDialog
            member={m}
            slug={slug}
            positions={positions}
            canAppoint={canAppoint}
            canGrantRoles={canGrantRoles}
            roleTitles={roleTitles}
            onDone={onChanged}
          />
        )}
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => void toggleTimeline()}
          aria-expanded={showTimeline}
          data-testid="member-timeline"
        >
          <History className="h-4 w-4" aria-hidden />
          Timeline
        </Button>
      </div>

      {showTimeline && (
        <ol className="mt-3 space-y-3 border-l-2 border-border pl-4 text-sm" aria-busy={timeline === null}>
          {timeline === null ? (
            <li className="text-muted-foreground">Loading…</li>
          ) : (
            timeline.map((e) => (
              <li key={e.id}>
                <span className="font-medium">{timelineLabel[e.type] ?? e.type}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  <time dateTime={e.occurredAt}>{formatDate(e.occurredAt)}</time>
                  {e.actor && ` · by ${e.actor.displayName}`}
                </span>
                {e.note && <p className="text-muted-foreground">“{e.note}”</p>}
              </li>
            ))
          )}
        </ol>
      )}
    </Card>
  );
}
