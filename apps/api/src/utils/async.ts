import { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not forward a rejected promise to the error middleware, so an
// async handler that throws would hang the request instead of returning a 500.
// Every async route handler goes through this.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
