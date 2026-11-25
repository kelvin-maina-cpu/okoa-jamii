import { Incident } from '../models/Incident.js';

export async function getIncidentAnalytics(input: { from?: Date; to?: Date }) {
  const now = new Date();
  const to = input.to ?? now;
  const from = input.from ?? new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  const range = { createdAt: { $gte: from, $lte: to } };
  const [facets] = await Incident.aggregate([
    { $match: range },
    { $facet: {
      summary: [{ $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: [{ $ne: ['$status', 'resolved'] }, 1, 0] } }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }, escalated: { $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] } } } }],
      byCategory: [{ $group: { _id: '$incidentType', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
      byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }],
      trend: [{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }],
      acknowledgement: [{ $match: { acknowledgedAt: { $type: 'date' }, createdAt: { $type: 'date' } } }, { $match: { $expr: { $gte: ['$acknowledgedAt', '$createdAt'] } } }, { $group: { _id: null, averageMinutes: { $avg: { $divide: [{ $subtract: ['$acknowledgedAt', '$createdAt'] }, 60_000] } }, sampleSize: { $sum: 1 } } }],
      resolution: [{ $match: { resolvedAt: { $type: 'date' }, createdAt: { $type: 'date' } } }, { $match: { $expr: { $gte: ['$resolvedAt', '$createdAt'] } } }, { $group: { _id: null, averageMinutes: { $avg: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 60_000] } }, sampleSize: { $sum: 1 } } }],
      locations: [
        { $match: { 'location.type': 'Point', 'location.coordinates.0': { $type: 'number' }, 'location.coordinates.1': { $type: 'number' } } },
        { $project: { longitude: { $arrayElemAt: ['$location.coordinates', 0] }, latitude: { $arrayElemAt: ['$location.coordinates', 1] } } },
        { $match: { $expr: { $and: [{ $gte: ['$latitude', -90] }, { $lte: ['$latitude', 90] }, { $gte: ['$longitude', -180] }, { $lte: ['$longitude', 180] }] } } },
        { $group: { _id: { latitude: { $round: ['$latitude', 1] }, longitude: { $round: ['$longitude', 1] } }, count: { $sum: 1 } } },
        { $match: { count: { $gte: 3 } } }, { $sort: { count: -1 } }, { $limit: 50 },
      ],
    } },
  ]);
  const summary = facets?.summary?.[0] ?? { total: 0, active: 0, resolved: 0, pending: 0, escalated: 0 };
  const acknowledgement = facets?.acknowledgement?.[0];
  const resolution = facets?.resolution?.[0];
  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    summary,
    byCategory: facets?.byCategory ?? [],
    byStatus: facets?.byStatus ?? [],
    trend: facets?.trend ?? [],
    responsePerformance: {
      acknowledgement: { averageMinutes: acknowledgement ? Math.round(acknowledgement.averageMinutes * 10) / 10 : null, sampleSize: acknowledgement?.sampleSize ?? 0 },
      resolution: { averageMinutes: resolution ? Math.round(resolution.averageMinutes * 10) / 10 : null, sampleSize: resolution?.sampleSize ?? 0 },
    },
    locationDistribution: (facets?.locations ?? []).map((entry: any) => ({ latitude: entry._id.latitude, longitude: entry._id.longitude, count: entry.count })),
    locationPrivacyThreshold: 3,
  };
}
