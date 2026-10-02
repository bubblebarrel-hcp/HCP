import { Request, Response } from 'express';
import * as follows from '../services/follow.service';
import * as photos from '../services/hasher-photos.service';
import { ApiError, ok } from '../utils/http';

const actor = (req: Request) => {
  if (!req.user) throw ApiError.unauthorized();
  return { id: req.user.id, role: req.user.role };
};

const viewer = (req: Request) => (req.user ? { id: req.user.id, role: req.user.role } : undefined);

const paging = (req: Request) => req.query as unknown as { page: number; limit: number };

export async function profile(req: Request, res: Response) {
  return ok(res, { hasher: await follows.hasherProfile(viewer(req), req.params.id) });
}

// The state of one follow relationship. A public page is a Server Component
// rendered without a session (D42), so the button that sits on it has to ask
// for its own state from the browser.
export async function hasherFollowState(req: Request, res: Response) {
  return ok(res, await follows.followState(viewer(req), 'USER', req.params.id));
}

export async function kennelFollowState(req: Request, res: Response) {
  return ok(res, await follows.followState(viewer(req), 'KENNEL', req.params.slug));
}

export async function followHasher(req: Request, res: Response) {
  return ok(res, await follows.followUser(actor(req), req.params.id));
}

export async function unfollowHasher(req: Request, res: Response) {
  return ok(res, await follows.unfollowUser(actor(req), req.params.id));
}

export async function followers(req: Request, res: Response) {
  return ok(res, await follows.listFollowers(viewer(req), req.params.id, paging(req)));
}

export async function following(req: Request, res: Response) {
  return ok(res, await follows.listFollowing(viewer(req), req.params.id, paging(req)));
}

export async function followKennel(req: Request, res: Response) {
  return ok(res, await follows.followKennel(actor(req), req.params.slug));
}

export async function unfollowKennel(req: Request, res: Response) {
  return ok(res, await follows.unfollowKennel(actor(req), req.params.slug));
}

export async function kennelFollowers(req: Request, res: Response) {
  return ok(res, await follows.listKennelFollowers(viewer(req), req.params.slug, paging(req)));
}

// "Who do I follow" without having to know your own id first.
export async function myFollowing(req: Request, res: Response) {
  return ok(res, await follows.listFollowing(viewer(req), actor(req).id, paging(req)));
}

export async function myFollowers(req: Request, res: Response) {
  return ok(res, await follows.listFollowers(viewer(req), actor(req).id, paging(req)));
}

// The photo grid on a hasher's page (D57).
export async function hasherPhotos(req: Request, res: Response) {
  return ok(res, await photos.listPhotos(viewer(req), req.params.id, paging(req)));
}

// Follow requests: people waiting on a locked profile's yes (D57).
export async function requests(req: Request, res: Response) {
  return ok(res, await follows.listRequests(actor(req), paging(req)));
}

export async function approveRequest(req: Request, res: Response) {
  return ok(res, await follows.approveRequest(actor(req), req.params.followerId));
}

export async function declineRequest(req: Request, res: Response) {
  return ok(res, await follows.declineRequest(actor(req), req.params.followerId));
}

export async function removeFollower(req: Request, res: Response) {
  return ok(res, await follows.removeFollower(actor(req), req.params.followerId));
}
