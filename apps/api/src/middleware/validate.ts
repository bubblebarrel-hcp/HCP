import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { ApiError } from '../utils/http';

type Source = 'body' | 'query' | 'params';

export function validate(schema: Joi.ObjectSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return next(
        ApiError.badRequest(error.details.map((d) => d.message).join('; '), 'VALIDATION_ERROR'),
      );
    }

    if (source === 'body') {
      req.body = value;
    } else {
      // req.query is a getter in Express 5 but writable in 4; mutate in place so
      // this keeps working if the major is bumped.
      Object.assign(req[source] as Record<string, unknown>, value);
    }
    return next();
  };
}
