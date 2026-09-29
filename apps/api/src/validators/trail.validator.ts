import Joi from 'joi';
import { uuid } from './common';

export const TRAIL_STYLES = ['LIVE_HARE', 'DEAD_HARE', 'A_TO_A', 'A_TO_B', 'OTHER'];
// GEOFENCE needs a server-verified location check; not built yet (D25).
export const RELEASE_MODES = ['AT_RUN_START', 'SCHEDULED', 'MANUAL', 'CHECK_IN'];
export const WAYPOINT_KINDS = ['START', 'FINISH', 'CHECKPOINT', 'REGROUP', 'HAZARD', 'SCENIC', 'ON_IN', 'OTHER'];
export const CHALK_SYMBOLS = [
  'ON_ON',
  'CHECK',
  'FALSE_TRAIL',
  'BACK_CHECK',
  'REGROUP',
  'BEER_NEAR',
  'TRUE_TRAIL',
  'ON_IN',
  'HAZARD',
  'CUSTOM',
];

const optionalText = (max: number) => Joi.string().trim().max(max).allow('', null);
const latitude = Joi.number().min(-90).max(90);
const longitude = Joi.number().min(-180).max(180);

// GeoJSON LineString, the planned route. Kept secret until release (BR-TRAIL-005).
const routeGeoJson = Joi.object({
  type: Joi.string().valid('LineString').required(),
  coordinates: Joi.array()
    .items(Joi.array().ordered(longitude.required(), latitude.required()).length(2))
    .min(2)
    .max(5000)
    .required(),
}).allow(null);

const trailFields = {
  name: Joi.string().trim().min(2).max(80),
  style: Joi.string().valid(...TRAIL_STYLES),
  estimatedDistanceM: Joi.number().integer().min(100).max(100_000).allow(null),
  estimatedDurationMin: Joi.number().integer().min(5).max(1440).allow(null),
  terrain: optionalText(120),
  notes: optionalText(4000),
  routeGeoJson,
  startLatitude: latitude.allow(null),
  startLongitude: longitude.allow(null),
  finishLatitude: latitude.allow(null),
  finishLongitude: longitude.allow(null),
  releaseMode: Joi.string().valid(...RELEASE_MODES),
  releaseAt: Joi.date().iso().allow(null),
  hares: Joi.array()
    .items(Joi.object({ userId: uuid.required(), isLead: Joi.boolean().default(false) }))
    .max(10)
    .unique('userId'),
};

export const createTrailSchema = Joi.object({
  ...trailFields,
  name: trailFields.name.default('Main Trail'),
  style: trailFields.style.default('DEAD_HARE'),
  releaseMode: trailFields.releaseMode.default('AT_RUN_START'),
});

export const updateTrailSchema = Joi.object(trailFields).min(1);

export const trailActionSchema = Joi.object({ reason: optionalText(500) });

export const waypointSchema = Joi.object({
  kind: Joi.string().valid(...WAYPOINT_KINDS).required(),
  label: optionalText(80),
  latitude: latitude.required(),
  longitude: longitude.required(),
  sequence: Joi.number().integer().min(0).max(1000),
  notes: optionalText(1000),
});

export const updateWaypointSchema = Joi.object({
  kind: Joi.string().valid(...WAYPOINT_KINDS),
  label: optionalText(80),
  latitude,
  longitude,
  sequence: Joi.number().integer().min(0).max(1000),
  notes: optionalText(1000),
}).min(1);

export const beerCheckSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80).required(),
  latitude: latitude.required(),
  longitude: longitude.required(),
  sequence: Joi.number().integer().min(0).max(1000),
  notes: optionalText(1000),
});

export const updateBeerCheckSchema = Joi.object({
  name: Joi.string().trim().min(1).max(80),
  latitude,
  longitude,
  sequence: Joi.number().integer().min(0).max(1000),
  notes: optionalText(1000),
}).min(1);

export const chalkSchema = Joi.object({
  symbol: Joi.string().valid(...CHALK_SYMBOLS).required(),
  customLabel: optionalText(60),
  latitude: latitude.required(),
  longitude: longitude.required(),
  bearingDeg: Joi.number().min(0).max(360).allow(null),
  sequence: Joi.number().integer().min(0).max(1000).allow(null),
});
